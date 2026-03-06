
## Problem Identified

`src/index.css` has **two full `@layer base` + `@layer components` blocks**. The first (lines 1–318) correctly defines the cricket green/crimson/gold theme. The second (lines 337–652) is the old navy/blue deep-space theme that **overrides every CSS variable** — making the entire app render in blue despite all previous theme work.

The reference image shows:
- **Background**: Rich mowed cricket-green outfield with alternating light/dark stripe bands — a global grass texture
- **Foreground panels (cards)**: Vivid crimson-red scoreboard with a soft radial gradient (lighter center, deeper edges), framed in a metallic bronze/gold border
- **Combination**: Deep green ground + crimson scoreboard + gold frame = the three design tokens already correct in the first `:root` block

## What's Wrong
- Lines 337–652: Entire second CSS block with navy `--background: 222 47%`, blue `--primary: 210 100%`, cyan, etc. — fully overrides the first block
- `BackgroundOrbs`: Good (crimson + green orbs already set)
- `tailwind.config.ts`: Already has crimson/gold values — fine

## Changes

### `src/index.css` — Single unified rewrite
**Remove the entire duplicate second block (lines 337–652)** and replace with clean closing print styles only.

At the same time, upgrade the first block to better match the reference:

1. **Background**: Slightly richer green — `140 60% 5%` (more saturated/visible than current `140 55% 4%`)
2. **Grass stripe texture on `body`**: Add `repeating-linear-gradient` diagonal stripes globally — subtle alternating green bands like the mowed outfield, `opacity ~0.04`, overlaid on the hero gradient
3. **Card glass background**: Shift from neutral-green to a very slight crimson-tinted glass — `355 25% 8% / 0.70` instead of `140 45% 8% / 0.65` — echoes the scoreboard panel on the grass
4. **Glass border**: Increase gold/bronze presence — `38 60% 55% / 0.20` (the bronze frame around the scoreboard)
5. **Gradient hero**: Richer green — `140 65% 4%` → `145 55% 7%` → `140 65% 4%`
6. **Body background**: Add a CSS `::before` pseudo-element or inline `background` layering with the stripe pattern

Actually the cleanest approach: add the stripe overlay directly on `body` using a multi-layer `background` property combining the hero gradient and a `repeating-linear-gradient` for the mowed-grass stripe effect.

### `src/components/ui/BackgroundOrbs.tsx`
- Increase crimson orb opacity slightly (0.3 → match the vivid scoreboard red)
- Add a third orb that's a softer gold/bronze for the frame color

## Files Changed

| File | Change |
|---|---|
| `src/index.css` | Remove entire duplicate second block (lines 337–652), upgrade first block: richer background, grass stripe on body, crimson-tinted glass cards, gold/bronze glass borders |
| `src/components/ui/BackgroundOrbs.tsx` | Tune orb colors/opacity to better match the image atmosphere |

Two files only. No logic changes.

## Result
Every page will use the single correct cricket theme: deep mowed-green background with grass stripe texture, crimson-tinted glass cards (scoreboard-panel feel), gold/bronze borders, and cream/white text — exactly matching the reference image's background/foreground combination.
