
## What needs to be done

The screenshot shows 5 items in the task tracker:
- ✅ Fix AdminDashboard — DONE (IST date, auto-refresh, error handling all present in current code)
- ✅ Fix AdminMatches — DONE (deactivation dialog present)
- ◐ Fix AdminManualBooking — PARTIALLY done. The auto-clear quote on change and WhatsApp after booking are done. But the "show WhatsApp share" is an auto window.open(), not a post-success state — the form resets immediately after. The plan called for a visible "Share on WhatsApp" button in the success state, but currently the form just resets after booking. Missing: **a persistent success state** after booking with the WhatsApp button visible.
- ✅ Fix AdminOrders — DONE (count chip, refresh button, Razorpay guard present)
- ○ Fix AdminControl — NOT done. `callFunction` still shows generic `'✅ Done'` for all actions. No descriptive success messages. The mobile header IS there (sticky top bar with match name + PhaseBadge). So only the **descriptive toast messages** for critical calls are missing.
- ○ Fix AdminValidate — Looking at the code: `handleScanNext` IS present (line 1236), `sendWhatsApp` IS present (line 1230), Admin Controls IS now shown for all `ticketData` (line 1334: `{ticketData && ...}`). So AdminValidate IS already done.
- ○ Fix AdminActivity, Analytics, Health, ... — Looking at the code: Activity has adminEmailMap (done), Analytics has Razorpay row (line 405, done), Health shows `admin_id.slice(0,8)` (line 242, done), Sidebar has tooltips (done), BottomNav has role badge (lines 150-153, done).

So the real remaining gaps are:

**1. AdminManualBooking** — After `handleCreate` succeeds, the form immediately resets (`setExisting(null)`, `setPriceQuote(null)`, `setForm(...)`, `handleSearch()`). The WhatsApp `window.open` fires but then the UI drops back to the empty search state with no confirmation. The plan called for a visible success card with a "Share on WhatsApp" CTA. Currently the admin sees just the search form again with no confirmation. Need: add a `bookingSuccess` state that shows a confirmation card with the WhatsApp link, instead of (or before) resetting the form.

**2. AdminControl** — `callFunction` always says `'✅ Done'`. The plan called for descriptive success messages for critical actions. Need: update `callFunction` to accept an optional `successMsg` parameter, and pass descriptive strings to the most critical calls (phase transitions especially).

Those are the two remaining incomplete items. Everything else listed in the task tracker is actually already implemented.

## Plan

### File: `src/pages/admin/AdminManualBooking.tsx`

Add a `lastBooking` state to capture the booking result (name, mobile, balance, matchName, waLink). After `handleCreate` succeeds, instead of immediately calling `handleSearch()` and resetting form, set `lastBooking` and show a success card. The success card shows:
- Green "Booking Created" header
- Customer name + order ID
- Balance due or "Fully paid"
- Large "Send WhatsApp Confirmation" button (opens the wa.me link)
- "Book Another" button that clears `lastBooking` and resets the form

The `window.open` still fires automatically, but the card stays visible as a fallback.

```typescript
// Add state
const [lastBooking, setLastBooking] = useState<{
  name: string; mobile: string; balance: number; orderId: string; waLink: string; matchName: string;
} | null>(null);

// In handleCreate success, after toast:
setLastBooking({ name: form.full_name, mobile: searchMobile, balance: finalBalance, orderId: data.order_id, waLink: waLink, matchName });
// DON'T reset form yet — wait for user to press "Book Another"

// Success card JSX renders when lastBooking !== null, replacing the form
```

### File: `src/pages/admin/AdminControl.tsx`

Update `callFunction` to accept an optional `successMsg?: string` param:

```typescript
const callFunction = async (fn: string, body: any, loadingKey: string, successMsg?: string) => {
  // ...
  toast({ title: successMsg ?? '✅ Done' });
  // ...
};
```

Then pass descriptive messages to the critical calls:
- `handleInitMatch`: `'✅ Match initialized'`
- `handlePhase('innings1')`: `'▶ Innings 1 started'`
- `handlePhase('break')`: `'⏸ Innings break'`
- `handlePhase('innings2')`: `'▶ Innings 2 started'`
- `handlePhase('ended')`: `'🏁 Match ended'`
- `handleCreateOver`: `'🏏 New over started'`
- `handleCompleteOver`: `'✅ Over completed'`
- `handleRecordDelivery` (in deliver fn): descriptive based on outcome
- `handleOpenWindow`: `'🎯 Guess window opened'`
- `handleCloseWindow`: `'🔒 Guess window closed'`

For `handlePhase` specifically — it calls `callFunction` directly for non-confirm phases and sets a confirm dialog for innings2/ended. Update the direct call to pass a message, and update `callFunction` inside `confirmDialog` confirmation too. The confirm dialog calls `callFunction` directly in `confirmDialog.body` resolution — need to update that path too.

Actually looking at the code more carefully: `handlePhase` for non-confirm phases calls `callFunction('match-control', ..., phase-${phase})` directly. For confirm phases it sets `confirmDialog`. The confirm dialog has an `AlertDialogAction onClick` that calls `callFunction(fn, body, key)`. We need to thread the successMsg through the dialog state too.

Simpler approach: update `confirmDialog` state type to include `successMsg?: string`, pass it through `callFunction`.

## Files to change

| File | Change |
|---|---|
| `src/pages/admin/AdminManualBooking.tsx` | Add `lastBooking` state; show success card after booking instead of immediately resetting; "Book Another" button resets |
| `src/pages/admin/AdminControl.tsx` | Add optional `successMsg` param to `callFunction`; pass descriptive messages for all critical action calls; update `confirmDialog` state to carry `successMsg` |
