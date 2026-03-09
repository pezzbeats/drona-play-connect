
## Plan: Make Coupon Subtitle Editable via Site Config

### What we're adding
A new `site_config` key `coupon_event_subtitle` (e.g. `"T20 World Cup Final · India vs New Zealand"`) that drives all the hardcoded event name text on the coupon PNG, the WhatsApp message, and the page header — so it can be updated for future events without code changes.

---

### All hardcoded strings to replace

| Location | Current hardcoded text | Replaced by |
|---|---|---|
| `drawToCanvas` line 128 | `'T20 World Cup Final  ·  India vs New Zealand'` | `subtitleText` param |
| `drawToCanvas` line 286 | `'As a valued guest who attended the T20 World Cup Final Night'` | `'As a valued guest who attended the ' + eventNightLabel` |
| `whatsappText` lines 483-484 | `'India won the T20 World Cup Final vs New Zealand 🎉'` | built from subtitle |
| Page header line 521 | `'T20 World Cup Final — India 🏆 vs New Zealand'` | `subtitleText` from config |

---

### Changes

**1. `AdminSiteConfig.tsx`** — Add a new `coupon` section (or add fields to the existing `registration` section):

Add a dedicated **"Victory Coupons"** section with:
- `coupon_event_subtitle` — "Coupon Subtitle Line" (e.g. `T20 World Cup Final · India vs New Zealand`)
- `coupon_event_night_label` — "Footer 'attended the ___' label" (e.g. `T20 World Cup Final Night`) — this is the footer strip sentence

This keeps coupons self-contained and makes both editable strings discoverable together.

**2. `AdminCoupons.tsx`**:
- Import `useSiteConfig` hook
- Read `coupon_event_subtitle` with fallback `'T20 World Cup Final  ·  India vs New Zealand'`
- Read `coupon_event_night_label` with fallback `'T20 World Cup Final Night'`
- Pass `subtitleText` as a new param to `drawToCanvas` and `buildCouponCanvas`
- Replace canvas line 128, footer line 286, WhatsApp message, and page header subtitle with the config values

**`drawToCanvas` signature update:**
```ts
async function drawToCanvas(
  canvas, row, discountText, code, logoImg, expiryStr,
  subtitleText, eventNightLabel  // ← new params
)
```

**Fallback chain**: `useSiteConfig.get('coupon_event_subtitle', 'T20 World Cup Final  ·  India vs New Zealand')` — so if not set in DB the coupon still renders correctly.

---

### Files to edit

| File | Change |
|---|---|
| `src/pages/admin/AdminSiteConfig.tsx` | Add new "Victory Coupons" section with 2 fields |
| `src/pages/admin/AdminCoupons.tsx` | Wire `useSiteConfig`, pass subtitle/night-label through canvas draw, replace all 4 hardcoded strings |

No DB migration needed — `site_config` is a key/value store, new keys are inserted on first save.
