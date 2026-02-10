import { useAgentsStore } from "@/stores/agents";
import { useConnectionStore } from "@/stores/connection";
import { StatusDot } from "@/components/shared/StatusDot";
import { Badge } from "@/components/shared/Badge";
import { TimeAgo } from "@/components/shared/TimeAgo";
import { formatTokens, formatCost, formatDuration } from "@/utils/format";
import type { AgentSnapshotInfo } from "@/protocol/types";

type AgentSnapshot = AgentSnapshotInfo;

export function AgentTreeView() {
  const agents = useAgentsStore((s) => s.agentsList);
  const status = useConnectionStore((s) => s.status);

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Connect to gateway to view agents
      </div>
    );
  }

  // Build tree: root agents have no parent
  const roots = agents.filter((a) => !a.parentAgentId);
  const childrenMap = new Map<string, AgentSnapshot[]>();
  for (const agent of agents) {
    if (agent.parentAgentId) {
      const existing = childrenMap.get(agent.parentAgentId) ?? [];
      existing.push(agent);
      childrenMap.set(agent.parentAgentId, existing);
    }
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p className="text-lg mb-1">No agents</p>
        <p className="text-sm">Agents will appear here when configured</p>
      </div>
    );
  }

  const runningCount = agents.filter((a) => a.status === "running").length;

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-400 mb-4">
        {agents.length} agent{agents.length !== 1 ? "s" : ""}
        {runningCount > 0 && <>, {runningCount} running</>}
      </div>
      {roots.map((agent) => (
        <AgentNode
          key={agent.agentId}
          agent={agent}
          childrenMap={childrenMap}
          depth={0}
        />
      ))}
    </div>
  );
}

function AgentNode({
  agent,
  childrenMap,
  depth,
}: {
  agent: AgentSnapshot;
  childrenMap: Map<string, AgentSnapshot[]>;
  depth: number;
}) {
  const children = childrenMap.get(agent.agentId) ?? [];

  const agentStatus = agent.status ?? (agent.isDefault ? "default" : "idle");

  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusDot status={agentStatus} size="md" />
            <span className="font-mono text-sm text-white">
              {agent.agentId.length > 12
                ? agent.agentId.slice(0, 8)
                : agent.agentId}
            </span>
            {agent.isDefault && <Badge variant="info">default</Badge>}
            {agent.status && (
              <Badge
                variant={
                  agent.status === "running"
                    ? "success"
                    : agent.status === "error"
                      ? "error"
                      : "default"
                }
              >
                {agent.status}
              </Badge>
            )}
            {agent.model && (
              <span className="text-xs text-slate-500">{agent.model}</span>
            )}
          </div>
          {agent.startedAt && (
            <TimeAgo ts={agent.startedAt} className="text-xs text-slate-500" />
          )}
        </div>

        {/* Runtime usage info */}
        {agent.usage && (
          <div className="mt-2 flex gap-4 text-xs text-slate-400">
            <span>In: {formatTokens(agent.usage.inputTokens)}</span>
            <span>Out: {formatTokens(agent.usage.outputTokens)}</span>
            {agent.usage.cost != null && (
              <span>Cost: {formatCost(agent.usage.cost)}</span>
            )}
          </div>
        )}

        {/* Snapshot info (heartbeat & sessions) */}
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
          {agent.heartbeat?.enabled && (
            <span>
              Heartbeat: every{" "}
              {agent.heartbeat.every ??
                (agent.heartbeat.everyMs
                  ? formatDuration(agent.heartbeat.everyMs)
                  : "?")}
            </span>
          )}
          {agent.sessions != null && (
            <span>
              {agent.sessions.count ?? agent.sessions.recent?.length ?? 0}{" "}
              session{(agent.sessions.count ?? agent.sessions.recent?.length ?? 0) !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {children.map((child) => (
        <AgentNode
          key={child.agentId}
          agent={child}
          childrenMap={childrenMap}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}
