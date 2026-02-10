import { create } from "zustand";
import { getItem, setItem } from "@/utils/storage";

export type ViewId =
  | "dashboard"
  | "chat"
  | "agents"
  | "approvals"
  | "sessions"
  | "channels"
  | "usage"
  | "cron"
  | "logs"
  | "doctor"
  | "config"
  | "settings";

export type Theme = "dark" | "light";

const THEME_KEY = "openclaw-remote:theme";

interface UIState {
  activeView: ViewId;
  sidebarOpen: boolean;
  theme: Theme;

  setActiveView: (view: ViewId) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: Theme) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: "dashboard",
  sidebarOpen: true,
  theme: (getItem<Theme>(THEME_KEY) ?? "dark") as Theme,

  setActiveView: (view: ViewId) => {
    set({ activeView: view, sidebarOpen: false });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  setSidebarOpen: (open: boolean) => {
    set({ sidebarOpen: open });
  },

  setTheme: (theme: Theme) => {
    setItem(THEME_KEY, theme);
    set({ theme });
  },
}));
