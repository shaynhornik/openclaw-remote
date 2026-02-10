import { useChannelsStore } from "@/stores/channels";
import { useConnectionStore } from "@/stores/connection";
import { StatusDot } from "@/components/shared/StatusDot";
import { Badge } from "@/components/shared/Badge";
import { TimeAgo } from "@/components/shared/TimeAgo";

export function ChannelsView() {
  const channels = useChannelsStore((s) => s.channels);
  const status = useConnectionStore((s) => s.status);

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Connect to gateway to view channels
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p className="text-lg mb-1">No channels</p>
        <p className="text-sm">Channels will appear when configured</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {channels.map((channel) => (
        <div
          key={channel.id}
          className="rounded-lg border border-slate-700 bg-slate-800 p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <StatusDot status={channel.status ?? (channel.running ? "active" : "idle")} size="md" />
              <span className="text-sm font-medium text-white">{channel.name}</span>
            </div>
            {channel.type && <Badge>{channel.type}</Badge>}
          </div>
          <dl className="space-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <dt>Status</dt>
              <dd className="text-white capitalize">{channel.status ?? (channel.running ? "running" : "idle")}</dd>
            </div>
            {channel.messageCount != null && (
              <div className="flex justify-between">
                <dt>Messages</dt>
                <dd className="text-white">{channel.messageCount}</dd>
              </div>
            )}
            {channel.connectedAt && (
              <div className="flex justify-between">
                <dt>Connected</dt>
                <dd>
                  <TimeAgo ts={channel.connectedAt} />
                </dd>
              </div>
            )}
            {channel.lastMessageAt && (
              <div className="flex justify-between">
                <dt>Last message</dt>
                <dd>
                  <TimeAgo ts={channel.lastMessageAt} />
                </dd>
              </div>
            )}
          </dl>
        </div>
      ))}
    </div>
  );
}
