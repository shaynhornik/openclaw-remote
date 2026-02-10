import { useCronStore } from "@/stores/cron";
import { useConnectionStore } from "@/stores/connection";
import { useRequest } from "@/hooks/useRequest";
import { Badge } from "@/components/shared/Badge";
import { StatusDot } from "@/components/shared/StatusDot";
import { TimeAgo } from "@/components/shared/TimeAgo";
import type { CronJob, CronSchedule } from "@/protocol/types";

function formatSchedule(schedule: CronSchedule | string): string {
  if (typeof schedule === "string") return schedule;
  if (schedule.kind === "cron" && schedule.expr) return schedule.expr;
  if (schedule.kind === "every" && schedule.everyMs) {
    const secs = schedule.everyMs / 1000;
    if (secs < 60) return `every ${secs}s`;
    if (secs < 3600) return `every ${Math.round(secs / 60)}m`;
    return `every ${Math.round(secs / 3600)}h`;
  }
  if (schedule.kind === "at" && schedule.at) return `at ${schedule.at}`;
  return schedule.kind ?? "unknown";
}

export function CronView() {
  const jobs = useCronStore((s) => s.jobs);
  const runLogs = useCronStore((s) => s.runLogs);
  const status = useConnectionStore((s) => s.status);

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Connect to gateway to manage cron jobs
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p className="text-lg mb-1">No cron jobs</p>
        <p className="text-sm">Cron jobs will appear when configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Jobs */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
          Jobs ({jobs.length})
        </h2>
        <div className="space-y-3">
          {jobs.map((job) => (
            <CronJobCard key={job.id} job={job} />
          ))}
        </div>
      </section>

      {/* Recent runs */}
      {runLogs.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Recent Runs
          </h2>
          <div className="space-y-2">
            {runLogs.slice(-10).reverse().map((log) => (
              <div
                key={log.runId}
                className="flex items-center justify-between rounded-md bg-slate-800 border border-slate-700 px-4 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <StatusDot
                    status={log.status === "success" ? "ok" : log.status === "error" ? "error" : "running"}
                    size="sm"
                  />
                  <span className="text-slate-300">{log.jobId}</span>
                  <Badge
                    variant={
                      log.status === "success"
                        ? "success"
                        : log.status === "error"
                          ? "error"
                          : "info"
                    }
                  >
                    {log.status}
                  </Badge>
                </div>
                <TimeAgo ts={log.startedAt} className="text-xs text-slate-500" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CronJobCard({ job }: { job: CronJob }) {
  const { execute, loading } = useRequest();

  const handleToggle = async () => {
    await execute("cron.update", {
      jobId: job.id,
      patch: { enabled: !job.enabled },
    });
  };

  const handleTrigger = async () => {
    await execute("cron.run", { jobId: job.id, mode: "force" });
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot
            status={
              !job.enabled
                ? "idle"
                : job.status === "running"
                  ? "running"
                  : job.status === "error"
                    ? "error"
                    : "ok"
            }
            size="md"
          />
          <span className="text-sm font-medium text-white">{job.name}</span>
          <Badge variant={job.enabled ? "success" : "default"}>
            {job.enabled ? "enabled" : "disabled"}
          </Badge>
        </div>
        <code className="text-xs text-slate-400 font-mono">
          {formatSchedule(job.schedule)}
        </code>
      </div>

      {job.description && (
        <p className="mt-1 text-xs text-slate-400">{job.description}</p>
      )}

      <div className="mt-2 flex gap-4 text-xs text-slate-400">
        {job.lastRun && (
          <span>Last run: <TimeAgo ts={job.lastRun} /></span>
        )}
        {job.nextRun && (
          <span>Next: <TimeAgo ts={job.nextRun} /></span>
        )}
      </div>

      {job.lastError && (
        <p className="mt-2 text-xs text-red-400">{job.lastError}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleToggle}
          disabled={loading}
          className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {job.enabled ? "Disable" : "Enable"}
        </button>
        <button
          onClick={handleTrigger}
          disabled={loading}
          className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          Run Now
        </button>
      </div>
    </div>
  );
}
