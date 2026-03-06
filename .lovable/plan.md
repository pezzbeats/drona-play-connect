
## Analysis

**What exists today:**
- `AdminDashboard.tsx` — 6 basic stat tiles (total orders, paid, unpaid, pending, check-ins today, total seats). No charts, no revenue breakdown by payment method, no occupancy meter, no prediction stats, no CSV export, no per-match filtering.
- `AdminOrders.tsx` — raw order list with filters. No aggregated analytics.
- `AdminLeaderboard.tsx` — per-match leaderboard. Has CSV export but only for leaderboard data.

**What needs building:**
A dedicated `/admin/analytics` page that aggregates across existing tables (`orders`, `tickets`, `payment_collections`, `predictions`, `prediction_windows`) and presents operational charts and exportable summaries.

No schema changes are needed — all data is available in existing tables.

---

## Plan

### New file: `src/pages/admin/AdminAnalytics.tsx`

One page, match-selector at the top, then 6 sections:

**1. Match selector** — dropdown of all matches; loads all data for that match on change. Also shows an "All Matches" option for aggregate view.

**2. Ticket Sales Summary** — 3 key cards:
- Total Registrations (order count)
- Total Seats Sold
- Conversion rate: paid/total %

**3. Paid vs Unpaid Breakdown** — horizontal stacked bar (Recharts `BarChart`) showing:
- `paid_verified` | `paid_manual_verified` | `pending_verification` | `unpaid` | `paid_rejected`
- Also a donut/pie chart (Recharts `PieChart`) as a visual summary

**4. Revenue Summary by Payment Method** — cards:
- Revenue from `upi_qr` orders (sum of `total_amount` where `payment_method = 'upi_qr'` and paid)
- Revenue from `pay_at_hotel` (sum where `payment_method = 'pay_at_hotel'` and paid)
- Total verified revenue
- Uses `orders.total_amount` for paid orders

**5. Live Occupancy Meter** — a progress bar showing `checked_in / total_seats_sold`. Fetches `tickets` count with `checked_in_at IS NOT NULL` for the selected match vs total tickets.

**6. Prediction Participation Stats** — 3 cards:
- Total prediction windows for the match
- Total predictions submitted
- Participation rate: unique mobiles who predicted / unique mobiles who have tickets
- Small bar chart: predictions per window (top 5 windows by participation)

**7. Export CSV** — single "Export Report" button that generates a multi-section CSV:
```
T20 Fan Night Analytics — [Match Name]
DISCLAIMER: For entertainment only. No gambling or wagering.

TICKET SALES
...

REVENUE BY PAYMENT METHOD
...

CHECK-IN STATS
...

PREDICTION STATS
...
```

### Routing + Sidebar

Add `{ icon: BarChart2, label: 'Analytics', to: '/admin/analytics' }` to `AdminSidebar.tsx` navItems.
Add `<Route path="analytics" element={<AdminAnalytics />} />` in `App.tsx`.

---

## Data fetching strategy

All done client-side from the Supabase JS client — no new edge functions needed:

```typescript
// Orders for match
const { data: orders } = await supabase
  .from('orders')
  .select('id, payment_status, payment_method, total_amount, seats_count, created_at')
  .eq('match_id', selectedMatchId);

// Tickets check-in count
const { count: checkedIn } = await supabase
  .from('tickets')
  .select('*', { count: 'exact', head: true })
  .eq('match_id', selectedMatchId)
  .not('checked_in_at', 'is', null);

const { count: totalTickets } = await supabase
  .from('tickets')
  .select('*', { count: 'exact', head: true })
  .eq('match_id', selectedMatchId);

// Prediction windows
const { data: windows } = await supabase
  .from('prediction_windows')
  .select('id, question, status')
  .eq('match_id', selectedMatchId);

// Predictions (count per window)
const { data: predictions } = await supabase
  .from('predictions')
  .select('id, window_id, mobile')
  .eq('match_id', selectedMatchId);
```

---

## Files changed

| File | Change |
|---|---|
| `src/pages/admin/AdminAnalytics.tsx` | New page — all analytics sections |
| `src/components/admin/AdminSidebar.tsx` | Add Analytics nav entry |
| `src/App.tsx` | Add `/admin/analytics` route |

No DB migrations needed.

---

## Layout sketch

```text
┌──────────────────────────────────────────────────────────────┐
│ Analytics & Reports        [Match selector ▾]  [Export CSV]  │
├──────────────────────────────────────────────────────────────┤
│ [Total Regs]  [Seats Sold]  [Paid %]  [Revenue Total]        │
├──────────────────────────────────────────────────────────────┤
│  Payment Status Breakdown           Occupancy Meter          │
│  ████▓▓▓░░░░  (stacked bar)        ████████░░ 68% checked in│
├──────────────────────────────────────────────────────────────┤
│  Revenue by Method                  Prediction Participation  │
│  UPI QR: ₹24,500                    Windows: 12              │
│  Pay at Hotel: ₹8,200               Predictions: 345         │
│  Total: ₹32,700                     Participation: 74%       │
└──────────────────────────────────────────────────────────────┘
```
