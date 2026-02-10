import { useEffect, useRef, useCallback } from "react";
import { useLogsStore } from "@/stores/logs";
import { useConnectionStore } from "@/stores/connection";
import type { LogEntry } from "@/protocol/types";

const POLL_INTERVAL_MS = 2000;

export function LogsView() {
  const entries = useLogsStore((s) => s.entries);
  const filterLevel = useLogsStore((s) => s.filterLevel);
  const setFilterLevel = useLogsStore((s) => s.setFilterLevel);
  const clear = useLogsStore((s) => s.clear);
  const status = useConnectionStore((s) => s.status);

  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cursorRef = useRef<number | null>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const isNearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries]);

  const fetchLogs = useCallback(async () => {
    const client = useConnectionStore.getState()._client;
    if (!client) return;

    try {
      const params: Record<string, unknown> = { limit: 500 };
      if (cursorRef.current != null) {
        params.cursor = cursorRef.current;
      }

      const res = await client.request<{
        lines: string[];
        cursor: number;
        size: number;
        truncated?: boolean;
        reset?: boolean;
      }>("logs.tail", params);

      if (res && res.lines && res.lines.length > 0) {
        useLogsStore.getState().addEntries(res.lines);
      }
      if (res && typeof res.cursor === "number") {
        cursorRef.current = res.cursor;
      }
    } catch {
      // Method may not be available
    }
  }, []);

  // Start polling when connected and this view is mounted
  useEffect(() => {
    if (status !== "connected") return;

    // Initial fetch
    fetchLogs();

    // Poll for new entries
    pollingRef.current = setInterval(fetchLogs, POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [status, fetchLogs]);

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Connect to gateway to view logs
      </div>
    );
  }

  const filtered = filterLevel
    ? entries.filter((e) => e.level === filterLevel)
    : entries;

  return (
    <div className="flex h-full flex-col">
      {/* Controls */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex gap-1">
          {(["debug", "info", "warn", "error"] as const).map((level) => (
            <button
              key={level}
              onClick={() =>
                setFilterLevel(filterLevel === level ? null : level)
              }
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filterLevel === level
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
        <button
          onClick={clear}
          className="rounded-md border border-slate-600 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-700 transition-colors"
        >
          Clear
        </button>
        <span className="text-xs text-slate-500">
          {filtered.length} entries
        </span>
      </div>

      {/* Log entries */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 font-mono text-xs"
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            Waiting for log entries...
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {filtered.map((entry, i) => (
              <LogLine key={i} entry={entry} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  const time = new Date(entry.ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });

  const levelColor: Record<string, string> = {
    debug: "text-slate-500",
    info: "text-blue-400",
    warn: "text-yellow-400",
    error: "text-red-400",
  };

  return (
    <div className="flex gap-2 py-0.5 hover:bg-slate-800/50 px-1 rounded">
      <span className="text-slate-600 shrink-0">{time}</span>
      <span
        className={`shrink-0 w-12 ${levelColor[entry.level] ?? "text-slate-400"}`}
      >
        {entry.level.toUpperCase().padEnd(5)}
      </span>
      {entry.source && (
        <span className="text-slate-500 shrink-0">[{entry.source}]</span>
      )}
      <span className="text-slate-200 break-all">{entry.message}</span>
    </div>
  );
}
