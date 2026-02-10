import { describe, it, expect } from "vitest";
import { bytesToBase64url, base64urlToBytes } from "./base64url";

describe("base64url", () => {
  it("round-trips bytes", () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 64]);
    const encoded = bytesToBase64url(original);
    const decoded = base64urlToBytes(encoded);
    expect(decoded).toEqual(original);
  });

  it("produces URL-safe characters", () => {
    // bytes that would produce + and / in standard base64
    const bytes = new Uint8Array([251, 255, 254]);
    const encoded = bytesToBase64url(bytes);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  it("handles empty bytes", () => {
    const encoded = bytesToBase64url(new Uint8Array([]));
    expect(encoded).toBe("");
    const decoded = base64urlToBytes(encoded);
    expect(decoded).toEqual(new Uint8Array([]));
  });
});
