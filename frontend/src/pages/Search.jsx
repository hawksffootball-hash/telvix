import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import PosterCard, { LiveCard } from "../components/PosterCard";

export default function Search() {
  const { creds } = useAuth();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [all, setAll] = useState({ live: [], vod: [], series: [] });
  const navigate = useNavigate();

  useEffect(() => {
    if (creds?.mode !== "xtream") {
      setLoading(false);
      return;
    }
    (async () => {
      const body = { server: creds.server, username: creds.username, password: creds.password };
      try {
        const [l, v, s] = await Promise.all([
          api.post("/xtream/streams", { ...body, type: "live" }).then((r) => r.data),
          api.post("/xtream/streams", { ...body, type: "vod" }).then((r) => r.data),
          api.post("/xtream/streams", { ...body, type: "series" }).then((r) => r.data),
        ]);
        setAll({ live: l || [], vod: v || [], series: s || [] });
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, [creds]);

  const filtered = useMemo(() => {
    if (!q) return { live: [], vod: [], series: [] };
    const qq = q.toLowerCase();
    const f = (arr) => arr.filter((it) => (it.name || "").toLowerCase().includes(qq)).slice(0, 40);
    return { live: f(all.live), vod: f(all.vod), series: f(all.series) };
  }, [q, all]);

  const hasResults = q && (filtered.live.length + filtered.vod.length + filtered.series.length > 0);

  return (
    <div className="p-8 md:p-12" data-testid="search-page">
      <h1 className="font-display text-5xl md:text-6xl font-black tracking-tighter mb-8">
        Buscar
      </h1>
      <div className="relative max-w-3xl mb-10">
        <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-neutral-500" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Busca películas, series, canales…"
          data-testid="search-input"
          className="focus-tv w-full bg-[#111] border-2 border-neutral-800 rounded-2xl pl-14 pr-6 py-5 text-xl focus:border-[#FFB800] outline-none transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-neutral-400 text-xl">
          <Loader2 className="w-6 h-6 animate-spin" /> Cargando catálogo…
        </div>
      ) : !q ? (
        <div className="text-neutral-500 text-xl">Empieza a escribir para buscar</div>
      ) : !hasResults ? (
        <div className="text-neutral-500 text-xl">Sin resultados para "{q}"</div>
      ) : (
        <div className="space-y-12">
          {filtered.live.length > 0 && (
            <Section title="En Vivo">
              {filtered.live.map((it, idx) => (
                <LiveCard
                  key={it.stream_id}
                  testid={`search-live-${idx}`}
                  title={it.name}
                  image={it.stream_icon}
                  onActivate={() => navigate(`/player/live/${it.stream_id}`, { state: it })}
                />
              ))}
            </Section>
          )}
          {filtered.vod.length > 0 && (
            <Section title="Películas">
              {filtered.vod.map((it, idx) => (
                <PosterCard
                  key={it.stream_id}
                  testid={`search-vod-${idx}`}
                  title={it.name}
                  image={it.stream_icon}
                  onActivate={() => navigate(`/player/vod/${it.stream_id}`, { state: it })}
                />
              ))}
            </Section>
          )}
          {filtered.series.length > 0 && (
            <Section title="Series">
              {filtered.series.map((it, idx) => (
                <PosterCard
                  key={it.series_id}
                  testid={`search-series-${idx}`}
                  title={it.name}
                  image={it.cover}
                  onActivate={() => navigate(`/series/${it.series_id}`, { state: it })}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="font-display text-3xl font-bold tracking-tighter mb-5">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
        {children}
      </div>
    </section>
  );
}
