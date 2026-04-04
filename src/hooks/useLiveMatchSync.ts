import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LiveMatchSyncState {
  syncing: boolean;
  lastSyncAt: number | null;
  lastSyncError: string | null;
  degraded: boolean;
  degradedReason: string | null;
  recommendedInterval: number;
  isStale: boolean;
}

const DEFAULT_LIVE_INTERVAL = 15;
const DEFAULT_PRE_INTERVAL = 60;
const STALE_THRESHOLD_MS = 45_000; // consider stale after 45s without successful sync

/**
 * Page-level hook that keeps `cricket-api-sync` polling alive
 * regardless of which tab is active (Score, Guess, Leaderboard).
 *
 * Mount this once in Live.tsx — it never unmounts while the page is open.
 */
export function useLiveMatchSync(matchPhase: string | null | undefined): SyncState {
export function useLiveMatchSync(matchId: string | null | undefined, matchPhase: string | null | undefined): LiveMatchSyncState {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [degradedReason, setDegradedReason] = useState<string | null>(null);
  const [recommendedInterval, setRecommendedInterval] = useState(DEFAULT_LIVE_INTERVAL);
  const [now, setNow] = useState(() => Date.now());

  const mountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const intervalRef = useRef(DEFAULT_LIVE_INTERVAL);

  const isActive = matchPhase === 'pre' || matchPhase === 'innings1' || matchPhase === 'innings2' || matchPhase === 'break' || matchPhase === 'super_over';

  const poll = useCallback(async () => {
    if (!mountedRef.current) return;
    clearTimeout(timeoutRef.current);
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('cricket-api-sync', {
        body: null,
        headers: {},
      });

      const syncPayload = data?.sync ?? data;
      const matchResult = Array.isArray(syncPayload?.results) && matchId
        ? syncPayload.results.find((result: any) => result?.match_id === matchId) ?? null
        : null;

      if (mountedRef.current) {
        if (error || matchResult?.status === 'error') {
          setLastSyncError(error?.message || matchResult?.reason || 'Sync failed');
          setDegraded(false);
          setDegradedReason(null);
        } else {
          setLastSyncError(null);
          setLastSyncAt(Date.now());
          const nextInterval = syncPayload?.recommended_interval;
          if (typeof nextInterval === 'number') {
            intervalRef.current = nextInterval;
            setRecommendedInterval(nextInterval);
          }

          setDegraded(Boolean(matchResult?.degraded));
          setDegradedReason(matchResult?.degraded ? (matchResult?.reason || 'Live feed delayed') : null);
        }
      }
    } catch (e: any) {
      if (mountedRef.current) {
        setLastSyncError(e?.message || 'Sync failed');
        setDegraded(false);
        setDegradedReason(null);
      }
    } finally {
      if (mountedRef.current) {
        setSyncing(false);
        // Schedule next poll
        if (isActive) {
          timeoutRef.current = setTimeout(poll, intervalRef.current * 1000);
        }
      }
    }
  }, [isActive, matchId]);

  useEffect(() => {
    if (!isActive && lastSyncAt === null) return;

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, lastSyncAt]);

  useEffect(() => {
    mountedRef.current = true;

    if (!isActive) {
      // If match is ended, do one final sync then stop
      if (matchPhase === 'ended') {
        supabase.functions.invoke('cricket-api-sync', { body: null, headers: {} }).catch(() => {});
      }
      return;
    }

    // Set base interval based on phase
    intervalRef.current = matchPhase === 'pre' ? DEFAULT_PRE_INTERVAL : DEFAULT_LIVE_INTERVAL;

    // Immediate first poll
    poll();

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutRef.current);
    };
  }, [isActive, matchPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  const isStale = lastSyncAt !== null
    ? (now - lastSyncAt) > STALE_THRESHOLD_MS
    : false;

  return {
    syncing,
    lastSyncAt,
    lastSyncError,
    degraded,
    degradedReason,
    recommendedInterval,
    isStale,
  };
}
