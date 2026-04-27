import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  timeout: 30000,
});

export function buildXtreamUrl(creds, type, streamId, ext) {
  const server = (creds.server || "").replace(/\/$/, "");
  const u = encodeURIComponent(creds.username);
  const p = encodeURIComponent(creds.password);
  if (type === "live") {
    return `${server}/live/${u}/${p}/${streamId}.${ext || "m3u8"}`;
  }
  if (type === "vod") {
    return `${server}/movie/${u}/${p}/${streamId}.${ext || "mp4"}`;
  }
  if (type === "series") {
    return `${server}/series/${u}/${p}/${streamId}.${ext || "mp4"}`;
  }
  return "";
}

export function proxiedStreamUrl(originalUrl) {
  return `${API}/proxy/stream?u=${encodeURIComponent(originalUrl)}`;
}

// Use proxy when we're on https and stream is http (mixed content)
export function playableUrl(originalUrl) {
  try {
    const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    const streamHttp = originalUrl.startsWith("http://");
    if (isHttps && streamHttp) return proxiedStreamUrl(originalUrl);
    return originalUrl;
  } catch {
    return originalUrl;
  }
}
