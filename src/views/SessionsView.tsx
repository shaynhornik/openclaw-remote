import { useSessionsStore } from "@/stores/sessions";
import { useConnectionStore } from "@/stores/connection";
import { Badge } from "@/components/shared/Badge";
import { TimeAgo } from "@/components/shared/TimeAgo";
import { formatDuration } from "@/utils/format";

export function SessionsView() {
  const sessions = useSessionsStore((s) => s.sessions);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const setActiveSession = useSessionsStore((s) => s.setActiveSession);
  const status = useConnectionStore((s) => s.status);

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Connect to gateway to view sessions
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p className="text-lg mb-1">No sessions</p>
        <p className="text-sm">Sessions will appear when created</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session, idx) => {
        const sessionKey = session.id ?? session.key ?? `session-${idx}`;
        const displayName = session.name ?? sessionKey;
        const updatedAt = session.updatedAt ?? session.lastActiveAt ?? session.createdAt;

        return (
          <button
            key={sessionKey}
            onClick={() => setActiveSession(sessionKey)}
            className={`w-full text-left rounded-lg border p-4 transition-colors ${
              activeSessionId === sessionKey
                ? "border-blue-500 bg-blue-900/20"
                : "border-slate-700 bg-slate-800 hover:bg-slate-700/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">
                  {displayName}
                </span>
                {session.status && (
                  <Badge
                    variant={session.status === "active" ? "success" : "default"}
                  >
                    {session.status}
                  </Badge>
                )}
              </div>
              {updatedAt != null && (
                <TimeAgo ts={updatedAt} className="text-xs text-slate-500" />
              )}
            </div>
            <div className="mt-1 flex gap-4 text-xs text-slate-400">
              {session.agentCount != null && (
                <span>{session.agentCount} agents</span>
              )}
              {session.age != null && (
                <span>Age: {formatDuration(session.age)}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
