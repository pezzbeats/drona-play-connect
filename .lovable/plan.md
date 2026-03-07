
## Goal
Add a prominent gameplay login section directly on the landing page (`Index.tsx`), so customers who are already checked in at the gate can quickly log in to the live game without having to navigate to `/play`. Also polish the existing `/play` page to match.

## What the landing page currently has
- Hero section
- Match highlight card
- Features grid
- Pricing card
- Trust strip
- Primary CTA buttons (Register / View Passes)
- Sticky bottom bar

## What's needed
1. **A new "Fan Game Login" section on the landing page** — embedded inline card with mobile + PIN inputs, same logic as `Play.tsx`. Placed prominently just below the match highlight card (before the features grid), since that's prime real estate that checkin users will see first.

2. **Sticky bottom bar** — add a third "🎮 Play Game" button alongside "Reserve Seats" and "View Passes".

3. **`/play` page** — keep it functional as a standalone route but it can be simplified/redirecting from the landing. No removal needed.

## Changes — 2 files only

### `src/pages/Index.tsx`

**A. Extract login logic into inline section** (~line 315, after match highlight card):
```tsx
{/* ─── FAN GAME LOGIN ─── */}
<GameLoginCard />   // inline component defined at top of file
```

The `GameLoginCard` component will:
- Import `useNavigate`, `useState` from React  
- Call `supabase.functions.invoke('verify-game-pin', ...)` on submit  
- On success: `localStorage.setItem('game_session', ...)` + `navigate('/live')`  
- Styled as a GlassCard with `variant="elevated"` and a green/gaming glow border  
- Compact design: headline "🎮 Already Checked In? Play Now", mobile input, PIN input (4 digits, OTP-style display), "Enter the Game" CTA button
- Small disclaimer: "PIN is given at the gate on check-in"

**B. Update sticky bottom bar** (line ~517):
Add a third button between "View Passes" and the X dismiss button:
```tsx
<Link to="/play" className="flex-1">
  <button className="w-full h-12 bg-primary/20 border border-primary/40 rounded-xl ...">
    🎮 Play Game
  </button>
</Link>
```

### `src/pages/Play.tsx`
- Minor polish: add back-to-home link, ensure it still works standalone
- No logic changes needed — the logic is already correct

## Section Placement in Index.tsx

```text
Hero
Match Highlight Card
↓ [NEW] Fan Game Login Card  ← prominent, right after match info
Features Grid
Pricing Card
Trust Strip
Primary CTA Buttons (Register / View Passes)
Legal Disclaimer
Business Trust Block
```

## Styling
The game login card will use:
- `variant="elevated" glow` GlassCard
- Border: `border-primary/40` (green glow, game feel)
- Gamepad2 icon header
- Compact 2-row layout (mobile + PIN stacked)
- Consistent with existing glass-input, GlassButton patterns already in Play.tsx
- A subtle "🎮 Fan Game" label/pill at top to signal who it's for

## Files Changed
| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add inline GameLoginCard component + insert section after match card + update sticky bar |
| `src/pages/Play.tsx` | Minor: add back link, keep standalone |
