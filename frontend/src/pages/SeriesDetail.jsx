import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Play, Star, ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function SeriesDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const { creds } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (creds?.mode !== "xtream") return setLoading(false);
      try {
        const { data } = await api.post("/xtream/series-info", {
          server: creds.server,
          username: creds.username,
          password: creds.password,
          series_id: Number(id),
        });
        setInfo(data);
        const keys = Object.keys(data?.episodes || {});
        if (keys.length) setSeason(keys[0]);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    load();
  }, [id, creds]);

  if (loading) {
    return (
      <div className="p-12 flex items-center gap-3 text-neutral-400 text-xl">
        <Loader2 className="w-6 h-6 animate-spin" /> Cargando…
      </div>
    );
  }

  const meta = info?.info || state || {};
  const episodes = info?.episodes?.[season] || [];

  return (
    <div className="min-h-screen" data-testid="series-detail">
      <div className="relative h-[60vh] min-h-[420px] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${meta.backdrop_path?.[0] || meta.cover || ""})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-transparent" />
        <button
          onClick={() => navigate(-1)}
          data-testid="back-btn"
          className="focus-tv absolute top-8 left-8 z-20 bg-black/60 backdrop-blur-md rounded-full p-4 outline-none"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="absolute inset-x-0 bottom-0 p-10 md:p-16 z-10">
          <h1 className="font-display text-5xl md:text-7xl font-black tracking-tighter mb-4 max-w-4xl">
            {meta.name || state?.name}
          </h1>
          <div className="flex items-center gap-5 text-neutral-300 text-lg mb-4">
            {meta.rating && (
              <span className="flex items-center gap-2 text-[#FFB800] font-bold">
                <Star className="w-5 h-5 fill-[#FFB800]" /> {meta.rating}
              </span>
            )}
            {meta.releaseDate && <span>{meta.releaseDate}</span>}
            {meta.genre && <span>{meta.genre}</span>}
          </div>
          <p className="text-neutral-300 max-w-3xl text-lg line-clamp-3">{meta.plot}</p>
        </div>
      </div>

      <div className="p-10 md:p-16 space-y-8">
        {Object.keys(info?.episodes || {}).length > 1 && (
          <div className="flex gap-3 flex-wrap">
            {Object.keys(info.episodes).map((k) => (
              <button
                key={k}
                onClick={() => setSeason(k)}
                data-testid={`season-${k}`}
                className={`focus-tv px-6 py-3 rounded-full font-semibold outline-none transition-colors ${
                  season === k
                    ? "bg-[#FFB800] text-black"
                    : "bg-[#111] text-neutral-300 border border-neutral-800"
                }`}
              >
                Temporada {k}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {episodes.map((ep, idx) => (
            <button
              key={ep.id}
              onClick={() =>
                navigate(`/player/series/${ep.id}`, {
                  state: { ...ep, _container: ep.container_extension || "mp4" },
                })
              }
              data-testid={`episode-${idx}`}
              className="focus-tv text-left bg-[#0a0a0a] border border-neutral-900 rounded-2xl p-5 hover:bg-[#111] transition-colors outline-none group"
            >
              <div className="aspect-video bg-neutral-900 rounded-xl mb-4 flex items-center justify-center overflow-hidden relative">
                {ep.info?.movie_image ? (
                  <img src={ep.info.movie_image} alt={ep.title} className="w-full h-full object-cover" />
                ) : (
                  <Play className="w-12 h-12 text-[#FFB800]" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Play className="w-14 h-14 text-white fill-white" />
                </div>
              </div>
              <div className="text-sm text-[#FFB800] uppercase tracking-wider font-bold mb-1">
                Episodio {ep.episode_num}
              </div>
              <div className="font-display font-bold text-xl line-clamp-1">{ep.title}</div>
              {ep.info?.plot && (
                <div className="text-neutral-400 text-sm mt-2 line-clamp-2">{ep.info.plot}</div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
