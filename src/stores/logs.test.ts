import { describe, it, expect, beforeEach } from "vitest";
import { useLogsStore } from "./logs";

describe("logs store", () => {
  beforeEach(() => {
    useLogsStore.getState().clear();
  });

  it("starts empty", () => {
    expect(useLogsStore.getState().entries).toHaveLength(0);
  });

  it("adds log entries", () => {
    useLogsStore.getState().addEntry({
      ts: Date.now(),
      level: "info",
      message: "Test log",
      source: "test",
    });
    expect(useLogsStore.getState().entries).toHaveLength(1);
    expect(useLogsStore.getState().entries[0].message).toBe("Test log");
  });

  it("filters by level", () => {
    useLogsStore.getState().addEntry({ ts: 1, level: "info", message: "info msg" });
    useLogsStore.getState().addEntry({ ts: 2, level: "error", message: "error msg" });
    useLogsStore.getState().setFilterLevel("error");
    expect(useLogsStore.getState().filterLevel).toBe("error");
  });

  it("caps at MAX_ENTRIES", () => {
    for (let i = 0; i < 1010; i++) {
      useLogsStore.getState().addEntry({
        ts: i,
        level: "debug",
        message: `msg ${i}`,
      });
    }
    expect(useLogsStore.getState().entries.length).toBeLessThanOrEqual(1000);
  });
});
