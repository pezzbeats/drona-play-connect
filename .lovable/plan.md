

## Problem

The polling interval is hardcoded at 30 seconds. During intense overs (boundaries, wickets, tight chases), this is too slow. During breaks or slow phases, it wastes API calls.

## Solution

1. **Reduce base polling to 20 seconds**
2. **Add an AI-powered adaptive layer** using Lovable AI (which serves Google Gemini models — already configured, no extra API key needed) that analyzes game pace and adjusts polling between 10-20 seconds

## How It Works

After each sync, the edge function analyzes recent delivery timestamps and match context, then returns a recommended next poll interval. The frontend uses this to schedule the next poll dynamically.

### Changes

**1. `supabase/functions/cricket-api-sync/index.ts`**

Add a new `analyzeGamePace()` function at the end of `doSync()` that:
- Counts deliveries in the last 2, 5, and 10 minutes from the `deliveries` table
- Checks match phase, current over, wickets fallen recently, and run rate
- Calls Lovable AI gateway (`google/gemini-2.5-flash-lite` — cheapest/fastest) with a structured prompt:
  ```
  "Given: phase={innings2}, overs={18.4}, score={165/4}, target={172}, 
   deliveries_last_2min={3}, deliveries_last_5min={7}, last_delivery={boundary_4}.
   Return optimal polling interval in seconds (10-20) based on game intensity."
  ```
- Uses tool calling to extract a structured `{ interval: number, reason: string }` response
- Returns this interval in the sync response JSON

If the AI call fails or times out, fall back to 20 seconds.

**2. `src/components/live/Scoreboard.tsx`**

- Change base interval from 30000ms to 20000ms
- After each poll, read the `recommended_interval` from the sync response
- Use `setTimeout` instead of `setInterval` for dynamic scheduling
- Store the current interval in a ref for display