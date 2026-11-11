import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError } from '../api/client';
import type { components } from '../api/schema';
import { session } from '../auth/session';
import { useLiveGraph } from '../live/useLiveGraph';

type Infra = components['schemas']['infra-info'];

export function useInfra() {
  const { resyncVersion } = useLiveGraph();
  const [infra, setInfra] = useState<Infra | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const request = useRef(0);
  // Set while a focus or foreground load runs, so the other trigger joins it.
  const automatic = useRef(false);
  const refetch = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const client = session.apiClient();
      if (!client) throw new ApiError(0, 'network_error');
      const next = await client.getInfra();
      if (current === request.current) setInfra(next);
    } catch (e) {
      if (current === request.current)
        setError(e instanceof ApiError ? e : new ApiError(0, 'network_error'));
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, []);
  const load = useCallback(() => {
    if (automatic.current) return;
    automatic.current = true;
    void refetch().finally(() => {
      automatic.current = false;
    });
  }, [refetch]);
  useFocusEffect(
    useCallback(() => {
      load();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') load();
      });
      return () => subscription.remove();
    }, [load]),
  );
  // A resync means the server's live connection came back (for example after a
  // restart), when its infrastructure may have changed. Run events never reload.
  const previous = useRef(resyncVersion);
  useEffect(() => {
    if (previous.current === resyncVersion) return;
    previous.current = resyncVersion;
    void refetch();
  }, [resyncVersion, refetch]);
  useEffect(() => {
    const counter = request;
    return () => {
      counter.current++;
    };
  }, []);
  return { infra, loading, error, refetch };
}
