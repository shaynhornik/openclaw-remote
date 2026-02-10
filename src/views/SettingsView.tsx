import { useState, useEffect, useCallback } from "react";
import { useConnectionStore } from "@/stores/connection";
import { useAuthStore } from "@/stores/auth";
import QRCode from "qrcode";

const isTailscale = (h: string) => h.endsWith(".ts.net");

export function SettingsView() {
  const url = useConnectionStore((s) => s.url);
  const status = useConnectionStore((s) => s.status);
  const error = useConnectionStore((s) => s.error);
  const hello = useConnectionStore((s) => s.hello);
  const setUrl = useConnectionStore((s) => s.setUrl);
  const connect = useConnectionStore((s) => s.connect);
  const disconnect = useConnectionStore((s) => s.disconnect);

  const token = useAuthStore((s) => s.token);
  const setToken = useAuthStore((s) => s.setToken);
  const setPassword = useAuthStore((s) => s.setPassword);
  const logout = useAuthStore((s) => s.logout);

  const [urlInput, setUrlInput] = useState(url);
  const [tokenInput, setTokenInput] = useState(token ?? "");
  const [passwordInput, setPasswordInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => { setUrlInput(url); }, [url]);

  const isConnected = status === "connected";
  const isConnecting = status === "connecting" || status === "authenticating";

  const handleConnect = () => {
    setUrl(urlInput);
    if (tokenInput) setToken(tokenInput);
    if (passwordInput) setPassword(passwordInput);
    connect();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Connection */}
      <section className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Connection</h2>

        <div className="space-y-2">
          <label htmlFor="gateway-url" className="block text-sm font-medium text-slate-300">
            Gateway URL
          </label>
          <input
            id="gateway-url"
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="ws://localhost:18789"
            disabled={isConnected || isConnecting}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <p className="text-xs text-slate-500">
            Auto-detected from the gateway. Override only if needed.
          </p>
        </div>

        {/* Advanced auth — collapsed by default */}
        <div className="mt-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showAdvanced ? "Hide" : "Show"} advanced auth options
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3 rounded-md border border-slate-700 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-500">
                Only needed if your gateway requires token or password authentication.
                Most setups use automatic device authentication.
              </p>
              <div className="space-y-2">
                <label htmlFor="auth-token" className="block text-xs font-medium text-slate-400">
                  Auth Token
                </label>
                <input
                  id="auth-token"
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Token from gateway config"
                  disabled={isConnected || isConnecting}
                  autoComplete="off"
                  className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="auth-password" className="block text-xs font-medium text-slate-400">
                  Password <span className="text-slate-600">(not persisted)</span>
                </label>
                <input
                  id="auth-password"
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Gateway password"
                  disabled={isConnected || isConnecting}
                  autoComplete="off"
                  className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              {(token || tokenInput) && (
                <button
                  onClick={() => {
                    logout();
                    setTokenInput("");
                    setPasswordInput("");
                  }}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-700 transition-colors"
                >
                  Clear Auth
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-900/30 border border-red-800/50 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          {isConnected ? (
            <button
              onClick={() => disconnect()}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={!urlInput || isConnecting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isConnecting ? "Connecting..." : "Connect"}
            </button>
          )}
        </div>
      </section>

      {/* Connection details */}
      {isConnected && hello && (
        <section className="rounded-lg border border-slate-700 bg-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Connection Details</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-slate-400">Server</dt>
            <dd className="text-white">{hello.server.name ?? "gateway"}</dd>
            <dt className="text-slate-400">Version</dt>
            <dd className="text-white">{hello.server.version}</dd>
            <dt className="text-slate-400">Protocol</dt>
            <dd className="text-white">v{hello.protocol}</dd>
            {hello.features?.methods && (
              <>
                <dt className="text-slate-400">Available Methods</dt>
                <dd className="text-white">{hello.features.methods.length}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {/* Mobile Access */}
      <MobileAccessSection />
    </div>
  );
}

// ── Mobile Access Section ─────────────────────────────────────────

function MobileAccessSection() {
  const hostname = window.location.hostname;
  const onTailscale = isTailscale(hostname);
  const isSecure = window.location.protocol === "https:";

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // The share URL is just the current page URL — the dashboard is served from the gateway
  const shareUrl = window.location.href;

  const generateQr = useCallback(async () => {
    try {
      const dataUrl = await QRCode.toDataURL(shareUrl, {
        width: 256,
        margin: 2,
        color: { dark: "#e2e8f0", light: "#0f172a" },
        errorCorrectionLevel: "M",
      });
      setQrDataUrl(dataUrl);
    } catch {
      setQrDataUrl(null);
    }
  }, [shareUrl]);

  useEffect(() => { generateQr(); }, [generateQr]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-800 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Mobile Access</h2>

      {onTailscale && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-green-900/30 border border-green-800/50 px-3 py-2">
          <span className="text-green-400 text-sm mt-0.5">&#10003;</span>
          <p className="text-xs text-green-400">
            Connected via Tailscale ({hostname}). Your connection is encrypted with WireGuard.
          </p>
        </div>
      )}

      {!isSecure && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-yellow-900/30 border border-yellow-800/50 px-3 py-2">
          <span className="text-yellow-500 text-sm mt-0.5">!</span>
          <p className="text-xs text-yellow-400">
            This page is served over HTTP. For secure mobile access, enable HTTPS on the gateway
            or use <a href="https://tailscale.com/download" target="_blank" rel="noopener noreferrer" className="underline">Tailscale</a>.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          Scan this QR code from your phone to open the dashboard.
          {onTailscale ? " Both devices must be on your Tailscale network." : ""}
          {" "}The gateway URL is auto-detected — no manual setup needed.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          {qrDataUrl && (
            <div className="shrink-0 rounded-lg bg-slate-900 p-3">
              <img
                src={qrDataUrl}
                alt="QR code for mobile access"
                width={200}
                height={200}
                className="rounded"
              />
            </div>
          )}

          <div className="flex-1 space-y-3 w-full">
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Dashboard URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-300 font-mono truncate"
                />
                <button
                  onClick={handleCopy}
                  className="rounded-md border border-slate-600 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors shrink-0"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <details className="text-xs">
              <summary className="text-slate-400 cursor-pointer hover:text-slate-300">
                How it works
              </summary>
              <ul className="mt-2 space-y-1 text-slate-500 list-disc list-inside">
                <li>The dashboard is served directly from the gateway — same port, same address</li>
                <li>Your phone auto-connects to the gateway when you open the page</li>
                <li>Each device gets its own cryptographic identity (ED25519)</li>
                <li>Add to home screen for an app-like experience (PWA)</li>
                {!isSecure && (
                  <li>For encrypted access, run the gateway behind Tailscale or a reverse proxy with HTTPS</li>
                )}
              </ul>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}
