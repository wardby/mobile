import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import type { components } from '../api/schema';
import { session } from '../auth/session';
import { useLiveGraph } from '../live/useLiveGraph';

type Run = components['schemas']['run-detail'];

export function useRunDetail(id: string) {
  const { graph, resyncVersion, loadVersion } = useLiveGraph();
  const [detail, setDetail] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const request = useRef(0);
  const refetch = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const client = session.apiClient();
      if (!client) throw new ApiError(0, 'network_error');
      const next = await client.getRun(id);
      if (current === request.current) setDetail(next);
    } catch (e) {
      if (current === request.current)
        setError(e instanceof ApiError ? e : new ApiError(0, 'network_error'));
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    let active = true;
    const counter = request;
    void Promise.resolve().then(() => {
      if (active) return refetch();
    });
    return () => {
      active = false;
      counter.current++;
    };
  }, [refetch]);
  const live = graph?.runs.find((run) => run.id === id);
  const outcomes = live ? JSON.stringify(live.outcomes) : undefined;
  const status = live?.status ?? (detail?.id === id ? detail.status : undefined);
  const active = status === 'pending' || status === 'running';
  const previous = useRef({ id, outcomes, resyncVersion, loadVersion, active });
  useEffect(() => {
    const before = previous.current;
    previous.current = { id, outcomes, resyncVersion, loadVersion, active };
    if (before.id !== id) return;
    const beforeOutcomes =
      before.outcomes ?? (detail ? JSON.stringify(detail.outcomes) : undefined);
    // loadVersion only says events may have been missed while disconnected
    // (reconnect, return from background), not that data changed: refetch an
    // run that was active before the reload or is active now (it may have
    // finished while disconnected) so useRunSteps can fill the gap by seq.
    if (
      before.resyncVersion !== resyncVersion ||
      ((before.active || active) && before.loadVersion !== loadVersion) ||
      (beforeOutcomes !== undefined && outcomes !== undefined && beforeOutcomes !== outcomes)
    )
      void refetch();
  }, [id, outcomes, resyncVersion, loadVersion, active, refetch, detail]);
  const run = detail?.id === id ? detail : null;
  return {
    // The run detail as last fetched, without the live graph fields.
    fetched: run,
    run:
      run && live
        ? {
            ...run,
            status: live.status,
            turns: live.turns,
            tokensIn: live.tokensIn,
            tokensOut: live.tokensOut,
            costUsd: live.costUsd,
            finishedAt: live.finishedAt,
            outcomes: live.outcomes,
            services: live.services,
          }
        : run,
    loading,
    error,
    refetch,
  };
}
