
## Feature: T20 World Cup Victory Coupon Generator

### What we're building
A new admin page at `/admin/coupons` — a self-contained "Victory Coupon" tool. Admin uploads a CSV of attendees (name + mobile), the system generates individual branded PNG discount coupons for each person, and admin can download them one-by-one or send via WhatsApp deep link.

---

### How it works end-to-end

```
Admin uploads CSV (name, mobile)
      ↓
Preview table shows parsed rows
      ↓
For each row: generate PNG coupon on Canvas (in-browser)
      ↓
Per row: [Download PNG] | [Send via WhatsApp] (opens wa.me deep link with image sharing)
```

All canvas rendering is 100% client-side — no backend, no API calls, no storage needed.

---

### Coupon PNG Design (Canvas, 750×950px @2x)

**Transparent background** (no fill on root canvas, transparent PNG export)

Layout (top to bottom):
1. **Header zone** — subtle dark card bg with golden border glow  
   - T20 World Cup trophy icon (unicode 🏆 rendered large)  
   - "INDIA WON!" in Cinzel font (loaded via FontFace API from Google Fonts)  
   - "T20 World Cup Final · India vs New Zealand"  
2. **Personalization strip** — "Congratulations, [NAME]!"  
3. **Coupon body** — Large discount amount centered with golden gradient text  
   - A unique coupon code (generated as `WC25-[MOBILE_LAST4]-[RANDOM4]`)
   - "Valid on your next visit to Hotel Drona Palace"  
   - Expiry note  
4. **Logo zone** — The uploaded logo (amber infinity mark) + "Hotel Drona Palace" + "(A UNIT OF SR LEISURE INN)" in Cinzel  
5. **Footer** — "Present this coupon at the hotel reception"

**Color palette:** Black/dark card bg, gold gradients (`hsl(38,95%,65%)` to `hsl(38,70%,45%)`), white text for names, amber accents — matching existing brand.

**Font:** Cinzel loaded dynamically via `FontFace` API (Google Fonts CDN) for the key headers. Falls back to `Georgia, serif` if font load fails.

---

### New file: `src/pages/admin/AdminCoupons.tsx`

Key sections:
1. **CSV upload + template download** — same pattern as `AdminEligibility.tsx`  
   Template: `name,mobile`  
   Parse: strip non-digits from mobile, validate 10-digit
2. **Preview table** — shows parsed rows with valid/invalid badge  
3. **Generate all** button — calls `buildCouponCanvas(row)` for each row, stores `{row, blob}` in state  
4. **Per-row actions** in results table:
   - **Download** — `URL.createObjectURL(blob)` → `<a>.click()`  
   - **WhatsApp** — builds `wa.me/91{mobile}?text=...` deep link with a pre-filled message including name + discount details. Since WhatsApp Web can't receive files via URL params, the flow is: open wa.me with pre-written text (name, discount code, redemption note), and separately also trigger the download so admin can manually attach. An alternative "Share" button uses `navigator.share({ files: [File] })` when available (mobile/Android Chrome).
5. **Download all** — sequential download of all generated PNGs

### Coupon code generation
```ts
const code = `WC25-${mobile.slice(-4)}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
```
Unique per row, no DB storage needed (purely cosmetic coupon code on the image).

### Font loading
```ts
const cinzel = new FontFace('Cinzel', 'url(https://fonts.gstatic.com/s/cinzel/...)');
await cinzel.load();
document.fonts.add(cinzel);
```
Called once when the component mounts, stored in a ref. Canvas `ctx.font = '700 52px Cinzel, Georgia, serif'` will use it.

### WhatsApp message text (pre-filled)
```
🏆 Congratulations, [NAME]!

India won the T20 World Cup Final vs New Zealand 🎉

As a valued guest of Hotel Drona Palace who attended the Final Night,
we're delighted to offer you an exclusive discount on your next visit.

🎟️ Your Coupon Code: WC25-XXXX-XXXX
💰 Discount: [AMOUNT] off

Valid for redemption at Hotel Drona Palace.
Present this coupon at the hotel reception.

— Hotel Drona Palace
(A Unit of SR Leisure Inn)
```

### Navigation additions
- Add `Gift` icon + "Victory Coupons" to `AdminSidebar.tsx` (minRole: `operator`)
- Add same to `AdminBottomNav.tsx`
- Add route in `App.tsx`: `/admin/coupons` → `AdminCoupons` (operator-protected)

### Logo asset
The uploaded logo (user-uploads://04C4B374-6ED6-47E7-A0B2-D874943655F6.png) is copied to `src/assets/drona-logo-coupon.png` and imported in `AdminCoupons.tsx`. It is used in the canvas `drawImage()` call for the footer logo zone.

### Discount value
The admin can configure the discount amount in a simple text input at the top of the page (e.g., "₹500 off", "20% off", "Complimentary Breakfast") — flexible text so it doesn't need to be a hardcoded number.

---

### Files to create/modify

| File | Action |
|---|---|
| `src/pages/admin/AdminCoupons.tsx` | **Create** — full coupon tool |
| `src/assets/drona-logo-coupon.png` | **Copy** from uploaded file |
| `src/App.tsx` | Add `/admin/coupons` route |
| `src/components/admin/AdminSidebar.tsx` | Add "Victory Coupons" nav item |
| `src/components/admin/AdminBottomNav.tsx` | Add to overflow nav items |

No database changes. No edge functions. No secrets needed. Entirely client-side.
