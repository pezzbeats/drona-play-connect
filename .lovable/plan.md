

## Problem

Query 2 (the "fallback" query on line 513-517) fetches **any** match where `is_active_for_registration = true` with no date filter. This pulls in yesterday's and tomorrow's matches alongside today's, causing 3 cards to appear.

## Solution

**File: `src/pages/Index.tsx`** — Replace the two-query merge with a single smart query that implements this logic:

1. **Primary**: Show matches with status `registrations_open` or `live` scheduled **today (IST)** — same as current Query 1.
2. **Fallback (no active today)**: If zero results from step 1, show the **next upcoming** match (earliest `