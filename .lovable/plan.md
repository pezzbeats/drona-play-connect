
## The Real Problem: WhatsApp Cannot Receive Images Programmatically from a Browser

### Root cause — why nothing has worked so far

WhatsApp has a hard platform limitation:
- `wa.me` URL scheme → text only, no file attachment possible
- `web.whatsapp.com/send?phone=...` → opens chat with text, but **cannot inject an image via URL or clipboard** — WhatsApp Web explicitly blocks programmatic clipboard injection
- `navigator.share({ files })` → works on mobile via OS share sheet, but user said "do it directly through browser"
- Clipboard API → the image is copied to clipboard, but WhatsApp Web ignores it and does not auto-paste on focus

**The clipboard.write() approach currently in the code is silently failing or being ignored by WhatsApp Web entirely.** There is no browser API that forces WhatsApp Web to attach a file.

### What IS actually achievable in a browser

The only reliable browser-side workflow for sending both text AND image to WhatsApp is:

1. **Auto-download the PNG** (guaranteed to work, no permission needed)
2. **Open WhatsApp Web with the specific contact + pre-filled text**
3. **Show a clear in-app instruction toast** telling the admin: "PNG saved to downloads — click the 📎 paperclip in WhatsApp to attach it"

This workflow requires exactly 2 extra clicks from the admin (click paperclip → select the downloaded file) and is completely reliable. The current clipboard approach requires the same manual step but is less reliable and confusing.

### Changes to `src/pages/admin/AdminCoupons.tsx`

**Replace `sendViaWhatsAppBrowser`** — remove all clipboard logic entirely. New logic:

```ts
const sendViaWhatsAppBrowser = async (mobile: string, blob: Blob, filename: string, encodedText: string) => {
  // 1. Auto-download the PNG
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);

  // 2. Open WhatsApp Web with specific contact + text
  window.open(`https://web.whatsapp.com/send?phone=91${mobile}&text=${encodedText}`, '_blank');

  // 3. Clear instruction toast
  toast({
    title: '📥 Coupon PNG downloaded!',
    description: 'Click the 📎 paperclip in WhatsApp to attach and send the image.',
    duration: 8000,
  });
};
```

**Update callers:**
- `shareOne(coupon)`: pass `WC25-${coupon.row.name}-${coupon.code}.png` as filename
- `regenerateAndShare(c)`: pass `WC25-${c.customer_name}-${c.code}.png` as filename

**Update button labels** to reflect the new workflow:
- "Share Image" button tooltip: "Downloads PNG + opens WhatsApp chat"

No other changes needed. The rest of the UI (button layout, table actions) stays the same.

### Why this is the correct and honest fix

There is no browser API that attaches a file to WhatsApp directly — this is a WhatsApp security boundary. The download + open chat workflow is the standard method used by every WhatsApp marketing tool that operates in-browser. The admin does one extra tap (paperclip → file) which is unavoidable.

### Files changed
- `src/pages/admin/AdminCoupons.tsx` only — remove clipboard logic, add auto-download, update toast message
