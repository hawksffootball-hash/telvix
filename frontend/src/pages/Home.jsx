import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Row from "../components/Row";
import PosterCard from "../components/PosterCard";
import { Tv, Film, Clapperboard, ChevronRight, Loader2 } from "lucide-react";

export default function Home() {
  const { creds, clientId } = useAuth();
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
          const [v, s] = await Promise.all([
            api.post("/xtream/streams", { ...body, type: "vod" }).then((r) => r.data),
            api.post("/xtream/streams", { ...body, type: "series" }).then((r) => r.data),
          ]);
          if (cancelled) return;
          setMovies(v || []);
          setSeries(s || []);
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

  const latestMovies = useMemo(
    () =>
      [...movies]
        .filter((it) => it.added)
        .sort((a, b) => Number(b.added) - Number(a.added))
        .slice(0, 5),
    [movies]
  );

  const latestSeries = useMemo(
    () =>
      [...series]
        .filter((it) => it.last_modified || it.added)
        .sort((a, b) => Number(b.last_modified || b.added || 0) - Number(a.last_modified || a.added || 0))
        .slice(0, 5),
    [series]
  );

  if (!creds) return null;

  const username = creds.user_info?.username || creds.username || "";

  return (
    <div className="min-h-screen" data-testid="home-page">
      <div className="px-8 md:px-16 lg:px-24 pt-24 pb-12">
        <div className="text-sm uppercase tracking-[0.3em] text-[#FFB800] font-bold mb-3">
          Bienvenido{username ? `, ${username}` : ""}
        </div>
        <h1 className="font-display text-5xl md:text-7xl font-black tracking-tighter leading-none mb-6">
          ¿Qué quieres<br />ver hoy?
        </h1>
        <p className="text-xl md:text-2xl text-neutral-400 max-w-2xl">
          Elige una sección o continúa donde lo dejaste.
        </p>
      </div>

      {/* 3 tarjetas grandes: TV, Películas, Series */}
      <div className="px-8 md:px-16 lg:px-24 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SectionTile
            label="En Vivo"
            description="Canales y deportes en directo"
            icon={Tv}
            color="#FFB800"
            onClick={() => navigate("/live")}
            testid="tile-live"
          />
          <SectionTile
            label="Películas"
            description={movies.length ? `${movies.length.toLocaleString("es")} títulos disponibles` : "Catálogo completo"}
            icon={Film}
            color="#FF3366"
            onClick={() => navigate("/movies")}
            testid="tile-movies"
          />
          <SectionTile
            label="Series"
            description={series.length ? `${series.length.toLocaleString("es")} series disponibles` : "Temporadas y episodios"}
            icon={Clapperboard}
            color="#00D9C0"
            onClick={() => navigate("/series")}
            testid="tile-series"
          />
        </div>
      </div>

      <div className="px-8 md:px-16 lg:px-24 pb-20 space-y-16">
        {loading && (
          <div className="flex items-center gap-3 text-neutral-400 text-xl">
            <Loader2 className="w-6 h-6 animate-spin" /> Cargando…
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

        {!loading && latestMovies.length > 0 && (
          <Row title="Últimas 5 películas agregadas" testid="row-latest-movies">
            {latestMovies.map((it, idx) => (
              <PosterCard
                key={it.stream_id}
                testid={`latest-movie-${idx}`}
                title={it.name}
                image={it.stream_icon}
                meta={it.rating ? `★ ${it.rating}` : null}
                onActivate={() => navigate(`/vod/${it.stream_id}`, { state: it })}
              />
            ))}
          </Row>
        )}

        {!loading && latestSeries.length > 0 && (
          <Row title="Últimas 5 series agregadas" testid="row-latest-series">
            {latestSeries.map((it, idx) => (
              <PosterCard
                key={it.series_id}
                testid={`latest-series-${idx}`}
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

function SectionTile({ label, description, icon: Icon, color, onClick, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className="focus-tv group relative overflow-hidden rounded-3xl bg-[#0a0a0a] border border-neutral-900 p-8 text-left outline-none transition-transform aspect-[16/9] md:aspect-[3/2]"
    >
      <div
        className="absolute inset-0 opacity-30 group-hover:opacity-60 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 70% 30%, ${color}33 0%, transparent 60%)`,
        }}
      />
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: color, color: "#050505" }}
        >
          <Icon className="w-8 h-8" strokeWidth={2.4} />
        </div>
        <div>
          <h2 className="font-display font-black text-4xl md:text-5xl tracking-tighter mb-2">
            {label}
          </h2>
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-base">{description}</span>
            <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </button>
  );
}
