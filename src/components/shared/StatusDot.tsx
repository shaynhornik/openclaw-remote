interface StatusDotProps {
  status: "ok" | "active" | "connected" | "running" | "idle" | "error" | "degraded" | "pending" | "disconnected" | string;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
}

const colorMap: Record<string, string> = {
  ok: "bg-green-500",
  active: "bg-green-500",
  connected: "bg-green-500",
  running: "bg-green-500",
  idle: "bg-yellow-500",
  pending: "bg-yellow-500",
  degraded: "bg-yellow-500",
  error: "bg-red-500",
  disconnected: "bg-slate-500",
};

const sizeMap = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
};

export function StatusDot({ status, size = "md", pulse }: StatusDotProps) {
  const color = colorMap[status] ?? "bg-slate-500";
  const sizeClass = sizeMap[size];
  const shouldPulse = pulse ?? (status === "running" || status === "active" || status === "connected");

  return (
    <span className="relative inline-flex">
      {shouldPulse && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${color}`}
        />
      )}
      <span className={`relative inline-flex rounded-full ${sizeClass} ${color}`} />
    </span>
  );
}
