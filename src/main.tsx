import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { useConnectionStore } from "./stores/connection";
import "./index.css";

// ── Auto-detect gateway URL ──────────────────────────────────────
// The dashboard is served from the gateway itself (same origin),
// so the WebSocket URL is simply the current host with ws(s)://.
// ?gw= URL param can override (for dev or external hosting).
const params = new URLSearchParams(window.location.search);
const gwParam = params.get("gw");
const store = useConnectionStore.getState();

function inferGatewayUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

if (gwParam) {
  store.setUrl(gwParam);
  const clean = new URL(window.location.href);
  clean.searchParams.delete("gw");
  window.history.replaceState({}, "", clean.pathname + clean.search + clean.hash);
} else {
  store.setUrl(inferGatewayUrl());
}

// Auto-connect on load
if (store.url && store.status === "disconnected") {
  setTimeout(() => {
    const s = useConnectionStore.getState();
    if (s.status === "disconnected" && s.url) {
      s.connect();
    }
  }, 100);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
