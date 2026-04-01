import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [] }),
            }),
          }),
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
      }),
    }),
    channel: () => ({
      on: function() { return this; },
      subscribe: () => {},
    }),
    removeChannel: () => {},
    functions: {
      invoke: () => Promise.resolve({ data: {} }),
    },
  },
}));

// Must import after mock
import { PredictionPanel } from '../PredictionPanel';

describe('PredictionPanel', () => {
  it('renders skeleton loader on initial load', () => {
    const { container } = render(<PredictionPanel matchId="test-123" mobile="9999999999" pin="1234" />);
    expect(container.querySelector('.disclaimer-bar')).toBeTruthy();
  });

  it('shows disclaimer about no betting', () => {
    const { getByText } = render(<PredictionPanel matchId="test-123" mobile="9999999999" pin="1234" />);
    expect(getByText(/not betting, gambling, or wagering/i)).toBeTruthy();
  });
});
