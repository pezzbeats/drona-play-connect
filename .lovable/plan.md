
## Analysis of Current State

**What exists:**
- `admin_activity` table exists with INSERT/SELECT policies — some pages already write audit logs (control, validate, orders, matches), but many critical paths still miss them (leaderboard adjustments, team edits, payment proof overrides, match-flag changes, check-in)
- All authenticated admins are equal — no roles (no `super_admin` vs `operator` vs `gate_staff` distinction)
- No rate limiting on any edge function — `submit-prediction`, `create-order`, and `verify-game-pin` are open to abuse
- No system health page — no DB health, edge function status, or connectivity indicators
- `AuthContext` exposes only `user` + `loading` — no role attached
- Error handling is try/catch per function but no global error boundary in React
- No graceful fallback UI for network failures
- Data backup is Supabase-native (automatic), but no documentation/export scheduled workflow exists

**What to build:**

### 1. Role-based admin access (DB migration + code)
- New `admin_roles` table: `user_id uuid, role text ('super_admin'|'operator'|'gate_staff')` with RLS
- DB function `get_admin_role(user_id)` SECURITY DEFINER
- `AuthContext` extended: loads role on sign-in, exposes `role` and `isRole()` helper
- `ProtectedRoute` gets a `requiredRole` prop for role-gating specific pages
- Role restrictions:
  - `gate_staff` → only `/validate` and `/dashboard`
  - `operator` → all except `/admin/control`, `/admin/leaderboard` (freeze/adjust), `/admin/analytics`
  - `super_admin` → everything
- `AdminSidebar` hides nav items the user can't access

### 2. Activity log completions + Activity Log page
- Complete coverage: add `admin_activity` inserts to: leaderboard adjust/freeze, match-flag changes (panic freeze), match scoring config save, team/player create/edit/delete, payment proof override
- New `/admin/activity` page — paginated audit trail table, filterable by action/admin/entity type, date range, CSV export

### 3. Error handling & graceful fallbacks
- Global React `ErrorBoundary` component wrapping admin routes
- Network error toast helper (detect `Failed to fetch` → "Check your connection")
- Edge functions: consistent error shape `{ error, code, retryable }` — already mostly done, just needs `retryable` flag
- Skeleton states already exist — ensure all data-fetching pages have proper empty states

### 4. Rate limiting on sensitive edge functions
- `submit-prediction`: per-mobile sliding window using DB — insert into `rate_limit_log` or simply check prediction count in last N seconds. Simpler: check predictions count for same `mobile + window_id` (already upserted so naturally idempotent) — main risk is flooding different windows. Add check: max 60 predictions per mobile per match per minute using a simple in-memory approach via a DB count.
- `verify-game-pin` / `create-order`: add basic IP-based rate limiting: count attempts in `ticket_scan_log` / a new `rate_limit_events` table within a 60-second window; reject with 429 if > threshold.
- Approach: lightweight — add a new `rate_limit_events(key text, created_at)` table. Edge functions check count of rows with matching `key` in last 60 seconds; insert a row each call; clean old rows periodically.

### 5. System health dashboard (new page `/admin/health`)
- 4 health cards:
  - **DB connectivity**: tries a lightweight `supabase.from('matches').select('count')` — shows ✅/❌ + latency
  - **Auth service**: checks `supabase.auth.getSession()` — shows ✅/❌
  - **Edge Functions**: pings each function via a lightweight OPTIONS request — shows reachable/unreachable
  - **Realtime**: shows connected/disconnected from `supabase.channel` status
- Active match summary (name, status, registration state)
- Last 5 admin activity entries inline
- Auto-refresh every 30 seconds

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/[new].sql` | `admin_roles` table + `get_admin_role()` function + `rate_limit_events` table |
| `src/contexts/AuthContext.tsx` | Load + expose `role`, `isRole()` |
| `src/components/admin/ProtectedRoute.tsx` | Accept `requiredRole` prop, redirect on insufficient role |
| `src/components/admin/AdminSidebar.tsx` | Filter nav items by role |
| `src/components/admin/ErrorBoundary.tsx` | New global error boundary |
| `src/App.tsx` | Wrap admin routes in ErrorBoundary; add `/admin/activity` and `/admin/health` routes with role guards |
| `supabase/functions/submit-prediction/index.ts` | Rate limit: max 30 predictions/mobile/match/minute |
| `supabase/functions/verify-game-pin/index.ts` | Rate limit: max 10 attempts/IP/minute |
| `supabase/functions/create-order/index.ts` | Rate limit: max 5 orders/mobile/10min |
| `src/pages/admin/AdminActivity.tsx` | New page — paginated audit log, filters, CSV export |
| `src/pages/admin/AdminHealth.tsx` | New health dashboard page |
| Existing admin pages | Plug missing `admin_activity` inserts (leaderboard, control flags, scoring config) |

## Role permissions matrix

```text
Route/Feature         gate_staff  operator  super_admin
/admin/dashboard           ✓          ✓          ✓
/admin/validate            ✓          ✓          ✓
/admin/orders              ✗          ✓          ✓
/admin/manual-booking      ✗          ✓          ✓
/admin/matches             ✗          ✓          ✓
/admin/teams               ✗          ✓          ✓
/admin/control             ✗          ✓          ✓
/admin/leaderboard         ✗          ✗          ✓
/admin/analytics           ✗          ✓          ✓
/admin/activity            ✗          ✗          ✓
/admin/health              ✗          ✓          ✓
```

## Rate limiting approach (lightweight, no Redis needed)

```sql
CREATE TABLE public.rate_limit_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL,       -- e.g. "predict:mobile:matchId" or "pin:ip"
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_rle_key_time ON public.rate_limit_events(key, created_at);
-- No RLS needed — only called via service_role in edge functions
```

Edge function checks:
```typescript
const windowStart = new Date(Date.now() - 60_000).toISOString();
const { count } = await supabase
  .from('rate_limit_events')
  .select('*', { count: 'exact', head: true })
  .eq('key', limitKey)
  .gte('created_at', windowStart);
if ((count || 0) >= LIMIT) return 429;
await supabase.from('rate_limit_events').insert({ key: limitKey });
```

Old rows auto-purge via a simple delete on insert (delete rows older than 5 minutes for same key).

## Health page layout

```text
┌─────────────────────────────────────────┐
│ System Health      [Refresh] last: 10s  │
├──────────┬──────────┬──────────┬────────┤
│ Database │   Auth   │ Edge Fn  │Realtime│
│  ✅ 42ms │  ✅ OK   │ ✅ 3/3  │  ✅   │
├─────────────────────────────────────────┤
│ Active Match: T20 Night 4   [Live ●]   │
│ Registrations: Open  |  Tickets: 142   │
├─────────────────────────────────────────┤
│ Recent Activity (last 5 actions)        │
│ admin@... set_match_active  2m ago      │
│ admin@... verify_payment    5m ago      │
└─────────────────────────────────────────┘
```
