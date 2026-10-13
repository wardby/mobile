import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, createApiClient } from '../api/client';
import { session, useSession } from '../auth/session';
import { byAgent, byIssue, summarize, type Graph } from './helpers';
import { periodStart, type Period } from './period';

export function useSpendPeriod() {
  const [period, setPeriod] = useState<Period>('week');
  const [ready, setReady] = useState(false);
  const changed = useRef(false);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem('spend.period')
      .catch(() => null)
      .then((saved) => {
        if (!active) return;
        if (!changed.current && (saved === 'day' || saved === 'week' || saved === 'month'))
          setPeriod(saved);
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const select = (next: Period) => {
    changed.current = true;
    setPeriod(next);
    void AsyncStorage.setItem('spend.period', next).catch(() => {});
  };
  return { period, setPeriod: select, ready };
}
export function useSpend(period: Period, ready = true) {
  const auth = useSession();
  const host = auth.status === 'signedIn' ? auth.host : null;
  const client = useMemo(
    () =>
      host
        ? createApiClient({
            baseUrl: host,
            getAccessToken: session.getAccessToken,
            onUnauthorized: () => {
              void session.signOut();
            },
          })
        : null,
    [host],
  );
  const [data, setData] = useState<ReturnType<typeof buildData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const request = useRef(0);
  const refetch = useCallback(async () => {
    if (!client || !ready) return;
    const current = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const start = periodStart(period, new Date());
      const graph = await client.getGraph({ since: start.toISOString(), limit: 2000 });
      if (current === request.current) setData(buildData(graph, start));
    } catch (error) {
      if (current === request.current)
        setError(error instanceof ApiError ? error : new ApiError(0, 'network_error'));
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [client, period, ready]);
  useFocusEffect(
    useCallback(() => {
      setData(null);
      void refetch();
      return () => {
        request.current++;
      };
    }, [refetch]),
  );
  return { data, loading, error, refetch };
}
function buildData(graph: Graph, start: Date) {
  return {
    ...summarize(graph, start),
    agents: byAgent(graph, start),
    issues: byIssue(graph, start),
    groups: graph.spend.groups,
  };
}
