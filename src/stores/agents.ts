import { create } from "zustand";
import type { AgentSnapshotInfo, AgentEventPayload } from "@/protocol/types";

type AgentSnapshot = AgentSnapshotInfo;

interface AgentsState {
  agents: Map<string, AgentSnapshot>;
  agentsList: AgentSnapshot[];

  setAgents: (agents: unknown[]) => void;
  handleAgentEvent: (payload: AgentEventPayload) => void;
  clear: () => void;
}

function toList(map: Map<string, AgentSnapshot>): AgentSnapshot[] {
  return Array.from(map.values());
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: new Map(),
  agentsList: [],

  setAgents: (agents: unknown[]) => {
    const map = new Map<string, AgentSnapshot>();
    for (const raw of agents) {
      const a = raw as Record<string, unknown>;
      const agentId =
        (a.agentId as string) ?? (a.id as string) ?? (a.agent_id as string);
      if (!agentId) continue;
      map.set(agentId, {
        agentId,
        isDefault: a.isDefault as boolean | undefined,
        heartbeat: a.heartbeat as AgentSnapshot["heartbeat"],
        sessions: a.sessions as AgentSnapshot["sessions"],
        parentAgentId: a.parentAgentId as string | undefined,
        sessionId: a.sessionId as string | undefined,
        status: a.status as string | undefined,
        model: a.model as string | undefined,
        startedAt: a.startedAt as number | undefined,
        usage: a.usage as AgentSnapshot["usage"],
      });
    }
    set({ agents: map, agentsList: toList(map) });
  },

  handleAgentEvent: (payload: AgentEventPayload) => {
    const { agents } = get();
    const updated = new Map(agents);

    if (payload.stream === "lifecycle") {
      const existing = updated.get(payload.agentId);
      const data = payload.data as Record<string, unknown> | undefined;

      if (payload.event === "started" || payload.event === "created") {
        updated.set(payload.agentId, {
          agentId: payload.agentId,
          parentAgentId: payload.parentAgentId,
          sessionId: payload.sessionId ?? "",
          status: "running",
          model: (data?.model as string) ?? existing?.model,
          startedAt: payload.ts ?? Date.now(),
          usage: existing?.usage,
        });
      } else if (
        payload.event === "completed" ||
        payload.event === "stopped" ||
        payload.event === "error"
      ) {
        if (existing) {
          updated.set(payload.agentId, {
            ...existing,
            status: payload.event === "error" ? "error" : "completed",
          });
        }
      } else if (payload.event === "usage" && existing && data) {
        updated.set(payload.agentId, {
          ...existing,
          usage: {
            inputTokens: (data.inputTokens as number) ?? 0,
            outputTokens: (data.outputTokens as number) ?? 0,
            cacheReadTokens: data.cacheReadTokens as number | undefined,
            cacheWriteTokens: data.cacheWriteTokens as number | undefined,
            cost: data.cost as number | undefined,
          },
        });
      }
    }

    set({ agents: updated, agentsList: toList(updated) });
  },

  clear: () => {
    set({ agents: new Map(), agentsList: [] });
  },
}));
