import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Row from "../components/Row";
import PosterCard, { LiveCard } from "../components/PosterCard";
import { Loader2, Play, History } from "lucide-react";

export default function Home() {
  const { creds, clientId } = useAuth();
  const [live, setLive] = useState([]);
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      try {
        const { data } = await api.get("/history", { params: { client_id: clientId, limit: 12 } });
        setHistory(data || []);
      } catch {}
    })();
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (creds?.mode === "xtream") {
          const body = { server: creds.server, username: creds.username, password: creds.password };
          const [l, v, s] = await Promise.all([
            api.post("/xtream/streams", { ...body, type: "live" }).then((r) => r.data),
            api.post("/xtream/streams", { ...body, type: "vod" }).then((r) => r.data),
            api.post("/xtream/streams", { ...body, type: "series" }).then((r) => r.data),
          ]);
          if (cancelled) return;
          setLive((l || []).slice(0, 20));
          setMovies((v || []).slice(0, 20));
          setSeries((s || []).slice(0, 20));
        } else if (creds?.mode === "m3u") {
          const cats = creds.parsed?.categories || {};
          const all = [];
          Object.entries(cats).forEach(([group, items]) => {
            items.forEach((it) => all.push({ ...it, group }));
          });
          setLive(all.slice(0, 20));
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    if (creds) load();
    return () => {
      cancelled = true;
    };
  }, [creds]);

  if (!creds) return null;

  return (
    <div className="min-h-screen" data-testid="home-page">
      {/* Hero */}
      <div className="relative h-[60vh] min-h-[400px] bg-gradient-to-br from-[#0a0a0a] via-[#1a0f00] to-[#050505] flex items-end overflow-hidden">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: `url(https://images.pexels.com/photos/9665193/pexels-photo-9665193.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            mixBlendMode: "overlay",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#050505] to-transparent" />
        <div className="relative z-10 p-10 md:p-16 max-w-4xl">
          <div className="text-sm uppercase tracking-[0.3em] text-[#FFB800] font-bold mb-4">
            Bienvenido
            {creds.mode === "xtream" && creds.user_info?.username
              ? `, ${creds.user_info.username}`
              : ""}
          </div>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter mb-6">
            Tu cine en vivo,<br />
            en cualquier pantalla.
          </h1>
          <p className="text-xl md:text-2xl text-neutral-400 max-w-2xl mb-8">
            Miles de canales, películas y series al alcance de tu control remoto.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => navigate("/live")}
              data-testid="hero-cta-live"
              className="focus-tv flex items-center gap-3 bg-[#FFB800] text-black font-bold rounded-xl px-8 py-5 text-xl hover:bg-[#FFD147] transition-colors outline-none"
            >
              <Play className="w-6 h-6 fill-black" /> Ver En Vivo
            </button>
            <button
              onClick={() => navigate("/movies")}
              data-testid="hero-cta-movies"
              className="focus-tv bg-white/10 text-white font-bold rounded-xl px-8 py-5 text-xl hover:bg-white/20 transition-colors outline-none border-2 border-white/10"
            >
              Explorar Películas
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 md:px-12 py-12 space-y-16">
        {loading && (
          <div className="flex items-center gap-3 text-neutral-400 text-xl">
            <Loader2 className="w-6 h-6 animate-spin" /> Cargando contenido…
          </div>
        )}

        {!loading && history.length > 0 && (
          <Row title="Continuar viendo" testid="row-history">
            {history.map((it, idx) => {
              const pct = it.duration ? Math.min(100, Math.round((it.position / it.duration) * 100)) : 0;
              const open = () => {
                if (it.type === "series") navigate(`/player/series/${it.stream_id}`, { state: it.extra });
                else if (it.type === "vod") navigate(`/player/vod/${it.stream_id}`, { state: it.extra });
                else navigate(`/player/${it.type}/${it.stream_id}`, { state: it.extra });
              };
              return (
                <div key={it.id} className="relative">
                  <PosterCard
                    testid={`history-card-${idx}`}
                    title={it.name}
                    image={it.icon}
                    meta={`${pct}% visto`}
                    onActivate={open}
                  />
                  <div className="absolute left-2 right-2 bottom-2 h-1.5 bg-black/70 rounded-full overflow-hidden pointer-events-none">
                    <div className="h-full bg-[#FFB800]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </Row>
        )}

        {!loading && live.length > 0 && (
          <Row title="En Vivo" testid="row-live">
            {live.map((it, idx) => (
              <LiveCard
                key={(it.stream_id || it.url || idx) + "-l"}
                testid={`live-card-${idx}`}
                title={it.name}
                image={it.stream_icon || it.logo}
                onActivate={() =>
                  creds.mode === "xtream"
                    ? navigate(`/player/live/${it.stream_id}`, {
                        state: { ...it, channels: live, channelIndex: idx },
                      })
                    : navigate(`/player/m3u/${idx}`, { state: it })
                }
              />
            ))}
          </Row>
        )}

        {!loading && movies.length > 0 && (
          <Row title="Películas" testid="row-movies">
            {movies.map((it, idx) => (
              <PosterCard
                key={it.stream_id + "-m"}
                testid={`movie-card-${idx}`}
                title={it.name}
                image={it.stream_icon}
                meta={it.rating ? `★ ${it.rating}` : null}
                onActivate={() => navigate(`/vod/${it.stream_id}`, { state: it })}
              />
            ))}
          </Row>
        )}

        {!loading && series.length > 0 && (
          <Row title="Series" testid="row-series">
            {series.map((it, idx) => (
              <PosterCard
                key={it.series_id + "-s"}
                testid={`series-card-${idx}`}
                title={it.name}
                image={it.cover}
                meta={it.rating ? `★ ${it.rating}` : null}
                onActivate={() => navigate(`/series/${it.series_id}`, { state: it })}
              />
            ))}
          </Row>
        )}
      </div>
    </div>
  );
}
