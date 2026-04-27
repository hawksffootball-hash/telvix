import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import Hls from "hls.js";
import { ArrowLeft, Loader2, Play, Pause, Volume2, VolumeX, Star, StarOff } from "lucide-react";
import { api, buildXtreamUrl, playableUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

export default function Player() {
  const { type, id } = useParams();
  const { state } = useLocation();
  const { creds, clientId } = useAuth();
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const hideTimerRef = useRef(null);

  const [src, setSrc] = useState(null);
  const [title, setTitle] = useState(state?.name || state?.title || "Reproduciendo");
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [loading, setLoading] = useState(true);
  const [fav, setFav] = useState(false);
  const [error, setError] = useState(null);
  const [epg, setEpg] = useState([]);

  const showControls = useCallback(() => {
    setShowUI(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowUI(false), 4000);
  }, []);

  // Build URL
  useEffect(() => {
    let url = null;
    if (creds?.mode === "m3u" && type === "m3u") {
      url = state?.url || null;
    } else if (creds?.mode === "xtream") {
      if (type === "live") {
        url = buildXtreamUrl(creds, "live", id, "m3u8");
      } else if (type === "vod") {
        const ext = state?.container_extension || "mp4";
        url = buildXtreamUrl(creds, "vod", id, ext);
      } else if (type === "series") {
        const ext = state?._container || "mp4";
        url = buildXtreamUrl(creds, "series", id, ext);
      }
    }
    if (!url) {
      setError("No se pudo construir la URL del stream");
      setLoading(false);
      return;
    }
    setSrc(playableUrl(url));
    setTitle(state?.name || state?.title || "Reproduciendo");
  }, [creds, type, id, state]);

  // Setup HLS
  useEffect(() => {
    if (!src || !videoRef.current) return;
    const video = videoRef.current;
    setLoading(true);
    setError(null);

    const isHls = src.includes(".m3u8") || type === "live";

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setError("Error de reproducción: " + (data.details || data.type));
          setLoading(false);
        }
      });
    } else {
      video.src = src;
      video.addEventListener("loadeddata", () => setLoading(false), { once: true });
      video.addEventListener(
        "error",
        () => {
          setError("No se pudo cargar el stream");
          setLoading(false);
        },
        { once: true }
      );
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, type]);

  // EPG for live
  useEffect(() => {
    if (type !== "live" || creds?.mode !== "xtream") return;
    (async () => {
      try {
        const { data } = await api.post("/xtream/epg", {
          server: creds.server,
          username: creds.username,
          password: creds.password,
          stream_id: Number(id),
          limit: 5,
        });
        setEpg(data?.epg_listings || []);
      } catch {}
    })();
  }, [type, id, creds]);

  // Favorites state
  useEffect(() => {
    if (!clientId) return;
    (async () => {
      try {
        const { data } = await api.get("/favorites", { params: { client_id: clientId } });
        const exists = data.some(
          (f) => f.type === type && String(f.stream_id) === String(id)
        );
        setFav(exists);
      } catch {}
    })();
  }, [clientId, type, id]);

  const toggleFav = async () => {
    try {
      if (fav) {
        await api.delete("/favorites", { params: { client_id: clientId, type, stream_id: String(id) } });
        setFav(false);
        toast("Quitado de favoritos");
      } else {
        await api.post("/favorites", {
          client_id: clientId,
          type,
          stream_id: String(id),
          name: title,
          icon: state?.stream_icon || state?.cover || state?.logo || null,
          extra: state || null,
        });
        setFav(true);
        toast.success("Agregado a favoritos");
      }
    } catch {
      toast.error("No se pudo actualizar favoritos");
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
    showControls();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    showControls();
  };

  // Key handling for TV remote
  useEffect(() => {
    const onKey = (e) => {
      showControls();
      if (e.key === "Escape" || e.key === "Backspace") {
        navigate(-1);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft") {
        if (videoRef.current) videoRef.current.currentTime -= 10;
      } else if (e.key === "ArrowRight") {
        if (videoRef.current) videoRef.current.currentTime += 10;
      } else if (e.key === "m" || e.key === "M") {
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  return (
    <div
      className="fixed inset-0 bg-black flex items-center justify-center z-50"
      onMouseMove={showControls}
      data-testid="player-page"
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain bg-black"
        autoPlay
        playsInline
        controls={false}
        data-testid="video-element"
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md rounded-2xl px-8 py-6 flex items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFB800]" />
            <span className="text-xl">Cargando stream…</span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-white p-8">
          <div className="bg-[#0a0a0a] border border-red-900 rounded-2xl p-8 max-w-lg text-center">
            <div className="text-red-500 font-bold text-2xl mb-2">Error</div>
            <p className="text-neutral-300">{error}</p>
            <button
              onClick={() => navigate(-1)}
              className="focus-tv mt-6 bg-[#FFB800] text-black font-bold rounded-xl px-6 py-3 outline-none"
            >
              Volver
            </button>
          </div>
        </div>
      )}

      {/* Overlay controls */}
      <div
        className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${
          showUI ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Top bar */}
        <div className="bg-gradient-to-b from-black/80 to-transparent p-6 md:p-10 flex items-center justify-between">
          <div className="flex items-center gap-5 min-w-0">
            <button
              onClick={() => navigate(-1)}
              data-testid="player-back"
              className="focus-tv bg-black/60 backdrop-blur-md rounded-full p-4 outline-none"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.3em] text-[#FFB800] font-bold">
                {type === "live" ? "En Vivo" : type === "vod" ? "Película" : "Serie"}
              </div>
              <div className="font-display font-bold text-2xl md:text-3xl truncate">{title}</div>
            </div>
          </div>
          <button
            onClick={toggleFav}
            data-testid="player-fav"
            className="focus-tv bg-black/60 backdrop-blur-md rounded-full p-4 outline-none"
          >
            {fav ? (
              <Star className="w-6 h-6 fill-[#FFB800] text-[#FFB800]" />
            ) : (
              <StarOff className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Bottom bar */}
        <div className="bg-gradient-to-t from-black/90 to-transparent p-6 md:p-10 space-y-4">
          {type === "live" && epg.length > 0 && (
            <div className="bg-black/60 backdrop-blur-md rounded-xl p-4 max-w-xl border border-white/10">
              <div className="text-xs text-[#FFB800] uppercase tracking-widest font-bold mb-1">
                Programación
              </div>
              <div className="text-lg font-semibold">
                {(() => {
                  try {
                    return atob(epg[0].title);
                  } catch {
                    return epg[0].title;
                  }
                })()}
              </div>
            </div>
          )}
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              data-testid="player-playpause"
              className="focus-tv bg-[#FFB800] text-black rounded-full p-5 outline-none"
            >
              {playing ? <Pause className="w-7 h-7 fill-black" /> : <Play className="w-7 h-7 fill-black" />}
            </button>
            <button
              onClick={toggleMute}
              data-testid="player-mute"
              className="focus-tv bg-black/60 backdrop-blur-md rounded-full p-5 outline-none"
            >
              {muted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </button>
            <div className="text-sm text-neutral-400 ml-2">
              ← → saltar 10s · Espacio play/pausa · Esc volver
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
