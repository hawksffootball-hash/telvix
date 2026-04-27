import React, { createContext, useContext, useMemo, useState, useEffect } from "react";

const AuthContext = createContext(null);

const CREDS_KEY = "tv_xtream_creds_v1";
const CLIENT_KEY = "tv_client_id_v1";

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function AuthProvider({ children }) {
  const [creds, setCreds] = useState(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(CREDS_KEY) : null;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [clientId, setClientId] = useState(() => {
    if (typeof window === "undefined") return null;
    let cid = localStorage.getItem(CLIENT_KEY);
    if (!cid) {
      cid = uuid();
      localStorage.setItem(CLIENT_KEY, cid);
    }
    return cid;
  });

  useEffect(() => {
    // No-op: state already initialised from localStorage. Kept for future side effects.
  }, []);

  const login = (c) => {
    localStorage.setItem(CREDS_KEY, JSON.stringify(c));
    setCreds(c);
  };

  const logout = () => {
    localStorage.removeItem(CREDS_KEY);
    setCreds(null);
  };

  const value = useMemo(
    () => ({ creds, clientId, login, logout, isAuthed: !!creds }),
    [creds, clientId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
