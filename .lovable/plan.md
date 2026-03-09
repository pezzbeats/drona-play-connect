
## Root Cause & Fix: Share PNG Coupon via WhatsApp

### Problem
Currently both buttons work text-only:
- **Generated coupons "WhatsApp" button** (line 829): calls `openWhatsApp()` → `wa.me` URL → text only
- **All Coupons table "Send" button** (line 958): also calls `openWhatsApp()` → `wa.me` URL → text only
- The `shareOne()` function (lines 559–570) does use `navigator.share({ files })` correctly but only shares the image with no text, and is hidden behind a separate `Share2` icon button

The **only browser-compatible way** to send a PNG to WhatsApp is `navigator.share({ files: [pngFile], text: message })` — this opens the OS native share sheet where the user picks WhatsApp, and the image + message land in the chat together. The `wa.me` URL scheme is permanently text-only.

### Two-button strategy (best UX)
For each coupon, expose **two distinct actions**:
1. **"Share Image" button** — `navigator.share({ files: [png], text: message })` — sends PNG + pre-filled text via OS share sheet (user picks WhatsApp). Works on Android Chrome & iOS Safari.
2. **"Open Chat" link** — `wa.me/91{mobile}` — opens the specific contact in WhatsApp directly (no image, but instant contact open for follow-up).

This is needed because `navigator.share` cannot pre-select a contact, and `wa.me` cannot attach a file. Both are needed together.

### Changes to `src/pages/admin/AdminCoupons.tsx`

**1. Fix `shareOne()` — add text to the share call (line 564)**
```ts
// Before:
await navigator.share({ files: [file], title: `Victory Coupon for ${coupon.row.name}` });
// After:
await navigator.share({ files: [file], text: decodeURIComponent(whatsappText(coupon)), title: `Victory Coupon for ${coupon.row.name}` });
```

**2. Replace generated coupons action buttons (lines 823–839)**
Replace the current 3-button layout (Download / WhatsApp / Share2) with:
- **Download** (unchanged)
- **"📤 Share on WhatsApp"** — calls updated `shareOne(c)` which does `navigator.share({ files, text })`. Falls back to `downloadOne(c)` if not supported.
- **"Open Chat ↗"** (small secondary) — calls `openWhatsApp(c.row.mobile, whatsappText(c))` — opens the direct contact

**3. Add `[sharingId, setSharingId]` state + `regenerateAndShare()` for the All Coupons table**

```ts
const [sharingId, setSharingId] = useState<string | null>(null);

const regenerateAndShare = async (c: DbCoupon) => {
  if (!logoRef.current) { toast({ title: 'Logo not loaded', variant: 'destructive' }); return; }
  setSharingId(c.id);
  try {
    const attendeeRow: AttendeeRow = { name: c.customer_name, mobile: c.customer_mobile, valid: true };
    const expiryForCanvas = c.expiry_date ? format(new Date(c.expiry_date), 'dd/MM/yyyy') : '';
    const blob = await buildCouponCanvas(attendeeRow, c.discount_text, c.code, logoRef.current, expiryForCanvas, subtitleText, eventNightLabel, winHeadline);
    const file = new File([blob], `${c.code}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: decodeURIComponent(dbCouponWhatsappText(c)), title: `Victory Coupon – ${c.customer_name}` });
    } else {
      // Desktop fallback: download the PNG + open WhatsApp text
      downloadOne({ row: attendeeRow, code: c.code, blob, objectUrl: URL.createObjectURL(blob) });
      openWhatsApp(c.customer_mobile, dbCouponWhatsappText(c));
    }
  } catch { /* user cancelled share */ }
  finally { setSharingId(null); }
};
```

**4. Replace All Coupons table "Send" button (lines 956–965)** with two buttons:
- **"📤 Share Image"** — calls `regenerateAndShare(c)` — shows spinner when `sharingId === c.id`
- **"↗"** small icon button — calls `openWhatsApp(c.customer_mobile, dbCouponWhatsappText(c))` to open the contact chat

### Files changed
- `src/pages/admin/AdminCoupons.tsx` only

> **Note**: `navigator.share({ files })` only works on **Android Chrome** and **iOS Safari**. On desktop browsers it falls back to download + text-only WA link. This is a platform limitation, not a code limitation.
