
## Fix: Hide "My Passes" when match is ended

**Problem**: Line 803 condition is `{match && ...}` — this shows "My Passes" whenever any match object exists, including ended ones. Since the match is ended but still exists in DB, the button still renders.

**Fix**: Change the condition to `{match && match.status !== 'ended' && ...}` so "My Passes" only shows for upcoming/live matches.

**Single line change in `src/pages/Index.tsx` — line 803:**

```tsx
// Before:
{match && (

// After:
{match && match.status !== 'ended' && (
```

That's the only change needed. No layout shifts — when match is ended the bar will show just "🏆 Results" and "🎮 Play" (plus dismiss), consistent with the intent.
