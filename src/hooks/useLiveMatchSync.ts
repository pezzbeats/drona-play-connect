import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SyncState {
  syncing: boolean;
  lastSyncAt: number | null;
  lastSyncError: string | null;
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
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [recommendedInterval, setRecommendedInterval] = useState(DEFAULT_LIVE_INTERVAL);

  const mountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const intervalRef = useRef(DEFAULT_LIVE_INTERVAL);

  const isActive = matchPhase === 'pre' || matchPhase === 'innings1' || matchPhase === 'innings2' || matchPhase === 'break' || matchPhase === 'super_over';

  const poll = useCallback(async () => {
    if (!mountedRef.current) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('cricket-api-sync', {
        body: null,
        headers: {},
      });
      if (mountedRef.current) {
        if (error) {
          setLastSyncError(error.message || 'Sync failed');
        } else {
          setLastSyncError(null);
          setLastSyncAt(Date.now());
          if (data?.recommended_interval && typeof data.recommended_interval === 'number') {
            intervalRef.current = data.recommended_interval;
            setRecommendedInterval(data.recommended_interval);
          }
        }
      }
    } catch (e: any) {
      if (mountedRef.current) {
        setLastSyncError(e?.message || 'Sync failed');
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
  }, [isActive]);

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
    ? (Date.now() - lastSyncAt) > STALE_THRESHOLD_MS
    : false;

  return { syncing, lastSyncAt, lastSyncError, recommendedInterval, isStale };
}
