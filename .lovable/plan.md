
## Audit Findings

### Critical Issues Found

**1. `GlassCard` missing `React.forwardRef` — console error on every render**
The console logs show: `"Function components cannot be given refs"` pointing to `GlassCard` being used with a ref somewhere in `PredictionPanel`. The `GlassCard` component is a plain div wrapper that doesn't forward refs. It appears something in PredictionPanel (or its parent) is passing a ref to it. The fix: wrap `GlassCard` with `React.forwardRef`.

**2. `Scoreboard.tsx` uses its own raw channel (not `useRealtimeChannel`) — no auto-reconnect**
The Scoreboard component has its own `subscribeRealtime()` using a raw `supabase.channel(...)` that sets `connected` to `false` on disconnect but never tries to reconnect. If the connection drops at any point during the match, the scoreboard silently goes offline and stays offline. The fix: migrate Scoreboard to use `useRealtimeChannel` with the shared reconnect hook.

**3. `PredictionPanel.tsx` also uses its own raw channel — no reconnect**
Same issue as Scoreboard. Uses `subscribeRealtime()` without `useRealtimeChannel`. If the realtime connection drops, no reconnect happens and new prediction windows are missed. The fix: migrate PredictionPanel to use `useRealtimeChannel`.

**4. `match_flags.predictions_frozen` is NOT enforced on the customer `/live` page**
The admin panel sets `predictions_frozen` in `match_flags` as an emergency freeze. But `PredictionPanel` on the `/live` page never fetches or subscribes to `match_flags`. It never checks `predictions_frozen`. Customers can still submit guesses even when the admin has frozen them. The fix: subscribe to `match_flags` in `PredictionPanel` (or in `Live.tsx`) and disable submission/display when frozen.

**5. `Live.tsx` — `predictionsEnabled` is fetched only once at session init, never updated via realtime**
If an admin toggles `predictions_enabled` on a match after users have already loaded the page, the tab doesn't appear/disappear dynamically. The fix: subscribe to `matches` table changes in `Live.tsx` to reactively update `predictionsEnabled`.

**6. `Scoreboard` reconnect indicator shows "Connecting" as a static string but no reconnect attempt**
The "Connecting" wifi icon at the top of the scoreboard component has no logic to re-attempt — it sets `connected = false` on CLOSED/ERROR but never calls subscribe again. Users during a long game will see "Connecting" forever after any dropout.

### Files to Change
- `src/components/ui/GlassCard.tsx` — add `React.forwardRef`
- `src/components/live/Scoreboard.tsx` — migrate to `useRealtimeChannel`, add reconnect, add "Reconnecting" visual state
- `src/components/live/PredictionPanel.tsx` — migrate to `useRealtimeChannel`, subscribe to `match_flags`, enforce `predictions_frozen` flag
- `src/pages/Live.tsx` — subscribe to `matches` table changes to reactively update `predictionsEnabled` flag without page reload

---

## Plan

### 1. Fix `GlassCard` ref forwarding (`GlassCard.tsx`)
Change the export from a plain arrow function component to `React.forwardRef<HTMLDivElement, GlassCardProps>`. Pass the ref through to the inner `<div>`. This fixes the console warning that fires on every page render.

```text
Before: export const GlassCard = ({ ...props }) => <div ...>
After:  export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(({ ... }, ref) => <div ref={ref} ...>)
```

### 2. Migrate `Scoreboard.tsx` to `useRealtimeChannel`
- Remove the manual `subscribeRealtime()` function and `channelRef`.
- Convert `fetchInitialData` to a `useCallback` named `fetchData` (used as the `onReconnect` callback too).
- Build a `subscriptions` array with `useMemo` for `match_live_state` and `super_over_rounds`.
- Wire `useRealtimeChannel('scoreboard-${matchId}', subscriptions, fetchData)` to get `{ connected, reconnecting }`.
- Update the connection indicator to show "Reconnecting..." with a spinner when `reconnecting === true`.

### 3. Migrate `PredictionPanel.tsx` to `useRealtimeChannel` + enforce `predictions_frozen`
- Remove `subscribeRealtime()` and raw channel logic.
- Convert `fetchWindows` to a stable `useCallback`.
- Add `matchFlags` state; fetch `match_flags` on init alongside windows.
- Extend `subscriptions` useMemo to include both `prediction_windows` and `match_flags`.
- When `matchFlags?.predictions_frozen` is true:
  - Show a warning banner: "⚠️ Guesses are temporarily paused by admin"
  - Disable all submit buttons and option selects

### 4. Update `Live.tsx` — Realtime for `predictions_enabled` + match status
- Add a `useEffect` that subscribes to the `matches` table for the active `matchId`.
- On any UPDATE to the match row, re-fetch and update `predictionsEnabled` state.
- This ensures the "Guess" tab appears/disappears without a page reload when an admin toggles it.

---

## Files Changed
| File | Change |
|------|--------|
| `src/components/ui/GlassCard.tsx` | Add `React.forwardRef` |
| `src/components/live/Scoreboard.tsx` | Migrate to `useRealtimeChannel`, reconnecting state |
| `src/components/live/PredictionPanel.tsx` | Migrate to `useRealtimeChannel`, add `match_flags` subscription, enforce `predictions_frozen` |
| `src/pages/Live.tsx` | Add `matches` realtime subscription for reactive `predictionsEnabled` |

No new dependencies. No database changes. No edge function changes.
