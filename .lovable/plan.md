

## Problem

The Live page is stuck on "Loading scoreboard..." and "Reconnecting to live updates..." because **all data fetching depends entirely on a successful Realtime subscription**. If the WebSocket channel fails to connect (CHANNEL_ERROR, TIMED_OUT, or just slow), no data ever loads — the page stays blank forever.

There are two distinct bugs:

1. **Scoreboard and PredictionPanel never fetch data on mount** — they only fetch inside the `onReconnect` callback, which only fires when a Realtime channel reaches `SUBSCRIBED` status. If it never connects, the loading spinner shows forever.

2. **Too many simultaneous Realtime channels** — the Live page opens **5 separate channels** (`live-match-*`, `scoreboard-*`, `predictions-panel-*`, `score-panel-*`, `leaderboard-*`). Each is an independent WebSocket subscription. On mobile networks or under load, this overwhelms the connection and causes cascading failures.

## Plan

### 1. Add independent initial data fetches (Scoreboard + PredictionPanel)

Both components currently rely on `onReconnect` for their first data load. Fix by adding a `useEffect` that calls the fetch function on mount, independent of Realtime status — exactly as Leaderboard already does correctly.

**Scoreboard.tsx**: Add `useEffect(() => { fetchData(); }, [fetchData]);` so data loads immediately on mount regardless of channel status.

**PredictionPanel.tsx**: Add `useEffect(() => { fetchWindows(); }, [fetchWindows]);` for the same reason.

### 2. Consolidate Realtime channels

Merge the 5 channels into 2 maximum:
- **One channel in LiveContent** — subscribes to `matches`, `prediction_windows`, and `leaderboard` (personal rank updates). This replaces the current `live-match-*` channel.
- **One channel in Scoreboard** — subscribes to `match_live_state` and `super_over_rounds`. This stays as-is since it's component-scoped.
- **Remove the dedicated channels** from PredictionPanel (merge `predictions-panel-*` and `score-panel-*` into the LiveContent channel or make PredictionPanel use the parent's channel data).

Specifically:
- PredictionPanel's `score-panel` channel (leaderboard personal score) duplicates what LiveContent already subscribes to. Remove it and pass the score data as props or keep just one subscription.
- PredictionPanel's `predictions-panel` channel watches `prediction_windows` and `match_flags` — this can stay as a single channel but should be consolidated with the LiveContent channel if possible.

### 3. Make useRealtimeChannel more resilient

Update the hook so it calls `onReconnect` (the data fetch) immediately on first mount, not just on `SUBSCRIBED`. This ensures data loads even if Realtime takes time to connect.

Add to the hook: on the first `subscribe()` call, immediately invoke `onReconnectRef.current()` so the initial data fetch isn't gated behind the WebSocket handshake.

### 4. Add a hard timeout fallback

If Realtime doesn't connect within 5 seconds on initial load, fetch data anyway via a timeout in the hook. This handles edge cases where the channel is perpetually stuck.

## Technical Details

**File changes:**

| File | Change |
|------|--------|
| `src/hooks/useRealtimeChannel.ts` | Call `onReconnectRef.current()` immediately on first subscribe (before waiting for SUBSCRIBED). Add `isFirstMount` ref to track this. |
| `src/components/live/Scoreboard.tsx` | Add `useEffect(() => { fetchData(); }, [fetchData]);` — one line |
| `src/components/live/PredictionPanel.tsx` | Add `useEffect(() => { fetchWindows(); }, [fetchWindows]);`. Remove the separate `score-panel` channel — use the existing leaderboard subscription in the parent or merge into the main `predictions-panel` channel |
| `src/pages/Live.tsx` | No changes needed — the parent channel