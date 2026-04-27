"""Backend API tests for TV Stream API (Xtream + M3U + favorites + history + proxy).

Iteration 2 additions:
- History upsert/list/delete (idempotent, sorted desc, no _id leakage)
- Proxy m3u8 rewrite (relative + redirect-aware base)
- Proxy non-m3u8 streaming (Content-Type preserved, CORS)
- Proxy User-Agent header forwarded to upstream
- Real Xtream login against playgo.sbs:25461
"""
import os
import uuid
import time
import threading
import http.server
import socketserver
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path
from urllib.parse import quote, parse_qs, urlparse

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"

CLIENT_ID = f"TEST_{uuid.uuid4().hex[:8]}"

XTREAM_REAL = {"server": "http://playgo.sbs:25461", "username": "jevus", "password": "jevus"}


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    yield sess
    # cleanup favorites + history for this CLIENT_ID
    for resource in ("favorites", "history"):
        try:
            items = sess.get(f"{API}/{resource}", params={"client_id": CLIENT_ID}, timeout=20).json()
            for it in items:
                sess.delete(f"{API}/{resource}", params={
                    "client_id": CLIENT_ID, "type": it["type"], "stream_id": it["stream_id"]
                }, timeout=20)
        except Exception:
            pass


# ---------- Health ----------
def test_root(s):
    r = s.get(f"{API}/", timeout=20)
    assert r.status_code == 200
    assert r.json().get("message")


# ---------- CORS ----------
def test_cors_headers(s):
    r = s.get(f"{API}/", headers={"Origin": "https://example.com"}, timeout=20)
    assert r.status_code == 200
    aco = r.headers.get("access-control-allow-origin")
    assert aco is not None and aco != ""


# ---------- Xtream login (invalid creds) ----------
def test_xtream_login_invalid(s):
    payload = {"server": "http://invalid.example.com", "username": "x", "password": "y"}
    r = s.post(f"{API}/xtream/login", json=payload, timeout=30)
    assert r.status_code in (401, 502)
    body = r.json()
    assert "detail" in body and isinstance(body["detail"], str) and len(body["detail"]) > 0


# ---------- Xtream categories (invalid creds) ----------
@pytest.mark.parametrize("typ", ["live", "vod", "series"])
def test_xtream_categories_invalid(s, typ):
    payload = {"server": "http://invalid.example.com", "username": "x", "password": "y", "type": typ}
    r = s.post(f"{API}/xtream/categories", json=payload, timeout=30)
    assert r.status_code in (502, 401)
    assert "detail" in r.json()


def test_xtream_categories_bad_type(s):
    payload = {"server": "http://invalid.example.com", "username": "x", "password": "y", "type": "bad"}
    r = s.post(f"{API}/xtream/categories", json=payload, timeout=30)
    assert r.status_code == 400


# ---------- Xtream streams (invalid creds) ----------
def test_xtream_streams_invalid(s):
    payload = {"server": "http://invalid.example.com", "username": "x", "password": "y", "type": "live"}
    r = s.post(f"{API}/xtream/streams", json=payload, timeout=30)
    assert r.status_code in (502, 401)
    assert "detail" in r.json()


# ---------- Xtream REAL login (end-to-end) ----------
def test_xtream_login_real(s):
    r = s.post(f"{API}/xtream/login", json=XTREAM_REAL, timeout=45)
    # If the upstream is down we skip rather than fail
    if r.status_code == 502:
        pytest.skip(f"Upstream Xtream provider unreachable: {r.text[:200]}")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "user_info" in data
    assert str(data["user_info"].get("auth")) == "1"
    # server_info typically present too
    assert "server_info" in data


def test_xtream_categories_real(s):
    payload = {**XTREAM_REAL, "type": "live"}
    r = s.post(f"{API}/xtream/categories", json=payload, timeout=45)
    if r.status_code == 502:
        pytest.skip("Upstream unreachable")
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    # the provider should return at least some categories
    if data:
        sample = data[0]
        assert "category_id" in sample and "category_name" in sample


# ---------- M3U Parse ----------
def test_m3u_parse_real(s):
    r = s.post(f"{API}/m3u/parse",
               json={"url": "https://iptv-org.github.io/iptv/index.m3u"},
               timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "total" in data and "categories" in data
    assert data["total"] > 0
    first_cat = next(iter(data["categories"].values()))
    assert isinstance(first_cat, list) and len(first_cat) > 0
    sample = first_cat[0]
    assert "name" in sample and "url" in sample


def test_m3u_parse_bad_url(s):
    r = s.post(f"{API}/m3u/parse", json={"url": "http://nonexistent.invalid.tld/x.m3u"}, timeout=30)
    assert r.status_code in (502, 400)


# ---------- Proxy: non-m3u8 text (StreamingResponse path) ----------
def test_proxy_stream_text(s):
    target = "https://raw.githubusercontent.com/iptv-org/iptv/master/README.md"
    r = s.get(f"{API}/proxy/stream", params={"u": target}, timeout=60)
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "*"
    assert len(r.content) > 0


# ---------- Proxy: Range header forwarding (binary path) ----------
def test_proxy_stream_range_forwarded(s):
    """Request a byte range from a known binary and verify 206 + Content-Range forwarded."""
    target = "https://raw.githubusercontent.com/iptv-org/iptv/master/README.md"
    r = s.get(f"{API}/proxy/stream", params={"u": target},
              headers={"Range": "bytes=0-99"}, timeout=60)
    # github returns 206 for Range. If upstream ignores we accept 200, but Content-Range should appear on 206.
    assert r.status_code in (200, 206)
    if r.status_code == 206:
        cr = r.headers.get("Content-Range") or r.headers.get("content-range")
        assert cr and cr.startswith("bytes 0-")
        assert len(r.content) <= 200  # approx: requested 100 bytes


# ---------- Proxy: local HTTP server for advanced proxy tests ----------
class _Handler(http.server.BaseHTTPRequestHandler):
    manifest_host = None  # will be set before serving

    def log_message(self, *a, **kw):  # silence
        pass

    def do_GET(self):
        path = self.path
        # Capture User-Agent for verification
        ua = self.headers.get("User-Agent", "")
        _Handler.last_user_agent = ua

        if path == "/redirect.m3u8":
            # redirect to a different path — segments in that manifest are RELATIVE
            self.send_response(302)
            self.send_header("Location", "/final/stream.m3u8")
            self.end_headers()
            return

        if path == "/final/stream.m3u8":
            body = (
                "#EXTM3U\n"
                "#EXT-X-VERSION:3\n"
                "#EXTINF:10.0,\n"
                "seg1.ts\n"
                "#EXTINF:10.0,\n"
                "seg2.ts\n"
                "#EXT-X-ENDLIST\n"
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/vnd.apple.mpegurl")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        self.send_response(404)
        self.end_headers()


@pytest.fixture(scope="module")
def local_server():
    httpd = socketserver.TCPServer(("0.0.0.0", 0), _Handler)
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    # backend (in same container) can reach host.docker? We assume localhost reachability.
    base = f"http://localhost:{port}"
    yield base
    httpd.shutdown()


def test_proxy_m3u8_rewrites_segments_with_redirect(s, local_server):
    """
    The /redirect.m3u8 redirects -> /final/stream.m3u8 whose segments are relative.
    After proxy processing:
    - response should be a playlist
    - each segment line must be '/api/proxy/stream?u=<absolute-url-of-final-host>/final/segN.ts'
    - i.e. base URL must be resolved against FINAL url, not original.
    """
    manifest_url = f"{local_server}/redirect.m3u8"
    r = s.get(f"{API}/proxy/stream", params={"u": manifest_url}, timeout=30)
    if r.status_code == 502:
        pytest.skip(f"Backend cannot reach local test server: {r.text[:200]}")
    assert r.status_code == 200, r.text
    ctype = r.headers.get("content-type", "")
    assert "mpegurl" in ctype.lower()
    body = r.text
    assert "#EXTM3U" in body
    # Collect non-# lines
    seg_lines = [ln.strip() for ln in body.splitlines() if ln.strip() and not ln.strip().startswith("#")]
    assert len(seg_lines) == 2, f"expected 2 segments, got {seg_lines}"
    for line in seg_lines:
        assert line.startswith("/api/proxy/stream?u="), line
        # decoded URL must be absolute and point to the FINAL path
        from urllib.parse import unquote
        u_param = line.split("?u=", 1)[1]
        decoded = unquote(u_param)
        assert decoded.startswith("http://"), decoded
        assert "/final/seg" in decoded, decoded
        assert decoded.endswith(".ts"), decoded


def test_proxy_forwards_vlc_user_agent(s, local_server):
    """Issue a request through proxy and verify our stub saw the VLC UA."""
    _Handler.last_user_agent = ""
    manifest_url = f"{local_server}/final/stream.m3u8"
    r = s.get(f"{API}/proxy/stream", params={"u": manifest_url}, timeout=30)
    if r.status_code == 502:
        pytest.skip("Backend cannot reach local test server")
    assert r.status_code == 200
    # Allow brief race
    time.sleep(0.1)
    ua = getattr(_Handler, "last_user_agent", "")
    assert "VLC" in ua, f"expected VLC UA forwarded, got: {ua!r}"


# ---------- Favorites CRUD ----------
def _fav_payload(stream_id="stream_1", typ="live", name="TEST_Channel"):
    return {
        "client_id": CLIENT_ID,
        "type": typ,
        "stream_id": stream_id,
        "name": name,
        "icon": "http://example.com/i.png",
        "extra": {"foo": "bar"},
    }


def test_favorite_create_no_objectid(s):
    r = s.post(f"{API}/favorites", json=_fav_payload("s1"), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "id" in body and isinstance(body["id"], str)
    assert "created_at" in body
    assert "_id" not in body
    assert body["client_id"] == CLIENT_ID
    assert body["stream_id"] == "s1"


def test_favorite_list_returns_created(s):
    r = s.get(f"{API}/favorites", params={"client_id": CLIENT_ID}, timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert any(it["stream_id"] == "s1" for it in items)
    for it in items:
        assert "_id" not in it


def test_favorite_idempotent_upsert(s):
    p = _fav_payload("s1", name="TEST_Channel_v2")
    r = s.post(f"{API}/favorites", json=p, timeout=20)
    assert r.status_code == 200
    listing = s.get(f"{API}/favorites", params={"client_id": CLIENT_ID}, timeout=20).json()
    matches = [it for it in listing if it["stream_id"] == "s1" and it["type"] == "live"]
    assert len(matches) == 1
    assert matches[0]["name"] == "TEST_Channel_v2"


def test_favorite_delete(s):
    s.post(f"{API}/favorites", json=_fav_payload("s2"), timeout=20)
    r = s.delete(f"{API}/favorites",
                 params={"client_id": CLIENT_ID, "type": "live", "stream_id": "s2"},
                 timeout=20)
    assert r.status_code == 200
    assert r.json().get("ok") is True
    listing = s.get(f"{API}/favorites", params={"client_id": CLIENT_ID}, timeout=20).json()
    assert not any(it["stream_id"] == "s2" for it in listing)


# ---------- History CRUD ----------
def _hist_payload(stream_id="v1", typ="vod", name="TEST_Movie", pos=12.5, dur=3600.0):
    return {
        "client_id": CLIENT_ID,
        "type": typ,
        "stream_id": stream_id,
        "name": name,
        "icon": "http://example.com/p.jpg",
        "position": pos,
        "duration": dur,
        "extra": {"container": "mkv"},
    }


def test_history_upsert_create(s):
    r = s.post(f"{API}/history", json=_hist_payload("v1"), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["stream_id"] == "v1"
    assert body["position"] == 12.5
    assert "_id" not in body
    assert "updated_at" in body


def test_history_list_excludes_objectid_and_has_shape(s):
    r = s.get(f"{API}/history", params={"client_id": CLIENT_ID}, timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert any(it["stream_id"] == "v1" for it in items)
    for it in items:
        assert "_id" not in it
        assert "updated_at" in it


def test_history_idempotent_upsert(s):
    # upsert same key with updated position — list length must stay 1 for (vod,v1)
    r = s.post(f"{API}/history", json=_hist_payload("v1", pos=42.0), timeout=20)
    assert r.status_code == 200
    assert r.json()["position"] == 42.0
    listing = s.get(f"{API}/history", params={"client_id": CLIENT_ID}, timeout=20).json()
    matches = [it for it in listing if it["type"] == "vod" and it["stream_id"] == "v1"]
    assert len(matches) == 1
    assert matches[0]["position"] == 42.0


def test_history_sorted_desc_by_updated_at(s):
    # create second entry later — it should appear first
    time.sleep(1.1)
    r = s.post(f"{API}/history", json=_hist_payload("v2", name="TEST_Movie_2"), timeout=20)
    assert r.status_code == 200
    listing = s.get(f"{API}/history", params={"client_id": CLIENT_ID}, timeout=20).json()
    # the most recent upsert should come first
    assert listing[0]["stream_id"] == "v2"


def test_history_delete(s):
    r = s.delete(f"{API}/history",
                 params={"client_id": CLIENT_ID, "type": "vod", "stream_id": "v2"},
                 timeout=20)
    assert r.status_code == 200
    assert r.json().get("ok") is True
    listing = s.get(f"{API}/history", params={"client_id": CLIENT_ID}, timeout=20).json()
    assert not any(it["stream_id"] == "v2" and it["type"] == "vod" for it in listing)
