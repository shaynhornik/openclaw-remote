import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./auth";

describe("auth store", () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it("starts with no auth", () => {
    const state = useAuthStore.getState();
    expect(state.password).toBeNull();
  });

  it("sets password in memory only", () => {
    useAuthStore.getState().setPassword("secret");
    expect(useAuthStore.getState().password).toBe("secret");
  });

  it("clears password on logout", () => {
    useAuthStore.getState().setPassword("secret");
    useAuthStore.getState().setToken("tok-123");
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.password).toBeNull();
    expect(state.token).toBeNull();
  });
});
