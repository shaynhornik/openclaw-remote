import { useUIStore } from "@/stores/ui";
import { useConnectionStore } from "@/stores/connection";
import { StatusDot } from "@/components/shared/StatusDot";

export function TopBar() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const activeView = useUIStore((s) => s.activeView);
  const status = useConnectionStore((s) => s.status);
  const hello = useConnectionStore((s) => s.hello);

  const viewTitles: Record<string, string> = {
    dashboard: "Dashboard",
    chat: "Chat",
    agents: "Agents",
    approvals: "Approvals",
    sessions: "Sessions",
    channels: "Channels",
    usage: "Usage",
    cron: "Cron Jobs",
    logs: "Logs",
    doctor: "Doctor",
    config: "Config",
    settings: "Settings",
  };

  return (
    <header className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3">
      {/* Mobile menu button */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden text-slate-400 hover:text-white p-1"
        aria-label="Toggle sidebar"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <h1 className="text-lg font-semibold text-white">
        {viewTitles[activeView] ?? activeView}
      </h1>

      {/* Connection info */}
      <div className="flex items-center gap-3">
        {hello?.server && (
          <span className="hidden sm:inline text-xs text-slate-400">
            {hello.server.name ?? "gateway"} v{hello.server.version}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <StatusDot
            status={status === "connected" ? "connected" : status === "error" ? "error" : "disconnected"}
          />
          <span className="text-xs text-slate-400 capitalize">{status}</span>
        </div>
      </div>
    </header>
  );
}
