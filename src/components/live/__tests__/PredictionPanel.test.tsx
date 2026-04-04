import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

const mockState = vi.hoisted(() => ({
  windows: [] as any[],
  flags: { predictions_frozen: false, freeze_reason: null as string | null },
  predictions: [] as any[],
  leaderboard: null as any,
  invoke: vi.fn(async () => ({ data: {} })),
}));

const createQuery = (table: string) => {
  const responseForTable = () => {
    switch (table) {
      case 'prediction_windows':
        return { data: mockState.windows };
      case 'match_flags':
        return { data: mockState.flags };
      case 'predictions':
        return { data: mockState.predictions };
      case 'leaderboard':
        return { data: mockState.leaderboard };
      default:
        return { data: [] };
    }
  };

  const query: any = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: () => Promise.resolve(responseForTable()),
    single: () => Promise.resolve(responseForTable()),
    then: (resolve: (value: any) => any, reject?: (reason: unknown) => any) =>
      Promise.resolve(responseForTable()).then(resolve, reject),
  };

  return query;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => createQuery(table),
    channel: () => ({
      on: function() { return this; },
      subscribe: () => {},
    }),
    removeChannel: () => {},
    functions: {
      invoke: mockState.invoke,
    },
  },
}));

vi.mock('@/hooks/useRealtimeChannel', () => ({
  useRealtimeChannel: () => ({ connected: true, reconnecting: false }),
}));

// Must import after mock
import { PredictionPanel } from '../PredictionPanel';

describe('PredictionPanel', () => {
  beforeEach(() => {
    mockState.windows = [];
    mockState.flags = { predictions_frozen: false, freeze_reason: null };
    mockState.predictions = [];
    mockState.leaderboard = null;
    mockState.invoke.mockClear();
  });

  it('renders skeleton loader on initial load', () => {
    const { container } = render(<PredictionPanel matchId="test-123" mobile="9999999999" pin="1234" />);
    expect(container.querySelector('.disclaimer-bar')).toBeTruthy();
  });

  it('shows disclaimer about no betting', () => {
    const { getByText } = render(<PredictionPanel matchId="test-123" mobile="9999999999" pin="1234" />);
    expect(getByText(/not betting, gambling, or wagering/i)).toBeTruthy();
  });

  it('shows delayed feed messaging when sync is stale and no window is open', async () => {
    const { getByText } = render(
      <PredictionPanel
        matchId="test-123"
        mobile="9999999999"
        pin="1234"
        syncHealth={{
          syncing: false,
          lastSyncAt: Date.now() - 60_000,
          lastSyncError: null,
          degraded: true,
          degradedReason: 'Score changed without new deliveries. Retrying automatically.',
          isStale: true,
        }}
      />,
    );

    // Use a small timeout to let async effects settle
    await new Promise(r => setTimeout(r, 50));
    expect(getByText(/live feed delayed — retrying/i)).toBeTruthy();
    expect(getByText(/retrying automatically/i)).toBeTruthy();
  });

  it('shows normal waiting state when sync is healthy', async () => {
    const { getByText, queryByText } = render(
      <PredictionPanel
        matchId="test-123"
        mobile="9999999999"
        pin="1234"
        syncHealth={{
          syncing: false,
          lastSyncAt: Date.now(),
          lastSyncError: null,
          degraded: false,
          degradedReason: null,
          isStale: false,
        }}
      />,
    );

    await new Promise(r => setTimeout(r, 50));
    expect(getByText(/waiting for next ball/i)).toBeTruthy();
    expect(queryByText(/live feed delayed — retrying/i)).toBeNull();
  });
});
