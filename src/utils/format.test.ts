import { describe, it, expect } from "vitest";
import { formatTokens, formatCost, formatDuration, formatBytes } from "./format";

describe("formatTokens", () => {
  it("formats small numbers", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(999)).toBe("999");
  });

  it("formats thousands", () => {
    expect(formatTokens(1000)).toBe("1.0K");
    expect(formatTokens(12345)).toBe("12.3K");
  });

  it("formats millions", () => {
    expect(formatTokens(1_000_000)).toBe("1.0M");
    expect(formatTokens(2_500_000)).toBe("2.5M");
  });
});

describe("formatCost", () => {
  it("formats cost with 4 decimals", () => {
    expect(formatCost(0)).toBe("$0.0000");
    expect(formatCost(1.23456)).toBe("$1.2346");
  });
});

describe("formatDuration", () => {
  it("formats seconds", () => {
    expect(formatDuration(5000)).toBe("5s");
  });

  it("formats minutes", () => {
    expect(formatDuration(90_000)).toBe("1m 30s");
  });

  it("formats hours", () => {
    expect(formatDuration(3_661_000)).toBe("1h 1m");
  });
});

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats KB", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats MB", () => {
    expect(formatBytes(2_097_152)).toBe("2.0 MB");
  });
});
