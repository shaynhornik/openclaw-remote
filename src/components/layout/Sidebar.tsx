import { useUIStore, type ViewId } from "@/stores/ui";
import { useApprovalsStore } from "@/stores/approvals";
import { useConnectionStore } from "@/stores/connection";

interface NavItem {
  id: ViewId;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "⊞" },
  { id: "chat", label: "Chat", icon: "💬" },
  { id: "agents", label: "Agents", icon: "🤖" },
  { id: "approvals", label: "Approvals", icon: "✓" },
  { id: "sessions", label: "Sessions", icon: "◉" },
  { id: "channels", label: "Channels", icon: "⇄" },
  { id: "usage", label: "Usage", icon: "📊" },
  { id: "cron", label: "Cron", icon: "⏱" },
  { id: "logs", label: "Logs", icon: "☰" },
  { id: "doctor", label: "Doctor", icon: "🩺" },
  { id: "config", label: "Config", icon: "⚡" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
  const activeView = useUIStore((s) => s.activeView);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const pendingApprovals = useApprovalsStore((s) => s.pendingCount);
  const status = useConnectionStore((s) => s.status);

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => useUIStore.getState().setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-56 transform bg-slate-800 border-r border-slate-700 transition-transform duration-200 lg:translate-x-0 lg:static lg:inset-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-700">
          <span className="text-lg font-bold text-white">OpenClaw</span>
          <span className="text-xs text-slate-400">Remote</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                activeView === item.id
                  ? "bg-slate-700/60 text-white"
                  : "text-slate-400 hover:bg-slate-700/30 hover:text-slate-200"
              }`}
            >
              <span className="w-5 text-center text-base">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "approvals" && pendingApprovals > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
                  {pendingApprovals}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Connection status */}
        <div className="border-t border-slate-700 px-4 py-3">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                status === "connected"
                  ? "bg-green-500"
                  : status === "connecting" || status === "authenticating"
                    ? "bg-yellow-500 animate-pulse"
                    : status === "error"
                      ? "bg-red-500"
                      : "bg-slate-500"
              }`}
            />
            <span className="text-slate-400 capitalize">{status}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
