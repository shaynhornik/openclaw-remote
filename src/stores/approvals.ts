import { create } from "zustand";
import type { ApprovalRequest } from "@/protocol/types";

interface ApprovalsState {
  approvals: ApprovalRequest[];
  pendingCount: number;

  setApprovals: (approvals: ApprovalRequest[]) => void;
  handleApprovalRequested: (payload: unknown) => void;
  handleApprovalResolved: (payload: unknown) => void;
  clear: () => void;
}

function countPending(approvals: ApprovalRequest[]): number {
  return approvals.filter((a) => a.status === "pending").length;
}

export const useApprovalsStore = create<ApprovalsState>((set) => ({
  approvals: [],
  pendingCount: 0,

  setApprovals: (approvals: ApprovalRequest[]) => {
    set({ approvals, pendingCount: countPending(approvals) });
  },

  handleApprovalRequested: (payload: unknown) => {
    const approval = payload as ApprovalRequest;
    set((state) => {
      const updated = [...state.approvals, approval];
      return { approvals: updated, pendingCount: countPending(updated) };
    });
  },

  handleApprovalResolved: (payload: unknown) => {
    const data = payload as { id: string; status: string; resolvedBy?: string; resolvedAt?: number };
    set((state) => {
      const updated = state.approvals.map((a) =>
        a.id === data.id
          ? {
              ...a,
              status: data.status as ApprovalRequest["status"],
              resolvedBy: data.resolvedBy,
              resolvedAt: data.resolvedAt,
            }
          : a,
      );
      return { approvals: updated, pendingCount: countPending(updated) };
    });
  },

  clear: () => {
    set({ approvals: [], pendingCount: 0 });
  },
}));
