

## Production Hardening — Drona Play Connect

This is a large overhaul touching the API sync pipeline, frontend performance, error handling, and testing. We'll break it into focused phases.

---

### Phase 1: API Robustness (`cricket-api-sync`)

**File: `supabase/functions/cricket-api-sync/index.ts`**

**A. Retry wrapper with exponential backoff**
- Add a `fetchWithRetry(url, opts, maxRetries=3)` helper that retries on 429/5xx with exponential delays (1s, 3s, 9s). On 429, respect `Retry-After` header.
- Replace all 4 raw `fetch()` calls (auth, fixtures, match detail, ball-by-ball) with `fetchWithRetry`.

**B. Gemini timeout + fallback**
- Wrap the Gemini fetch in `Promise.race` with a 2-second timeout. If it fails or times out, return default 15s interval instead of 20s.

**C. Edge case handling in sync**
- **DLS**: Parse `matchData.dls` or `matchData.revised_target` from the API and store in `match_live_state.target_runs` when present.
- **Abandoned/No Result**: Detect status strings containing "abandoned", "no result", "postponed" → set phase to `ended` and match status to `ended`.
- **Rain delay**: Detect "rain" or "delayed" in status → keep phase as current innings but add `last_delivery_summary = "Rain Delay"`.
- **Toss data**: Extract `matchData.toss` (winner team key + decision) and store in `match_live_state.last_delivery_summary` during pre-match (or a new site_config-style approach since we don't have a toss column — we'll use the existing `last_delivery_summary` field during pre phase).

**D. Structured logging**
- Replace `console.error`/`console.warn` with a `log(level, message, context)` helper that outputs JSON with `{level, message, match_id, timestamp, ...context}`. This makes edge function logs filterable.

---

### Phase 2: Frontend Performance

**A. Optimistic prediction submission (`PredictionPanel.tsx`)**
- On `handleOptionTap`, immediately set `submittedWindows[windowId] = optKey` before calling the edge function. If the function returns an error (and not `ALREADY_SUBMITTED`), revert the optimistic update.

**B. Debounce rapid realtime events (`useRealtimeChannel.ts`)**
- Add a 150ms debounce to the `onReconnect` callback invocation on realtime events, so rapid consecutive DB changes don't trigger 10 fetches in 200ms.

**C. Leaderboard already has debouncing (200ms) — no changes needed.**

**D. Skeleton loader dimensions (`Scoreboard.tsx`)**
- The current loading skeleton is minimal. Replace with a skeleton that matches the actual scoreboard layout (phase badge, score area, player pills) to prevent CLS.

---

### Phase 3: Error Handling & Observability

**A. Global unhandled rejection catcher**
- In `src/main.tsx`, add `window.addEventListener('unhandledrejection', ...)` that logs to console with structured context and shows a toast.

**B. Toast coverage audit**
- The prediction panel already has good toast coverage. Ensure `Scoreboard` fetch failures show a subtle warning toast (non-blocking). Currently they silently fail.

**C. ErrorBoundary enhancement**
- The existing `ErrorBoundary` already catches render errors. Add `componentDidCatch` reporting to a structured log helper (same as edge function pattern, but client-side `console.error` with JSON).

---

### Phase 4: Security Audit

**A. RLS review** — Current policies are already solid:
- `matches`, `deliveries`, `prediction_windows`, `leaderboard` → readable by all (public-facing)
- Write access requires `authenticated` role (admin)
- `predictions` → insertable by all (users submit without auth), readable by all
- `orders` → insertable by all, updatable by authenticated only
- `rate_limit_events` → no direct access (service role only via edge functions)
- No API keys are exposed to the frontend — all external calls go through edge functions.

**B. One gap**: The `game_access` table has `SELECT` open to all (`true`). This leaks all PINs (hashed, but still). We should restrict to authenticated only or add a filter so users can only see their own records. **Migration needed**: Update RLS on `game_access` for SELECT to `auth.role() = 'authenticated'` (admins only) since end users access via edge functions.

---

### Phase 5: Testing

**A. New file: `supabase/functions/cricket-api-sync/index.test.ts`**
- Unit tests for `deliveryToOutcomeKey` covering: dot, 1-6 runs, wide, no_ball, wicket, boundary, six.
- Unit tests for `isApiStatusLive` covering: "started", "play", "innings break", "completed", "not_started", "result".
- Integration-style test mocking the Roanuz API response and verifying the parsed output structure.

**B. New file: `src/components/live/__tests__/PredictionPanel.test.tsx`**
- Render test: skeleton shows on loading.
- Render test: options grid renders correctly.

---

### File Summary

| File | Change |
|---|---|
| `supabase/functions/cricket-api-sync/index.ts` | Add `fetchWithRetry`, Gemini timeout, DLS/abandoned/toss handling, structured logging |
| `src/components/live/PredictionPanel.tsx` | Optimistic UI on prediction submit |
| `src/hooks/useRealtimeChannel.ts` | Add debounce to realtime callback batching |
| `src/components/live/Scoreboard.tsx` | Better skeleton loader, toast on fetch failure |
| `src/main.tsx` | Global unhandled rejection handler |
| `supabase/functions/cricket-api-sync/index.test.ts` | Unit tests for parsing logic |
| `src/components/live/__tests__/PredictionPanel.test.tsx` | Component render tests |
| **Migration** | Tighten `game_access` SELECT RLS policy |

### What we are NOT doing (and why)
- **Fallback provider architecture**: Adding a secondary cricket data provider is a significant architectural change requiring a separate API contract. The retry mechanism covers transient failures. A mock provider for local dev can be added later.
- **Full React Query migration**: The app already uses direct Supabase queries with realtime subscriptions. Migrating to React Query would be a large refactor with minimal benefit given the realtime-first architecture.
- **Super Over API parsing**: The Roanuz API doesn't expose super over data in a standard format. The existing manual super over control (admin-driven) is the correct approach.

