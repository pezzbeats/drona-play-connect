
## Fix: Scope "My Passes" and "Play" buttons to active matches only

**Problem**: 
- "My Passes" currently shows whenever any `match` exists (including ended matches)
- "🎮 Play" always shows regardless of whether any match exists

**User intent**: Both buttons should only appear when there is an active (non-ended) match.

**Single change in `src/pages/Index.tsx` lines 803–814:**

```tsx
// Before:
{match && (
  <Link to="/ticket" className="flex-1">
    ...My Passes...
  </Link>
)}
<Link to="/play" className="flex-1">
  ...🎮 Play...
</Link>

// After:
{match && match.status !== 'ended' && (
  <>
    <Link to="/ticket" className="flex-1">
      ...My Passes...
    </Link>
    <Link to="/play" className="flex-1">
      ...🎮 Play...
    </Link>
  </>
)}
```

This means:
- **Active match** (upcoming/live): Shows Reserve + My Passes + Play + Dismiss
- **Ended match**: Shows 🏆 Results + Dismiss only
- **No match**: Shows nothing (bar is still hidden by `!barDismissed` but no match-specific buttons clutter it)

**File changed**: `src/pages/Index.tsx` only
