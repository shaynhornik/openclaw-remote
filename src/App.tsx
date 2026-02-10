import { AppShell } from "@/components/layout/AppShell";
import { useUIStore } from "@/stores/ui";
import { useGateway } from "@/hooks/useGateway";
import { useApprovalNotification } from "@/hooks/useApprovalNotification";

import { DashboardView } from "@/views/DashboardView";
import { ChatView } from "@/views/ChatView";
import { AgentTreeView } from "@/views/AgentTreeView";
import { ApprovalsView } from "@/views/ApprovalsView";
import { SessionsView } from "@/views/SessionsView";
import { ChannelsView } from "@/views/ChannelsView";
import { UsageView } from "@/views/UsageView";
import { CronView } from "@/views/CronView";
import { LogsView } from "@/views/LogsView";
import { DoctorView } from "@/views/DoctorView";
import { ConfigView } from "@/views/ConfigView";
import { SettingsView } from "@/views/SettingsView";

const viewComponents: Record<string, React.FC> = {
  dashboard: DashboardView,
  chat: ChatView,
  agents: AgentTreeView,
  approvals: ApprovalsView,
  sessions: SessionsView,
  channels: ChannelsView,
  usage: UsageView,
  cron: CronView,
  logs: LogsView,
  doctor: DoctorView,
  config: ConfigView,
  settings: SettingsView,
};

export function App() {
  useGateway();
  useApprovalNotification();

  const activeView = useUIStore((s) => s.activeView);
  const ViewComponent = viewComponents[activeView] ?? DashboardView;

  return (
    <AppShell>
      <ViewComponent />
    </AppShell>
  );
}
