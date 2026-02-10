import { create } from "zustand";
import type { CronJob, CronRunLog } from "@/protocol/types";

interface CronState {
  jobs: CronJob[];
  runLogs: CronRunLog[];

  setCronJobs: (jobs: unknown[]) => void;
  handleCronEvent: (payload: unknown) => void;
  clear: () => void;
}

export const useCronStore = create<CronState>((set) => ({
  jobs: [],
  runLogs: [],

  setCronJobs: (jobs: unknown[]) => {
    const parsed: CronJob[] = [];
    for (const raw of jobs) {
      const j = raw as Record<string, unknown>;
      const id = (j.id as string) ?? (j.jobId as string);
      if (!id) continue;
      const job: CronJob = {
        id,
        name: (j.name as string) ?? id,
        schedule: (j.schedule as CronJob["schedule"]) ?? "unknown",
        enabled: (j.enabled as boolean) ?? true,
      };
      if (j.agentId) job.agentId = j.agentId as string;
      if (j.description) job.description = j.description as string;
      if (j.deleteAfterRun != null) job.deleteAfterRun = j.deleteAfterRun as boolean;
      if (j.sessionTarget) job.sessionTarget = j.sessionTarget as string;
      if (j.wakeMode) job.wakeMode = j.wakeMode as string;
      if (j.payload) job.payload = j.payload;
      if (j.delivery) job.delivery = j.delivery;
      if (j.lastRun) job.lastRun = j.lastRun as number;
      if (j.nextRun) job.nextRun = j.nextRun as number;
      if (j.status) job.status = j.status as CronJob["status"];
      if (j.lastError) job.lastError = j.lastError as string;
      parsed.push(job);
    }
    set({ jobs: parsed });
  },

  handleCronEvent: (payload: unknown) => {
    const data = payload as Record<string, unknown>;
    const event = data.event as string;

    if (event === "job.updated" || event === "job.created") {
      const job = data.job as CronJob;
      if (job) {
        set((state) => {
          const exists = state.jobs.some((j) => j.id === job.id);
          return {
            jobs: exists
              ? state.jobs.map((j) => (j.id === job.id ? job : j))
              : [...state.jobs, job],
          };
        });
      }
    } else if (event === "job.deleted") {
      const jobId = data.jobId as string;
      set((state) => ({
        jobs: state.jobs.filter((j) => j.id !== jobId),
      }));
    } else if (event === "run.started" || event === "run.completed") {
      const log = data.run as CronRunLog;
      if (log) {
        set((state) => {
          const exists = state.runLogs.some((r) => r.runId === log.runId);
          return {
            runLogs: exists
              ? state.runLogs.map((r) => (r.runId === log.runId ? log : r))
              : [...state.runLogs.slice(-99), log],
          };
        });
      }
    }
  },

  clear: () => {
    set({ jobs: [], runLogs: [] });
  },
}));
