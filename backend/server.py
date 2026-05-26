from fastapi import FastAPI, APIRouter, HTTPException, Request, Query
from fastapi.responses import StreamingResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy import (
    Column, String, Float, DateTime, JSON, Text, UniqueConstraint, select, delete,
)
from sqlalchemy.orm import declarative_base
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Base de datos: usa DATABASE_URL si está definido (MySQL/MariaDB),
# permite fallback a MongoDB MONGO_URL si la app se despliega con Mongo.
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"sqlite+aiosqlite:///{ROOT_DIR / 'televix.db'}",
)
IS_SQLITE = DATABASE_URL.startswith("sqlite")


def _upsert(table, payload, update_keys, conflict_cols):
    """INSERT con upsert compatible MySQL/MariaDB y SQLite."""
    if IS_SQLITE:
        stmt = sqlite_insert(table).values(**payload)
        return stmt.on_conflict_do_update(
            index_elements=conflict_cols,
            set_={k: stmt.excluded[k] for k in update_keys},
        )
    stmt = mysql_insert(table).values(**payload)
    return stmt.on_duplicate_key_update(**{k: stmt.inserted[k] for k in update_keys})

Base = declarative_base()


class FavoriteRow(Base):
    __tablename__ = "favorites"
    id = Column(String(36), primary_key=True)
    client_id = Column(String(64), nullable=False, index=True)
    type = Column(String(16), nullable=False)
    stream_id = Column(String(64), nullable=False)
    name = Column(String(512), nullable=False)
    icon = Column(Text)
    extra = Column(JSON)
    created_at = Column(DateTime, nullable=False)
    __table_args__ = (UniqueConstraint("client_id", "type", "stream_id", name="uq_fav"),)


class HistoryRow(Base):
    __tablename__ = "history"
    id = Column(String(36), primary_key=True)
    client_id = Column(String(64), nullable=False, index=True)
    type = Column(String(16), nullable=False)
    stream_id = Column(String(64), nullable=False)
    name = Column(String(512), nullable=False)
    icon = Column(Text)
    position = Column(Float, default=0.0)
    duration = Column(Float, default=0.0)
    extra = Column(JSON)
    updated_at = Column(DateTime, nullable=False, index=True)
    __table_args__ = (UniqueConstraint("client_id", "type", "stream_id", name="uq_hist"),)


engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=1800)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


app = FastAPI(title="TV Stream API")
api_router = APIRouter(prefix="/api")

# Shared HTTP client
http_client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0), follow_redirects=True)


@app.on_event("startup")
async def _init_db():
    """Crea las tablas si no existen al arrancar."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# ------------------- Models -------------------
class XtreamCreds(BaseModel):
    server: str  # full url with http/https, no trailing slash required
    username: str
    password: str


class XtreamCategoryQuery(XtreamCreds):
    type: str  # live | vod | series


class XtreamStreamsQuery(XtreamCreds):
    type: str  # live | vod | series
    category_id: Optional[str] = None


class XtreamVodInfoQuery(XtreamCreds):
    vod_id: int


class XtreamSeriesInfoQuery(XtreamCreds):
    series_id: int


class XtreamEpgQuery(XtreamCreds):
    stream_id: int
    limit: Optional[int] = 10


class M3UQuery(BaseModel):
    url: str


class FavoriteItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    type: str  # live | vod | series
    stream_id: str
    name: str
    icon: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FavoriteCreate(BaseModel):
    client_id: str
    type: str
    stream_id: str
    name: str
    icon: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


class HistoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    type: str
    stream_id: str
    name: str
    icon: Optional[str] = None
    position: float = 0.0
    duration: float = 0.0
    extra: Optional[Dict[str, Any]] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class HistoryUpsert(BaseModel):
    client_id: str
    type: str
    stream_id: str
    name: str
    icon: Optional[str] = None
    position: float = 0.0
    duration: float = 0.0
    extra: Optional[Dict[str, Any]] = None


# ------------------- Helpers -------------------
def _normalize_server(server: str) -> str:
    s = server.strip().rstrip('/')
    if not s.startswith('http://') and not s.startswith('https://'):
        s = 'http://' + s
    return s


async def xtream_call(creds: XtreamCreds, action: Optional[str] = None, extra: Optional[Dict[str, Any]] = None) -> Any:
    server = _normalize_server(creds.server)
    params = {"username": creds.username, "password": creds.password}
    if action:
        params["action"] = action
    if extra:
        params.update(extra)
    url = f"{server}/player_api.php"
    try:
        r = await http_client.get(url, params=params)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al contactar el servidor: {e}")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"El servidor respondió con estado {r.status_code}")
    try:
        return r.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Respuesta no válida del servidor Xtream")


# ------------------- Xtream Routes -------------------
@api_router.get("/")
async def root():
    return {"message": "TV Stream API"}


@api_router.post("/xtream/login")
async def xtream_login(creds: XtreamCreds):
    data = await xtream_call(creds)
    if not isinstance(data, dict) or "user_info" not in data:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    ui = data.get("user_info", {})
    if str(ui.get("auth", 0)) != "1":
        raise HTTPException(status_code=401, detail="Usuario no autorizado")
    return data


@api_router.post("/xtream/categories")
async def xtream_categories(q: XtreamCategoryQuery):
    action_map = {
        "live": "get_live_categories",
        "vod": "get_vod_categories",
        "series": "get_series_categories",
    }
    action = action_map.get(q.type)
    if not action:
        raise HTTPException(status_code=400, detail="Tipo inválido")
    return await xtream_call(q, action=action)


@api_router.post("/xtream/streams")
async def xtream_streams(q: XtreamStreamsQuery):
    action_map = {
        "live": "get_live_streams",
        "vod": "get_vod_streams",
        "series": "get_series",
    }
    action = action_map.get(q.type)
    if not action:
        raise HTTPException(status_code=400, detail="Tipo inválido")
    extra = {"category_id": q.category_id} if q.category_id else None
    return await xtream_call(q, action=action, extra=extra)


@api_router.post("/xtream/vod-info")
async def xtream_vod_info(q: XtreamVodInfoQuery):
    return await xtream_call(q, action="get_vod_info", extra={"vod_id": q.vod_id})


@api_router.post("/xtream/series-info")
async def xtream_series_info(q: XtreamSeriesInfoQuery):
    return await xtream_call(q, action="get_series_info", extra={"series_id": q.series_id})


@api_router.post("/xtream/epg")
async def xtream_epg(q: XtreamEpgQuery):
    return await xtream_call(
        q,
        action="get_short_epg",
        extra={"stream_id": q.stream_id, "limit": q.limit or 10},
    )


# ------------------- M3U Parser -------------------
@api_router.post("/m3u/parse")
async def m3u_parse(q: M3UQuery):
    try:
        r = await http_client.get(q.url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"No se pudo descargar el M3U: {e}")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"El servidor devolvió {r.status_code}")
    text = r.text
    lines = text.splitlines()
    entries = []
    current: Optional[Dict[str, Any]] = None
    ext_pattern = re.compile(r'([a-zA-Z0-9-]+)="([^"]*)"')
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#EXTINF"):
            attrs = dict(ext_pattern.findall(line))
            name = line.split(",", 1)[1] if "," in line else attrs.get("tvg-name", "Sin nombre")
            current = {
                "name": name,
                "logo": attrs.get("tvg-logo"),
                "group": attrs.get("group-title", "Sin categoría"),
                "tvg_id": attrs.get("tvg-id"),
            }
        elif not line.startswith("#") and current is not None:
            current["url"] = line
            entries.append(current)
            current = None
    # group by category
    categories: Dict[str, List[Dict[str, Any]]] = {}
    for e in entries:
        categories.setdefault(e["group"], []).append(e)
    return {"total": len(entries), "categories": categories}


# ------------------- Stream Proxy -------------------
@api_router.get("/remux/mp4")
async def remux_to_mp4(u: str = Query(...)):
    """
    Remuxea video (MKV/AVI/etc) a fMP4 para <video> del navegador.
    Detecta codec con ffprobe: si es HEVC/AV1 transcodifica a H.264.
    Si es H.264, solo remux (rápido).
    """
    import asyncio
    # 1) Detectar codec con ffprobe (3s timeout)
    vcodec = "h264"
    try:
        probe = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=codec_name", "-of", "csv=p=0",
            "-user_agent", "VLC/3.0.20 LibVLC/3.0.20",
            u,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        try:
            out, _ = await asyncio.wait_for(probe.communicate(), timeout=4.0)
            vcodec = (out.decode().strip().splitlines() or ["h264"])[0].lower()
        except asyncio.TimeoutError:
            probe.kill()
    except Exception:
        pass

    # 2) Construir comando según codec
    needs_transcode = vcodec in ("hevc", "h265", "av1", "vp9", "mpeg4", "wmv3", "vc1")
    cmd = [
        "ffmpeg",
        "-loglevel", "error",
        "-user_agent", "VLC/3.0.20 LibVLC/3.0.20",
        "-i", u,
    ]
    if needs_transcode:
        cmd += [
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-tune", "zerolatency",
            "-crf", "23",
            "-pix_fmt", "yuv420p",
        ]
    else:
        cmd += ["-c:v", "copy"]
    cmd += [
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "frag_keyframe+empty_moov+default_base_moof",
        "-f", "mp4",
        "pipe:1",
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )

    async def body_iter():
        try:
            while True:
                chunk = await proc.stdout.read(64 * 1024)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                proc.kill()
            except Exception:
                pass
            try:
                await proc.wait()
            except Exception:
                pass

    return StreamingResponse(
        body_iter(),
        media_type="video/mp4",
        headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "no-store"},
    )


@api_router.get("/proxy/stream")
async def proxy_stream(request: Request, u: str = Query(...)):
    """Proxy HLS/MP4. Manifests get rewritten so segments go through us.
    Segments and VOD are streamed without buffering, supporting Range requests."""
    headers = {"User-Agent": "VLC/3.0.20 LibVLC/3.0.20"}
    if "range" in request.headers:
        headers["Range"] = request.headers["range"]

    is_manifest = u.lower().split("?")[0].endswith(".m3u8")

    if is_manifest:
        try:
            upstream = await http_client.get(u, headers=headers)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Proxy error: {e}")
        text = upstream.content.decode("utf-8", errors="replace")
        from urllib.parse import urljoin, quote
        base = str(upstream.url)
        proxy_base = "/api/proxy/stream?u="
        new_lines = []
        for line in text.splitlines():
            s = line.strip()
            if s and not s.startswith("#"):
                new_lines.append(proxy_base + quote(urljoin(base, s), safe=""))
            else:
                new_lines.append(line)
        return Response(
            content="\n".join(new_lines).encode("utf-8"),
            media_type="application/vnd.apple.mpegurl",
            headers={"Access-Control-Allow-Origin": "*"},
        )

    # Stream binary bodies (.ts segments, .mp4 VOD) without buffering whole body.
    try:
        req = http_client.build_request("GET", u, headers=headers)
        upstream = await http_client.send(req, stream=True)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Proxy error: {e}")

    media_type = upstream.headers.get("content-type", "application/octet-stream")
    resp_headers = {"Access-Control-Allow-Origin": "*"}
    for h in ("content-range", "accept-ranges", "content-length"):
        if h in upstream.headers:
            resp_headers[h.title()] = upstream.headers[h]

    async def body_iter():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await upstream.aclose()

    return StreamingResponse(
        body_iter(),
        status_code=upstream.status_code,
        media_type=media_type,
        headers=resp_headers,
    )


# ------------------- Favorites -------------------
@api_router.post("/favorites", response_model=FavoriteItem)
async def add_favorite(fav: FavoriteCreate):
    obj = FavoriteItem(**fav.model_dump())
    payload = {
        "id": obj.id,
        "client_id": obj.client_id,
        "type": obj.type,
        "stream_id": obj.stream_id,
        "name": obj.name,
        "icon": obj.icon,
        "extra": obj.extra,
        "created_at": obj.created_at.replace(tzinfo=None),
    }
    async with SessionLocal() as session:
        stmt = _upsert(
            FavoriteRow,
            payload,
            update_keys=("name", "icon", "extra"),
            conflict_cols=["client_id", "type", "stream_id"],
        )
        await session.execute(stmt)
        await session.commit()
    return obj


@api_router.get("/favorites", response_model=List[FavoriteItem])
async def list_favorites(client_id: str):
    async with SessionLocal() as session:
        rows = (await session.execute(
            select(FavoriteRow).where(FavoriteRow.client_id == client_id)
        )).scalars().all()
    return [
        FavoriteItem(
            id=r.id, client_id=r.client_id, type=r.type, stream_id=r.stream_id,
            name=r.name, icon=r.icon, extra=r.extra,
            created_at=r.created_at,
        )
        for r in rows
    ]


@api_router.delete("/favorites")
async def remove_favorite(client_id: str, type: str, stream_id: str):
    async with SessionLocal() as session:
        await session.execute(
            delete(FavoriteRow).where(
                FavoriteRow.client_id == client_id,
                FavoriteRow.type == type,
                FavoriteRow.stream_id == stream_id,
            )
        )
        await session.commit()
    return {"ok": True}


# ------------------- History (Continuar viendo) -------------------
@api_router.post("/history", response_model=HistoryItem)
async def upsert_history(item: HistoryUpsert):
    obj = HistoryItem(**item.model_dump())
    payload = {
        "id": obj.id,
        "client_id": obj.client_id,
        "type": obj.type,
        "stream_id": obj.stream_id,
        "name": obj.name,
        "icon": obj.icon,
        "position": obj.position,
        "duration": obj.duration,
        "extra": obj.extra,
        "updated_at": obj.updated_at.replace(tzinfo=None),
    }
    async with SessionLocal() as session:
        stmt = _upsert(
            HistoryRow,
            payload,
            update_keys=("name", "icon", "position", "duration", "extra", "updated_at"),
            conflict_cols=["client_id", "type", "stream_id"],
        )
        await session.execute(stmt)
        await session.commit()
    return obj


@api_router.get("/history", response_model=List[HistoryItem])
async def list_history(client_id: str, limit: int = 30):
    async with SessionLocal() as session:
        rows = (await session.execute(
            select(HistoryRow)
            .where(HistoryRow.client_id == client_id)
            .order_by(HistoryRow.updated_at.desc())
            .limit(limit)
        )).scalars().all()
    return [
        HistoryItem(
            id=r.id, client_id=r.client_id, type=r.type, stream_id=r.stream_id,
            name=r.name, icon=r.icon, position=r.position or 0.0,
            duration=r.duration or 0.0, extra=r.extra,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@api_router.delete("/history")
async def remove_history(client_id: str, type: str, stream_id: str):
    async with SessionLocal() as session:
        await session.execute(
            delete(HistoryRow).where(
                HistoryRow.client_id == client_id,
                HistoryRow.type == type,
                HistoryRow.stream_id == stream_id,
            )
        )
        await session.commit()
    return {"ok": True}


# ------------------- Setup -------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    await http_client.aclose()
    await engine.dispose()
