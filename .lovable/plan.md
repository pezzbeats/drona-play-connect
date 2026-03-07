

## The Exact Problem

The user wants a two-phase model for each ball:

```
PHASE 1: Window OPEN → Players submit guesses (admin can see guesses coming in)
PHASE 2: Admin clicks "Lock Window" → Window status: open → locked
         ↳ Customers: UI freezes, no more submissions accepted
         ↳ Admin: Can now see the "Record Ball" form and record what happened
PHASE 3: Admin records delivery → Ball result stored in DB
PHASE 4: Admin resolves window → Points distributed
```

**The current broken behavior:** The admin sees the "Record Ball" form at all times (it's not gated behind window lock). The `record-delivery` edge function auto-locks open windows before inserting, but **the UI doesn't enforce or communicate the two-phase flow to admins**. There's no visual separation between "prediction phase" and "delivery recording phase".

**The second problem (critical):** Looking at the current `record-delivery` edge function (lines 59-70), it already auto-locks open windows before recording. This backend protection already exists. BUT the `submit-prediction` edge function only checks `window.status !== "open"` (line 89). So after the admin locks, customers can no longer submit. **This part already works server-side.**

**The real gap:** The admin Command tab shows the "🏏 Record Ball" button at all times, regardless of whether a prediction window is currently open or locked. Admin should ideally:
1. Not be able to (or be warned not to) record while a window is still `open`
2. Only be allowed to record freely once the window is `locked` OR there's no window

**Additionally:** The customer PredictionPanel shows `open` windows with interactive buttons. When a window is `locked`, it moves to `closedWindows` and shows as a locked card. **But the customer still sees the question — they just can't answer.** This is the correct behavior. It IS already working via realtime update.

## Root Cause Summary

1. **AdminControl Command tab**: The delivery form is always visible with no enforcement that the prediction window should be locked first. Admin could accidentally (or deliberately) record a ball while a window is still `open`.

2. **The backend auto-lock** in `record-delivery` handles this as a safety net, but the admin UX doesn't guide/enforce the correct workflow.

3. The customer UI correctly freezes when window goes to `locked` via realtime — this is already working.

## What to Build

### Change 1: AdminControl — Gate "Record Ball" behind prediction window status

In the Command tab, in the delivery form area, add an **inline warning banner** that appears when `activeWindow` (from state) has `status === 'open'`:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ Prediction window is OPEN — 47 guesses received       │
│    Lock the window before recording this ball            │
│    [Lock Window Now →]                                   │
└─────────────────────────────────────────────────────────┘
```

The "🏏 Record Ball" button should:
- Still be **enabled** (admin can always record — the backend auto-locks)
- But show a **amber/orange border + warning text** if window is still open
- After clicking, show a one-time confirm: "A prediction window is still open. Recording will auto-lock it. Continue?"

This is NOT blocking — it's a guard rail. The backend enforces anyway.

### Change 2: Pass `activeWindow` state from AdminControl parent down to the delivery form area

The `activeWindow` state already exists in `AdminControl`. The Command tab just needs to read it and render the inline banner. No new data fetching needed — it's already subscribed via realtime.

### Change 3: AdminControl — Lock Window shortcut in Command tab

Add a compact "Lock Window" button directly in the Command tab (near the Record Ball form) as a quick action when `activeWindow?.status === 'open'`. This avoids the admin needing to switch to the Predict tab to lock.

### Change 4: `submit-prediction` edge function — ensure window match_id matches user's game_access match_id

Currently the function checks `window.status !== "open"` but doesn't verify the window belongs to the same match as the user's game_access. Add this cross-check for extra security:

```typescript
if (window.match_id !== access.match_id) {
  return 400 MATCH_MISMATCH
}
```

### No schema changes needed.

## Files to Change

| File | Change |
|------|--------|
| `src/pages/admin/AdminControl.tsx` | Add inline "window open" warning banner + Lock shortcut in Command tab delivery form area |
| `supabase/functions/submit-prediction/index.ts` | Add `window.match_id !== access.match_id` cross-check |

## Precise Implementation

### AdminControl.tsx — Command tab delivery form (around line 756-935)

**Before the delivery form div** (where "Ball X of 6" heading is), insert:

```tsx
{/* Prediction window status guard */}
{activeWindow && (
  <div className="rounded-xl border border-warning/50 bg-warning/8 p-3 space-y-2">
    <div className="flex items-center gap-2 text-warning text-xs font-semibold">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      Prediction window OPEN — lock before recording ball
    </div>
    <PredictionCountBadge windowId={activeWindow.id} matchId={match.id} />
    <GlassButton
      variant="ghost" size="sm"
      loading={actionLoading === 'lock-window-cmd'}
      onClick={() => callFunction('resolve-prediction-window', 
        { action: 'lock', window_id: activeWindow.id }, 
        'lock-window-cmd'
      )}
    >
      <Lock className="h-3.5 w-3.5" /> Lock Window Now
    </GlassButton>
  </div>
)}
```

**The "🏏 Record Ball" button** gets a conditional border color:
```tsx
className={`w-full ... ${activeWindow ? 'border-warning/60' : ''}`}
```

No confirmation dialog needed — the auto-lock in the edge function is the actual enforcement. The UI guidance is sufficient.

### submit-prediction/index.ts — Add match cross-check (after line 80)

After fetching the `window`, add:
```typescript
if (window.match_id !== access.match_id) {
  return new Response(JSON.stringify({ error: "Invalid prediction window for your session.", code: "MATCH_MISMATCH", retryable: false }), {
    status: 400, ...
  });
}
```

This prevents any hypothetical abuse where someone manually crafts a request with a window_id from a different match.

