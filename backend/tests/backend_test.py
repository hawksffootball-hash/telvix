"""Backend API tests for TV Stream API (Xtream + M3U + favorites + proxy)."""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"

CLIENT_ID = f"TEST_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    yield sess
    # cleanup all favorites for this CLIENT_ID
    try:
        favs = sess.get(f"{API}/favorites", params={"client_id": CLIENT_ID}, timeout=20).json()
        for f in favs:
            sess.delete(f"{API}/favorites", params={
                "client_id": CLIENT_ID, "type": f["type"], "stream_id": f["stream_id"]
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
    # CORSMiddleware should reflect/allow origin
    aco = r.headers.get("access-control-allow-origin")
    assert aco is not None and aco != ""


# ---------- Xtream login (invalid creds) ----------
def test_xtream_login_invalid(s):
    payload = {"server": "http://invalid.example.com", "username": "x", "password": "y"}
    r = s.post(f"{API}/xtream/login", json=payload, timeout=30)
    assert r.status_code in (401, 502)
    body = r.json()
    assert "detail" in body
    assert isinstance(body["detail"], str) and len(body["detail"]) > 0


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


# ---------- M3U Parse ----------
def test_m3u_parse_real(s):
    r = s.post(f"{API}/m3u/parse",
               json={"url": "https://iptv-org.github.io/iptv/index.m3u"},
               timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "total" in data and "categories" in data
    assert data["total"] > 0
    assert isinstance(data["categories"], dict)
    # at least one category should have entries
    first_cat = next(iter(data["categories"].values()))
    assert isinstance(first_cat, list) and len(first_cat) > 0
    sample = first_cat[0]
    assert "name" in sample and "url" in sample


def test_m3u_parse_bad_url(s):
    r = s.post(f"{API}/m3u/parse", json={"url": "http://nonexistent.invalid.tld/x.m3u"}, timeout=30)
    assert r.status_code in (502, 400)


# ---------- Proxy ----------
def test_proxy_stream_text(s):
    target = "https://raw.githubusercontent.com/iptv-org/iptv/master/README.md"
    r = s.get(f"{API}/proxy/stream", params={"u": target}, timeout=60)
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "*"
    assert len(r.content) > 0


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
    # post same favorite again with different name -> upsert, list should still contain only one
    p = _fav_payload("s1", name="TEST_Channel_v2")
    r = s.post(f"{API}/favorites", json=p, timeout=20)
    assert r.status_code == 200
    listing = s.get(f"{API}/favorites", params={"client_id": CLIENT_ID}, timeout=20).json()
    matches = [it for it in listing if it["stream_id"] == "s1" and it["type"] == "live"]
    assert len(matches) == 1
    assert matches[0]["name"] == "TEST_Channel_v2"


def test_favorite_delete(s):
    # create another then delete
    s.post(f"{API}/favorites", json=_fav_payload("s2"), timeout=20)
    r = s.delete(f"{API}/favorites",
                 params={"client_id": CLIENT_ID, "type": "live", "stream_id": "s2"},
                 timeout=20)
    assert r.status_code == 200
    assert r.json().get("ok") is True
    listing = s.get(f"{API}/favorites", params={"client_id": CLIENT_ID}, timeout=20).json()
    assert not any(it["stream_id"] == "s2" for it in listing)
