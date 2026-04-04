import React, { useState } from 'react';
import { act, render } from '@testing-library/react';
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
      <span data-testid="tab">{tab}</span>
      <span data-testid="health">{sync.degraded ? 'degraded' : 'healthy'}</span>
      <span data-testid="interval">{sync.recommendedInterval}</span>
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
    const { getByTestId, getByText } = render(<Harness />);

    // Wait for first poll
    await act(async () => {
      await Promise.resolve();
    });
    expect(invokeMock).toHaveBeenCalledTimes(1);

    // Switch tab
    act(() => {
      getByText('toggle-tab').click();
    });
    expect(getByTestId('tab').textContent).toBe('predict');

    // Advance timer to trigger second poll
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(getByTestId('health').textContent).toBe('degraded');
  });
});
