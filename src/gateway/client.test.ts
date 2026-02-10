import { describe, it, expect, vi, beforeEach } from "vitest";
import { GatewayClient } from "./client";

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;

  send = vi.fn();
  close = vi.fn();

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError() {
    this.onerror?.();
  }
}

const buildParams = () => ({
  minProtocol: 3,
  maxProtocol: 3,
  client: { id: "test", version: "1", platform: "web", mode: "webchat" },
  role: "operator",
  scopes: [] as string[],
  caps: [] as string[],
});

describe("GatewayClient", () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    mockWs = new MockWebSocket();
    vi.stubGlobal("WebSocket", vi.fn(() => mockWs));
  });

  it("starts disconnected", () => {
    const client = new GatewayClient();
    expect(client.status).toBe("disconnected");
  });

  it("transitions through connecting → authenticating → connected", async () => {
    const client = new GatewayClient();
    const statusChanges: string[] = [];
    client.setStatusHandler((s) => statusChanges.push(s));

    const connectPromise = client.connect("ws://localhost:18789", buildParams);

    // Should be connecting after WebSocket constructor called
    expect(statusChanges).toContain("connecting");

    // Simulate open → authenticating
    mockWs.simulateOpen();
    expect(statusChanges).toContain("authenticating");

    // Simulate challenge
    mockWs.simulateMessage({
      type: "event",
      seq: 0,
      event: "connect.challenge",
      payload: { nonce: "test-nonce" },
    });

    // Get request id from sent data
    const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);

    // Simulate hello-ok response
    mockWs.simulateMessage({
      type: "res",
      id: sentData.id,
      ok: true,
      payload: {
        protocol: 3,
        server: { id: "test-server", version: "1.0.0" },
        tickIntervalMs: 5000,
        session: { id: "sess-1", scopes: [], role: "operator" },
      },
    });

    const hello = await connectPromise;
    expect(statusChanges).toContain("connected");
    expect(hello.protocol).toBe(3);
    expect(hello.server.id).toBe("test-server");
    expect(client.status).toBe("connected");
  });

  it("sends connect request with method and params", async () => {
    const client = new GatewayClient();

    const connectPromise = client.connect("ws://localhost:18789", buildParams);

    mockWs.simulateOpen();
    mockWs.simulateMessage({
      type: "event",
      seq: 0,
      event: "connect.challenge",
      payload: { nonce: "test-nonce" },
    });

    expect(mockWs.send).toHaveBeenCalledTimes(1);
    const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
    expect(sentData.type).toBe("req");
    expect(sentData.method).toBe("connect");
    expect(sentData.params.minProtocol).toBe(3);

    // Resolve the promise
    mockWs.simulateMessage({
      type: "res",
      id: sentData.id,
      ok: true,
      payload: {
        protocol: 3,
        server: { id: "s", version: "1" },
        tickIntervalMs: 5000,
        session: { id: "s1", scopes: [], role: "operator" },
      },
    });

    await connectPromise;
  });

  it("handles connection errors", async () => {
    const client = new GatewayClient();

    const connectPromise = client.connect("ws://localhost:18789", buildParams);

    mockWs.simulateError();

    await expect(connectPromise).rejects.toThrow("WebSocket connection failed");
    expect(client.status).toBe("error");
  });

  it("rejects on connect rejection", async () => {
    const client = new GatewayClient();

    const connectPromise = client.connect("ws://localhost:18789", buildParams);

    mockWs.simulateOpen();
    mockWs.simulateMessage({
      type: "event",
      seq: 0,
      event: "connect.challenge",
      payload: { nonce: "n" },
    });

    const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);

    mockWs.simulateMessage({
      type: "res",
      id: sentData.id,
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Bad token" },
    });

    await expect(connectPromise).rejects.toThrow("Bad token");
  });

  it("dispatches events after connected", async () => {
    const client = new GatewayClient();
    const events: unknown[] = [];
    client.setEventHandler((f) => events.push(f));

    const connectPromise = client.connect("ws://localhost:18789", buildParams);

    mockWs.simulateOpen();
    mockWs.simulateMessage({
      type: "event",
      seq: 0,
      event: "connect.challenge",
      payload: { nonce: "n" },
    });

    const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
    mockWs.simulateMessage({
      type: "res",
      id: sentData.id,
      ok: true,
      payload: {
        protocol: 3,
        server: { id: "s", version: "1" },
        tickIntervalMs: 5000,
        session: { id: "s1", scopes: [], role: "operator" },
      },
    });

    await connectPromise;

    // Now send an event – should go through event handler
    mockWs.simulateMessage({
      type: "event",
      seq: 1,
      event: "tick",
      payload: {},
    });

    expect(events).toHaveLength(1);
  });
});
