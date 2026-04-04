import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { useLiveMatchSync } from '@/hooks/useLiveMatchSync';

function Harness() {
  const [tab, setTab] = useState<'score' | 'predict'>('score');
  const sync = useLiveMatchSync('match-1', 'innings1');

  return (
    <div>
      <button onClick={() => setTab((current) => current === 'score' ? 'predict' : 'score')}>
        toggle-tab
      </button>
      <span>{tab}</span>
      <span>{sync.degraded ? 'degraded' : 'healthy'}</span>
      <span>{sync.recommendedInterval}</span>
    </div>
  );
}

describe('useLiveMatchSync tab persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({
      data: {
        sync: {
          recommended_interval: 15,
          results: [
            {
              match_id: 'match-1',
              status: 'synced',
              degraded: true,
              degraded_message: 'Score changed without new deliveries. Retrying automatically.',
            },
          ],
        },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps polling after tab switches and exposes degraded state', async () => {
    render(<Harness />);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByText('toggle-tab'));
    expect(screen.getByText('predict')).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText('degraded')).toBeTruthy();
  });
});