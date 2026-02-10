import { useUIStore, type ViewId } from "@/stores/ui";
import { useApprovalsStore } from "@/stores/approvals";

interface NavTab {
  id: ViewId;
  label: string;
  icon: string;
}

const tabs: NavTab[] = [
  { id: "dashboard", label: "Home", icon: "⊞" },
  { id: "chat", label: "Chat", icon: "💬" },
  { id: "approvals", label: "Approvals", icon: "✓" },
  { id: "agents", label: "Agents", icon: "🤖" },
  { id: "doctor", label: "Doctor", icon: "🩺" },
  { id: "config", label: "Config", icon: "⚡" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export function MobileNav() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const pendingApprovals = useApprovalsStore((s) => s.pendingCount);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-700 bg-slate-800 lg:hidden safe-bottom">
      <div className="flex justify-around">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
              activeView === tab.id
                ? "text-blue-400"
                : "text-slate-500"
            }`}
          >
            <span className="relative text-base">
              {tab.icon}
              {tab.id === "approvals" && pendingApprovals > 0 && (
                <span className="absolute -top-1 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {pendingApprovals > 9 ? "9+" : pendingApprovals}
                </span>
              )}
            </span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
