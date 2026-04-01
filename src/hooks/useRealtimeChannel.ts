import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChannelSubscription {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
  filter?: string;
  callback: (payload: any) => void;
}

const BACKOFF_DELAYS = [2000, 4000, 8000, 16000, 30000];
const INITIAL_FETCH_TIMEOUT = 3000;
const DEBOUNCE_MS = 150; // Debounce rapid realtime events

/**
 * Shared realtime channel hook with:
 * - Immediate data fetch on mount (not gated behind WebSocket)
 * - Auto-reconnect on CHANNEL_ERROR / TIMED_OUT with exponential backoff
 * - Missed-update replay via onReconnect callback
 * - 150ms debounce on realtime-triggered refetches
 * - Connection state (connected, reconnecting)
 */
export function useRealtimeChannel(
  channelName: string,
  subscriptions: ChannelSubscription[],
  onReconnect: () => void,
): { connected: boolean; reconnecting: boolean } {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const backoffIndexRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const initialFetchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);
  const hasFetchedRef = useRef(false);
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  // Debounced version of onReconnect for realtime events
  const debouncedReconnect = useCallback(() => {
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (mountedRef.current) onReconnectRef.current();
    }, DEBOUNCE_MS);
  }, []);

  const removeChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const subscribe = useCallback(() => {
    if (!mountedRef.current) return;
    removeChannel();

    let ch = supabase.channel(channelName);

    for (const sub of subscriptions) {
      const originalCallback = sub.callback;
      ch = ch.on(
        'postgres_changes' as any,
        {
          event: sub.event,
          schema: sub.schema,
          table: sub.table,
          ...(sub.filter ? { filter: sub.filter } : {}),
        },
        (payload: any) => {
          // Call the original callback immediately for optimistic inline updates
          originalCallback(payload);
          // Debounce the full refetch
          debouncedReconnect();
        },
      );
    }

    ch.subscribe((status: string) => {
      if (!mountedRef.current) return;

      if (status === 'SUBSCRIBED') {
        setConnected(true);
        setReconnecting(false);
        backoffIndexRef.current = 0;
        onReconnectRef.current();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnected(false);
        setReconnecting(true);
        const delay = BACKOFF_DELAYS[Math.min(backoffIndexRef.current, BACKOFF_DELAYS.length - 1)];
        backoffIndexRef.current += 1;
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          if (mountedRef.current) subscribe();
        }, delay);
      } else if (status === 'CLOSED') {
        setConnected(false);
      }
    });

    channelRef.current = ch;
  }, [channelName, debouncedReconnect]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    hasFetchedRef.current = false;

    // Immediately fetch data on mount
    onReconnectRef.current();
    hasFetchedRef.current = true;

    // Start realtime subscription in parallel
    subscribe();

    // Safety net
    initialFetchTimerRef.current = setTimeout(() => {
      if (mountedRef.current && !connected) {
        onReconnectRef.current();
      }
    }, INITIAL_FETCH_TIMEOUT);

    return () => {
      mountedRef.current = false;
      clearTimeout(retryTimerRef.current);
      clearTimeout(initialFetchTimerRef.current);
      clearTimeout(debounceTimerRef.current);
      removeChannel();
    };
  }, [subscribe, removeChannel]);

  return { connected, reconnecting };
}
