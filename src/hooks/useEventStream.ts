import { useEffect, useRef } from "react";
import type { EventFrame } from "@/protocol/types";
import { useConnectionStore } from "@/stores/connection";

/**
 * Subscribe to specific gateway event types.
 * The callback receives the event frame directly.
 */
export function useEventStream(
  eventTypes: string[],
  callback: (frame: EventFrame) => void,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const client = useConnectionStore.getState()._client;
    if (!client) return;

    const originalHandler = client["onEvent"];

    client.setEventHandler((frame: EventFrame) => {
      // Call original handler for store routing
      originalHandler(frame);

      // Call subscriber if event matches
      if (eventTypes.includes(frame.event)) {
        callbackRef.current(frame);
      }
    });

    return () => {
      // Restore original handler
      client.setEventHandler(originalHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventTypes.join(",")]);
}
