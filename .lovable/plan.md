
## Improve WhatsApp Share Toast UX

Single change: update the `toast` call inside `sendViaWhatsAppBrowser` (lines 568–573 of `src/pages/admin/AdminCoupons.tsx`) to show a richer notification with:
- The exact filename so the admin knows what to look for in Downloads
- A numbered 3-step guide as the description

### Current (lines 569–573)
```ts
toast({
  title: '📥 Coupon PNG downloaded!',
  description: 'Click the 📎 paperclip in WhatsApp to attach and send the image.',
  duration: 8000,
});
```

### Replacement
```ts
toast({
  title: `📥 "${filename}" saved to Downloads`,
  description: '1️⃣ Image downloaded  →  2️⃣ WhatsApp chat opened  →  3️⃣ Click 📎 in WhatsApp, find the file and send.',
  duration: 10000,
});
```

The `filename` variable is already in scope (parameter of `sendViaWhatsAppBrowser`), so no new state or imports are needed.

### File changed
- `src/pages/admin/AdminCoupons.tsx` — lines 569–573 only
