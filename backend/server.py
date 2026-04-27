from fastapi import FastAPI, APIRouter, HTTPException, Request, Query
from fastapi.responses import StreamingResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
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

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="TV Stream API")
api_router = APIRouter(prefix="/api")

# Shared HTTP client
http_client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0), follow_redirects=True)


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
    doc = obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.favorites.update_one(
        {"client_id": obj.client_id, "type": obj.type, "stream_id": obj.stream_id},
        {"$set": doc},
        upsert=True,
    )
    return obj


@api_router.get("/favorites", response_model=List[FavoriteItem])
async def list_favorites(client_id: str):
    items = await db.favorites.find({"client_id": client_id}, {"_id": 0}).to_list(1000)
    for it in items:
        if isinstance(it.get("created_at"), str):
            it["created_at"] = datetime.fromisoformat(it["created_at"])
    return items


@api_router.delete("/favorites")
async def remove_favorite(client_id: str, type: str, stream_id: str):
    await db.favorites.delete_one({"client_id": client_id, "type": type, "stream_id": stream_id})
    return {"ok": True}


# ------------------- History (Continuar viendo) -------------------
@api_router.post("/history", response_model=HistoryItem)
async def upsert_history(item: HistoryUpsert):
    obj = HistoryItem(**item.model_dump())
    doc = obj.model_dump()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.history.update_one(
        {"client_id": obj.client_id, "type": obj.type, "stream_id": obj.stream_id},
        {"$set": doc},
        upsert=True,
    )
    return obj


@api_router.get("/history", response_model=List[HistoryItem])
async def list_history(client_id: str, limit: int = 30):
    items = (
        await db.history.find({"client_id": client_id}, {"_id": 0})
        .sort("updated_at", -1)
        .to_list(limit)
    )
    for it in items:
        if isinstance(it.get("updated_at"), str):
            it["updated_at"] = datetime.fromisoformat(it["updated_at"])
    return items


@api_router.delete("/history")
async def remove_history(client_id: str, type: str, stream_id: str):
    await db.history.delete_one({"client_id": client_id, "type": type, "stream_id": stream_id})
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
    client.close()
