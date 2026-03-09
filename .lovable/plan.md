
## Plan: Session Redemption History Panel

### What to build
Add a `sessionHistory` state array (max 10 items, in-memory only — clears on page refresh) that captures each successful redemption. Render it as a card at the bottom of the page, below the loading states.

### Type to add
```typescript
interface RedemptionHistoryEntry {
  id: string;           // coupon id (for key)
  code: string;
  customer_name: string;
  customer_mobile: string;
  discount_text: string;
  redeemed_at: string;  // ISO timestamp captured at moment of success
}
```

### Changes — single file: `src/pages/admin/AdminCouponScan.tsx`

1. **Add import**: `History` icon from `lucide-react`

2. **Add state** (line ~58, after `coupon` state):
   ```typescript
   const [sessionHistory, setSessionHistory] = useState<RedemptionHistoryEntry[]>([]);
   ```

3. **Populate on success** (inside `redeemCoupon`, after `setLookupState('redeemed_success')`):
   ```typescript
   setSessionHistory(prev => [{
     id: coupon.id, code: coupon.code,
     customer_name: coupon.customer_name,
     customer_mobile: coupon.customer_mobile,
     discount_text: coupon.discount_text,
     redeemed_at: new Date().toISOString(),
   }, ...prev].slice(0, 10));
   ```

4. **Render panel** (after the `redeeming` loading card, before the closing `</div>`):
   - Only shows when `sessionHistory.length > 0`
   - Header: "Session History" with `History` icon + green badge showing count
   - Each row: index number (newest = #1), customer name + mobile, coupon code in mono font, discount text as amber badge, timestamp formatted as `h:mm a`
   - Subtle `border-green-500/20` left border on each row for visual scan
   - "Clears on page refresh" note at the bottom in muted xs text
