import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tv, Loader2, Eye, EyeOff } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

export default function Login() {
  const [server, setServer] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onXtream = async (e) => {
    e.preventDefault();
    if (!server || !username || !password) {
      toast.error("Completa todos los campos");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/xtream/login", { server, username, password });
      login({
        mode: "xtream",
        server,
        username,
        password,
        user_info: data.user_info,
        server_info: data.server_info,
      });
      toast.success("Bienvenido");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-grid-dim p-8 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `url(https://images.unsplash.com/photo-1771873679947-dd2b426cfd77?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHwxfHxjaW5lbWF0aWMlMjBkYXJrJTIwdGV4dHVyZSUyMGJhY2tncm91bmR8ZW58MHx8fHwxNzc3MzI0MDQyfDA&ixlib=rb-4.1.0&q=85)`,
          backgroundSize: "cover",
          mixBlendMode: "overlay",
        }}
      />
      <div className="w-full max-w-2xl relative z-10">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-14 h-14 rounded-xl bg-[#FFB800] text-black flex items-center justify-center">
            <Tv className="w-8 h-8" />
          </div>
          <div>
            <h1 className="font-display text-5xl md:text-6xl font-black tracking-tighter">
              TELEVIX
            </h1>
            <p className="text-sm uppercase tracking-[0.3em] text-neutral-500 mt-1">
              Xtream Codes · Smart TV
            </p>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-neutral-900 rounded-2xl p-10 shadow-2xl">
          <form onSubmit={onXtream} className="space-y-5" data-testid="xtream-form">
            <Field
              label="URL del Servidor"
              placeholder="http://tuservidor.com:8080"
              value={server}
              onChange={setServer}
              testid="input-server"
            />
            <Field
              label="Usuario"
              placeholder="usuario"
              value={username}
              onChange={setUsername}
              testid="input-username"
            />
            <PasswordField
              label="Contraseña"
              value={password}
              onChange={setPassword}
              show={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
              testid="input-password"
            />
            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit"
              className="focus-tv w-full mt-4 bg-[#FFB800] text-black font-bold rounded-xl py-5 text-xl hover:bg-[#FFD147] transition-colors outline-none disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              Iniciar Sesión
            </button>
          </form>
        </div>

        <p className="text-center text-neutral-500 text-sm mt-8">
          Optimizado para Samsung Tizen y LG webOS · Navega con ← ↑ → ↓
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", testid }) {
  return (
    <label className="block">
      <span className="text-sm uppercase tracking-[0.2em] text-neutral-500 font-semibold">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testid}
        className="focus-tv mt-2 w-full bg-[#111] border-2 border-neutral-800 rounded-xl px-5 py-4 text-lg text-white placeholder:text-neutral-600 focus:border-[#FFB800] focus:bg-[#151515] outline-none transition-colors"
      />
    </label>
  );
}

function PasswordField({ label, value, onChange, show, onToggle, testid }) {
  return (
    <label className="block">
      <span className="text-sm uppercase tracking-[0.2em] text-neutral-500 font-semibold">
        {label}
      </span>
      <div className="relative mt-2">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          data-testid={testid}
          className="focus-tv w-full bg-[#111] border-2 border-neutral-800 rounded-xl pl-5 pr-14 py-4 text-lg text-white placeholder:text-neutral-600 focus:border-[#FFB800] focus:bg-[#151515] outline-none transition-colors"
        />
        <button
          type="button"
          onClick={onToggle}
          data-testid="toggle-password"
          tabIndex={0}
          className="focus-tv absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-neutral-400 hover:text-[#FFB800] outline-none"
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    </label>
  );
}
