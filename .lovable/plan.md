
## Fix: WhatsApp Deep Link Opens Specific Contact Directly

### Problem
Two issues in `src/pages/admin/AdminCoupons.tsx`:

1. **Generated coupons section** (fresh batch): The WhatsApp button calls `shareOne()` which **first tries `navigator.share`** — on mobile this opens the generic OS share sheet, not WhatsApp directly. Only if `navigator.share` fails does it fall through to `wa.me`. The `navigator.share` path never opens the specific contact number.

2. **"All Coupons" management table**: Has **no WhatsApp button at all** — zero action column. Admin can't send to existing coupon holders from this table.

### Fix

**1. Split the WhatsApp button from the generic share button** in the generated coupons card (lines 814–829):
- Keep the `Share2` icon button for `navigator.share` (generic share)  
- Make the green **WhatsApp button always go directly to `wa.me/91{mobile}?text={message}`** — no `navigator.share` interception
- This guarantees it opens the contact chat in WhatsApp immediately

**2. Add a WhatsApp action column to the management table** (after line 906 for the `<th>` and after line 944 for the `<td>`):
- Add an "Actions" column header
- In each row, add a green WhatsApp button that opens `https://wa.me/91{c.customer_mobile}?text={encodedMessage}` using the coupon's stored data (name, code, discount_text)
- The pre-filled message uses the coupon code, discount, and a standard greeting

### New `whatsappDirect` helper (replaces `shareOne` for WA):
```ts
const openWhatsApp = (mobile: string, encodedText: string) => {
  window.open(`https://wa.me/91${mobile}?text=${encodedText}`, '_blank');
};
```

### Management table WhatsApp message helper:
```ts
const dbCouponWhatsappText = (c: DbCoupon) =>
  encodeURIComponent(
    `🏆 Congratulations, ${c.customer_name}!\n\n` +
    `Your exclusive Victory Coupon from Hotel Drona Palace:\n\n` +
    `🎟️ Code: ${c.code}\n💰 ${c.discount_text}\n` +
    (c.expiry_date ? `📅 Valid until: ${new Date(c.expiry_date).toLocaleDateString('en-IN')}\n` : '') +
    `\nPresent at hotel reception to redeem.\n— Hotel Drona Palace\ncricket.dronapalace.com`
  );
```

### Files changed
- `src/pages/admin/AdminCoupons.tsx` only
