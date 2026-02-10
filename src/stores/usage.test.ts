import { describe, it, expect, beforeEach } from "vitest";
import { useUsageStore, computeFilteredUsage } from "./usage";

describe("usage store", () => {
  beforeEach(() => {
    useUsageStore.getState().clear();
  });

  it("starts with zero metrics", () => {
    const { metrics } = useUsageStore.getState();
    expect(metrics.totalInputTokens).toBe(0);
    expect(metrics.totalOutputTokens).toBe(0);
    expect(metrics.totalCost).toBe(0);
  });

  it("accumulates usage events", () => {
    useUsageStore.getState().handleUsageEvent({
      inputTokens: 100,
      outputTokens: 50,
      cost: 0.001,
      model: "claude-3",
    });

    useUsageStore.getState().handleUsageEvent({
      inputTokens: 200,
      outputTokens: 75,
      cost: 0.002,
      model: "claude-3",
    });

    const { metrics } = useUsageStore.getState();
    expect(metrics.totalInputTokens).toBe(300);
    expect(metrics.totalOutputTokens).toBe(125);
    expect(metrics.totalCost).toBeCloseTo(0.003);
    expect(metrics.byModel["claude-3"].inputTokens).toBe(300);
  });

  it("tracks usage by session", () => {
    useUsageStore.getState().handleUsageEvent({
      inputTokens: 100,
      outputTokens: 50,
      cost: 0.001,
      sessionId: "s1",
    });

    const { metrics } = useUsageStore.getState();
    expect(metrics.bySession["s1"].inputTokens).toBe(100);
  });

  it("records events with timestamps", () => {
    useUsageStore.getState().handleUsageEvent({
      inputTokens: 100,
      outputTokens: 50,
      cost: 0.001,
    });

    const { events } = useUsageStore.getState();
    expect(events).toHaveLength(1);
    expect(events[0].ts).toBeGreaterThan(0);
    expect(events[0].inputTokens).toBe(100);
  });

  it("tracks usage by agent and model", () => {
    useUsageStore.getState().handleUsageEvent({
      inputTokens: 100,
      outputTokens: 50,
      cost: 0.001,
      agentId: "agent-1",
      model: "claude-3",
    });

    useUsageStore.getState().handleUsageEvent({
      inputTokens: 200,
      outputTokens: 75,
      cost: 0.002,
      agentId: "agent-1",
      model: "gpt-4",
    });

    const { metrics } = useUsageStore.getState();
    expect(metrics.byAgent["agent-1"]["claude-3"].inputTokens).toBe(100);
    expect(metrics.byAgent["agent-1"]["gpt-4"].inputTokens).toBe(200);
  });

  it("computes time-filtered usage", () => {
    const { metrics } = useUsageStore.getState();

    // Events: one recent, one old
    const now = Date.now();
    const events = [
      { ts: now - 2 * 60 * 60 * 1000, agentId: "a1", model: "m1", inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0.01 },
      { ts: now - 30 * 60 * 1000, agentId: "a1", model: "m1", inputTokens: 200, outputTokens: 75, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0.02 },
    ];

    const last1h = computeFilteredUsage(events, metrics, "1h");
    expect(last1h.totalInputTokens).toBe(200);
    expect(last1h.totalCost).toBeCloseTo(0.02);

    const last24h = computeFilteredUsage(events, metrics, "24h");
    expect(last24h.totalInputTokens).toBe(300);
  });
});
