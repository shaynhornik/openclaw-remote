import { useState } from "react";

interface JsonViewerProps {
  data: unknown;
  collapsed?: boolean;
  className?: string;
}

export function JsonViewer({ data, collapsed = true, className }: JsonViewerProps) {
  const [expanded, setExpanded] = useState(!collapsed);

  const json = typeof data === "string" ? data : JSON.stringify(data, null, 2);

  if (!json || json === "null" || json === "undefined") {
    return <span className="text-slate-500 text-xs italic">null</span>;
  }

  const preview = json.length > 80 ? json.slice(0, 80) + "..." : json;

  return (
    <div className={className}>
      {json.length > 80 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-400 hover:text-blue-300 mb-1"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      )}
      <pre className="text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap break-all bg-slate-800/50 rounded p-2">
        {expanded ? json : preview}
      </pre>
    </div>
  );
}
