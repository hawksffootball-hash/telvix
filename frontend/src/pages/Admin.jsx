import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, RefreshCw, Trash2, Plus, LogOut, Power, Users, Server } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const TOKEN_KEY = "televix_admin_token";

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [pwd, setPwd] = useState("");
  const [authed, setAuthed] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeCount, setActiveCount] = useState(0);
  const [servers, setServers] = useState([]);
  const [newServer, setNewServer] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const authHeader = useCallback(() => ({ "X-Admin-Token": token }), [token]);

  const loadSessions = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get("/admin/sessions?minutes=5", { headers: authHeader() });
      setSessions(data.sessions || []);
      setActiveCount(data.active || 0);
    } catch (e) {
      if (e?.response?.status === 403) {
        localStorage.removeItem(TOKEN_KEY);
        setAuthed(false);
        setToken("");
        toast.error("Token inválido o expirado");
      }
    }
  }, [token, authHeader]);

  const loadServers = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get("/admin/allowed-servers", { headers: authHeader() });
      setServers(data || []);
    } catch {}
  }, [token, authHeader]);

  // Autenticación con el token guardado
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        await api.post("/admin/auth", { token });
        setAuthed(true);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setAuthed(false);
      }
    })();
  }, [token]);

  // Refresh cada 10s
  useEffect(() => {
    if (!authed) return;
    loadSessions();
    loadServers();
    const i = setInterval(() => { loadSessions(); }, 10000);
    return () => clearInterval(i);
  }, [authed, loadSessions, loadServers]);

  const onLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/admin/auth", { token: pwd });
      localStorage.setItem(TOKEN_KEY, pwd);
      setToken(pwd);
      setAuthed(true);
      toast.success("Acceso concedido");
    } catch {
      toast.error("Token incorrecto");
    }
    setLoading(false);
  };

  const onLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setAuthed(false);
    setPwd("");
  };

  const addServer = async (e) => {
    e.preventDefault();
    if (!newServer.trim()) return toast.error("URL requerida");
    try {
      await api.post("/admin/allowed-servers",
        { server_url: newServer.trim(), label: newLabel.trim() },
        { headers: authHeader() });
      setNewServer(""); setNewLabel("");
      await loadServers();
      toast.success("Servidor agregado");
    } catch {
      toast.error("No se pudo agregar");
    }
  };

  const removeServer = async (id) => {
    if (!confirm("¿Eliminar este servidor de la lista?")) return;
    try {
      await api.delete(`/admin/allowed-servers/${id}`, { headers: authHeader() });
      await loadServers();
      toast.success("Eliminado");
    } catch { toast.error("Error"); }
  };

  const toggleServer = async (id, active) => {
    try {
      await api.patch(`/admin/allowed-servers/${id}`, { active: !active }, { headers: authHeader() });
      await loadServers();
    } catch { toast.error("Error"); }
  };

  const kickSession = async (clientId) => {
    if (!confirm("¿Desconectar esta sesión?")) return;
    try {
      await api.delete(`/admin/sessions/${clientId}`, { headers: authHeader() });
      await loadSessions();
      toast.success("Sesión eliminada");
    } catch { toast.error("Error"); }
  };

  const fmtAgo = (iso) => {
    if (!iso) return "?";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
        <form onSubmit={onLogin} className="w-full max-w-md bg-[#0a0a0a] border border-neutral-900 rounded-2xl p-10 space-y-5">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-[#FFB800]" />
            <h1 className="font-display text-3xl font-black">Panel Admin</h1>
          </div>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-semibold">Token de administrador</span>
            <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus
              className="focus-tv mt-2 w-full bg-[#111] border-2 border-neutral-800 rounded-xl px-5 py-4 text-lg focus:border-[#FFB800] outline-none" />
          </label>
          <button type="submit" disabled={loading}
            className="focus-tv w-full bg-[#FFB800] text-black font-bold rounded-xl py-4 text-lg hover:bg-[#FFD147] outline-none disabled:opacity-50">
            {loading ? "Verificando..." : "Entrar"}
          </button>
          <button type="button" onClick={() => navigate("/")}
            className="text-sm text-neutral-500 hover:text-white block w-full text-center">
            Volver a la app
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-10">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-[#FFB800]" />
          <h1 className="font-display text-4xl font-black tracking-tighter">Admin</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { loadSessions(); loadServers(); }}
            className="focus-tv bg-[#111] border border-neutral-800 rounded-xl px-4 py-2 flex items-center gap-2 outline-none">
            <RefreshCw className="w-4 h-4" /> Refrescar
          </button>
          <button onClick={onLogout}
            className="focus-tv bg-red-900/40 border border-red-900 rounded-xl px-4 py-2 flex items-center gap-2 outline-none">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </div>

      {/* Sesiones activas */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-5">
          <Users className="w-6 h-6 text-[#FFB800]" />
          <h2 className="font-display text-2xl font-bold">Usuarios conectados</h2>
          <span className="bg-[#FFB800] text-black font-bold rounded-full px-3 py-1 text-sm">{activeCount}</span>
          <span className="text-xs text-neutral-500">(últimos 5 minutos)</span>
        </div>
        {sessions.length === 0 ? (
          <p className="text-neutral-500">Nadie conectado ahora mismo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-[#0a0a0a] border border-neutral-900 rounded-xl">
              <thead className="bg-[#111] text-xs uppercase tracking-wider text-neutral-400">
                <tr>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">IP</th>
                  <th className="px-4 py-3 text-left">Servidor Xtream</th>
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-left">Hace</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.client_id} className="border-t border-neutral-900">
                    <td className="px-4 py-3 font-mono text-xs">{s.client_id.slice(0, 8)}…</td>
                    <td className="px-4 py-3">{s.ip || "?"}</td>
                    <td className="px-4 py-3 text-sm">{s.server_used || "—"}</td>
                    <td className="px-4 py-3">{s.username_used || "—"}</td>
                    <td className="px-4 py-3 text-sm text-neutral-400">{fmtAgo(s.last_seen)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => kickSession(s.client_id)}
                        className="focus-tv text-red-400 hover:text-red-300 p-1 outline-none" title="Desconectar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Servidores permitidos */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <Server className="w-6 h-6 text-[#FFB800]" />
          <h2 className="font-display text-2xl font-bold">Servidores Xtream permitidos</h2>
        </div>
        <p className="text-sm text-neutral-500 mb-5">
          Si la lista está vacía, se permite cualquier servidor. En cuanto agregas el primero, solo esos podrán usarse.
        </p>

        <form onSubmit={addServer} className="bg-[#0a0a0a] border border-neutral-900 rounded-xl p-5 mb-5 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[280px]">
            <label className="text-xs uppercase tracking-wider text-neutral-500 font-semibold block mb-1">URL del servidor (con http:// o https:// y puerto)</label>
            <input value={newServer} onChange={(e) => setNewServer(e.target.value)} placeholder="http://midns.com:8080"
              className="focus-tv w-full bg-[#111] border border-neutral-800 rounded-lg px-4 py-3 focus:border-[#FFB800] outline-none" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs uppercase tracking-wider text-neutral-500 font-semibold block mb-1">Etiqueta (opcional)</label>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Mi proveedor"
              className="focus-tv w-full bg-[#111] border border-neutral-800 rounded-lg px-4 py-3 focus:border-[#FFB800] outline-none" />
          </div>
          <button type="submit"
            className="focus-tv bg-[#FFB800] text-black font-bold rounded-lg px-5 py-3 flex items-center gap-2 outline-none">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </form>

        {servers.length === 0 ? (
          <p className="text-neutral-500">Lista vacía — todos los servidores están permitidos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-[#0a0a0a] border border-neutral-900 rounded-xl">
              <thead className="bg-[#111] text-xs uppercase tracking-wider text-neutral-400">
                <tr>
                  <th className="px-4 py-3 text-left">URL</th>
                  <th className="px-4 py-3 text-left">Etiqueta</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {servers.map((s) => (
                  <tr key={s.id} className="border-t border-neutral-900">
                    <td className="px-4 py-3 font-mono text-sm">{s.server_url}</td>
                    <td className="px-4 py-3">{s.label || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-semibold ${s.active ? "bg-green-900/40 text-green-400" : "bg-neutral-800 text-neutral-500"}`}>
                        {s.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-2 justify-end">
                      <button onClick={() => toggleServer(s.id, s.active)}
                        className="focus-tv text-neutral-400 hover:text-[#FFB800] p-1 outline-none"
                        title={s.active ? "Desactivar" : "Activar"}>
                        <Power className="w-4 h-4" />
                      </button>
                      <button onClick={() => removeServer(s.id)}
                        className="focus-tv text-red-400 hover:text-red-300 p-1 outline-none" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
