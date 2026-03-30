

## Plan: Auto-Show Today's IPL Matches on Landing Page with Free Registration

### What changes

Transform the landing page from showing a single admin-activated match to automatically displaying all of today's IPL matches (already auto-created by the Roanuz cron sync). Users register for free with just their phone number and name — no payment flow, no ticket pricing.

### Architecture

```text
Landing Page (Index.tsx)
├── Fetches ALL matches where start_time is today (not just is_active_for_registration)
├── Shows match cards for each today's match
│   └── Each card: team names, venue, start time, countdown, "Join Free" button
│
├── "Join Free" button → inline registration form OR /register?match_id=xxx
│   └── Collects: Full Name + Mobile Number only
│   └── Creates order with total_amount=0, payment_status='paid_verified'
│   └── Auto-generates game_access + PIN
│   └── Redirects to /live
│
└── No pricing cards, no payment flow for these matches
```

### Database changes

**No schema migrations needed.** The existing `orders` table supports `total_amount = 0` and the `create-order` edge function already handles order creation. We just need to allow free orders.

### Key changes by file

**1. `src/pages/Index.tsx`** (major rewrite of data fetching + match display)
- Instead of querying `matches` with `is_active_for_registration = true`, query all matches where `start_time` is today (within 24h window)
- Display multiple match cards in a scrollable list
- Each card shows: match name, teams (from match_roster + teams), venue, start time, countdown timer, live status badge
- Replace "Reserve Your Seats Now" CTA with "Join Free" button per match
- Remove pricing card section entirely for free matches
- Remove "Already Booked? View Your Passes" when matches are free
- Keep the GameLoginCard for users who already have a PIN

**2. `src/pages/Register.tsx`** (simplify for free registration)
- Accept `match_id` query param to know which match the user is registering for
- Remove payment steps (step 2 pricing, step 3 payment) — go straight from details to game access
- Collect only: Full Name + Mobile Number (email optional)
- On submit:
  - Create order via `create-order` edge function with `payment_method: 'free'`, `total_amount: 0`
  - OR create a simplified direct-insert flow: insert order + generate game_access + PIN
  - Show the user their 4-digit PIN and redirect to /live

**3. `supabase/functions/create-order/index.ts`** (minor update)
- Support `payment_method: 'free'` that sets `payment_status = 'paid_verified'` and `total_amount = 0`
- Auto-generate tickets + game_access with PIN immediately (no payment verification step)

**4. `supabase/functions/cricket-api-sync/index.ts`** (minor tweak)
- When discovering matches, set `is_active_for_registration = true` automatically for today's matches so existing queries still work as fallback

### Registration flow (user perspective)

1. User opens landing page → sees today's IPL match(es) with team logos, countdown
2. Taps "Join Free" on a match card
3. Enters Full Name + 10-digit Mobile Number
4. System creates free order, generates game PIN
5. User sees their 4-digit PIN + "Enter the Game" button
6. Redirected to /live page

### What stays the same
- Admin can still manually control matches via admin panel
- GameLoginCard for returning users with existing PINs
- Legal disclaimer, trust blocks, footer
- The Roanuz cron sync continues discovering and syncing matches automatically

### Files changed
1. `src/pages/Index.tsx` — fetch today's matches, show multiple cards, free join CTA
2. `src/pages/Register.tsx` — simplified free registration flow (name + mobile only)
3. `supabase/functions/create-order/index.ts` — support free orders with auto game access
4. `supabase/functions/cricket-api-sync/index.ts` — auto-set `is_active_for_registration` for discovered matches

