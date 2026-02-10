import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "./ui";

describe("ui store", () => {
  beforeEach(() => {
    useUIStore.setState({
      activeView: "dashboard",
      sidebarOpen: true,
      theme: "dark",
    });
  });

  it("starts with dashboard view", () => {
    expect(useUIStore.getState().activeView).toBe("dashboard");
  });

  it("changes active view and closes sidebar", () => {
    useUIStore.getState().setActiveView("chat");
    expect(useUIStore.getState().activeView).toBe("chat");
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it("toggles sidebar", () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it("sets theme", () => {
    useUIStore.getState().setTheme("light");
    expect(useUIStore.getState().theme).toBe("light");
  });
});
