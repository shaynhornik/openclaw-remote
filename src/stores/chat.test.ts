import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "./chat";

describe("chat store", () => {
  beforeEach(() => {
    useChatStore.getState().clear();
  });

  it("starts empty", () => {
    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(0);
    expect(state.streamingMessage).toBeNull();
    expect(state.toolStream).toHaveLength(0);
  });

  it("sends a user message", () => {
    const msg = useChatStore.getState().sendMessage("hello");
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("hello");
    expect(useChatStore.getState().messages).toHaveLength(1);
  });

  it("handles chat events", () => {
    // Simulate a "final" chat event (actual gateway format)
    useChatStore.getState().handleChatEvent({
      runId: "run-1",
      sessionKey: "test-session",
      seq: 1,
      state: "final",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Hi there" }],
        timestamp: Date.now(),
      },
    });
    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().messages[0].content).toBe("Hi there");
  });

  it("handles assistant streaming", () => {
    useChatStore.getState().handleAssistantEvent({
      agentId: "a1",
      stream: "assistant",
      event: "chunk",
      data: { text: "Hello" },
    });

    expect(useChatStore.getState().streamingMessage).not.toBeNull();
    expect(useChatStore.getState().streamingMessage?.content).toBe("Hello");

    // Another chunk
    useChatStore.getState().handleAssistantEvent({
      agentId: "a1",
      stream: "assistant",
      event: "chunk",
      data: { text: " world" },
    });

    expect(useChatStore.getState().streamingMessage?.content).toBe("Hello world");

    // End
    useChatStore.getState().handleAssistantEvent({
      agentId: "a1",
      stream: "assistant",
      event: "end",
    });

    expect(useChatStore.getState().streamingMessage).toBeNull();
    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().messages[0].content).toBe("Hello world");
  });

  it("handles tool events", () => {
    useChatStore.getState().handleToolEvent({
      agentId: "a1",
      stream: "tool",
      event: "start",
      data: { id: "t1", name: "search", args: { query: "test" } },
    });

    expect(useChatStore.getState().toolStream).toHaveLength(1);
    expect(useChatStore.getState().toolStream[0].name).toBe("search");
    expect(useChatStore.getState().toolStream[0].status).toBe("running");
  });
});
