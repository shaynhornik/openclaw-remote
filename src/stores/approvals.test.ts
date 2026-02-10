import { describe, it, expect, beforeEach } from "vitest";
import { useApprovalsStore } from "./approvals";
import type { ApprovalRequest } from "@/protocol/types";

describe("approvals store", () => {
  beforeEach(() => {
    useApprovalsStore.getState().clear();
  });

  it("starts empty", () => {
    expect(useApprovalsStore.getState().approvals).toHaveLength(0);
    expect(useApprovalsStore.getState().pendingCount).toBe(0);
  });

  it("adds approval request", () => {
    const approval: ApprovalRequest = {
      id: "ap-1",
      agentId: "a1",
      sessionId: "s1",
      type: "exec",
      command: "rm -rf /tmp/test",
      requestedAt: Date.now(),
      status: "pending",
    };
    useApprovalsStore.getState().handleApprovalRequested(approval);

    expect(useApprovalsStore.getState().approvals).toHaveLength(1);
    expect(useApprovalsStore.getState().pendingCount).toBe(1);
  });

  it("resolves approval", () => {
    const approval: ApprovalRequest = {
      id: "ap-1",
      agentId: "a1",
      sessionId: "s1",
      type: "exec",
      requestedAt: Date.now(),
      status: "pending",
    };
    useApprovalsStore.getState().handleApprovalRequested(approval);

    useApprovalsStore.getState().handleApprovalResolved({
      id: "ap-1",
      status: "approved",
      resolvedBy: "user-1",
      resolvedAt: Date.now(),
    });

    expect(useApprovalsStore.getState().pendingCount).toBe(0);
    expect(useApprovalsStore.getState().approvals[0].status).toBe("approved");
  });
});
