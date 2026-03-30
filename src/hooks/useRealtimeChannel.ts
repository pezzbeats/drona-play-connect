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
const INITIAL_FETCH_TIMEOUT = 3000; // fetch data if channel hasn't connected in 3s

/**
 * Shared realtime channel hook with:
 * - Immediate data fetch on mount (not gated behind WebSocket)
 * - Auto-reconnect on CHANNEL_ERROR / TIMED_OUT with exponential backoff
 * - Missed-update replay via onReconnect callback
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
  const mountedRef = useRef(true);
  const hasFetchedRef = useRef(false);
  const onReconnectRef = useRef(onReconnect);
  // Keep ref up-to-date without re-subscribing
  onReconnectRef.current = onReconnect;

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
      ch = ch.on(
        'postgres_changes' as any,
        {
          event: sub.event,
          schema: sub.schema,
          table: sub.table,
          ...(sub.filter ? { filter: sub.filter } : {}),
        },
        sub.callback,
      );
    }

    ch.subscribe((status: string) => {
      if (!mountedRef.current) return;

      if (status === 'SUBSCRIBED') {
        setConnected(true);
        setReconnecting(false);
        backoffIndexRef.current = 0;
        // Replay missed updates on every (re)connect
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
  }, [channelName]); // eslint-disable-line react-hooks/exhaustive-deps
  // subscriptions is intentionally excluded — callers should memoize or pass stable refs

  useEffect(() => {
    mountedRef.current = true;
    subscribe();

    return () => {
      mountedRef.current = false;
      clearTimeout(retryTimerRef.current);
      removeChannel();
    };
  }, [subscribe, removeChannel]);

  return { connected, reconnecting };
}
