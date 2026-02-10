import { useState, useEffect } from "react";
import { formatTimeAgo } from "@/utils/format";

interface TimeAgoProps {
  ts: number;
  className?: string;
}

export function TimeAgo({ ts, className }: TimeAgoProps) {
  const [text, setText] = useState(() => formatTimeAgo(ts));

  useEffect(() => {
    setText(formatTimeAgo(ts));
    const interval = setInterval(() => {
      setText(formatTimeAgo(ts));
    }, 10_000);
    return () => clearInterval(interval);
  }, [ts]);

  return (
    <time className={className} dateTime={new Date(ts).toISOString()} title={new Date(ts).toLocaleString()}>
      {text}
    </time>
  );
}
