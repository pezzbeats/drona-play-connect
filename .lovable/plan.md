
## Analysis

### Current realtime gaps

**Scoreboard (`Scoreboard.tsx`):**
- Single channel subscription with no reconnect logic
- `setConnected(status === 'SUBSCRIBED')` — only the subscription status, no handling for `CHANNEL_ERROR` or `TIMED_OUT`
- No reconnect on socket drop — if the Supabase realtime socket disconnects, `connected` stays `false` and no re-subscribe happens
- No missed-update replay — if a delivery comes in while disconnected, the score is stale until refresh

**PredictionPanel (`PredictionPanel.tsx`):**
- On any prediction_window change → calls `fetchWindows()` (full DB fetch). Race condition: if two rapid window events arrive, two concurrent fetches run, second may overwrite first
- No reconnect handling on the channel `subscribe` callback
- `action === "open"` in `resolve-prediction-window/index.ts` has a bug: calls `await req.json()` twice — the second call will return `{}` because the body stream is already consumed

**Leaderboard (`Leaderboard.tsx`):**
- Same pattern: any change → `fetchLeaderboard()`. No debounce, no reconnect

**AdminControl (`AdminControl.tsx`):**
- Shows `<Wifi className="text-success" />` hardcoded — no actual connection state tracking
- `over_control` changes trigger full `fetchAll()` — heavyweight for frequent events
- No idempotency guard on "Open Prediction Window" — if admin clicks twice rapidly, two windows open

**Race conditions on backend:**
- `over-control/create_over`: no check for existing active over — two concurrent "New Over" calls can create two active overs simultaneously
- `resolve-prediction-window/open`: no check for existing open window — admin can open a second window while one is already open

**Panic controls:** None exist anywhere.

---

## Plan

### Part 1 — DB migration: `match_flags` table (panic controls)
A single-row table per match with boolean flags for emergency overrides:

```sql
CREATE TABLE public.match_flags (
  match_id uuid PRIMARY KEY,
  predictions_frozen boolean NOT NULL DEFAULT false,
  scanning_frozen boolean NOT NULL DEFAULT false,
  windows_locked boolean NOT NULL DEFAULT false,
  frozen_by_admin_id uuid,
  frozen_at timestamptz,
  freeze_reason text
);
```

RLS: readable by all (public clients need to check flags), writable by authenticated only.

Also add a unique constraint fix to `over_control`: add a **partial unique index** to prevent two active overs in the same innings:
```sql
CREATE UNIQUE INDEX over_control_one_active_per_innings 
ON public.over_control (match_id, innings_no) 
WHERE status = 'active';
```

And on `prediction_windows`: partial unique index to prevent two open windows per match:
```sql
CREATE UNIQUE INDEX prediction_windows_one_open_per_match
ON public.prediction_windows (match_id) 
WHERE status = 'open';
```

### Part 2 — Shared realtime hook: `useRealtimeChannel`

Create `src/hooks/useRealtimeChannel.ts` — a reusable hook that wraps Supabase realtime with:

- **Auto-reconnect**: on `CHANNEL_ERROR` or `TIMED_OUT` status, wait exponential backoff (2s, 4s, 8s max 30s) then re-subscribe
- **Missed-update replay**: on reconnect, call a provided `onReconnect()` callback to re-fetch fresh data
- **Connection state**: returns `{ connected: boolean, reconnecting: boolean }`
- Cleans up on unmount

```typescript
export function useRealtimeChannel(
  channelName: string,
  subscriptions: ChannelSubscription[],
  onReconnect: () => void
): { connected: boolean; reconnecting: boolean }
```

### Part 3 — Upgrade `Scoreboard.tsx` with new hook

Replace the manual `subscribeRealtime` / `channelRef` pattern:
- Use `useRealtimeChannel` — on reconnect calls `fetchInitialData()` to replay missed updates
- Show `reconnecting` state in the WiFi indicator with a yellow/amber spinner

### Part 4 — Upgrade `PredictionPanel.tsx`

- Use `useRealtimeChannel` — on reconnect calls `fetchWindows()`
- Deduplicate rapid fetches: add a `fetchingRef = useRef(false)` guard — if a fetch is already in-flight, skip the duplicate trigger
- Fix the double `req.json()` bug in `resolve-prediction-window/index.ts` `open` action — parse the full body once at the top of the handler

### Part 5 — Upgrade `Leaderboard.tsx`

- Use `useRealtimeChannel` — on reconnect calls `fetchLeaderboard()`
- Add fetch debounce (200ms) to avoid N parallel fetches on burst leaderboard updates after a window resolve

### Part 6 — Fix race conditions in edge functions

**`over-control/index.ts`** — `create_over` action: check for existing active over before inserting:
```typescript
const { data: existingActive } = await supabase
  .from("over_control")
  .select("id")
  .eq("match_id", match_id)
  .eq("innings_no", innings_no || 1)
  .eq("status", "active")
  .single();

if (existingActive) {
  return new Response(JSON.stringify({ error: "An over is already active. Complete it first." }), { status: 409 });
}
```

**`resolve-prediction-window/index.ts`** — `open` action: fix double `req.json()` bug (body already parsed once at top), add check for existing open window:
```typescript
const { data: existingOpen } = await supabase
  .from("prediction_windows")
  .select("id")
  .eq("match_id", match_id)
  .eq("status", "open")
  .single();

if (existingOpen) {
  return new Response(JSON.stringify({ error: "A prediction window is already open." }), { status: 409 });
}
```

**`submit-prediction/index.ts`** — check `match_flags.predictions_frozen` before accepting submission:
```typescript
const { data: flags } = await supabase.from("match_flags").select("predictions_frozen").eq("match_id", access.match_id).single();
if (flags?.predictions_frozen) {
  return new Response(JSON.stringify({ error: "Predictions are currently paused." }), { status: 423 });
}
```

**`admin-checkin/index.ts`** — check `match_flags.scanning_frozen`:
```typescript
const { data: flags } = await supabase.from("match_flags").select("scanning_frozen").eq("match_id", ticket.match_id).single();
if (flags?.scanning_frozen) {
  return new Response(JSON.stringify({ error: "Gate scanning is currently frozen by admin." }), { status: 423 });
}
```

### Part 7 — Admin panic controls in `AdminControl.tsx`

Add a new **"Panic Controls"** card below the phase controls. Uses a `match_flags` row for the active match:

- **Freeze Predictions** toggle — sets `predictions_frozen = true/false` with a reason prompt
- **Freeze Scanning** toggle — sets `scanning_frozen = true/false`
- **Lock All Windows** button — updates all `open` and `locked` windows to `resolved` status instantly
- Show current flag state (frozen/active) with colored badges
- Each action logs to `admin_activity`

Realtime subscribe to `match_flags` row so the panel updates live when another admin changes flags.

Fix the hardcoded `<Wifi className="text-success" />` — replace with actual connection state from `useRealtimeChannel`.

### Part 8 — `AdminValidate.tsx` freeze check

Add a real-time check: subscribe to `match_flags` for the active match. If `scanning_frozen = true`, show a full-width red banner "⛔ Scanning frozen by admin" and disable the check-in button. This is client-side safety in addition to the backend gate in `admin-checkin`.

---

## Files changed

| File | Change |
|---|---|
| `supabase/migrations/[new].sql` | `match_flags` table + RLS + partial unique indexes on `over_control` and `prediction_windows` |
| `src/hooks/useRealtimeChannel.ts` | New shared hook: auto-reconnect + missed-update replay |
| `src/components/live/Scoreboard.tsx` | Use `useRealtimeChannel`, show reconnecting state |
| `src/components/live/PredictionPanel.tsx` | Use `useRealtimeChannel`, fetch dedup guard |
| `src/components/live/Leaderboard.tsx` | Use `useRealtimeChannel`, fetch debounce |
| `supabase/functions/over-control/index.ts` | Add active-over guard (409 on duplicate) |
| `supabase/functions/resolve-prediction-window/index.ts` | Fix double req.json() bug, add open-window guard, check `windows_locked` flag |
| `supabase/functions/submit-prediction/index.ts` | Check `predictions_frozen` flag |
| `supabase/functions/admin-checkin/index.ts` | Check `scanning_frozen` flag |
| `src/pages/admin/AdminControl.tsx` | Panic controls card, real connection state indicator, `match_flags` realtime |
| `src/pages/admin/AdminValidate.tsx` | Subscribe to `match_flags`, show freeze banner, disable check-in when frozen |

---

## What this achieves

| Requirement | Implementation |
|---|---|
| No refresh ever | `useRealtimeChannel` auto-reconnects + replays missed data on reconnect |
| Missed updates replay | `onReconnect()` callback re-fetches fresh data from DB |
| Socket reconnection | Exponential backoff re-subscribe on CHANNEL_ERROR/TIMED_OUT |
| No duplicate window opens | Partial unique index + 409 check in edge function |
| No double scoring | Already handled by `upsert` in `submit-prediction`; added open-window guard |
| No overlapping overs | Partial unique index + 409 check in `over-control` |
| Freeze predictions | `match_flags.predictions_frozen` checked in `submit-prediction` |
| Freeze scanning | `match_flags.scanning_frozen` checked in `admin-checkin` + shown in `AdminValidate` |
| Lock all windows instantly | Admin button → sets all open/locked windows to resolved |
| Panic controls | New card in `AdminControl` with live flag state badges |
