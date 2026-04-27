import React, { useEffect, useRef, useState } from "react";
import { Tv, Play, Star } from "lucide-react";
import { api, playableUrl } from "../lib/api";

/**
 * Panel hero arriba en /live: muestra logo gigante + nombre + EPG actual del
 * canal con foco. Cachea las consultas EPG por stream_id.
 */
export default function LivePreview({ channel, creds, onPlay }) {
  const cache = useRef(new Map());
  const [epg, setEpg] = useState(null);

  useEffect(() => {
    if (!channel || !creds || creds.mode !== "xtream") {
      setEpg(null);
      return;
    }
    const key = String(channel.stream_id);
    if (cache.current.has(key)) {
      setEpg(cache.current.get(key));
      return;
    }
    let cancelled = false;
    setEpg(null);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post("/xtream/epg", {
          server: creds.server,
          username: creds.username,
          password: creds.password,
          stream_id: Number(channel.stream_id),
          limit: 2,
        });
        const list = data?.epg_listings || [];
        const decoded = list.map((p) => ({
          ...p,
          title: safeAtob(p.title),
          description: safeAtob(p.description),
        }));
        cache.current.set(key, decoded);
        if (!cancelled) setEpg(decoded);
      } catch {
        if (!cancelled) setEpg([]);
      }
    }, 350); // debounce, evita spammear el server al navegar rápido
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [channel, creds]);

  if (!channel) {
    return (
      <div
        data-testid="live-preview-empty"
        className="rounded-2xl bg-[#0a0a0a] border border-neutral-900 p-10 mb-8 text-neutral-500 text-center"
      >
        Pasa el cursor o foco sobre un canal para ver su programación
      </div>
    );
  }

  const now = epg?.[0];
  const next = epg?.[1];
  const logo = channel.stream_icon || channel.logo;

  return (
    <div
      data-testid="live-preview"
      className="relative overflow-hidden rounded-3xl border border-neutral-900 bg-gradient-to-br from-[#0a0a0a] via-[#0f0805] to-[#050505] mb-8"
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div
          className="w-full h-full bg-center bg-cover blur-3xl scale-110"
          style={{ backgroundImage: logo ? `url(${playableUrl(logo)})` : "" }}
        />
      </div>
      <div className="relative z-10 flex flex-col md:flex-row gap-8 p-8 md:p-10 items-center md:items-stretch">
        <div className="shrink-0 w-44 h-44 md:w-48 md:h-48 rounded-2xl bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center p-6">
          {logo ? (
            <img src={playableUrl(logo)} alt={channel.name} className="max-w-full max-h-full object-contain" />
          ) : (
            <Tv className="w-20 h-20 text-[#FFB800]" />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-[#FFB800] font-bold">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FFB800] animate-pulse" /> En Vivo
            </span>
            {channel.rating && (
              <span className="text-neutral-500 normal-case tracking-normal flex items-center gap-1">
                <Star className="w-3 h-3" /> {channel.rating}
              </span>
            )}
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-black tracking-tighter leading-none">
            {channel.name}
          </h2>
          <div className="space-y-2">
            {epg === null ? (
              <div className="text-sm text-neutral-600">Cargando programación…</div>
            ) : now ? (
              <>
                <div>
                  <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
                    Ahora
                  </div>
                  <div className="text-lg md:text-xl font-semibold text-white line-clamp-1">
                    {now.title || "Sin título"}
                  </div>
                  {now.description && (
                    <div className="text-sm text-neutral-400 line-clamp-2 mt-1">
                      {now.description}
                    </div>
                  )}
                </div>
                {next && (
                  <div className="pt-2 border-t border-white/5">
                    <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
                      A continuación
                    </div>
                    <div className="text-base text-neutral-300 line-clamp-1">
                      {next.title || "Sin título"}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-neutral-600">Sin guía disponible</div>
            )}
          </div>
          <div>
            <button
              onClick={() => onPlay && onPlay(channel)}
              data-testid="live-preview-play"
              className="focus-tv inline-flex items-center gap-3 bg-[#FFB800] text-black font-bold rounded-xl px-6 py-3 text-base hover:bg-[#FFD147] transition-colors outline-none"
            >
              <Play className="w-5 h-5 fill-black" /> Ver canal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function safeAtob(s) {
  if (!s) return "";
  try {
    return decodeURIComponent(escape(atob(s)));
  } catch {
    try {
      return atob(s);
    } catch {
      return s;
    }
  }
}
