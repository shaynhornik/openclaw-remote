import { describe, it, expect, beforeEach } from "vitest";
import { useConnectionStore } from "./connection";

describe("connection store", () => {
  beforeEach(() => {
    const state = useConnectionStore.getState();
    state.disconnect();
    useConnectionStore.setState({ url: "", error: null });
  });

  it("starts disconnected", () => {
    expect(useConnectionStore.getState().status).toBe("disconnected");
  });

  it("persists and reads URL", () => {
    useConnectionStore.getState().setUrl("ws://localhost:19000");
    expect(useConnectionStore.getState().url).toBe("ws://localhost:19000");
  });

  it("sets error when URL is empty", () => {
    useConnectionStore.getState().connect();
    expect(useConnectionStore.getState().error).toBe("Gateway URL is required");
  });
});
