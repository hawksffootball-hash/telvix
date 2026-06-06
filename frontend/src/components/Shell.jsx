import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Tv, Film, Clapperboard, Star, Search, LogOut, Home } from "lucide-react";
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

  const onLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      {/* Sidebar SIEMPRE visible (fijo) */}
      <aside
        className="fixed top-0 left-0 bottom-0 z-40 w-64 bg-[#0a0a0a] border-r border-neutral-900 flex flex-col"
        data-testid="sidebar"
      >
        <div className="h-20 flex items-center px-6 border-b border-neutral-900">
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
              className={({ isActive }) =>
                `focus-tv flex items-center gap-4 px-4 py-3 rounded-xl text-base transition-colors outline-none ${
                  isActive
                    ? "bg-[#FFB800] text-black font-bold"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <n.icon className="w-5 h-5 shrink-0" />
              <span className="whitespace-nowrap">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-neutral-900">
          <div className="px-3 py-2 text-xs text-neutral-500 truncate">
            {creds?.username || creds?.user_info?.username || ""}
          </div>
          <button
            onClick={onLogout}
            data-testid="logout-btn"
            className="focus-tv w-full flex items-center gap-4 px-4 py-3 rounded-xl text-base text-neutral-400 hover:text-white hover:bg-white/5 transition-colors outline-none"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Contenido principal con padding-left para el sidebar */}
      <main className="flex-1 min-h-screen ml-64">{children}</main>
    </div>
  );
}
