import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Star, StarOff, Loader2, Calendar, Clock, Globe } from "lucide-react";
import { api, playableUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

export default function VodDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const { creds, clientId } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fav, setFav] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (creds?.mode !== "xtream") return setLoading(false);
      try {
        const { data } = await api.post("/xtream/vod-info", {
          server: creds.server,
          username: creds.username,
          password: creds.password,
          vod_id: Number(id),
        });
        setInfo(data);
      } catch {}
      setLoading(false);
    };
    load();
  }, [id, creds]);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      try {
        const { data } = await api.get("/favorites", { params: { client_id: clientId } });
        setFav(data.some((f) => f.type === "vod" && String(f.stream_id) === String(id)));
      } catch {}
    })();
  }, [clientId, id]);

  if (loading) {
    return (
      <div className="p-12 flex items-center gap-3 text-neutral-400 text-xl">
        <Loader2 className="w-6 h-6 animate-spin" /> Cargando…
      </div>
    );
  }

  const meta = info?.info || {};
  const movie = info?.movie_data || state || {};
  const ext = movie.container_extension || meta.container_extension || "mp4";
  const title = movie.name || state?.name || "Sin título";

  const toggleFav = async () => {
    try {
      if (fav) {
        await api.delete("/favorites", { params: { client_id: clientId, type: "vod", stream_id: String(id) } });
        setFav(false);
      } else {
        await api.post("/favorites", {
          client_id: clientId,
          type: "vod",
          stream_id: String(id),
          name: title,
          icon: meta.movie_image || state?.stream_icon,
          extra: { ...state, container_extension: ext },
        });
        setFav(true);
        toast.success("Agregado a favoritos");
      }
    } catch {
      toast.error("Error en favoritos");
    }
  };

  return (
    <div className="min-h-screen" data-testid="vod-detail">
      <div className="relative h-[70vh] min-h-[460px] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${playableUrl(meta.backdrop_path?.[0] || meta.movie_image || state?.stream_icon || "")})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />

        <button
          onClick={() => navigate(-1)}
          data-testid="vod-back"
          className="focus-tv absolute top-8 left-8 z-20 bg-black/60 backdrop-blur-md rounded-full p-4 outline-none"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <div className="relative z-10 h-full flex items-end p-10 md:p-16">
          <div className="max-w-3xl">
            <h1 className="font-display text-5xl md:text-7xl font-black tracking-tighter mb-5">
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-5 text-neutral-300 text-lg mb-5">
              {meta.rating && (
                <span className="flex items-center gap-2 text-[#FFB800] font-bold">
                  <Star className="w-5 h-5 fill-[#FFB800]" /> {meta.rating}
                </span>
              )}
              {meta.releasedate && (
                <span className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" /> {meta.releasedate}
                </span>
              )}
              {meta.duration && (
                <span className="flex items-center gap-2">
                  <Clock className="w-5 h-5" /> {meta.duration}
                </span>
              )}
              {meta.country && (
                <span className="flex items-center gap-2">
                  <Globe className="w-5 h-5" /> {meta.country}
                </span>
              )}
            </div>
            {meta.genre && (
              <div className="text-sm uppercase tracking-[0.2em] text-[#FFB800] font-bold mb-5">
                {meta.genre}
              </div>
            )}
            {meta.plot && (
              <p className="text-neutral-300 text-lg md:text-xl leading-relaxed mb-8 line-clamp-5">
                {meta.plot}
              </p>
            )}
            <div className="flex gap-4 flex-wrap">
              <button
                onClick={() =>
                  navigate(`/player/vod/${id}`, {
                    state: { ...movie, name: title, container_extension: ext, stream_icon: meta.movie_image },
                  })
                }
                data-testid="vod-play"
                className="focus-tv flex items-center gap-3 bg-[#FFB800] text-black font-bold rounded-xl px-8 py-5 text-xl hover:bg-[#FFD147] outline-none"
              >
                <Play className="w-6 h-6 fill-black" /> Reproducir
              </button>
              <button
                onClick={toggleFav}
                data-testid="vod-fav"
                className="focus-tv flex items-center gap-3 bg-white/10 text-white font-bold rounded-xl px-8 py-5 text-xl hover:bg-white/20 border-2 border-white/10 outline-none"
              >
                {fav ? (
                  <><Star className="w-6 h-6 fill-[#FFB800] text-[#FFB800]" /> En favoritos</>
                ) : (
                  <><StarOff className="w-6 h-6" /> Favorito</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {meta.cast && (
        <div className="p-10 md:p-16 grid md:grid-cols-2 gap-8 max-w-6xl">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-[#FFB800] font-bold mb-2">Reparto</div>
            <div className="text-lg text-neutral-300">{meta.cast}</div>
          </div>
          {meta.director && (
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-[#FFB800] font-bold mb-2">Director</div>
              <div className="text-lg text-neutral-300">{meta.director}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
