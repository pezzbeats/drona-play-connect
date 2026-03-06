
## What to Change

**File:** `src/pages/Index.tsx`

### 1. Move both buttons higher
Currently the CTA block (lines 415–428) sits at the very bottom — after features, pricing, and trust strip. Move it to right **after the match highlight card** (after line 312), so users see the action options immediately without scrolling.

### 2. Convert "View Your Passes" into a proper green button
Replace the text link with a full-width button styled similarly to the Register button but:
- Smaller: `h-12 text-base` vs Register's `h-16 text-xl`
- Solid green using `bg-success` (`hsl(142 70% 45%)`) with white text and a green glow
- Same rounded-xl shape, ChevronRight icon, hover/active scale transitions

```text
┌─────────────────────────────────────┐
│  Reserve Your Seats Now  →          │  ← h-16, crimson gradient (unchanged)
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  View Your Passes  →                │  ← h-12, green, slightly smaller
└─────────────────────────────────────┘
```

### Changes
- **Remove** the CTA block from its current position (lines 415–428)
- **Insert** the new two-button layout right after the `</GlassCard>` of the match highlight card (~line 312), inside the `match ?` branch
- Also add an equivalent two-button block in the **no-match "Coming Soon"** branch so it always appears
- The green button uses: `bg-success text-success-foreground shadow-[0_0_20px_hsl(142_70%_45%/0.5)]` + hover transitions
