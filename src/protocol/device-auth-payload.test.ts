import { describe, it, expect } from "vitest";
import { buildDeviceAuthPayload } from "./device-auth-payload";

describe("buildDeviceAuthPayload", () => {
  it("builds v2 format payload", () => {
    const result = buildDeviceAuthPayload({
      deviceId: "dev-123",
      clientId: "openclaw-control-ui",
      clientMode: "webchat",
      role: "operator",
      scopes: ["operator.admin", "operator.approvals"],
      signedAt: 1700000000000,
      token: "tok-abc",
      nonce: "nonce-xyz",
    });

    expect(result).toBe(
      "v2|dev-123|openclaw-control-ui|webchat|operator|operator.admin,operator.approvals|1700000000000|tok-abc|nonce-xyz",
    );
  });

  it("handles empty scopes", () => {
    const result = buildDeviceAuthPayload({
      deviceId: "d",
      clientId: "c",
      clientMode: "m",
      role: "r",
      scopes: [],
      signedAt: 0,
      token: "",
      nonce: "n",
    });

    expect(result).toBe("v2|d|c|m|r||0||n");
  });
});
