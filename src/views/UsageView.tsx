import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useUsageStore, computeFilteredUsage } from "@/stores/usage";
import type { TimePeriod } from "@/stores/usage";
import { useConnectionStore } from "@/stores/connection";
import { useRequest } from "@/hooks/useRequest";
import { formatTokens, formatCost } from "@/utils/format";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const PERIODS: { key: TimePeriod; label: string }[] = [
  { key: "1h", label: "1 Hour" },
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "all", label: "All Time" },
];

export function UsageView() {
  const metrics = useUsageStore((s) => s.metrics);
  const events = useUsageStore((s) => s.events);
  const status = useConnectionStore((s) => s.status);
  const usageReq = useRequest<unknown>();
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [period, setPeriod] = useState<TimePeriod>("24h");

  const refresh = useCallback(async () => {
    const result = await usageReq.execute("usage.cost", { days: 30 });
    if (result && typeof result === "object") {
      useUsageStore.getState().setUsageData(result);
    }
  }, [usageReq]);

  useEffect(() => {
    if (status === "connected") {
      refresh();
      refreshInterval.current = setInterval(refresh, 30_000);
    }
    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
        refreshInterval.current = null;
      }
    };
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(
    () => computeFilteredUsage(events, metrics, period),
    [events, metrics, period],
  );

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Connect to gateway to view usage
      </div>
    );
  }

  const hasData = filtered.totalInputTokens > 0 || filtered.totalOutputTokens > 0 || filtered.totalCost > 0;

  const modelData = Object.entries(filtered.byModel).map(([model, usage]) => ({
    name: model,
    input: usage.inputTokens,
    output: usage.outputTokens,
    cost: usage.cost,
  }));

  const agentEntries = Object.entries(filtered.byAgent);

  return (
    <div className="space-y-6">
      {/* Time period selector */}
      <div className="flex items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              period === p.key
                ? "bg-blue-600 text-white"
                : "border border-slate-600 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={refresh}
            disabled={usageReq.loading}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {usageReq.loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Input Tokens" value={formatTokens(filtered.totalInputTokens)} />
        <MetricCard label="Output Tokens" value={formatTokens(filtered.totalOutputTokens)} />
        <MetricCard label="Cache Read" value={formatTokens(filtered.totalCacheReadTokens)} />
        <MetricCard label="Total Cost" value={formatCost(filtered.totalCost)} highlight />
      </div>

      {!hasData && !usageReq.loading && (
        <div className="text-xs text-slate-500">
          No usage data for this period. Usage updates as agents process requests.
        </div>
      )}

      {/* Token usage over time */}
      {filtered.chartData.length > 1 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
            Token Usage Over Time
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filtered.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="ts"
                  tickFormatter={(ts: number) => formatChartTime(ts, period)}
                  stroke="#64748b"
                  fontSize={11}
                />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={formatTokens} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(ts: number) => new Date(ts).toLocaleString()}
                />
                <Area
                  type="monotone"
                  dataKey="inputTokens"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                  name="Input"
                />
                <Area
                  type="monotone"
                  dataKey="outputTokens"
                  stackId="1"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.3}
                  name="Output"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Usage by model */}
      {modelData.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
            Usage by Model
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={formatTokens} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="input" fill="#3b82f6" name="Input" radius={[4, 4, 0, 0]} />
                <Bar dataKey="output" fill="#8b5cf6" name="Output" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Usage by agent */}
      {agentEntries.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
            Usage by Agent
          </h3>
          <div className="space-y-4">
            {agentEntries
              .sort(([, a], [, b]) => {
                const costA = Object.values(a).reduce((s, m) => s + m.cost, 0);
                const costB = Object.values(b).reduce((s, m) => s + m.cost, 0);
                return costB - costA;
              })
              .map(([agentId, models]) => {
                const totalIn = Object.values(models).reduce((s, m) => s + m.inputTokens, 0);
                const totalOut = Object.values(models).reduce((s, m) => s + m.outputTokens, 0);
                const totalCost = Object.values(models).reduce((s, m) => s + m.cost, 0);
                const modelEntries = Object.entries(models).sort(([, a], [, b]) => b.cost - a.cost);

                return (
                  <div key={agentId} className="rounded-md bg-slate-700/30 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm text-white">{agentId}</span>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>{formatTokens(totalIn)} in</span>
                        <span>{formatTokens(totalOut)} out</span>
                        <span className="text-green-400 font-medium">{formatCost(totalCost)}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {modelEntries.map(([model, usage]) => (
                        <div key={model} className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-mono">{model}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-blue-400">{formatTokens(usage.inputTokens)} in</span>
                            <span className="text-purple-400">{formatTokens(usage.outputTokens)} out</span>
                            <span className="text-slate-300 w-16 text-right">{formatCost(usage.cost)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
        {label}
      </span>
      <p className={`mt-2 text-2xl font-bold ${highlight ? "text-green-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function formatChartTime(ts: number, period: TimePeriod): string {
  const d = new Date(ts);
  if (period === "1h" || period === "24h") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
