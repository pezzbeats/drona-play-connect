
## Full Admin Experience Audit

After reading every admin page, component, and layout in detail, here are all the issues and enhancements identified:

---

### Issues Found

**1. AdminDashboard.tsx — `fetchData` has no error handling / `setLoading(false)` in error path**
- `fetchData` calls `Promise.all` without try/catch. If `orders` query fails, `setLoading(false)` is never called, leaving the page in a permanent skeleton state.
- **Fix**: Wrap in try/catch/finally, call `setLoading(false)` in finally.

**2. AdminDashboard.tsx — "Refresh" button shows no loading state**
- Clicking "Refresh" re-runs `fetchData()` but the button doesn't indicate loading — it just sits idle while data loads.
- **Fix**: Pass `loading` to the `GlassButton`'s `loading` prop.

**3. AdminDashboard.tsx — `checkedInToday` query uses today's date in UTC, not IST**
- The check `gte('checked_in_at', today)` uses `new Date().toISOString().split('T')[0]` which is UTC midnight. For an event in India this means the day resets at 5:30 AM IST, so late-night check-ins may show 0 on the next calendar day.
- **Fix**: Use IST midnight by computing `new Date()` offset to UTC+5:30.

**4. AdminDashboard.tsx — Dashboard doesn't auto-refresh; stale counts during live events**
- During an active match, check-in counts and registrations change rapidly. The dashboard has no auto-refresh; staff must manually click "Refresh".
- **Fix**: Add a 60-second auto-refresh `setInterval` when viewing the dashboard so counts stay fresh.

**5. AdminMatches.tsx — `handleCreate` hardcodes `event_id`**
- Line 65: `event_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'` is hardcoded. This is fine if there's only one event, but should be fetched from the DB's single `events` row so it doesn't silently break if the event UUID ever changes.
- **Fix**: On component mount, fetch the first active event ID and use it. Fall back to the hardcoded value if none.

**6. AdminMatches.tsx — No confirmation dialog when deactivating a match**
- Activating a match shows a confirmation dialog. Deactivating (`handleSetActive(match.id, true)`) fires immediately with no confirmation — this can accidentally close registrations mid-event.
- **Fix**: Show an alert dialog for deactivation as well, similar to the activation dialog.

**7. AdminManualBooking.tsx — "Get Price Quote" button is visible only after user triggers it; seat count/seating type changes don't re-fetch the quote**
- If admin changes seat count after getting a quote, the stale quote remains visible with no indication it needs refreshing. The create button is also enabled on a stale quote.
- **Fix**: When `seats_count` or `seating_type` changes while a quote is already loaded, auto-re-fetch the quote (or clear it to force a re-fetch).

**8. AdminManualBooking.tsx — No "Copy booking link" or WhatsApp button after creating an order**
- After a manual booking, admin sees a toast but has no quick way to share the ticket link with the customer. They'd need to navigate to `/admin/orders` and find the order.
- **Fix**: After `handleCreate` succeeds, show a "Share on WhatsApp" action in the success state that opens `wa.me/91{mobile}?text=...` with the booking summary.

**9. AdminOrders.tsx — The orders list has no total count shown**
- When 50+ orders exist, the admin sees the list but there's no "Showing N orders" count at the top to give a quick heads-up on scope.
- **Fix**: Add a small `{filtered.length} orders` count chip next to the heading.

**10. AdminOrders.tsx — No "refresh" button; list is stale after a new order arrives**
- Orders are fetched once on mount. During live events, new orders arrive but the admin doesn't see them unless they navigate away and back.
- **Fix**: Add a "Refresh" button near the heading.

**11. AdminOrders.tsx — Razorpay payments show the "Manual Verify" override button**
- Looking at `handleOverrideSubmit`, the UI allows any admin to set `payment_status` to `paid_manual_verified` even for orders that are already `paid_verified` (Razorpay). While the memory notes say Razorpay payments shouldn't be manually overrideable, there's no UI guard — only the button is present.
- Actually on review: override buttons ARE shown and can be clicked on Razorpay-verified orders. The logic should hide the "Approve" button when `order.payment_method === 'razorpay'` since Razorpay verification is automatic.
- **Fix**: Hide the "Approve (Manual)" override button for Razorpay orders; only show "Reject" as an override option.

**12. AdminControl.tsx — No page title / breadcrumb visible on mobile**
- On mobile the component starts with the tab bar immediately. No `<h1>` heading at the top shows what page this is for staff who land on it from the bottom nav.
- **Fix**: Add a compact header with title "Match Control" and the active match name/phase badge at the top, visible before the tabs.

**13. AdminControl.tsx — `loadingKey` toast always says "✅ Done" even for failures**
- `callFunction` on success shows "✅ Done" for every action. For critical operations like "Set Phase → ended" this is too generic. No action-specific feedback.
- **Fix**: Accept an optional `successTitle` param to `callFunction` so each call can provide a custom success message. At minimum, pass descriptive success messages to the most critical calls (phase transitions, check-in, etc.).

**14. AdminValidate.tsx — "Admin Controls" card (Block/Reissue QR) is only shown when `isPaid || isBlocked`**
- If a ticket is `unpaid` (e.g., the customer walked in claiming to have paid), the admin cannot block or reissue the QR. They have no controls available.
- **Fix**: Show Admin Controls for all loaded tickets (not just paid/blocked ones).

**15. AdminValidate.tsx — No "Clear / Scan Next" button after a successful check-in**
- After checking in, the large green success bar + ticket data remain. To scan the next person, the operator must manually clear the QR input field. There's no prominent "Scan Next" or "Clear" CTA that resets the view.
- **Fix**: Add a "Scan Next →" button at the bottom of the check-in card that clears `qrInput`, `ticketData`, `scanFeedback`, and focuses the input (or re-opens the camera).

**16. AdminValidate.tsx — The "Copy WhatsApp Message" button doesn't send to WhatsApp — it only copies**
- The button copies a message to the clipboard but the label says "Copy WhatsApp Message". Most gate staff expect this to actually open WhatsApp. The clipboard copy is fine as a secondary, but a direct WhatsApp deep-link is more useful.
- **Fix**: Keep clipboard copy but also open `wa.me/91{mobile}?text=...` in a new tab so it can be sent directly.

**17. AdminActivity.tsx — Admin IDs are shown as truncated UUIDs, not email addresses**
- Row.admin_id is shown as a raw UUID substring. During an incident investigation it's very hard to tell which admin performed which action.
- **Fix**: Cross-reference the `authUsers` from the `admin_roles` table enriched data to display the email address instead of the UUID. A simple approach: fetch the roles list once and build a `userId → email` map.

**18. AdminAnalytics.tsx — Revenue stats don't include Razorpay-paid orders**
- The revenue breakdown shows UPI, Pay at Hotel, and Cash. But the `verifiedRevenue` calculation uses `paidOrders` (all `paid_verified` + `paid_manual_verified`), which includes Razorpay orders. However the per-method breakdown (lines 176-177) doesn't have a Razorpay row — so Razorpay revenue is silently included in `verifiedRevenue` but not shown anywhere in the method breakdown.
- **Fix**: Add a "Razorpay" row to the revenue by method breakdown.

**19. AdminHealth.tsx — "Recent Admin Activity" shows action names but not which admin performed them**
- The health page shows recent activity `action` + `entity_type` + `created_at`. It doesn't show `admin_id`. If there's an unexpected action, there's no way to see who did it from the health page.
- **Fix**: Add the admin's email/ID to each activity row on the health page (use `admin_id.slice(0, 8)` as a fallback).

**20. AdminLogin.tsx — No `Enter` key submits the form on mobile keyboards**
- The login form uses `onSubmit` on the `<form>` element, which should work. But the `<GlassButton type="submit">` has `type="submit"` — that's correct. No issue here on further review.

**21. AdminSidebar.tsx — No tooltip on collapsed nav items**
- When the sidebar is collapsed to icon-only mode, hovering shows no tooltip label. Staff can't know what each icon is without expanding.
- **Fix**: Wrap each collapsed nav icon in a `<Tooltip>` showing the label, visible only when `collapsed` is `true`.

**22. AdminBottomNav.tsx — The "More" sheet doesn't show a user role badge**
- The sidebar shows the role badge, but the mobile "More" sheet only shows the email without the role. Gate staff reviewing their own access level see no role on mobile.
- **Fix**: Add the role badge below the email in the "More" sheet footer.

**23. AdminLayout.tsx — No page-level padding wrapper for desktop**
- The `<Outlet />` renders inside `<main>`, but each admin page is individually responsible for padding (`px-4 py-5`). Some pages have it (Dashboard, Validate, Orders) but others like Health, Analytics, Activity are slightly inconsistent.
- Minor cosmetic — Health page has `p-1` (too little), Analytics has `p-6`. But this is a per-page authoring concern and not a layout bug. Acceptable as-is.

---

### Summary of changes

| File | Fixes |
|------|-------|
| `AdminDashboard.tsx` | try/catch/finally on fetchData; loading state on Refresh button; IST-aware today date; 60s auto-refresh |
| `AdminMatches.tsx` | Fetch event_id dynamically; add deactivation confirmation dialog |
| `AdminManualBooking.tsx` | Auto-re-fetch quote on seat/seating change; show WhatsApp share after booking success |
| `AdminOrders.tsx` | Add orders count chip; add Refresh button; hide "Approve" override for Razorpay orders |
| `AdminControl.tsx` | Add compact mobile header showing match name + phase; descriptive success messages for critical actions |
| `AdminValidate.tsx` | Show Admin Controls for all tickets (not just paid); add "Scan Next" CTA button after check-in; WhatsApp deep-link from copy button |
| `AdminActivity.tsx` | Enrich admin_id → email using roles/auth user data |
| `AdminAnalytics.tsx` | Add Razorpay row to revenue by method breakdown |
| `AdminHealth.tsx` | Show admin_id in recent activity rows |
| `AdminSidebar.tsx` | Tooltips on collapsed sidebar items |
| `AdminBottomNav.tsx` | Show role badge in "More" sheet footer |

No DB migrations needed. No edge function changes needed.

---

### Technical notes

**IST midnight fix (Dashboard)**:
```typescript
// Instead of: new Date().toISOString().split('T')[0]
const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
const today = nowIST.toISOString().split('T')[0];
```

**Auto-refresh (Dashboard)**:
```typescript
useEffect(() => {
  fetchData();
  const interval = setInterval(fetchData, 60_000);
  return () => clearInterval(interval);
}, []);
```

**Sidebar tooltip (collapsed)**:
```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// Wrap each NavLink icon when collapsed:
<Tooltip>
  <TooltipTrigger asChild>
    <NavLink ...>
      <Icon className="h-5 w-5" />
    </NavLink>
  </TooltipTrigger>
  <TooltipContent side="right">{label}</TooltipContent>
</Tooltip>
```

**WhatsApp deep-link in Validate (after check-in)**:
```typescript
const sendWhatsApp = () => {
  const msg = `🏏 T20 Fan Night...\nPIN: ${gamePin}`;
  window.open(`https://wa.me/91${ord?.purchaser_mobile}?text=${encodeURIComponent(msg)}`, '_blank');
  navigator.clipboard.writeText(msg);
};
```

**Scan Next button (Validate)**:
```typescript
const handleScanNext = () => {
  setQrInput('');
  setTicketData(null);
  setScanFeedback('idle');
  setGamePin(null);
  setNotFoundError(false);
  inputRef.current?.focus();
};
```

**Razorpay revenue row (Analytics)**:
```typescript
const razorpayRevenue = paidOrders.filter(o => o.payment_method === 'razorpay').reduce(...)
// Add to revenue method list:
{ label: 'Razorpay', value: razorpayRevenue, color: 'text-primary' },
```
