
## What We're Doing

The user wants the two large CTA buttons ("Reserve Your Seats Now" and "Already Booked? View Your Passes") moved to appear **directly above the `<GameLoginCard />`** (the "Play the Game" / "Already Checked In?" section).

Currently (lines 537–549), the two CTA buttons are rendered **after** the trust strip / features section and before the legal disclaimer — which puts them well below the GameLoginCard at line 434.

The image shows the exact desired style: large full-width buttons, crimson-to-orange gradient for "Reserve Your Seats Now", solid green for "Already Booked?".

### Change: `src/pages/Index.tsx`

**Move** the existing CTA block (lines 537–549) to sit **just before** the `<GameLoginCard />` at line 434. The two blocks to swap are:

**Remove** from lines 537–549:
```jsx
{/* ─── PRIMARY CTA — always visible ─── */}
<div className="mb-6 animate-slide-up" style={{ animationDelay: '0.27s' }}>
  <Link to="/register" className="block mb-3">
    <button className="w-full h-16 btn-gradient ...">Reserve Your Seats Now ...</button>
  </Link>
  <Link to="/ticket" className="block">
    <button className="w-full h-12 bg-success ...">Already Booked? View Your Passes ...</button>
  </Link>
</div>
```

**Insert** that same block (with slightly adjusted animation delay to match position) **above** line 433 (`{/* ─── FAN GAME LOGIN ─── */}`), i.e. directly after the match highlight card closes at line 431.

The buttons already have the correct styling matching the screenshot. We just need to reorder them in the JSX. The button height should also be bumped to match the screenshot's tall chunky look — increase "Already Booked" button to `h-16` to match "Reserve Your Seats".

### Result layout (top to bottom):
1. Banner
2. Match Highlight Card + Countdown
3. **Reserve Your Seats Now** (crimson→orange, tall)
4. **Already Booked? View Your Passes** (green, tall)
5. GameLoginCard (Fan Game Login / "Play the Game")
6. Event Experience / Features grid
7. Pricing Card
8. Trust Strip
9. Legal Disclaimer
10. Business Trust Block

### Files to change

| File | Change |
|---|---|
| `src/pages/Index.tsx` | Remove CTA block from lines 537–549; insert it above `<GameLoginCard />` at ~line 433, with both buttons at `h-16` |
