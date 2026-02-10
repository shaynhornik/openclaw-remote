/**
 * Routes incoming gateway events to the appropriate Zustand stores.
 */
import type {
  EventFrame,
  AgentEventPayload,
  HealthInfo,
} from "@/protocol/types";
import { useConnectionStore } from "@/stores/connection";
import { useAgentsStore } from "@/stores/agents";
import { useChatStore } from "@/stores/chat";
import { usePresenceStore } from "@/stores/presence";
import { useApprovalsStore } from "@/stores/approvals";
import { useSessionsStore } from "@/stores/sessions";
import { useChannelsStore } from "@/stores/channels";
import { useCronStore } from "@/stores/cron";
import { useLogsStore } from "@/stores/logs";
import { useUsageStore } from "@/stores/usage";

export function dispatchEvent(frame: EventFrame): void {
  const { event, payload } = frame;

  switch (event) {
    case "tick":
      useConnectionStore.getState().onTick();
      break;

    case "agent": {
      const agentPayload = payload as AgentEventPayload;
      useAgentsStore.getState().handleAgentEvent(agentPayload);

      if (agentPayload.stream === "tool") {
        useChatStore.getState().handleToolEvent(agentPayload);
      } else if (agentPayload.stream === "assistant") {
        useChatStore.getState().handleAssistantEvent(agentPayload);
      }

      // Forward agent usage events to the global usage store
      if (
        agentPayload.stream === "lifecycle" &&
        agentPayload.event === "usage" &&
        agentPayload.data
      ) {
        const d = agentPayload.data as Record<string, unknown>;
        useUsageStore.getState().handleUsageEvent({
          ...d,
          agentId: agentPayload.agentId,
          sessionId: d.sessionId ?? agentPayload.sessionId,
        });
      }
      break;
    }

    case "chat":
      useChatStore.getState().handleChatEvent(payload);
      break;

    case "presence":
      usePresenceStore.getState().handlePresenceEvent(payload);
      break;

    case "health": {
      const health = payload as HealthInfo;
      usePresenceStore.getState().handleHealthEvent(payload);

      // Also refresh channel status from health data
      if (health.channels) {
        const labels = health.channelLabels ?? {};
        useChannelsStore.getState().setChannels(
          Object.entries(health.channels).map(([id, ch]) => ({
            id,
            name: labels[id] ?? id,
            type: ch.mode ?? undefined,
            status: ch.lastError
              ? ("error" as const)
              : ch.running
                ? ("active" as const)
                : ("idle" as const),
            configured: ch.configured,
            running: ch.running,
            connectedAt: ch.lastStartAt ?? undefined,
          })),
        );
      }

      // Refresh agents from health
      if (health.agents) {
        useAgentsStore.getState().setAgents(health.agents);
      }
      break;
    }

    case "exec.approval.requested":
      useApprovalsStore.getState().handleApprovalRequested(payload);
      break;

    case "exec.approval.resolved":
      useApprovalsStore.getState().handleApprovalResolved(payload);
      break;

    case "session":
      useSessionsStore.getState().handleSessionEvent(payload);
      break;

    case "channel":
      useChannelsStore.getState().handleChannelEvent(payload);
      break;

    case "cron":
      useCronStore.getState().handleCronEvent(payload);
      break;

    case "log":
      useLogsStore.getState().addEntry(payload);
      break;

    case "usage":
      useUsageStore.getState().handleUsageEvent(payload);
      break;

    case "shutdown":
      useConnectionStore.getState().handleShutdown();
      break;

    default:
      // Unknown event type – ignore
      break;
  }
}
