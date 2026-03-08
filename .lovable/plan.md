
## Deep Analysis

### What exists today

**Customer journey:**
1. Home (Index) → Register → Ticket (QR pass) → Gate check-in → Play (PIN login) → Live (Score / Guess / Leaderboard)

**Admin journey:**
1. Dashboard → Matches → Match Detail → Bookings (Orders) → Gate Validate → Manual Booking → Match Control → Leaderboard → Analytics

### Gaps & improvement opportunities identified

**1. Admin Dashboard — static polling, no realtime**
- Dashboard uses `setInterval(60s)` polling. If a new booking lands, it won't show for up to 60 seconds.
- Fix: add a realtime subscription on `orders` INSERT → increment stats live. One-liner using `useRealtimeChannel`.

**2. Admin Dashboard — "Pending Verification" stat is a dead-end**
- The dashboard shows a "Pending" count card but it's not clickable/linked. The admin has to manually navigate to Bookings to find them.
- Fix: make the "Pending" stat card a link to `/admin/orders?filter=pending_verification`.

**3. Bookings page has no deep-link filter support**
- No URL param filtering. When coming from Dashboard's "Pending" card, user lands on an unfiltered list.
- Fix: read `?filter=` from URL params on mount and pre-set the status filter Select.

**4. Live page — match end has no realtime detection**
- `matchStatus` is fetched once at init. If a match transitions to `ended` while the user is in the Live page, nothing happens. The user only sees the "ended" state if they reload.
- Fix: add an UPDATE subscription on `matches` table in `LiveContent`'s realtime channel (already listening for `predictions_enabled` changes) to also detect `status === 'ended'` → set `matchEnded = true` state reactively.

**5. Play page — PIN entry is blind to session state**
- If the user already has a valid `game_session` in localStorage, they're forced through the PIN form again. Should auto-redirect to `/live`.
- Fix: on Play page mount, if `game_session` exists in localStorage, silently navigate to `/live`.

**6. Customer Ticket page — balance due is shown but no inline payment path**
- Unpaid orders show "Balance due: ₹X" but have no CTA to pay or upload proof. The user is left stranded.
- Fix: show a prominent "Pay Now" CTA that triggers the same Razorpay flow (already built in Register.tsx) or a "Upload Payment Proof" option, linking back to Register page with mobile pre-filled.

**7. Customer Live page — no personal rank position visible outside Leaderboard tab**
- Users can only see their rank by switching to the Leaderboard tab. No summary indicator in Score or Guess tabs.
- Fix: in the sticky header or Score tab, show a compact "Your rank: #N · X pts" chip that updates in realtime (already available from `leaderboard` table).

**8. Match Control → "Open Guess" workflow lacks a confirmation of how many players are guessing**
- Admins open a prediction window but don't know real-time participation. Knowing "12 players have already guessed" helps them time the lock.
- Fix: in AdminControl's prediction tab, when a window is `open`, show a live counter from the `predictions` table (count where window_id = current open window).

**9. Admin Dashboard — no "Match Control" quick action**
- Quick Actions only shows Gate Validate, Manual Booking, Manage Matches. When a match is live, the most urgent task is Match Control, not match management.
- Fix: dynamically show "Match Control" in Quick Actions when the active match's status is `live`.

**10. Gate Validate — no link back to booking after check-in**
- After a successful scan, the admin sees the customer name and PIN but can't quickly access the booking. If there's a dispute, they have to manually search in Bookings.
- Fix: add a "View Booking" button in the success result card that links to `/admin/orders` with the mobile pre-set in the search field.

---

## Plan: Most Impactful Improvements

I'll implement the top 5 that give the most seamless UX across both journeys, all in frontend-only changes:

### 1. Admin Dashboard: realtime order count + clickable Pending stat card + "Match Control" quick action when live

**File:** `src/pages/admin/AdminDashboard.tsx`
- Add `useRealtimeChannel` subscription on `orders` INSERT → call `fetchData()` on new order
- Wrap the "Pending" stat card in a `<Link to="/admin/orders?filter=pending_verification">`
- In `quickActions`, conditionally insert `{ icon: Zap, label: 'Match Control', desc: 'Live scoring & guesses', to: '/admin/control' }` when `activeMatch?.status === 'live'`

### 2. Bookings: read URL `?filter=` param on mount

**File:** `src/pages/admin/AdminOrders.tsx`
- Use `useSearchParams()` on mount; if `filter` param present, set `statusFilter` state to that value

### 3. Live page: realtime match-end detection

**File:** `src/pages/Live.tsx`
- In `LiveContent`, the existing `matches` UPDATE subscription already updates `predictionsEnabled` and `matchName`
- Extend it to also check: if `payload.new?.status === 'ended'`, set a local `isMatchEnded` state to `true`
- Pass that as `matchEnded` prop behavior (currently only set from the shell's initial load)
- The shell (`LivePage`) already has the ended branch; this makes it reactive without reload

### 4. Play page: auto-redirect if session exists

**File:** `src/pages/Play.tsx`
- In the initial `useEffect`, check `localStorage.getItem('game_session')` before showing the form — if valid JSON with mobile+pin, navigate to `/live` immediately

### 5. Live page: compact personal rank chip in sticky header

**File:** `src/pages/Live.tsx`
- Fetch `leaderboard` row for the current `session.mobile` + `matchId` on mount
- Subscribe to leaderboard UPDATE for that mobile via realtime
- Show a pill in the sticky header: `#3 · 80pts` that updates live
- Only show when there's a rank (player has guessed at least once)

---

## Technical approach

All changes are frontend-only, no migrations needed. Touches 3 files:

```text
src/pages/admin/AdminDashboard.tsx   → realtime + pending link + match control action
src/pages/admin/AdminOrders.tsx      → URL param filter
src/pages/Live.tsx                   → realtime match-end + personal rank chip + auto-redirect in Play
src/pages/Play.tsx                   → session auto-redirect
```

Each change is small, isolated, and uses existing patterns (useRealtimeChannel, supabase client, react-router).
