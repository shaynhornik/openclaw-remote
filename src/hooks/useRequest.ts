import { useState, useCallback } from "react";
import { useConnectionStore } from "@/stores/connection";

interface RequestState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (method: string, params?: unknown) => Promise<T | null>;
}

/**
 * Hook for sending RPC requests through the gateway client.
 */
export function useRequest<T = unknown>(): RequestState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (method: string, params?: unknown): Promise<T | null> => {
      const client = useConnectionStore.getState()._client;
      if (!client) {
        setError("Not connected");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await client.request<T>(method, params);
        setData(result);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Request failed";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { data, loading, error, execute };
}
