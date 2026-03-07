
## Full Analysis

### Current State (What Works)
- `PredictionPanel` uses `useRealtimeChannel` with auto-reconnect ✅
- `Scoreboard` uses `useRealtimeChannel` ✅
- `Leaderboard` uses `useRealtimeChannel` ✅
- `Live.tsx` subscribes to `matches` table changes ✅
- `submit-prediction` edge function blocks overwrites (409 on duplicate) ✅
- `predictions_frozen` flag enforced both on client and server ✅
- One-tap immediate submission ✅
- `AdminControl` uses `useRealtimeChannel` for live state ✅

### What's Missing / Broken for Fairness

**1. No "window lock before ball" workflow — the timing gap**
The admin workflow is:
1. Open prediction window → players guess
2. Record delivery (ball happens)

The problem: the admin must **manually** click "Lock Window" between opening and recording. There's nothing stopping an admin from recording the delivery WHILE the window is still open, meaning a dishonest actor could see the ball result and still submit. The fix: `record-delivery` edge function should **auto-lock any open prediction windows** for that match before recording the ball. This is a server-side enforcement — no client can bypass it.

**2. Prediction window status change not reflected on `/play` customers in realtime**
When a window moves from `open` → `locked`, customers currently see:
- The `prediction_windows` subscription calls `fetchWindows()`, which re-fetches the full list
- `closedWindows` are shown as "Locked" cards — this is fine
- BUT: the window status transition on the customer-facing UI needs to immediately disable all tapping the moment it goes to `locked` — currently there's a small gap between the realtime event arriving and `fetchWindows()` completing its async fetch. The fix: in the `prediction_windows` realtime callback, directly update the window's status in local state without waiting for a full refetch.

**3. `/play` page (the login/PIN entry page) is completely static**
The `/play` route (`src/pages/Play.tsx`) is a static HTML page that never receives any realtime updates. If the active match changes while a user is on this page, they won't know. The fix: add a realtime subscription on `/play` so the match status is kept fresh.

**4. `PredictionPanel` `submittedWindows` state is only loaded once at mount (and on reconnect)**
If a user refreshes the page in a different browser tab and submits a prediction, their original tab doesn't know they already submitted. This is covered by the `fetchWindows` in `onReconnect`, but there's no periodic sync. The real risk: if two tabs are open for the same session and one submits, the other still shows open buttons. This is cosmetic-only since the backend blocks the duplicate at the server. But UX-wise the second tab would show a spinner then get an "already submitted" toast and update. This is acceptable.

**5. Admin `Prediction` tab doesn't show realtime count of submissions for the active window**
When an admin opens a window, they have no idea how many guesses have been submitted. They need to know when to lock it. The fix: show live submission count in the admin prediction control panel.

### Plan

#### Change 1: `supabase/functions/record-delivery/index.ts` — Auto-lock open prediction windows before recording
**This is the most critical fairness fix.**

Before inserting the delivery, add:
```typescript
// Auto-lock any open prediction windows for this match before the ball is delivered
const { data: openWindows } = await supabase
  .from("prediction_windows")
  .select("id")
  .eq("match_id", match_id)
  .eq("status", "open");

if (openWindows && openWindows.length > 0) {
  await supabase
    .from("prediction_windows")
    .update({ status: "locked" })
    .in("id", openWindows.map(w => w.id));
}
```

This means: the moment admin clicks "Record Ball", all open windows are server-side locked FIRST before the delivery is inserted. No race condition possible. Users who tap after this point get `WINDOW_CLOSED` (400) from the edge function.

#### Change 2: `src/components/live/PredictionPanel.tsx` — Optimistic instant lock on realtime event
In the `prediction_windows` subscription callback, instead of only calling `fetchWindows()`, also immediately update the local `windows` state in place:

```typescript
callback: (payload) => {
  if (payload.new) {
    // Instantly update the window status in local state (no wait for refetch)
    setWindows(prev => prev.map(w => 
      w.id === payload.new.id ? { ...w, ...payload.new } : w
    ));
  }
  // Also do a full refetch for correctness
  fetchWindows();
},
```

This removes the visual lag between "window locked" server event and the customer's UI freezing.

#### Change 3: `src/pages/admin/AdminControl.tsx` — Show live prediction count in Prediction tab
In the Prediction tab, when there's an active open window, show a live count of how many users have submitted. Subscribe to the `predictions` table count for the active window and display it:

Add a `predCount` state, fetch it whenever `activeWindow` changes, and subscribe to prediction inserts to increment it in real-time. Display as:
```
47 guesses received — Lock now to record the ball
```

This tells the admin exactly when to lock.

#### Change 4: `src/pages/Play.tsx` — Add basic realtime match status awareness
Read the current file first to understand what's there, then add a realtime subscription to `matches` so if the active match changes, the login page refreshes its state (e.g., shows "Match is now live!" or clears stale match info from localStorage).

### Files to Change
| File | Change |
|------|--------|
| `supabase/functions/record-delivery/index.ts` | Auto-lock open prediction windows BEFORE recording delivery |
| `src/components/live/PredictionPanel.tsx` | Optimistic instant UI lock on realtime window status change |
| `src/pages/admin/AdminControl.tsx` | Live prediction count in Prediction tab + visual "lock before deliver" prompt |
| `src/pages/Play.tsx` | Realtime match status subscription |

No database schema changes required.
