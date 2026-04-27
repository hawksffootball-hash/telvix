import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import PosterCard, { LiveCard } from "../components/PosterCard";
import Row from "../components/Row";

export default function CatalogPage({ type }) {
  const { creds } = useAuth();
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const title = { live: "En Vivo", vod: "Películas", series: "Series" }[type];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (creds?.mode === "xtream") {
          const body = { server: creds.server, username: creds.username, password: creds.password };
          const [cats, streams] = await Promise.all([
            api.post("/xtream/categories", { ...body, type }).then((r) => r.data),
            api.post("/xtream/streams", { ...body, type }).then((r) => r.data),
          ]);
          setCategories(cats || []);
          setItems(streams || []);
        } else if (creds?.mode === "m3u" && type === "live") {
          const cats = creds.parsed?.categories || {};
          const all = [];
          const catList = [];
          Object.entries(cats).forEach(([group, arr], gi) => {
            catList.push({ category_id: String(gi), category_name: group });
            arr.forEach((it, ii) => all.push({ ...it, category_id: String(gi), _idx: `${gi}-${ii}` }));
          });
          setCategories(catList);
          setItems(all);
        } else {
          setItems([]);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    if (creds) load();
  }, [creds, type]);

  const filtered = useMemo(() => {
    if (activeCat === "all") return items;
    return items.filter((it) => String(it.category_id) === String(activeCat));
  }, [items, activeCat]);

  // Últimos 50 agregados (ordenados por timestamp `added` descendente)
  const latest = useMemo(() => {
    if (type === "live") return [];
    return [...items]
      .filter((it) => it.added)
      .sort((a, b) => Number(b.added) - Number(a.added))
      .slice(0, 50);
  }, [items, type]);

  const openItem = (it, idx) => {
    if (type === "series") {
      navigate(`/series/${it.series_id}`, { state: it });
    } else if (type === "vod") {
      navigate(`/vod/${it.stream_id}`, { state: it });
    } else {
      if (creds.mode === "xtream") navigate(`/player/live/${it.stream_id}`, { state: it });
      else navigate(`/player/m3u/${idx}`, { state: it });
    }
  };

  return (
    <div className="p-8 md:p-12" data-testid={`catalog-${type}`}>
      <h1 className="font-display text-5xl md:text-6xl font-black tracking-tighter mb-8">
        {title}
      </h1>

      <div className="flex gap-3 overflow-x-auto scroll-tv pb-4 mb-8">
        <CatBtn active={activeCat === "all"} onClick={() => setActiveCat("all")} testid="cat-all">
          Todas
        </CatBtn>
        {categories.map((c) => (
          <CatBtn
            key={c.category_id}
            active={String(activeCat) === String(c.category_id)}
            onClick={() => setActiveCat(c.category_id)}
            testid={`cat-${c.category_id}`}
          >
            {c.category_name}
          </CatBtn>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-neutral-400 text-xl">
          <Loader2 className="w-6 h-6 animate-spin" /> Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-neutral-500 text-xl py-20 text-center">No hay contenido disponible</div>
      ) : (
        <>
          {type !== "live" && latest.length > 0 && activeCat === "all" && (
            <div className="mb-12">
              <Row title="Últimos 50 agregados" testid="row-latest">
                {latest.map((it, idx) => (
                  <PosterCard
                    key={`latest-${it.stream_id || it.series_id}`}
                    testid={`latest-${type}-${idx}`}
                    title={it.name}
                    image={it.stream_icon || it.cover}
                    meta={it.rating ? `★ ${it.rating}` : null}
                    onActivate={() => openItem(it, idx)}
                  />
                ))}
              </Row>
            </div>
          )}
          <div
            className={
              type === "live"
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6"
                : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-6"
            }
          >
          {filtered.slice(0, 300).map((it, idx) => {
            const common = {
              key: (it.stream_id || it.series_id || it._idx || idx) + "-" + idx,
              title: it.name,
              image: it.stream_icon || it.cover || it.logo,
              onActivate: () => openItem(it, idx),
              testid: `${type}-item-${idx}`,
            };
            return type === "live" ? <LiveCard {...common} /> : <PosterCard {...common} />;
          })}
        </div>
        </>
      )}
    </div>
  );
}

function CatBtn({ active, onClick, children, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`focus-tv shrink-0 px-6 py-3 rounded-full text-base md:text-lg font-semibold transition-colors outline-none whitespace-nowrap ${
        active
          ? "bg-[#FFB800] text-black"
          : "bg-[#111] text-neutral-400 hover:text-white hover:bg-[#1a1a1a] border border-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}
