import { create } from "zustand";
import type { LogEntry } from "@/protocol/types";

const MAX_ENTRIES = 1000;

interface LogsState {
  entries: LogEntry[];
  filterLevel: LogEntry["level"] | null;
  cursor: number | null;

  addEntries: (lines: string[]) => void;
  setCursor: (cursor: number) => void;
  addEntry: (payload: unknown) => void;
  setFilterLevel: (level: LogEntry["level"] | null) => void;
  clear: () => void;
}

function parseLine(line: string): LogEntry | null {
  // Try JSON parse first (structured log lines)
  try {
    const obj = JSON.parse(line) as Record<string, unknown>;
    return {
      ts: (obj.ts as number) ?? (obj.time as number) ?? (obj.timestamp as number) ?? Date.now(),
      level: parseLevel(obj.level ?? obj.severity ?? obj.lvl),
      message: (obj.msg as string) ?? (obj.message as string) ?? (obj.text as string) ?? line,
      source: (obj.source as string) ?? (obj.name as string) ?? (obj.component as string),
      data: obj.data ?? obj.extra ?? obj.meta,
    };
  } catch {
    // Plain text log line — try to extract level from common patterns
    const match = line.match(
      /^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*Z?)\]?\s*\[?(DEBUG|INFO|WARN|ERROR|TRACE)\]?\s*(.*)/i,
    );
    if (match) {
      return {
        ts: new Date(match[1]).getTime() || Date.now(),
        level: parseLevel(match[2]),
        message: match[3],
      };
    }
    // Fallback: treat whole line as info message
    if (line.trim()) {
      return {
        ts: Date.now(),
        level: "info",
        message: line,
      };
    }
    return null;
  }
}

function parseLevel(raw: unknown): LogEntry["level"] {
  const s = String(raw ?? "info").toLowerCase();
  if (s === "debug" || s === "trace" || s === "verbose") return "debug";
  if (s === "warn" || s === "warning") return "warn";
  if (s === "error" || s === "fatal" || s === "critical") return "error";
  return "info";
}

export const useLogsStore = create<LogsState>((set) => ({
  entries: [],
  filterLevel: null,
  cursor: null,

  addEntries: (lines: string[]) => {
    const newEntries: LogEntry[] = [];
    for (const line of lines) {
      const entry = parseLine(line);
      if (entry) newEntries.push(entry);
    }
    if (newEntries.length === 0) return;
    set((state) => ({
      entries: [...state.entries, ...newEntries].slice(-MAX_ENTRIES),
    }));
  },

  setCursor: (cursor: number) => {
    set({ cursor });
  },

  addEntry: (payload: unknown) => {
    const entry = payload as LogEntry;
    set((state) => ({
      entries: [...state.entries, entry].slice(-MAX_ENTRIES),
    }));
  },

  setFilterLevel: (level: LogEntry["level"] | null) => {
    set({ filterLevel: level });
  },

  clear: () => {
    set({ entries: [] });
  },
}));
