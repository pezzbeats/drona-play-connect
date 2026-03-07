
## Problem Analysis

Two separate gaps allow prediction changes:

**1. Frontend (`PredictionPanel.tsx`) — two-step flow allows changing answer before submit**
- User clicks an option → `selectedAnswers[windowId]` is set
- User can click a *different* option → `selectedAnswers[windowId]` is overwritten
- Only after clicking "Lock My Guess" does it become permanent
- The fix: once a user taps any option, immediately auto-submit. No separate "Lock My Guess" button step. One tap = locked forever.

**2. Backend (`submit-prediction/index.ts`) — upsert allows overwriting**
- Line 108–120: Uses `.upsert(..., { onConflict: "window_id,mobile" })` which updates the existing row if one exists
- This means if a user somehow calls the function twice (race condition, network retry), their first answer gets silently replaced
- The fix: change to INSERT with a conflict check — if a prediction already exists for `window_id + mobile`, return an error instead of overwriting

## Changes

### `supabase/functions/submit-prediction/index.ts`
- Before the upsert, add a check: query `predictions` for an existing row where `window_id = window_id AND mobile = mobile`
- If found → return `{ error: "You have already locked in a guess for this question.", code: "ALREADY_SUBMITTED", retryable: false }` with HTTP 409
- Change the `.upsert()` to a plain `.insert()` — no more conflict update

### `src/components/live/PredictionPanel.tsx`

**Remove the two-step select → submit flow entirely:**

- Remove `selectedAnswers` state
- Remove the "Lock My Guess" `GlassButton` 
- When a user taps an option button, immediately call `handleSubmit(windowId, optKey)` inline
- While `submitting === windowId`, show all buttons as disabled with a spinner on the tapped option (use `submitting` + a `submittingKey` ref to know which button to spin)
- After successful submit, `submittedWindows[windowId]` is set — buttons stay disabled and the chosen one shows the checkmark as before
- On the button: show a small `Loader2` spinner instead of the label text while that specific option is being submitted

**Key UX flow after change:**
```
User taps option → button immediately shows spinner → 
  success → button shows ✓ checkmark, all options frozen
  error → toast shown, buttons re-enabled so user can try again
```

**State changes:**
- Remove: `selectedAnswers` state, `setSelectedAnswers`
- Add: `submittingKey` state `{ windowId: string; optKey: string } | null` to know which specific button to show spinner on
- Change `handleSubmit(windowId)` → `handleSubmit(windowId, optKey)`
- Keep: `submittedWindows`, `submitting`, all other existing state

**No database schema changes required.**

## Files Changed
| File | Change |
|------|--------|
| `supabase/functions/submit-prediction/index.ts` | Add pre-check for existing prediction, reject with 409 if already submitted; change upsert → insert |
| `src/components/live/PredictionPanel.tsx` | Remove two-step flow; tap-to-submit immediately; show per-button spinner; handle 409 gracefully |
