
## What needs to change

The current "Coupon Settings" section is a single free-text input (`₹500 Off`). The user wants a proper discount configurator with:

1. **Discount type toggle** — "Flat (₹)" or "Percentage (%)"
2. **Amount input** — number field that changes its prefix/suffix based on type
3. **Save settings** — persists to `localStorage` so the chosen discount survives page refreshes
4. **Live preview** of the computed discount string (e.g. "₹500 Off" or "20% Off") before generating
5. **The generated coupon PNG** must use the saved/computed discount string — which already flows through `discountText` into `buildCouponCanvas`

### State changes in `AdminCoupons.tsx`

Replace:
```ts
const [discountText, setDiscountText] = useState('₹500 Off');
```

With:
```ts
type DiscountType = 'flat' | 'percent';
const [discountType, setDiscountType] = useState<DiscountType>('flat');
const [discountValue, setDiscountValue] = useState('500');
// derived:
const discountText = discountType === 'flat' ? `₹${discountValue} Off` : `${discountValue}% Off`;
```

Loaded from + saved to `localStorage` key `drona_coupon_discount`.

### UI changes — Coupon Settings card

Replace the single free-text input with:

```
[ Flat ₹ ] [ Percentage % ]   ← toggle buttons (like a segmented control)

Amount: [ 500 ] (number input, min 1)

Preview: "₹500 Off"  ← live derived string shown as a badge

[ Save Settings ]  ← persists to localStorage, shows a toast
```

The `discountText` derived value (not a raw text input anymore) flows into `buildCouponCanvas` exactly as before — no canvas changes needed.

### Files to edit

| File | Change |
|---|---|
| `src/pages/admin/AdminCoupons.tsx` | Replace discount settings UI section + state |

No DB, no edge function, no other files needed.
