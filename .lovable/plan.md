
## What Needs to Change

Currently in `AdminControl.tsx`, when a prediction window is open (`activeWindow` is not null):
- A warning box shows "lock it before recording" 
- But "Record Ball" is still **fully clickable** with a label "Record Ball (will auto-lock)"
- The `record-delivery` edge function will auto-lock as a backend safety net, but the admin UI allows bypassing the lock step

### The Required Change: Hard Block on "Record Ball"

The delivery form's "Record Ball" button (lines ~1031-1039) must be **disabled** when `activeWindow` is present. The admin must explicitly hit "Lock Window Now" before the record button becomes active.

### Changes to `src/pages/admin/AdminControl.tsx`

**1. Disable the Record Ball button when window is open**

Change the button at ~line 1032-1039:
```tsx
// BEFORE
<GlassButton
  variant="primary" size="md"
  className={`w-full transition-all ${activeWindow ? 'border-2 border-warning/60' : ''}`}
  loading={actionLoading === 'record-delivery'}
  onClick={handleRecordDelivery}
>
  🏏 {activeWindow ? 'Record Ball (will auto-lock)' : 'Record Ball'}
</GlassButton>
```

```tsx
// AFTER
<GlassButton
  variant="primary" size="md"
  className="w-full"
  loading={actionLoading === 'record-delivery'}
  onClick={handleRecordDelivery}
  disabled={!!activeWindow}
>
  🏏 Record Ball
</GlassButton>
```

**2. Update the warning box copy** (lines ~996-1028) to make it clear the record button is now blocked, not just a suggestion. Update the text from:
- "Recording will auto-lock if you proceed anyway." 
to:
- "You must lock the window before you can record this ball."

Also make the warning box visually stronger — change border/bg from `warning/8` hint to a more prominent blocker-style style.

**3. Also track "locked" windows** — the `activeWindow` state only tracks `open` status windows (line 167). But after lock, `activeWindow` becomes null, which is correct — the record button unblocks. However, we need to also show the locked window in the Command tab so admin knows to go resolve it after recording. Currently the Predict tab handles this. No change needed here — the flow works: lock → `activeWindow` becomes null → record button enabled.

### Summary of changes

| Location | What | Before | After |
|---|---|---|---|
| Line ~1032 | Record Ball button `disabled` | Never disabled | `disabled={!!activeWindow}` |
| Line ~1032 | Record Ball button label | "Record Ball (will auto-lock)" | "Record Ball" |
| Line ~1032 | Record Ball button className | Has warning border when open | Normal always |
| Line ~1003-1004 | Warning box body text | "Recording will auto-lock if you proceed anyway" | "You must lock the window before recording." |

**That's it.** No backend changes, no schema changes, no other files. The `record-delivery` edge function already auto-locks as a safety net — this just enforces it at the UI layer too. The lock-first, record-second ordering becomes the only possible path.

### Visual Flow After Change

```text
[Over active] 
    ↓
[Open Guesses button] → window opens → customers guess
    ↓
[Warning box with LOCK button — Record Ball greyed out]
    ↓  admin taps "Lock Window Now"
[window locked → activeWindow = null → Record Ball enabled]
    ↓  admin selects outcome + taps "Record Ball"
[delivery recorded]
    ↓
[Predict tab → resolve window → points awarded]
```
