import { create } from "zustand";
import type { UsageMetrics } from "@/protocol/types";

export interface UsageEvent {
  ts: number;
  agentId?: string;
  model?: string;
  sessionId?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number;
}

interface UsageState {
  metrics: UsageMetrics;
  events: UsageEvent[];

  setUsageData: (data: unknown) => void;
  seedFromAgents: (agents: unknown[]) => void;
  handleUsageEvent: (payload: unknown) => void;
  clear: () => void;
}

const MAX_EVENTS = 5000;

const emptyMetrics: UsageMetrics = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCacheReadTokens: 0,
  totalCacheWriteTokens: 0,
  totalCost: 0,
  byModel: {},
  bySession: {},
  byAgent: {},
};

function num(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function addToModel(
  byModel: Record<string, { inputTokens: number; outputTokens: number; cost: number }>,
  model: string,
  input: number,
  output: number,
  cost: number,
) {
  const prev = byModel[model] ?? { inputTokens: 0, outputTokens: 0, cost: 0 };
  byModel[model] = {
    inputTokens: prev.inputTokens + input,
    outputTokens: prev.outputTokens + output,
    cost: prev.cost + cost,
  };
}

export const useUsageStore = create<UsageState>((set) => ({
  metrics: { ...emptyMetrics, byModel: {}, bySession: {}, byAgent: {} },
  events: [],

  setUsageData: (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const d = data as Record<string, unknown>;

    const inner =
      (d.usage && typeof d.usage === "object" ? d.usage : null) ??
      (d.data && typeof d.data === "object" ? d.data : null);
    const src = (inner ?? d) as Record<string, unknown>;

    set((state) => {
      const metrics = { ...state.metrics };
      const newEvents: UsageEvent[] = [];

      const totalIn = num(src.totalInputTokens) || num(src.inputTokens) || num(src.input);
      const totalOut = num(src.totalOutputTokens) || num(src.outputTokens) || num(src.output);
      const totalCost = num(src.totalCost) || num(src.cost);
      const totalCacheRead = num(src.totalCacheReadTokens) || num(src.cacheReadTokens);
      const totalCacheWrite = num(src.totalCacheWriteTokens) || num(src.cacheWriteTokens);

      if (totalIn) metrics.totalInputTokens = totalIn;
      if (totalOut) metrics.totalOutputTokens = totalOut;
      if (totalCost) metrics.totalCost = totalCost;
      if (totalCacheRead) metrics.totalCacheReadTokens = totalCacheRead;
      if (totalCacheWrite) metrics.totalCacheWriteTokens = totalCacheWrite;

      if (src.byModel && typeof src.byModel === "object") {
        metrics.byModel = src.byModel as Record<string, { inputTokens: number; outputTokens: number; cost: number }>;
      }
      if (src.bySession && typeof src.bySession === "object") {
        metrics.bySession = src.bySession as Record<string, { inputTokens: number; outputTokens: number; cost: number }>;
      }
      if (src.byAgent && typeof src.byAgent === "object") {
        metrics.byAgent = src.byAgent as Record<string, Record<string, { inputTokens: number; outputTokens: number; cost: number }>>;
      }

      // Extract timestamped entries → create events for time filtering
      const entries = Array.isArray(src.daily) ? src.daily
        : Array.isArray(src.entries) ? src.entries
        : Array.isArray(src.records) ? src.records
        : null;
      if (entries) {
        let sumIn = 0, sumOut = 0, sumCost = 0;
        for (const e of entries) {
          if (e && typeof e === "object") {
            const r = e as Record<string, unknown>;
            const eIn = num(r.inputTokens) || num(r.input);
            const eOut = num(r.outputTokens) || num(r.output);
            const eCost = num(r.cost);
            sumIn += eIn;
            sumOut += eOut;
            sumCost += eCost;
            // Extract timestamp from entry
            const ts = num(r.ts) || num(r.timestamp) ||
              (typeof r.date === "string" ? new Date(r.date).getTime() : 0) ||
              (typeof r.day === "string" ? new Date(r.day).getTime() : 0);
            if ((eIn || eOut || eCost) && ts > 0) {
              newEvents.push({
                ts,
                model: typeof r.model === "string" ? r.model : undefined,
                agentId: typeof r.agentId === "string" ? r.agentId : undefined,
                sessionId: typeof r.sessionId === "string" ? r.sessionId : undefined,
                inputTokens: eIn,
                outputTokens: eOut,
                cacheReadTokens: num(r.cacheReadTokens),
                cacheWriteTokens: num(r.cacheWriteTokens),
                cost: eCost,
              });
            }
          }
        }
        if (!totalIn && !totalCost) {
          if (sumIn) metrics.totalInputTokens = sumIn;
          if (sumOut) metrics.totalOutputTokens = sumOut;
          if (sumCost) metrics.totalCost = sumCost;
        }
      }

      // If no timestamped entries were extracted but we have totals,
      // create a snapshot event so time filtering has data
      if (newEvents.length === 0 && state.events.length === 0 && (totalIn || totalCost)) {
        newEvents.push({
          ts: Date.now(),
          inputTokens: totalIn,
          outputTokens: totalOut,
          cacheReadTokens: totalCacheRead,
          cacheWriteTokens: totalCacheWrite,
          cost: totalCost,
        });
      }

      // Merge: keep existing real-time events, prepend historical entries
      // (avoid duplicating snapshot events on refresh)
      const existingRealtime = state.events.filter((e) => e.agentId || e.sessionId);
      const merged = [...newEvents, ...existingRealtime].slice(-MAX_EVENTS);

      return { metrics, events: merged.length > 0 ? merged : state.events };
    });
  },

  seedFromAgents: (agents: unknown[]) => {
    set((state) => {
      const metricsAlreadySet = state.metrics.totalInputTokens > 0 || state.metrics.totalCost > 0;

      const metrics = {
        ...state.metrics,
        byModel: { ...state.metrics.byModel },
        byAgent: { ...state.metrics.byAgent },
      };
      const seedEvents: UsageEvent[] = [];

      for (const raw of agents) {
        if (!raw || typeof raw !== "object") continue;
        const a = raw as Record<string, unknown>;
        const usage = a.usage as Record<string, unknown> | undefined;
        if (!usage || typeof usage !== "object") continue;

        const agentId = (a.agentId as string) ?? (a.id as string) ?? undefined;
        const model = a.model as string | undefined;
        const inputTokens = num(usage.inputTokens);
        const outputTokens = num(usage.outputTokens);
        const cost = num(usage.cost);
        const cacheRead = num(usage.cacheReadTokens);
        const cacheWrite = num(usage.cacheWriteTokens);

        // Only update metrics totals if setUsageData hasn't already
        if (!metricsAlreadySet) {
          metrics.totalInputTokens += inputTokens;
          metrics.totalOutputTokens += outputTokens;
          metrics.totalCost += cost;
          metrics.totalCacheReadTokens += cacheRead;
          metrics.totalCacheWriteTokens += cacheWrite;
        }

        if (model && (inputTokens || outputTokens)) {
          if (!metricsAlreadySet) {
            addToModel(metrics.byModel, model, inputTokens, outputTokens, cost);
          }
        }

        if (agentId && model && (inputTokens || outputTokens)) {
          if (!metrics.byAgent[agentId]) metrics.byAgent[agentId] = {};
          addToModel(metrics.byAgent[agentId], model, inputTokens, outputTokens, cost);
        }

        // Always create events for time filtering
        if (inputTokens || outputTokens || cost) {
          seedEvents.push({
            ts: (a.startedAt as number) ?? Date.now(),
            agentId,
            model,
            inputTokens,
            outputTokens,
            cacheReadTokens: cacheRead,
            cacheWriteTokens: cacheWrite,
            cost,
          });
        }
      }

      return {
        metrics,
        events: [...state.events, ...seedEvents].slice(-MAX_EVENTS),
      };
    });
  },

  handleUsageEvent: (payload: unknown) => {
    if (!payload || typeof payload !== "object") return;
    const data = payload as Record<string, unknown>;

    set((state) => {
      const inputTokens = num(data.inputTokens);
      const outputTokens = num(data.outputTokens);
      const cost = num(data.cost);
      const cacheRead = num(data.cacheReadTokens);
      const cacheWrite = num(data.cacheWriteTokens);
      const model = data.model as string | undefined;
      const agentId = data.agentId as string | undefined;
      const sessionId = data.sessionId as string | undefined;

      const metrics = {
        ...state.metrics,
        byModel: { ...state.metrics.byModel },
        bySession: { ...state.metrics.bySession },
        byAgent: { ...state.metrics.byAgent },
      };
      metrics.totalInputTokens += inputTokens;
      metrics.totalOutputTokens += outputTokens;
      metrics.totalCost += cost;
      metrics.totalCacheReadTokens += cacheRead;
      metrics.totalCacheWriteTokens += cacheWrite;

      if (model) {
        addToModel(metrics.byModel, model, inputTokens, outputTokens, cost);
      }

      if (sessionId) {
        const prev = metrics.bySession[sessionId] ?? { inputTokens: 0, outputTokens: 0, cost: 0 };
        metrics.bySession[sessionId] = {
          inputTokens: prev.inputTokens + inputTokens,
          outputTokens: prev.outputTokens + outputTokens,
          cost: prev.cost + cost,
        };
      }

      if (agentId) {
        if (!metrics.byAgent[agentId]) metrics.byAgent[agentId] = {};
        const modelKey = model ?? "unknown";
        addToModel(metrics.byAgent[agentId], modelKey, inputTokens, outputTokens, cost);
      }

      const event: UsageEvent = {
        ts: Date.now(),
        agentId,
        model,
        sessionId,
        inputTokens,
        outputTokens,
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
        cost,
      };

      return {
        metrics,
        events: [...state.events, event].slice(-MAX_EVENTS),
      };
    });
  },

  clear: () => {
    set({
      metrics: { ...emptyMetrics, byModel: {}, bySession: {}, byAgent: {} },
      events: [],
    });
  },
}));

// ── Time-filtered computation ───────────────────────────────────

export type TimePeriod = "1h" | "24h" | "7d" | "30d" | "all";

const PERIOD_MS: Record<TimePeriod, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: Infinity,
};

export interface FilteredUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCost: number;
  byModel: Record<string, { inputTokens: number; outputTokens: number; cost: number }>;
  byAgent: Record<string, Record<string, { inputTokens: number; outputTokens: number; cost: number }>>;
  chartData: Array<{ ts: number; inputTokens: number; outputTokens: number; cost: number }>;
}

export function computeFilteredUsage(
  events: UsageEvent[],
  metrics: UsageMetrics,
  period: TimePeriod,
): FilteredUsage {
  // "all" → use running totals from metrics
  if (period === "all") {
    // Build chart data from all events, bucketed
    const chartData = bucketEvents(events, events.length > 0 ? events[0].ts : Date.now(), Date.now());
    return {
      totalInputTokens: metrics.totalInputTokens,
      totalOutputTokens: metrics.totalOutputTokens,
      totalCacheReadTokens: metrics.totalCacheReadTokens,
      totalCost: metrics.totalCost,
      byModel: metrics.byModel,
      byAgent: metrics.byAgent,
      chartData,
    };
  }

  const cutoff = Date.now() - PERIOD_MS[period];
  const filtered = events.filter((e) => e.ts >= cutoff);

  let totalIn = 0, totalOut = 0, totalCacheRead = 0, totalCost = 0;
  const byModel: FilteredUsage["byModel"] = {};
  const byAgent: FilteredUsage["byAgent"] = {};

  for (const e of filtered) {
    totalIn += e.inputTokens;
    totalOut += e.outputTokens;
    totalCacheRead += e.cacheReadTokens;
    totalCost += e.cost;

    const modelKey = e.model ?? "unknown";
    addToModel(byModel, modelKey, e.inputTokens, e.outputTokens, e.cost);

    if (e.agentId) {
      if (!byAgent[e.agentId]) byAgent[e.agentId] = {};
      addToModel(byAgent[e.agentId], modelKey, e.inputTokens, e.outputTokens, e.cost);
    }
  }

  return {
    totalInputTokens: totalIn,
    totalOutputTokens: totalOut,
    totalCacheReadTokens: totalCacheRead,
    totalCost: totalCost,
    byModel,
    byAgent,
    chartData: bucketEvents(filtered, cutoff, Date.now()),
  };
}

/** Bucket events into ~20-40 time slots for charting */
function bucketEvents(
  events: UsageEvent[],
  startTs: number,
  endTs: number,
): Array<{ ts: number; inputTokens: number; outputTokens: number; cost: number }> {
  if (events.length === 0) return [];

  const range = endTs - startTs;
  const bucketCount = Math.min(Math.max(events.length, 10), 40);
  const bucketSize = Math.max(range / bucketCount, 1);
  const buckets = new Map<number, { ts: number; inputTokens: number; outputTokens: number; cost: number }>();

  for (const e of events) {
    const bucketKey = Math.floor((e.ts - startTs) / bucketSize);
    const bucketTs = startTs + bucketKey * bucketSize;
    const existing = buckets.get(bucketKey);
    if (existing) {
      existing.inputTokens += e.inputTokens;
      existing.outputTokens += e.outputTokens;
      existing.cost += e.cost;
    } else {
      buckets.set(bucketKey, {
        ts: bucketTs,
        inputTokens: e.inputTokens,
        outputTokens: e.outputTokens,
        cost: e.cost,
      });
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts);
}
