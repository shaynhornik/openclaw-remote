import { create } from "zustand";
import { getItem, setItem, removeItem } from "@/utils/storage";
import { clearDeviceToken } from "@/gateway/device-auth-store";

const TOKEN_STORAGE_KEY = "openclaw-remote:auth-token";

interface AuthState {
  token: string | null;
  password: string | null; // in-memory only, never persisted

  setToken: (token: string) => void;
  setPassword: (password: string) => void;
  clearPassword: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getItem<string>(TOKEN_STORAGE_KEY),
  password: null,

  setToken: (token: string) => {
    setItem(TOKEN_STORAGE_KEY, token);
    set({ token });
  },

  setPassword: (password: string) => {
    set({ password });
  },

  clearPassword: () => {
    set({ password: null });
  },

  logout: () => {
    removeItem(TOKEN_STORAGE_KEY);
    clearDeviceToken();
    set({ token: null, password: null });
  },
}));
