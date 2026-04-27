# Televix — Reproductor IPTV (Xtream Codes + M3U)

## Problem Statement
"Construyendo un reproductor de lista m3u conectados a xtream codes para varias plataformas como Samsung tv y el LG tv"

## Architecture
- **Frontend**: React 19 + React Router 7 + Tailwind + shadcn/ui + HLS.js
- **Backend**: FastAPI + Motor (MongoDB) + httpx (Xtream proxy)
- **Storage**: MongoDB (`favorites` collection, keyed by client_id UUID in localStorage)
- **Theme**: Swiss Dark Cinematic — #050505 background, #FFB800 amber accent, Cabinet Grotesk + Outfit fonts

## User Personas
- Dueños de suscripciones IPTV Xtream Codes que quieren ver en Smart TV / navegador
- Usuarios con listas M3U públicas o personales

## Core Requirements (static)
- Login por Xtream (URL, usuario, contraseña) o URL M3U
- Catálogos: En Vivo, Películas, Series, Favoritos, Buscar
- Reproductor HLS con overlay, soporte D-pad / teclas de flecha
- Multi-plataforma: navegador de Smart TV (Tizen/webOS) y desktop

## Implemented (2026-02)
- ✅ Backend Xtream: login, categories, streams, vod-info, series-info, epg
- ✅ Backend M3U parser (categorías + entradas con logo/grupo)
- ✅ Backend proxy /api/proxy/stream (reescribe m3u8 y recursa segmentos para HTTPS↔HTTP)
- ✅ Backend favoritos (CRUD con upsert, sin leakage de _id)
- ✅ Frontend: login con tabs Xtream/M3U, Home hero + rows, catálogos con filtros de categoría
- ✅ SeriesDetail con temporadas/episodios, Favoritos, Search (en catálogo Xtream)
- ✅ Player HLS.js con controles overlay, favoritos, EPG live, controles por teclas
- ✅ Shell/sidebar con navegación D-pad, focus ring amber
- ✅ Testing backend: 15/15 pytest pasados

## Prioritized Backlog
### P1
- StreamingResponse en proxy para VOD grandes (evitar buffer full en memoria)
- Búsqueda en modo M3U (actualmente solo Xtream)
- Vista detallada de VOD antes de reproducir (poster/sinopsis)
- Progreso de continuación (last-watched) en VOD/series

### P2
- Multi-perfil (varios usuarios locales)
- Control parental / PIN por categoría
- Empaquetado Tizen (.wgt) y webOS (.ipk) con guías

### P3
- EPG completa (guía rejilla para Live TV)
- Picture-in-picture
- Selector de pista de audio/subtítulos

## Next Tasks
1. Esperar feedback del usuario con credenciales Xtream reales para validar UI completa
2. Opcional: ofrecer detalles VOD (página intermedia con sinopsis antes de reproducir)
