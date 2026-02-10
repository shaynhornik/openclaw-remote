import { useState, useCallback } from "react";
import { useConnectionStore } from "@/stores/connection";
import { useAgentsStore } from "@/stores/agents";
import { Badge } from "@/components/shared/Badge";

interface DiagnosticCheck {
  name: string;
  status: "pass" | "warn" | "fail" | "info";
  message: string;
  detail?: string;
}

interface DoctorResult {
  checks: DiagnosticCheck[];
  ranAt: number;
}

export function DoctorView() {
  const status = useConnectionStore((s) => s.status);
  const hello = useConnectionStore((s) => s.hello);
  const agents = useAgentsStore((s) => s.agentsList);

  const [result, setResult] = useState<DoctorResult | null>(null);
  const [running, setRunning] = useState(false);

  const runDoctor = useCallback(async () => {
    setRunning(true);
    const checks: DiagnosticCheck[] = [];
    const client = useConnectionStore.getState()._client;

    // 1. Connection check
    if (status === "connected" && client) {
      checks.push({
        name: "Gateway Connection",
        status: "pass",
        message: "Connected to gateway",
        detail: `Protocol v${hello?.protocol ?? "?"}`,
      });
    } else {
      checks.push({
        name: "Gateway Connection",
        status: "fail",
        message: "Not connected to gateway",
      });
      setResult({ checks, ranAt: Date.now() });
      setRunning(false);
      return;
    }

    // 2. Security check
    const url = useConnectionStore.getState().url;
    if (url.startsWith("wss://")) {
      checks.push({
        name: "Transport Security",
        status: "pass",
        message: "Connection uses WSS (encrypted)",
      });
    } else {
      checks.push({
        name: "Transport Security",
        status: "warn",
        message: "Connection uses WS (unencrypted)",
        detail: "Device authentication is disabled over plain WebSocket. Use wss:// for production.",
      });
    }

    // 3. Server health via RPC
    try {
      const health = await client.request<unknown>("health");
      if (health && typeof health === "object") {
        const h = health as Record<string, unknown>;
        const ok = h.ok === true || h.status === "ok";
        checks.push({
          name: "Server Health",
          status: ok ? "pass" : "warn",
          message: ok ? "Server reports healthy" : "Server reports degraded health",
          detail: h.durationMs ? `Health check took ${h.durationMs}ms` : undefined,
        });
      }
    } catch {
      checks.push({
        name: "Server Health",
        status: "info",
        message: "Health RPC not available",
      });
    }

    // 4. Try doctor RPC (multiple method names)
    let doctorResult: unknown = null;
    for (const method of ["doctor", "agent.doctor", "agents.doctor", "diagnostics"]) {
      try {
        doctorResult = await client.request<unknown>(method);
        if (doctorResult) break;
      } catch {
        // try next
      }
    }

    if (doctorResult && typeof doctorResult === "object") {
      const dr = doctorResult as Record<string, unknown>;

      // Parse structured doctor results
      if (Array.isArray(dr.checks) || Array.isArray(dr.results) || Array.isArray(dr.diagnostics)) {
        const items = (dr.checks ?? dr.results ?? dr.diagnostics) as unknown[];
        for (const item of items) {
          if (item && typeof item === "object") {
            const c = item as Record<string, unknown>;
            checks.push({
              name: String(c.name ?? c.check ?? c.label ?? "Check"),
              status: mapStatus(c.status ?? c.result ?? c.state),
              message: String(c.message ?? c.description ?? c.detail ?? ""),
              detail: typeof c.detail === "string" ? c.detail : undefined,
            });
          }
        }
      } else {
        // Single-object result
        const ok = dr.ok === true || dr.status === "ok" || dr.healthy === true;
        checks.push({
          name: "Agent Diagnostics",
          status: ok ? "pass" : "warn",
          message: String(dr.message ?? dr.summary ?? (ok ? "All checks passed" : "Issues detected")),
          detail: dr.detail ? String(dr.detail) : undefined,
        });
      }
    } else {
      checks.push({
        name: "Agent Diagnostics",
        status: "info",
        message: "Doctor RPC not available on this gateway",
        detail: "Tried: doctor, agent.doctor, agents.doctor, diagnostics",
      });
    }

    // 5. Agent status checks
    if (agents.length > 0) {
      const running = agents.filter((a) => a.status === "running");
      const errored = agents.filter((a) => a.status === "error");
      checks.push({
        name: "Agents",
        status: errored.length > 0 ? "warn" : "pass",
        message: `${agents.length} agents configured, ${running.length} running`,
        detail: errored.length > 0 ? `${errored.length} agents in error state` : undefined,
      });

      // Check each agent has a model
      const noModel = agents.filter((a) => !a.model);
      if (noModel.length > 0) {
        checks.push({
          name: "Agent Models",
          status: "info",
          message: `${noModel.length} agents without explicit model assignment`,
        });
      }
    } else {
      checks.push({
        name: "Agents",
        status: "warn",
        message: "No agents found",
      });
    }

    // 6. Available features
    if (hello?.features?.methods) {
      checks.push({
        name: "API Methods",
        status: "pass",
        message: `${hello.features.methods.length} methods available`,
      });
    }

    if (hello?.features?.events) {
      checks.push({
        name: "Event Streams",
        status: "pass",
        message: `${hello.features.events.length} event types supported`,
      });
    }

    // 7. Try channel health
    try {
      const channels = await client.request<unknown>("channels.list");
      if (channels && typeof channels === "object") {
        const ch = channels as Record<string, unknown>;
        const list = Array.isArray(channels) ? channels : (ch.channels ?? ch.list);
        if (Array.isArray(list)) {
          const active = list.filter((c) => {
            if (!c || typeof c !== "object") return false;
            const cc = c as Record<string, unknown>;
            return cc.running === true || cc.status === "active";
          });
          checks.push({
            name: "Channels",
            status: active.length > 0 ? "pass" : "info",
            message: `${list.length} channels configured, ${active.length} active`,
          });
        }
      }
    } catch {
      // channels.list not available
    }

    setResult({ checks, ranAt: Date.now() });
    setRunning(false);
  }, [status, hello, agents]);

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Connect to gateway to run diagnostics
      </div>
    );
  }

  const passCount = result?.checks.filter((c) => c.status === "pass").length ?? 0;
  const warnCount = result?.checks.filter((c) => c.status === "warn").length ?? 0;
  const failCount = result?.checks.filter((c) => c.status === "fail").length ?? 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Run button */}
      <div className="flex items-center gap-4">
        <button
          onClick={runDoctor}
          disabled={running}
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {running ? "Running Diagnostics..." : "Run Diagnostics"}
        </button>
        {result && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-400">{passCount} passed</span>
            {warnCount > 0 && <span className="text-yellow-400">{warnCount} warnings</span>}
            {failCount > 0 && <span className="text-red-400">{failCount} failed</span>}
            <span className="text-slate-500 text-xs">
              {new Date(result.ranAt).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {!result && !running && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 text-center">
          <p className="text-slate-400 text-sm">
            Run diagnostics to check gateway health, agent status, and connectivity.
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-2">
          {result.checks.map((check, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-700 bg-slate-800 p-4"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">
                  {check.status === "pass" ? "\u2705" :
                   check.status === "warn" ? "\u26A0\uFE0F" :
                   check.status === "fail" ? "\u274C" : "\u2139\uFE0F"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white text-sm">{check.name}</span>
                    <Badge variant={
                      check.status === "pass" ? "success" :
                      check.status === "warn" ? "warning" :
                      check.status === "fail" ? "error" : "default"
                    }>
                      {check.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">{check.message}</p>
                  {check.detail && (
                    <p className="text-xs text-slate-500 mt-1">{check.detail}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function mapStatus(val: unknown): DiagnosticCheck["status"] {
  const s = String(val).toLowerCase();
  if (s === "pass" || s === "ok" || s === "success" || s === "healthy" || s === "true") return "pass";
  if (s === "warn" || s === "warning" || s === "degraded") return "warn";
  if (s === "fail" || s === "error" || s === "critical" || s === "false") return "fail";
  return "info";
}
