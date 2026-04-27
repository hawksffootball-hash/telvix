import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Tv, Film, Clapperboard, Star, Search, LogOut, Home, Menu } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const nav = [
  { to: "/", icon: Home, label: "Inicio", test: "nav-home" },
  { to: "/live", icon: Tv, label: "En Vivo", test: "nav-live" },
  { to: "/movies", icon: Film, label: "Películas", test: "nav-movies" },
  { to: "/series", icon: Clapperboard, label: "Series", test: "nav-series" },
  { to: "/favorites", icon: Star, label: "Favoritos", test: "nav-favorites" },
  { to: "/search", icon: Search, label: "Buscar", test: "nav-search" },
];

export default function Shell({ children }) {
  const { logout, creds } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // Cierra con Esc
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "m" || e.key === "M") setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Trigger zone: borde izquierdo de 6px que abre el sidebar al hover */}
      <div
        className="fixed top-0 left-0 bottom-0 w-1.5 z-50 hover:w-3 transition-all duration-200"
        onMouseEnter={() => setOpen(true)}
        data-testid="sidebar-trigger"
        aria-hidden="true"
      />

      {/* Botón hamburger flotante (siempre visible arriba a la izquierda) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="sidebar-toggle"
        className="focus-tv fixed top-5 left-5 z-50 bg-black/60 backdrop-blur-md rounded-full p-3 outline-none border border-white/10 hover:bg-black/80"
        title="Menú (M)"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay oscuro cuando el sidebar está abierto */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        onMouseLeave={() => setOpen(false)}
        className={`fixed top-0 left-0 bottom-0 z-40 w-72 bg-[#0a0a0a] border-r border-neutral-900 flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0 shadow-2xl shadow-black/50" : "-translate-x-full"
        }`}
        data-testid="sidebar"
      >
        <div className="h-24 flex items-center px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FFB800] text-black flex items-center justify-center font-black text-xl shrink-0 font-display">
              T
            </div>
            <span className="font-display font-black text-2xl tracking-tighter">
              TELEVIX
            </span>
          </div>
        </div>
        <nav className="flex-1 flex flex-col gap-2 px-3 mt-4">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={n.test}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `focus-tv flex items-center gap-5 px-5 py-4 rounded-xl text-lg transition-colors outline-none ${
                  isActive
                    ? "bg-[#FFB800] text-black font-bold"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <n.icon className="w-6 h-6 shrink-0" />
              <span className="whitespace-nowrap">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-neutral-900">
          <div className="px-4 py-3 text-xs text-neutral-500 truncate">
            {creds?.username || creds?.user_info?.username || ""}
          </div>
          <button
            onClick={onLogout}
            data-testid="logout-btn"
            className="focus-tv w-full flex items-center gap-5 px-5 py-4 rounded-xl text-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors outline-none"
          >
            <LogOut className="w-6 h-6 shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main className="min-h-screen">{children}</main>
    </div>
  );
}
