
## Analysis

**Current state of AdminValidate.tsx:**
- Basic QR paste input (small, plain)
- Ticket info card with name/status shown after lookup
- Check-in button → PIN shown in a moderate-size box
- Payment collection form (dropdown + fields) — below the fold
- Admin controls (block/unblock/reissue) at the bottom
- No visual feedback color flash, no sound/vibration, no offline queue
- Layout is `max-w-lg` single column — usable but not optimized for speed at a real gate

**What the prompt asks:**
1. Large scan zone — bigger, more prominent input area
2. Instant color feedback (green flash = ok, red flash = error)
3. Vibration/sound cues on scan result
4. Critical info instantly visible: paid/unpaid badge + seats count + name + order summary
5. Quick payment buttons: Cash / UPI / Card — one-tap instead of a dropdown
6. Reference capture required for non-cash (already exists, keep it)
7. After check-in: PIN displayed large + prominent, copy WhatsApp button, regenerate PIN
8. Offline resilience: queue scans locally, sync when back online

**Key decisions:**

**Scan zone:** Make the QR input area a large centered input with auto-focus on page load. Input auto-submits on paste (via `onPaste` → trigger lookup immediately). Use `onChange` debounce for typed input but instant on paste.

**Color flash feedback:** Add a `scanState` enum: `idle | loading | success | error | mismatch | blocked`. Drive a full-screen color overlay for ~1.5s. Uses CSS class transitions already in the design system.

**Vibration:** `navigator.vibrate()` — 1 pulse for success, 3 pulses for error. Browser API, no deps needed.

**Sound:** Simple Web Audio API beep generated programmatically (no audio files needed):
- Success: two ascending tones
- Error: single low-frequency buzz
This avoids needing to host audio files.

**Instant info display:** Reorganize the result card to show the most critical info FIRST and in large type:
- Name (large)
- Paid/Unpaid status badge (very prominent, colored)  
- Seats count
- Match name
Then secondary info below.

**Quick payment buttons:** Replace the dropdown with 3 side-by-side colored buttons: `Cash`, `UPI`, `Card`. Clicking one opens an inline mini-form (just amount + reference if non-cash). This is faster than a dropdown at a gate.

**PIN display:** Make the PIN take up the full card width in a massive font size after check-in. Already uses `text-4xl tracking-[0.3em]` — increase to `text-6xl` and make the card glow green.

**Offline resilience:** 
- Use `navigator.onLine` + listen to `online`/`offline` events
- When offline, push scan actions (lookup + check-in) to `localStorage` queue (`offlineScanQueue`)
- When back online, process the queue in order
- Show a yellow banner when offline
- For scan lookups when offline: show a "queued — will sync when online" state
- For check-ins when offline: this is a hard call — we cannot safely do offline check-ins (risk of double check-in). Instead, queue the check-in and sync when online.

**admin-gate-collect edge function:** Needs to add HMAC-signed QR generation (like the other functions after prompt 3). Currently uses plain QR format. Update to use `generateSignedQr()`.

**Files to change:**
- `src/pages/admin/AdminValidate.tsx` — full rewrite of the UI
- `supabase/functions/admin-gate-collect/index.ts` — add HMAC QR signing for generated tickets

**No DB changes needed** — all existing columns/tables are sufficient.

---

## Plan

### File 1: `src/pages/admin/AdminValidate.tsx` — full UI overhaul

**Scan zone:**
- Large card with auto-focus input on mount (`useRef` + `useEffect` auto-focus)
- Auto-submit on paste via `onPaste` handler (fires `lookupTicket` after 50ms)
- Auto-submit on Enter key (already exists, keep)
- Large `text-lg` monospaced font in the input
- The entire top card is the scan zone

**Scan feedback states:**
```
scanFeedback: 'idle' | 'loading' | 'success' | 'error' | 'mismatch' | 'blocked'
```
- Map to card border color + brief flash overlay: success = green tint, error = red tint
- Flash lasts 1200ms via `setTimeout` + CSS transition
- `useEffect` on `scanFeedback` → trigger vibrate + beep

**Vibration:**
```js
const vibrate = (pattern: number[]) => navigator.vibrate?.(pattern);
// success: vibrate([100])
// error: vibrate([100, 50, 100, 50, 100])
```

**Sound (Web Audio API):**
```js
function playBeep(type: 'success' | 'error') {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.frequency.value = type === 'success' ? 880 : 220;
  gain.gain.value = 0.3;
  osc.start(); osc.stop(ctx.currentTime + (type === 'success' ? 0.15 : 0.3));
}
```

**Result card — new layout priority order:**
1. Large name + mobile
2. HUGE payment status badge (colored)
3. Seats count + match name
4. Ticket status

**Quick payment buttons (replacing dropdown):**
```
[ 💵 Cash ]  [ 📱 UPI ]  [ 💳 Card ]
```
Selected method highlights in the button style. When UPI or Card selected, show reference field. Amount field always shown.

**PIN display after check-in:**
- Full-width card with green glow
- PIN in `text-7xl font-bold tracking-[0.5em]`
- "Copy WhatsApp Message" as a large green button
- "Regenerate PIN" as secondary

**Offline resilience:**
```typescript
const [isOnline, setIsOnline] = useState(navigator.onLine);
const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>(() => {
  try { return JSON.parse(localStorage.getItem('gate_offline_queue') || '[]'); }
  catch { return []; }
});

useEffect(() => {
  const onOnline = () => { setIsOnline(true); processOfflineQueue(); };
  const onOffline = () => setIsOnline(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
}, []);
```
- Offline banner: yellow sticky strip at top: "⚠️ Offline — {n} actions queued"
- When offline and admin tries to check in: show warning + allow queueing
- When back online: auto-process queue + show toast "Synced {n} queued actions"
- Queue stored in `localStorage` with `{ action: 'checkin', ticket_id, admin_id, qr_text, timestamp }`

### File 2: `supabase/functions/admin-gate-collect/index.ts`

Update ticket generation to use HMAC-signed QR format (same helper function as `create-order` and `verify-payment-proof`). This ensures tickets created at the gate also have tamper-evident QR codes.

```typescript
async function generateSignedQr(matchId: string, mobile: string, seatNo: number, orderId: string, secret: string): Promise<string> {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts = Date.now();
  const payload = `T20FN-${matchId.slice(0, 8)}-${mobile}-S${seatNo}-${ts}-${rand}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16).toUpperCase();
  return `${payload}-SIG:${sigHex}`;
}
```

---

## What's NOT changing
- Visual design system (GlassCard/GlassButton/colors) — only layout/size changes
- Backend edge functions logic (only QR signing update in admin-gate-collect)
- Check-in RPC / admin-checkin function
- Block/Unblock/Reissue logic (already working from prompt 3)
- DB schema (no new tables/columns needed)

## Summary table

| Feature | Implementation |
|---|---|
| Large scan zone | Full-width card, large font input, auto-focus on mount |
| Auto-submit on paste | `onPaste` → 50ms delay → lookupTicket |
| Color flash feedback | `scanFeedback` state → border + background tint, 1200ms timeout |
| Vibration | `navigator.vibrate()` — 1 pulse success, 3 pulses error |
| Sound cue | Web Audio API programmatic beep, no audio files |
| Critical info first | Name + payment badge + seats shown in priority order |
| Quick payment buttons | 3-button row (Cash/UPI/Card), reference field conditional |
| PIN display large | `text-7xl tracking-[0.5em]` in full-width glowing green card |
| WhatsApp copy | Already works, promote to primary button |
| Offline banner | `navigator.onLine` + event listeners, yellow strip |
| Offline queue | `localStorage` queue, auto-sync on reconnect |
| HMAC QR in gate-collect | Updated `admin-gate-collect` with `generateSignedQr()` |
