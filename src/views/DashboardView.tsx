import { useConnectionStore } from "@/stores/connection";
import { usePresenceStore } from "@/stores/presence";
import { useAgentsStore } from "@/stores/agents";
import { useApprovalsStore } from "@/stores/approvals";
import { useUsageStore } from "@/stores/usage";
import { StatusDot } from "@/components/shared/StatusDot";
import { Badge } from "@/components/shared/Badge";
import { formatTokens, formatCost, formatDuration } from "@/utils/format";

export function DashboardView() {
  const status = useConnectionStore((s) => s.status);
  const hello = useConnectionStore((s) => s.hello);
  const health = usePresenceStore((s) => s.health);
  const presence = usePresenceStore((s) => s.entries);
  const agents = useAgentsStore((s) => s.agentsList);
  const pendingApprovals = useApprovalsStore((s) => s.pendingCount);
  const metrics = useUsageStore((s) => s.metrics);

  if (status !== "connected") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="text-4xl mb-4">⊞</div>
        <h2 className="text-xl font-semibold text-white mb-2">Not Connected</h2>
        <p className="text-slate-400 mb-4">
          Configure your gateway URL in Settings to get started.
        </p>
      </div>
    );
  }

  const healthOk = health?.ok ?? false;
  const uptimeMs = hello?.snapshot?.uptimeMs;
  const activeAgents = agents.filter((a) => a.status === "running").length;
  const serverName = hello?.server?.name ?? "gateway";
  const serverVersion = hello?.server?.version ?? "unknown";

  // Derive channel info from health
  const channelEntries = Object.entries(health?.channels ?? {});

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Health"
          value={healthOk ? "OK" : "Down"}
          badge={<StatusDot status={healthOk ? "ok" : "error"} size="lg" />}
        />
        <StatCard
          label="Agents"
          value={String(agents.length)}
          badge={activeAgents > 0 ? <Badge variant="success">{activeAgents} running</Badge> : undefined}
        />
        <StatCard
          label="Clients"
          value={String(presence.length)}
        />
        <StatCard
          label="Pending Approvals"
          value={String(pendingApprovals)}
          badge={pendingApprovals > 0 ? <Badge variant="warning">{pendingApprovals}</Badge> : undefined}
        />
      </div>

      {/* Server info + usage */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Server Info */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Server
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Server</dt>
              <dd className="text-white">{serverName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Version</dt>
              <dd className="text-white">{serverVersion}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Protocol</dt>
              <dd className="text-white">v{hello?.protocol ?? "?"}</dd>
            </div>
            {uptimeMs != null && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Uptime</dt>
                <dd className="text-white">{formatDuration(uptimeMs)}</dd>
              </div>
            )}
            {hello?.features?.methods && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Methods</dt>
                <dd className="text-white">{hello.features.methods.length}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Usage Summary */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Token Usage
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Input Tokens</dt>
              <dd className="text-white">{formatTokens(metrics.totalInputTokens)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Output Tokens</dt>
              <dd className="text-white">{formatTokens(metrics.totalOutputTokens)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Cache Read</dt>
              <dd className="text-white">{formatTokens(metrics.totalCacheReadTokens)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Total Cost</dt>
              <dd className="text-white font-medium">{formatCost(metrics.totalCost)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Channels from health */}
      {channelEntries.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Channels
          </h3>
          <div className="space-y-2">
            {channelEntries.map(([name, ch]) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-md bg-slate-700/30 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <StatusDot status={ch.running ? "running" : ch.configured ? "idle" : "disconnected"} size="sm" />
                  <span className="text-white">{health?.channelLabels?.[name] ?? name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={ch.configured ? (ch.running ? "success" : "default") : "error"}>
                    {ch.running ? "running" : ch.configured ? "configured" : "not configured"}
                  </Badge>
                  {ch.probe?.bot?.username && (
                    <span className="text-xs text-slate-400">@{ch.probe.bot.username}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connected Clients */}
      {presence.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Presence ({presence.length})
          </h3>
          <div className="space-y-2">
            {presence.map((entry, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md bg-slate-700/30 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <StatusDot
                    status={entry.reason === "disconnect" ? "disconnected" : "connected"}
                    size="sm"
                  />
                  <span className="text-white">{entry.mode ?? entry.client?.mode ?? "client"}</span>
                  {entry.role && <Badge>{entry.role}</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {entry.reason && (
                    <span className="text-xs text-slate-500">{entry.reason}</span>
                  )}
                  {entry.platform && (
                    <span className="text-xs text-slate-500">{entry.platform}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        {badge}
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
