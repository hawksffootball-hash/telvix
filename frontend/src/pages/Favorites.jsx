import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Star } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import PosterCard, { LiveCard } from "../components/PosterCard";

export default function Favorites() {
  const { clientId } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      try {
        const { data } = await api.get("/favorites", { params: { client_id: clientId } });
        setItems(data || []);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, [clientId]);

  const open = (it) => {
    if (it.type === "series") {
      navigate(`/series/${it.stream_id}`, { state: it.extra });
    } else {
      navigate(`/player/${it.type}/${it.stream_id}`, { state: it.extra });
    }
  };

  return (
    <div className="p-8 md:p-12" data-testid="favorites-page">
      <h1 className="font-display text-5xl md:text-6xl font-black tracking-tighter mb-8">
        Favoritos
      </h1>

      {loading ? (
        <div className="flex items-center gap-3 text-neutral-400 text-xl">
          <Loader2 className="w-6 h-6 animate-spin" /> Cargando…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 text-neutral-500">
          <Star className="w-16 h-16 mb-4 text-neutral-700" />
          <p className="text-2xl">Aún no tienes favoritos</p>
          <p className="text-lg mt-2">Marca canales, películas o series con la estrella mientras los ves.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {items.map((it, idx) =>
            it.type === "live" ? (
              <LiveCard
                key={it.id}
                testid={`fav-item-${idx}`}
                title={it.name}
                image={it.icon}
                onActivate={() => open(it)}
              />
            ) : (
              <PosterCard
                key={it.id}
                testid={`fav-item-${idx}`}
                title={it.name}
                image={it.icon}
                onActivate={() => open(it)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
