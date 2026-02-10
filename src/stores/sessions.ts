import { create } from "zustand";
import type { SessionInfo } from "@/protocol/types";

interface SessionsState {
  sessions: SessionInfo[];
  activeSessionId: string | null;

  setSessions: (sessions: unknown[]) => void;
  setActiveSession: (id: string | null) => void;
  handleSessionEvent: (payload: unknown) => void;
  clear: () => void;
}

export const useSessionsStore = create<SessionsState>((set) => ({
  sessions: [],
  activeSessionId: null,

  setSessions: (sessions: unknown[]) => {
    const parsed: SessionInfo[] = sessions.map((raw) => {
      const s = raw as Record<string, unknown>;
      return {
        id: s.id as string | undefined,
        key: s.key as string | undefined,
        name: s.name as string | undefined,
        createdAt: s.createdAt as number | undefined,
        updatedAt: s.updatedAt as number | undefined,
        lastActiveAt: s.lastActiveAt as number | undefined,
        agentCount: s.agentCount as number | undefined,
        status: s.status as string | undefined,
        age: s.age as number | undefined,
      };
    });
    set({ sessions: parsed });
  },

  setActiveSession: (id: string | null) => {
    set({ activeSessionId: id });
  },

  handleSessionEvent: (payload: unknown) => {
    const data = payload as Record<string, unknown>;
    const event = data.event as string;

    if (event === "created") {
      const session = data.session as SessionInfo;
      if (session) {
        set((state) => ({
          sessions: [...state.sessions, session],
        }));
      }
    } else if (event === "updated") {
      const session = data.session as SessionInfo;
      if (session) {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === session.id ? session : s,
          ),
        }));
      }
    } else if (event === "deleted") {
      const sessionId = data.sessionId as string;
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        activeSessionId:
          state.activeSessionId === sessionId
            ? null
            : state.activeSessionId,
      }));
    }
  },

  clear: () => {
    set({ sessions: [], activeSessionId: null });
  },
}));
