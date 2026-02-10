import { useEffect, useRef } from "react";
import { useApprovalsStore } from "@/stores/approvals";

/**
 * Sends browser push notifications when new approval requests arrive.
 */
export function useApprovalNotification(): void {
  const pendingCount = useApprovalsStore((s) => s.pendingCount);
  const prevCount = useRef(pendingCount);

  useEffect(() => {
    if (pendingCount > prevCount.current) {
      const newCount = pendingCount - prevCount.current;
      showNotification(newCount);
    }
    prevCount.current = pendingCount;
  }, [pendingCount]);
}

async function showNotification(count: number): Promise<void> {
  if (!("Notification" in window)) return;

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }

  if (Notification.permission === "granted") {
    new Notification("OpenClaw – Approval Required", {
      body: `${count} new approval request${count > 1 ? "s" : ""} pending`,
      icon: "/icons/icon-192.png",
      tag: "approval-request",
    });
  }
}
