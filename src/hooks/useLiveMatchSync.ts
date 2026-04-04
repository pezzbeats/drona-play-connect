import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LiveMatchSyncState {
  syncing: boolean;
  lastSyncAt: number | null;
  lastAttemptAt: number | null;
  lastSyncError: string | null;
  degraded: boolean;
  degradedReason: string | null;
  recommendedInterval: number;
  isStale: boolean;
}

const DEFAULT_INTERVAL = 15;
const STALE_THRESHOLD_MS = 45_000;

/**
 * Continuous polling hook for cricket-api-sync.
 * Starts immediately on mount when matchId is provided.
 * Does NOT depend on matchPhase to begin — treats missing/null phase as "keep polling".
 * Stops only on unmount or when phase is explicitly "ended".
 */
export function useLiveMatchSync(
  matchId: string | null | undefined,
  matchPhase: string | null | undefined,
): LiveMatchSyncState {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [lastAttemptAt, setLastAttemptAt] = useState<number | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [degradedReason, setDegradedReason] = useState<string | null>(null);
  const [recommendedInterval, setRecommendedInterval] = useState(DEFAULT_INTERVAL);
  const [now, setNow] = useState(() => Date.now());

  const mountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const intervalRef = useRef(DEFAULT_INTERVAL);
  const inFlightRef = useRef(false);

  // Only stop polling when phase is explicitly "ended"
  const isEnded = matchPhase === 'ended';

  const poll = useCallback(async () => {
    if (!mountedRef.current || inFlightRef.current) return;
    inFlightRef.current = true;
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
          if (typeof nextInterval === 'number' && nextInterval >= 5) {
            intervalRef.current = nextInterval;
            setRecommendedInterval(nextInterval);
          }

          setDegraded(Boolean(matchResult?.degraded));
          setDegradedReason(
            matchResult?.degraded
              ? (matchResult?.degraded_message || matchResult?.reason || 'Live feed delayed')
              : null,
          );
        }
      }
    } catch (e: any) {
      if (mountedRef.current) {
        setLastSyncError(e?.message || 'Sync failed');
        setDegraded(false);
        setDegradedReason(null);
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setSyncing(false);
        // Schedule next poll unless explicitly ended
        if (!isEnded) {
          timeoutRef.current = setTimeout(poll, intervalRef.current * 1000);
        }
      }
    }
  }, [matchId, isEnded]);

  // Tick now every second for stale calculation
  useEffect(() => {
    if (lastSyncAt === null && !matchId) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [matchId, lastSyncAt]);

  // Main effect: start polling immediately when matchId exists and not ended
  useEffect(() => {
    mountedRef.current = true;

    if (!matchId) return;

    if (isEnded) {
      // Final sync then stop
      supabase.functions.invoke('cricket-api-sync', { body: null, headers: {} }).catch(() => {});
      return;
    }

    // Adjust base interval based on phase hint (but don't block on it)
    if (matchPhase === 'pre') {
      intervalRef.current = 60;
    } else if (matchPhase === 'innings1' || matchPhase === 'innings2' || matchPhase === 'super_over') {
      intervalRef.current = DEFAULT_INTERVAL;
    }
    // If phase is null/undefined, keep default interval — don't skip polling

    // Immediate first poll
    poll();

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutRef.current);
    };
  }, [matchId, isEnded]); // eslint-disable-line react-hooks/exhaustive-deps

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
