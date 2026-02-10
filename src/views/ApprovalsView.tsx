import { useApprovalsStore } from "@/stores/approvals";
import { useConnectionStore } from "@/stores/connection";
import { useRequest } from "@/hooks/useRequest";
import { Badge } from "@/components/shared/Badge";
import { TimeAgo } from "@/components/shared/TimeAgo";
import type { ApprovalRequest } from "@/protocol/types";

export function ApprovalsView() {
  const approvals = useApprovalsStore((s) => s.approvals);
  const status = useConnectionStore((s) => s.status);

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Connect to gateway to manage approvals
      </div>
    );
  }

  const pending = approvals.filter((a) => a.status === "pending");
  const resolved = approvals.filter((a) => a.status !== "pending");

  return (
    <div className="space-y-6">
      {/* Pending */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-slate-500 text-sm">No pending approvals</p>
        ) : (
          <div className="space-y-3">
            {pending.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} />
            ))}
          </div>
        )}
      </section>

      {/* Resolved */}
      {resolved.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Resolved ({resolved.length})
          </h2>
          <div className="space-y-2">
            {resolved.slice(-20).reverse().map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} resolved />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ApprovalCard({
  approval,
  resolved,
}: {
  approval: ApprovalRequest;
  resolved?: boolean;
}) {
  const { execute, loading } = useRequest();

  const handleResolve = async (action: "approve" | "deny") => {
    await execute("exec.approval.resolve", {
      id: approval.id,
      action,
    });
  };

  const statusVariant =
    approval.status === "approved"
      ? "success"
      : approval.status === "denied"
        ? "error"
        : approval.status === "expired"
          ? "default"
          : "warning";

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={statusVariant}>{approval.status}</Badge>
            <span className="text-sm font-medium text-white">{approval.type}</span>
          </div>
          {approval.command && (
            <div className="mt-1">
              <code className="text-xs font-mono text-blue-300 bg-slate-900 px-2 py-1 rounded">
                {approval.command}
                {approval.args?.length ? ` ${approval.args.join(" ")}` : ""}
              </code>
            </div>
          )}
          {approval.description && (
            <p className="mt-1 text-xs text-slate-400">{approval.description}</p>
          )}
          {/* cwd intentionally not displayed for security */}
        </div>
        <TimeAgo ts={approval.requestedAt} className="text-xs text-slate-500 shrink-0" />
      </div>

      {/* Actions for pending approvals */}
      {!resolved && approval.status === "pending" && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => handleResolve("approve")}
            disabled={loading}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => handleResolve("deny")}
            disabled={loading}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            Deny
          </button>
        </div>
      )}

      {/* Resolution info */}
      {resolved && approval.resolvedBy && (
        <div className="mt-2 text-xs text-slate-500">
          Resolved by {approval.resolvedBy}
          {approval.resolvedAt && (
            <> at {new Date(approval.resolvedAt).toLocaleString()}</>
          )}
        </div>
      )}
    </div>
  );
}
