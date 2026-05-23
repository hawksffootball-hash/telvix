# Televix — Reproductor IPTV (Xtream Codes + M3U)

## Problem Statement
"Construyendo un reproductor de lista m3u conectados a xtream codes para varias plataformas como Samsung tv y el LG tv"

## Architecture
- **Frontend**: React 19 + React Router 7 + Tailwind + shadcn/ui + HLS.js
- **Backend**: FastAPI + Motor (MongoDB) + httpx (Xtream proxy con streaming)
- **Storage**: MongoDB (`favorites`, `history`) keyed por `client_id` (UUID en localStorage)
- **Theme**: Swiss Dark Cinematic — #050505 background, #FFB800 amber accent, Cabinet Grotesk + Outfit

## Validado End-to-End (2026-02)
- ✅ Login Xtream real: `http://playgo.sbs:25461` user/pass `jevus` → auth=1
- ✅ Reproducción HLS en vivo: Imagen TV HD a 1280x720, sin errores de consola
- ✅ Proxy de streams: redirige redirects 302, reescribe segmentos m3u8 a rutas relativas, streaming sin buffer
- ✅ 25/25 tests pytest

## Implementado
### Backend
- `/api/xtream/login`, `/api/xtream/categories`, `/api/xtream/streams`
- `/api/xtream/vod-info`, `/api/xtream/series-info`, `/api/xtream/epg`
- `/api/m3u/parse` (parser de M3U con categorías + entradas)
- `/api/proxy/stream` con doble branch: m3u8 (rewrite + redirects) y binarios (StreamingResponse + Range)
- `/api/favorites` CRUD (upsert idempotente por client_id+type+stream_id)
- `/api/history` CRUD (idem, ordenado por updated_at desc)

### Frontend
- Login con tabs Xtream/M3U + validación
- Home con hero + filas: **Continuar viendo** (con barra de progreso amber), En Vivo, Películas, Series
- Catálogos `/live`, `/movies`, `/series` con filtros de categoría
- Detalle VOD `/vod/:id` con sinopsis, año, género, reparto, director, duración
- Detalle Series `/series/:id` con temporadas/episodios
- Player HLS.js con:
  - Auto-resume desde última posición (toast "Reanudado desde X:XX")
  - Tracking de progreso cada 10s
  - Overlay con play/pause, mute, EPG live, favorito
  - Teclas D-pad: ←→ saltar 10s, Espacio play/pausa, Esc volver, M mute
- Favoritos, Búsqueda
- Sidebar D-pad con focus ring amber, fuentes Cabinet Grotesk + Outfit

### Empaquetado nativo
- `/app/packaging/tizen/` — config.xml + index.html (wrapper iframe) para Samsung Tizen `.wgt`
- `/app/packaging/webos/` — appinfo.json + index.html para LG webOS `.ipk`
- `/app/packaging/README.md` — instrucciones completas para empaquetar y desplegar en TVs

## Validado (2026-02 — Despliegue VPS)
- ✅ Producción en `https://moviesymas.vip` (VPS Ubuntu 24.04, Nginx + PM2 + MariaDB + Certbot)
- ✅ Puente TV nativo: cuando `?tv=tizen` o `?tv=webos` está en la URL, el Player envía `postMessage({action:'play', url})` al wrapper en vez de remuxear → el reproductor nativo del TV (AVPlay / `<video>` con `mediaOption`) reproduce el MKV con multi-audio y subs.
- ✅ Packaging `tizen/index.html`, `webos/index.html`, `tizen/config.xml` actualizados a `moviesymas.vip`
- ✅ Guía `packaging/TV-INSTALL-GUIDE.md` con pasos para Samsung Developer Mode + Tizen Studio y LG Developer Mode + webOS CLI

## Backlog
### P1
- Búsqueda en modo M3U (actualmente solo Xtream)
- Auth multi-usuario con JWT (mover credenciales Xtream de `localStorage` a la DB por usuario)
- Detalle de canal en vivo (vista previa antes de entrar a fullscreen)

### P2
- Multi-perfil (varios usuarios locales en mismo TV)
- Control parental con PIN
- EPG completa (rejilla horaria) para Live TV

### P3
- PiP (picture-in-picture)
- Modo offline (cache de últimos canales/listas)
- Voice search via webOS/Tizen TV remote mic
