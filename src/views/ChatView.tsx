import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/stores/chat";
import { useConnectionStore } from "@/stores/connection";
import { useRequest } from "@/hooks/useRequest";
import DOMPurify from "dompurify";
import { TimeAgo } from "@/components/shared/TimeAgo";
import { Badge } from "@/components/shared/Badge";
import { JsonViewer } from "@/components/shared/JsonViewer";
import { uuid } from "@/utils/uuid";

export function ChatView() {
  const messages = useChatStore((s) => s.messages);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const toolStream = useChatStore((s) => s.toolStream);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const sessionKey = useChatStore((s) => s.sessionKey);
  const status = useConnectionStore((s) => s.status);

  const [input, setInput] = useState("");
  const { execute, loading } = useRequest();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, streamingMessage]);

  const handleSend = async () => {
    if (!input.trim() || loading || status !== "connected") return;
    const content = input.trim();
    setInput("");
    sendMessage(content);

    const idempotencyKey = uuid();
    await execute("chat.send", {
      sessionKey: sessionKey || undefined,
      message: content,
      idempotencyKey,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Connect to gateway to use chat
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4 min-w-0">
      {/* Chat panel */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 pb-4">
          {messages.length === 0 && !streamingMessage && (
            <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
              No messages yet. Send a message to start chatting.
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {streamingMessage && (
            <ChatMessage message={streamingMessage} />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-700 pt-3">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              rows={2}
              className="flex-1 resize-none rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="self-end rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "..." : "Send"}
            </button>
          </div>
        </div>
      </div>

      {/* Tool stream panel */}
      {toolStream.length > 0 && (
        <div className="hidden lg:block w-80 overflow-y-auto border-l border-slate-700 pl-4">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Tool Calls
          </h3>
          <div className="space-y-2">
            {toolStream.map((tool) => (
              <div
                key={tool.id}
                className="rounded-md border border-slate-700 bg-slate-800/50 p-3 text-xs"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant={
                      tool.status === "completed"
                        ? "success"
                        : tool.status === "error"
                          ? "error"
                          : "info"
                    }
                  >
                    {tool.status}
                  </Badge>
                  <span className="font-mono text-white">{tool.name}</span>
                </div>
                {tool.args != null && <JsonViewer data={tool.args} />}
                {tool.result != null && (
                  <div className="mt-1">
                    <JsonViewer data={tool.result} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChatMessage({ message }: { message: { id: string; role: string; content: string; ts: number; streaming?: boolean } }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const sanitized = DOMPurify.sanitize(message.content);

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${
          isSystem
            ? "bg-yellow-900/30 border border-yellow-700/50 text-yellow-200"
            : isUser
              ? "bg-blue-600 text-white"
              : "bg-slate-800 border border-slate-700 text-slate-100"
        }`}
      >
        <div
          className="whitespace-pre-wrap break-words"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
        <div className="mt-1 flex items-center gap-2">
          <TimeAgo
            ts={message.ts}
            className={`text-xs ${
              isSystem
                ? "text-yellow-400"
                : isUser
                  ? "text-blue-200"
                  : "text-slate-500"
            }`}
          />
          {message.streaming && (
            <span className="text-xs text-blue-400 animate-pulse">streaming...</span>
          )}
        </div>
      </div>
    </div>
  );
}
