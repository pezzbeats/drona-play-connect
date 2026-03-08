
## Animated Score Increment in PredictionPanel

### What the feature does
When `myScore.total_points` increases (e.g. from 20 → 30), the score banner:
1. **Counts up** from the old value to the new value (animates each integer step over ~600ms)
2. **Flashes green** — the banner background momentarily shifts to `success/20` with a `success` border
3. **Shows a delta badge** — a `+10` pill pops up next to the score and fades out after ~1.5s
4. Snaps back to the normal crimson banner styling once the animation completes

### Implementation plan — 3 things to add

**1. State/refs in `PredictionPanel.tsx`**
- `prevPointsRef = useRef<number>(0)` — tracks the last known points to detect increases
- `displayPoints` state (number) — the animated counter value shown in the DOM (starts equal to `myScore.total_points`)
- `scoreDelta` state (number | null) — the `+N` value to show in the badge (null = hidden)
- `scoreFlash` boolean state — true for ~700ms after a point increase, drives the green flash class

**2. `useEffect` watching `myScore.total_points`**
```ts
useEffect(() => {
  if (!myScore) return;
  const prev = prevPointsRef.current;
  const next = myScore.total_points;
  if (next > prev && prev !== 0) {          // genuine increase (not initial load)
    const delta = next - prev;
    setScoreDelta(delta);
    setScoreFlash(true);
    // Count-up: tick every ~60ms across the delta steps
    const steps = Math.min(delta, 10);       // cap at 10 ticks for large jumps
    const interval = 600 / steps;
    let current = prev;
    const timer = setInterval(() => {
      current += Math.ceil(delta / steps);
      if (current >= next) { current = next; clearInterval(timer); }
      setDisplayPoints(current);
    }, interval);
    // Clear flash + delta after 1.5s
    setTimeout(() => { setScoreFlash(false); setScoreDelta(null); }, 1500);
  } else {
    setDisplayPoints(next);                  // silent update (initial load or reset)
  }
  prevPointsRef.current = next;
}, [myScore?.total_points]);
```

**3. Banner JSX update (lines 266–276)**
Replace static render with animated version:
```tsx
<div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-500
  ${scoreFlash
    ? 'bg-success/20 border-success/50 shadow-[0_0_16px_hsl(142_70%_45%/0.4)]'
    : 'bg-primary/10 border-primary/25'}`}>
  <Target className={`h-4 w-4 flex-shrink-0 transition-colors duration-300 ${scoreFlash ? 'text-success' : 'text-primary'}`} />
  <span className={`text-sm font-bold transition-colors duration-300 ${scoreFlash ? 'text-success' : 'text-primary'}`}>
    Your Score: {displayPoints} pts
  </span>
  {/* +N delta badge */}
  {scoreDelta !== null && (
    <span className="text-xs font-black text-success bg-success/15 border border-success/40 rounded-full px-2 py-0.5 animate-fade-in">
      +{scoreDelta}
    </span>
  )}
  <span className="text-muted-foreground font-medium text-xs ml-auto">
    · {myScore.correct_predictions}/{myScore.total_predictions} correct
  </span>
</div>
```

### Files changed
| File | Change |
|---|---|
| `src/components/live/PredictionPanel.tsx` | Add 3 state vars + 1 useEffect + update banner JSX |

No CSS changes needed — `animate-fade-in` and `transition-*` classes already exist in the design system. The `success` color token is already defined in `index.css`.

### Edge cases handled
- **Initial load** (prev = 0, or same value): no animation fires, `displayPoints` is set silently
- **Large delta** (e.g. admin awards bonus): capped at 10 ticks so it never spins for too long
- **Rapid successive updates**: each new update clears previous via the single timer overwrite pattern
