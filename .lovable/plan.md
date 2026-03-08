
## Full Plan: Rename "Orders" → "Bookings" + Complete Booking Control Panel

### What needs to change across files

**Rename references (6 locations):**
1. `AdminSidebar.tsx` — label `Orders` → `Bookings`, icon stays `ShoppingBag`
2. `AdminBottomNav.tsx` — label `Orders` → `Bookings`, primary route unchanged (`/admin/orders`)
3. `App.tsx` — no route change needed (keep `/admin/orders` URL for backward compatibility, just rename the displayed label)
4. `AdminOrders.tsx` — page header h1 `Orders` → `Bookings`, description text
5. `AdminDashboard.tsx` — any "Orders" heading references

---

### Core new file: `AdminOrders.tsx` full rewrite

The current file is 499 lines — expand to ~900 lines adding:

#### Structure
- List view (existing) with expanded detail panel
- Each expanded row becomes a **full booking control panel** with tabbed sections

#### New sections per booking detail

**1. Customer & Booking Overview** (already exists, improve layout)
- Name, mobile, email, source, seating type, seats count
- Pricing source badge (Standard ₹999 / Special ₹949 / Eligible)
- Booking timeline: `created_at`, `payment_verified_at`
- Order ID (copyable)

**2. Payment & Proof** (already exists)
- Status, method, amounts, advance, balance
- Proof viewer, override controls
- Advance record form

**3. Pass Downloads (NEW)**
The existing `buildPassCanvas` + `QRCodeCanvas` logic lives in `Ticket.tsx` and `Register.tsx`. For admin, we need to:
- Fetch tickets for that order from the `tickets` table on expand
- Render hidden `<QRCodeCanvas id={qr-canvas-{ticket.id}}>` elements in the DOM (same pattern as Ticket.tsx)
- Reuse the same `buildPassCanvas` function (copy into AdminOrders or extract to a shared util)
- "Download Seat N" buttons for each ticket
- "Download All (ZIP)" — since we cannot import `jszip` (not installed), use sequential staggered downloads (same approach as Register.tsx auto-download)
- Show a progress indicator while generating

**4. WhatsApp Sharing (NEW)**
- "Send to Customer" button: builds `wa.me/91{mobile}?text=...` deep link
- Message includes: event/match name, booking holder name, order ID (last 8 chars), pass link (`https://cricket.dronapalace.com/ticket?mobile={mobile}`)
- Opens in new tab (user-gesture triggered, no blocking)
- Uses `cricket.dronapalace.com` as the base URL for all shared links

**5. Game Access / PIN (NEW)**
- On expand, fetch `game_access` row: `.from('game_access').select('*').eq('match_id', ...).eq('ticket_id', ...)`
- Since PIN is stored hashed, we **cannot show the current PIN** (it's a one-way hash). Instead:
  - Show PIN status: Active / Not Generated / Regenerated
  - Show `pin_created_at` timestamp
  - Show check-in status: `checked_in_at`, `checked_in_by_admin_id`
  - **Regenerate PIN** button → calls existing `admin-checkin` edge function with `{ ticket_id, admin_id, regenerate: true }` → returns new 4-digit PIN
  - On regeneration: display the new PIN prominently (one-time display) in a highlighted box
  - Store regenerated PIN in component state (not persisted — disappears on collapse)

**6. Check-in Status (NEW)**
- Show ticket status: `active` / `used` / `blocked`
- Check-in timestamp and which admin checked in
- If not checked in: show check-in button (calls `admin-checkin` without regenerate flag)

---

### Implementation approach for pass canvas in admin

The `buildPassCanvas` function uses `document.getElementById(`qr-canvas-${ticket.id}`)` to grab the QR canvas. This means we need:
1. A `BookingTickets` sub-component that renders hidden `<QRCodeCanvas>` elements for each ticket when the booking is expanded
2. The same `buildPassCanvas` logic (copy from Ticket.tsx — it's self-contained except for `loadImage` helper and `hotelLogo` import)
3. A `downloadOrderPasses` function that iterates tickets, calls `buildPassCanvas`, and triggers staggered downloads

The `roundRect` and `loadImage` helpers + `buildPassCanvas` will be duplicated into AdminOrders.tsx (identical to Ticket.tsx). This avoids creating a new shared file for plan scope.

---

### WhatsApp message format

```
🎟️ Booking Confirmed — Hotel Drona Palace

Hi {name}! Your T20 Fan Night pass(es) are ready.

🏏 Match: {matchName}
📍 Venue: {venue}  
🗓️ Date: {startTime}
🪑 Seats: {seatNos}
💳 Payment: {statusLine}
📋 Booking ID: #{orderId.slice(-8).toUpperCase()}

🎫 View your passes: https://cricket.dronapalace.com/ticket?mobile={mobile}

— Hotel Drona Palace
```

---

### Files to edit

| File | Change |
|------|--------|
| `src/components/admin/AdminSidebar.tsx` | `Orders` → `Bookings` label |
| `src/components/admin/AdminBottomNav.tsx` | `Orders` → `Bookings` label |
| `src/pages/admin/AdminOrders.tsx` | Full rewrite — add pass download, WhatsApp, Game PIN, check-in sections |

`App.tsx` — no route changes needed (keep `/admin/orders`). `AdminDashboard.tsx` — has no hardcoded "Orders" text in visible labels, confirmed from reading lines 1-60.

---

### State management in AdminOrders.tsx

New state added:
```ts
const [orderTickets, setOrderTickets] = useState<Record<string, any[]>>({});  // orderId → tickets
const [gameAccess, setGameAccess] = useState<Record<string, any>>({});        // ticketId → game_access row
const [downloadingId, setDownloadingId] = useState<string | null>(null);
const [regeneratingPin, setRegeneratingPin] = useState<string | null>(null);  // ticketId
const [freshPin, setFreshPin] = useState<Record<string, string>>({});          // ticketId → plain PIN (one-time)
const [activeTab, setActiveTab] = useState<Record<string, string>>({});       // orderId → tab name
```

When a booking is expanded:
1. Fetch tickets: `.from('tickets').select('*').eq('order_id', orderId)`
2. For each ticket, fetch game_access: `.from('game_access').select('*').eq('ticket_id', ticketId).maybeSingle()`

PIN regeneration flow:
1. Call `supabase.functions.invoke('admin-checkin', { body: { ticket_id, admin_id: user.id, regenerate: true } })`
2. Response: `{ pin: '1234', success: true }`
3. Store `pin` in `freshPin[ticketId]` state — display for the session
4. Refetch game_access row to update timestamps

---

### UI layout for expanded booking detail

Use a tabbed layout (4 tabs) within each expanded card:
- **Overview** — customer info, payment, pricing, timeline
- **Passes** — pass download controls + QR codes (hidden canvas elements)  
- **Game Access** — PIN status, regenerate button, check-in status
- **WhatsApp** — pre-filled message preview + share button

Tabs implemented as simple pill-style buttons (no Radix Tabs to avoid import complexity) — `activeTab[orderId]` state controls which tab is shown.

---

### Key constraints respected
- No existing functionality removed
- Route `/admin/orders` unchanged (backward compatible)
- Pass design is identical to customer-facing Ticket.tsx (same canvas code)
- WhatsApp uses native `wa.me` deep links only (no API)
- PIN shown only on regeneration (one-time), never from DB (it's hashed)
- All shared links use `cricket.dronapalace.com` base URL
