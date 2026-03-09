
## Plan: Quick Single-Entry Coupon Form

### What to add
A new "Quick Add" GlassCard section placed **between the Coupon Settings card and the CSV Upload card**. This gives the admin a fast path to generate and send a coupon for a single person — no CSV needed.

### UI
```text
┌─ Quick Add — Single Coupon ─────────────────────────────────────┐
│  Name: [__________]   Mobile: [__________]                       │
│  [🚀 Generate & Send via WhatsApp]  (full-width green button)    │
│                                                                   │
│  (after success: shows mini coupon thumbnail + code inline)      │
│  [Send Another] clears form ready for next person                │
└─────────────────────────────────────────────────────────────────┘
```

### New state variables
- `singleName: string`
- `singleMobile: string`
- `singleGenerating: boolean`
- `lastSingle: GeneratedCoupon | null` — the most recently generated single coupon, shown as inline preview

### New function: `generateAndSendSingle()`
```ts
async function generateAndSendSingle() {
  // 1. Validate
  if (!singleName.trim()) → toast error
  if (!/^\d{10}$/.test(singleMobile)) → toast error
  // 2. Generate code + PNG
  const code = generateCode(singleMobile);
  const blob = await buildCouponCanvas(row, discountText, code, ...);
  // 3. Save to DB (same as batch)
  await supabase.from('coupons').insert({ code, customer_name, ... });
  // 4. Trigger download + open WhatsApp (reuses existing sendViaWhatsAppBrowser)
  await sendViaWhatsAppBrowser(singleMobile, blob, filename, encodedText);
  // 5. Show inline preview, keep settings, clear name+mobile
  setLastSingle({ row, code, blob, objectUrl });
  setSingleName(''); setSingleMobile('');
  fetchDbCoupons(); // refresh table
}
```

### "Send Another" flow
After success, an inline preview card shows the last coupon with a "Send Another" button that simply focuses the Name field — the form is already cleared.

### Files changed
- `src/pages/admin/AdminCoupons.tsx` only — add ~80 lines for the new card + state + function
