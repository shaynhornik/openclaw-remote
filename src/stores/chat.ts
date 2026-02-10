import { create } from "zustand";
import type {
  ChatMessage,
  ToolCall,
  AgentEventPayload,
  ChatEventPayload,
} from "@/protocol/types";
import { uuid } from "@/utils/uuid";
import { useUsageStore } from "./usage";

interface ChatState {
  messages: ChatMessage[];
  streamingMessage: ChatMessage | null;
  toolStream: ToolCall[];
  sessionKey: string;

  setSessionKey: (key: string) => void;
  setMessages: (messages: unknown[]) => void;
  handleChatEvent: (payload: unknown) => void;
  handleAssistantEvent: (payload: AgentEventPayload) => void;
  handleToolEvent: (payload: AgentEventPayload) => void;
  sendMessage: (content: string) => ChatMessage;
  clear: () => void;
}

/**
 * Extract text content from a chat history message.
 * Content can be a plain string or an array of content blocks.
 */
function extractContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block && typeof block === "object") {
          return (block as Record<string, unknown>).text ?? "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streamingMessage: null,
  toolStream: [],
  sessionKey: "",

  setSessionKey: (key: string) => {
    set({ sessionKey: key });
  },

  setMessages: (rawMessages: unknown[]) => {
    const messages: ChatMessage[] = rawMessages.map((raw, i) => {
      const m = raw as Record<string, unknown>;
      return {
        id: (m.id as string) ?? (m.key as string) ?? `msg-${i}`,
        role:
          (m.role as ChatMessage["role"]) ??
          (m.sender === "user" ? "user" : "assistant"),
        content: extractContent(m.content ?? m.text ?? m.message ?? ""),
        agentId: m.agentId as string | undefined,
        sessionId: m.sessionId as string | undefined,
        ts:
          (m.ts as number) ??
          (m.timestamp as number) ??
          (m.createdAt as number) ??
          Date.now(),
      };
    });
    set({ messages });
  },

  /**
   * Handle a "chat" event from the gateway.
   * Structure: { runId, sessionKey, seq, state, message?, usage?, errorMessage? }
   */
  handleChatEvent: (payload: unknown) => {
    const data = payload as ChatEventPayload;

    if (data.state === "delta") {
      // Streaming delta — accumulate text
      const text = data.message?.content
        ?.map((b) => b.text ?? "")
        .join("") ?? "";

      set((state) => {
        const current = state.streamingMessage;
        if (current && current.id === data.runId) {
          return {
            streamingMessage: {
              ...current,
              content: current.content + text,
            },
          };
        }
        return {
          streamingMessage: {
            id: data.runId ?? uuid(),
            role: "assistant",
            content: text,
            ts: Date.now(),
            streaming: true,
          },
        };
      });
    } else if (data.state === "final") {
      // Finalize the streaming message
      set((state) => {
        if (state.streamingMessage) {
          // If the final event includes full message content, use that
          const finalText = data.message?.content
            ?.map((b) => b.text ?? "")
            .join("") ?? "";
          const content = finalText || state.streamingMessage.content;

          return {
            messages: [
              ...state.messages,
              {
                ...state.streamingMessage,
                content,
                streaming: false,
                ts: data.message?.timestamp ?? state.streamingMessage.ts,
              },
            ],
            streamingMessage: null,
          };
        }
        // No streaming message but got final — add it directly
        if (data.message) {
          const text = data.message.content
            ?.map((b) => b.text ?? "")
            .join("") ?? "";
          return {
            messages: [
              ...state.messages,
              {
                id: data.runId ?? uuid(),
                role: "assistant",
                content: text,
                ts: data.message.timestamp ?? Date.now(),
                streaming: false,
              },
            ],
          };
        }
        return state;
      });

      // Feed usage to the usage store
      if (data.usage) {
        useUsageStore.getState().handleUsageEvent({
          inputTokens: data.usage.input,
          outputTokens: data.usage.output,
          cacheReadTokens: data.usage.cacheRead,
          cacheWriteTokens: data.usage.cacheWrite,
          cost: data.usage.totalCost,
        });
      }
    } else if (data.state === "error") {
      // Show error as a system message
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: data.runId ?? uuid(),
            role: "system",
            content: data.errorMessage ?? "An error occurred",
            ts: Date.now(),
          },
        ],
        streamingMessage: null,
      }));
    } else if (data.state === "aborted") {
      // Finalize streaming message if present, mark as aborted
      set((state) => {
        if (state.streamingMessage) {
          return {
            messages: [
              ...state.messages,
              {
                ...state.streamingMessage,
                content: state.streamingMessage.content + " [aborted]",
                streaming: false,
              },
            ],
            streamingMessage: null,
          };
        }
        return { streamingMessage: null };
      });
    }
  },

  handleAssistantEvent: (payload: AgentEventPayload) => {
    const data = payload.data as Record<string, unknown> | undefined;

    if (payload.event === "chunk" || payload.event === "delta") {
      const delta = (data?.text as string) ?? (data?.content as string) ?? "";
      set((state) => {
        const current = state.streamingMessage;
        if (current) {
          return {
            streamingMessage: {
              ...current,
              content: current.content + delta,
            },
          };
        }
        return {
          streamingMessage: {
            id: uuid(),
            role: "assistant",
            content: delta,
            agentId: payload.agentId,
            ts: Date.now(),
            streaming: true,
          },
        };
      });
    } else if (payload.event === "end" || payload.event === "done") {
      set((state) => {
        if (state.streamingMessage) {
          return {
            messages: [
              ...state.messages,
              { ...state.streamingMessage, streaming: false },
            ],
            streamingMessage: null,
          };
        }
        return state;
      });
    }
  },

  handleToolEvent: (payload: AgentEventPayload) => {
    const data = payload.data as Record<string, unknown> | undefined;
    const toolId =
      (data?.toolCallId as string) ?? (data?.id as string) ?? uuid();

    if (
      payload.event === "start" ||
      payload.event === "call" ||
      (data?.phase === "start")
    ) {
      const tool: ToolCall = {
        id: toolId,
        name: (data?.name as string) ?? (data?.tool as string) ?? "unknown",
        args: data?.args ?? data?.input,
        status: "running",
        startedAt: Date.now(),
      };
      set((state) => ({
        toolStream: [...state.toolStream, tool],
      }));
    } else if (
      payload.event === "result" ||
      payload.event === "end" ||
      payload.event === "done" ||
      (data?.phase === "result")
    ) {
      set((state) => ({
        toolStream: state.toolStream.map((t) =>
          t.id === toolId
            ? {
                ...t,
                status: "completed" as const,
                result: data?.result ?? data?.output ?? data?.partialResult,
                completedAt: Date.now(),
              }
            : t,
        ),
      }));
    } else if (payload.event === "error") {
      set((state) => ({
        toolStream: state.toolStream.map((t) =>
          t.id === toolId
            ? {
                ...t,
                status: "error" as const,
                result: data?.error ?? data?.message,
                completedAt: Date.now(),
              }
            : t,
        ),
      }));
    }
  },

  sendMessage: (content: string) => {
    const msg: ChatMessage = {
      id: uuid(),
      role: "user",
      content,
      ts: Date.now(),
    };
    set((state) => ({
      messages: [...state.messages, msg],
    }));
    return msg;
  },

  clear: () => {
    set({ messages: [], streamingMessage: null, toolStream: [], sessionKey: get().sessionKey });
  },
}));
