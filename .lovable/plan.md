

## Problem

Three gaps exist in the current system:

1. **Manual match activation required**: When `cricket-api-sync` discovers a match via the Roanuz API, it creates it but the admin must manually activate it. If a match goes live on TV, players with game access see "No Active Match."

2. **No automatic polling for live scores**: The `doSync()` function works correctly but is only triggered by manual admin clicks or a cron job. There's no client-side or server-side continuous polling to keep scores updated in near real-time.

3. **Prediction windows don't auto-close on ball delivery**: Currently, prediction windows are only closed when an admin manually records a delivery via `record-delivery` (which locks open windows before inserting). The API-synced deliveries in `doSync()` explicitly skip prediction window management (line 452: "Admin controls prediction window open/lock/resolve via Match Command Center").

## Plan

### 1. Auto-activate matches when API detects them as "live"

**File**: `supabase/functions/cricket-api-sync/index.ts` — in `doSync()`

Currently, `doSync()` skips matches where `status !== 'live'` (line 351). But a newly discovered match starts as `registrations_open` and never transitions to `live` unless an admin does it.

**Fix**: In `doSync()`, when the API returns a match status that indicates "live" or "in progress", automatically update the match status to `live` in the `matches` table and set `is_active_for_registration = true`. Also update `match_live_state.phase` from `pre` to `innings1`.

Additionally, in `doDiscover()` (which already runs on the `auto` action), if the API shows a match as live during discovery, set its status to `live` directly instead of `registrations_open`.

### 2. Auto-poll live scores from client side

**File**: `src/components/live/Scoreboard.tsx`

Add a `setInterval` (every 30 seconds) that calls the `cricket-api-sync?action=sync` endpoint. This ensures that even without admin intervention, live scores from the Roanuz API are continuously fetched and written to the database — which then propagates via existing Realtime subscriptions.

This polling only runs when the match is in a "live" phase (not pre-match or ended).

**File**: `supabase/functions/cricket-api-sync/index.ts` — in `doSync()`

Broaden the filter: instead of only syncing matches with `status = 'live'`, also sync matches with `status = 'registrations_open'` whose API status shows them as live. Auto-transition their status to `live`.

### 3. Auto-lock prediction windows on new API-synced delivery

**File**: `supabase/functions/cricket-api-sync/index.ts` — in `doSync()`, inside the new-ball insert loop

When a new delivery is detected from the API (line 415–456), **before** inserting it, lock any open prediction windows for that match — exactly like `record-delivery` already does. Remove the comment on line 452 and add: