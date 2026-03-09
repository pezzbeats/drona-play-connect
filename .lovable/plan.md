
## Fix: Hide "View Your Match Passes" and "Already Checked In?" when match is ended

**Root cause**: The old T20 World Cup match record has `is_active_for_registration = true` AND `status = ended`. The code still fetches it, so:
- The "View Your Match Passes" CTA renders because `match.status === 'ended'` is truthy
- The `GameLoginCard` component renders unconditionally — no match/status check at all

**Fix in `src/pages/Index.tsx` — two changes:**

### 1. Hide "View Your Match Passes" CTA for ended matches (lines 528–557)
The entire primary CTA block is inside `match && (...)`. For ended matches, instead of showing the "View Your Match Passes" button, just show nothing (or only the Results button without the passes button — the user's image confirms both should be gone). Since the IPL teaser is now the focus, **remove** the ended-match CTA block entirely, so that section is only shown for non-ended active matches.

```tsx
// Before:
{match.status === 'ended' ? (
  <>  <-- shows View Passes + See Results
  </>
) : (
  <>  <-- shows Reserve + Already Booked
  </>
)}

// After:
{match.status !== 'ended' && (
  <>  <-- only shows Reserve + Already Booked when match is upcoming/live
  </>
)}
```

### 2. Hide `GameLoginCard` when match is ended (line 560)
Wrap the `<GameLoginCard />` call so it only renders when match exists AND status is not ended:

```tsx
// Before:
<GameLoginCard />

// After:
{match && match.status !== 'ended' && <GameLoginCard />}
```

**Result**:
- Ended match → both "View Your Match Passes" CTA and "Already Checked In?" card are hidden
- Active match (upcoming/live) → both show as normal
- No match → both hidden (no match object)

**File changed**: `src/pages/Index.tsx` only
