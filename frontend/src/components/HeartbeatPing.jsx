import { useEffect } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

// Envía heartbeat al backend cada 30s con la sesión activa.
// El backend lo registra para el panel admin.
export default function HeartbeatPing() {
  const { clientId, creds, isAuthed } = useAuth();

  useEffect(() => {
    if (!isAuthed || !clientId) return;
    const ping = () => {
      api.post("/heartbeat", {
        client_id: clientId,
        server_used: creds?.server || creds?.m3uUrl || "",
        username_used: creds?.username || "",
      }).catch(() => {});
    };
    ping();
    const i = setInterval(ping, 30000);
    return () => clearInterval(i);
  }, [isAuthed, clientId, creds]);

  return null;
}
