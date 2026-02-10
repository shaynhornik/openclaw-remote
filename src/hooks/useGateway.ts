import { useEffect } from "react";
import { useConnectionStore } from "@/stores/connection";

/**
 * Hook to manage gateway connection lifecycle.
 * Call in App root – connects on mount if URL is configured, cleans up on unmount.
 */
export function useGateway(): void {
  const url = useConnectionStore((s) => s.url);
  const status = useConnectionStore((s) => s.status);
  const disconnect = useConnectionStore((s) => s.disconnect);

  useEffect(() => {
    return () => {
      disconnect();
    };
    // Only cleanup on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-reconnect if URL changes while connected
  useEffect(() => {
    if (url && status === "connected") {
      // URL changed while connected – reconnect
      useConnectionStore.getState().connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
}
