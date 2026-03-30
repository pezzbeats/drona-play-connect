

## Problem

When a new prediction window opens after resolving the previous ball, it stays open indefinitely until the next API sync (~30 seconds). A user watching the match on TV could see the ball outcome and still submit a prediction before the system detects the new delivery. There is no countdown or auto-lock timer.

## Solution

Add a **12-second auto-lock timer** to every prediction window. The window opens, users get 12 seconds to predict, then it auto-locks — well before the next ball is bowled (~25-40 seconds between deliveries in cricket).

### Changes

**1. Backend: Set `locks_at` when opening windows** (`supabase/functions/cricket-api-sync/index.ts`)

When auto-opening a new prediction window after a delivery sync, set `locks_at` to `now() + 12 seconds`. This is the source of truth for when the window closes.

**2. Backend: Auto-lock expired windows on every sync** (`supabase/functions/cricket-api-sync/index.ts`)

At the start of `doSync()`, before processing any deliveries, run a query to lock any open windows whose `locks_at` has passed:
```sql
UPDATE prediction_windows SET status = 'locked' 
WHERE status = 'open' AND locks_at IS NOT NULL AND locks_at <= now()
```

**3. Backend: Set `locks_at` in `resolve-prediction-window` (open action)** (`supabase/functions/resolve-prediction-window/index.ts`)

When admin manually opens a window via the "open" action, also set `locks_at` to 12 seconds from now, so manually-opened windows also auto-lock.

**4. Frontend: Countdown timer on open windows** (`src/components/live/PredictionPanel.tsx`)

- Read the `locks_at` field from each open prediction window
- Add a visible countdown (e.g., "