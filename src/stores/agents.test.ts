import { describe, it, expect, beforeEach } from "vitest";
import { useAgentsStore } from "./agents";
import type { AgentEventPayload, AgentSnapshotInfo } from "@/protocol/types";

describe("agents store", () => {
  beforeEach(() => {
    useAgentsStore.getState().clear();
  });

  it("starts empty", () => {
    expect(useAgentsStore.getState().agentsList).toHaveLength(0);
  });

  it("sets agents from snapshot", () => {
    const agents: AgentSnapshotInfo[] = [
      { agentId: "a1", sessionId: "s1", status: "running" },
      { agentId: "a2", sessionId: "s1", status: "completed" },
    ];
    useAgentsStore.getState().setAgents(agents);
    expect(useAgentsStore.getState().agentsList).toHaveLength(2);
  });

  it("handles lifecycle events", () => {
    const event: AgentEventPayload = {
      agentId: "a1",
      stream: "lifecycle",
      event: "started",
      data: { model: "claude-3" },
      ts: Date.now(),
    };
    useAgentsStore.getState().handleAgentEvent(event);

    const agents = useAgentsStore.getState().agentsList;
    expect(agents).toHaveLength(1);
    expect(agents[0].status).toBe("running");
    expect(agents[0].model).toBe("claude-3");
  });

  it("updates status on completed", () => {
    // Start agent
    useAgentsStore.getState().handleAgentEvent({
      agentId: "a1",
      stream: "lifecycle",
      event: "started",
      ts: Date.now(),
    });

    // Complete agent
    useAgentsStore.getState().handleAgentEvent({
      agentId: "a1",
      stream: "lifecycle",
      event: "completed",
    });

    expect(useAgentsStore.getState().agentsList[0].status).toBe("completed");
  });
});
