import { create } from "zustand";
import type { PresenceEntry, HealthInfo } from "@/protocol/types";

interface PresenceState {
  entries: PresenceEntry[];
  health: HealthInfo | null;

  setPresence: (entries: PresenceEntry[]) => void;
  setHealth: (health: HealthInfo) => void;
  handlePresenceEvent: (payload: unknown) => void;
  handleHealthEvent: (payload: unknown) => void;
  clear: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  entries: [],
  health: null,

  setPresence: (entries: PresenceEntry[]) => {
    set({ entries });
  },

  setHealth: (health: HealthInfo) => {
    set({ health });
  },

  handlePresenceEvent: (payload: unknown) => {
    const data = payload as Record<string, unknown>;
    const event = data.event as string;

    if (event === "join") {
      const entry = data.entry as PresenceEntry;
      if (entry) {
        set((state) => ({
          entries: [
            ...state.entries.filter((e) => e.sessionId !== entry.sessionId),
            entry,
          ],
        }));
      }
    } else if (event === "leave") {
      const sessionId = data.sessionId as string;
      set((state) => ({
        entries: state.entries.filter((e) => e.sessionId !== sessionId),
      }));
    } else if (event === "update") {
      const entry = data.entry as PresenceEntry;
      if (entry) {
        set((state) => ({
          entries: state.entries.map((e) =>
            e.sessionId === entry.sessionId ? entry : e,
          ),
        }));
      }
    } else {
      // Full presence list update
      if (Array.isArray(payload)) {
        set({ entries: payload as PresenceEntry[] });
      }
    }
  },

  handleHealthEvent: (payload: unknown) => {
    set({ health: payload as HealthInfo });
  },

  clear: () => {
    set({ entries: [], health: null });
  },
}));
