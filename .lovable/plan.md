
## Full Analysis

### Current State
- `handleOpenWindow` passes a custom `windowQuestion` string and a hardcoded 6-option set (`dot`, `1`, `2`, `4`, `6`, `wicket`) to `resolve-prediction-window`
- The Predict tab in AdminControl still has a free-text `<Input>` for the question, plus a "Quick Resolve" grid with 6 buttons
- `PredictionPanel` renders options as a 2-column grid of rectangular `<button>` elements
- The delivery form uses a separate scattered UI: quick run buttons (0-6), extras type dropdown, wicket checkbox
- There is NO shared canonical option set — the predict-tab resolve buttons have different keys (`dot`) than what would make sense for resolution mapping

### The Unified Standard Option Set
Define this ONCE and use it everywhere:

```
KEY              LABEL           EMOJI  COLOR HINT
dot_ball         Dot Ball         •      muted
runs_1           1 Run            1      neutral
runs_2           2 Runs           2      neutral
runs_3           3 Runs           3      neutral
boundary_4       4 (Boundary)     4      accent/gold
six_6            6 (Six!)         6      primary/crimson
wide             Wide             WD     warning
no_ball          No Ball          NB     warning
byes             Byes             B      info
leg_byes         Leg Byes        LB      info
wicket           Wicket           W      destructive
```

### Delivery → Prediction Key Mapping
Admin records a delivery with specific fields. The mapping to correct prediction answer key:
- `is_wicket = true` → `wicket`
- `extras_type = 'wide'` → `wide`
- `extras_type = 'no_ball'` → `no_ball`
- `extras_type = 'bye'` → `byes`
- `extras_type = 'leg_bye'` → `leg_byes`
- `runs_off_bat = 0`, no extras → `dot_ball`
- `runs_off_bat = 1` → `runs_1`
- `runs_off_bat = 2` → `runs_2`
- `runs_off_bat = 3` → `runs_3`
- `runs_off_bat = 4` → `boundary_4`
- `runs_off_bat = 6` → `six_6`
- Otherwise: `dot_ball` (fallback)

### Files to Change

| File | What Changes |
|------|-------------|
| `src/pages/admin/AdminControl.tsx` | 1) Remove free-text question input everywhere. 2) `handleOpenWindow` uses fixed question + full 11-option set. 3) Delivery form gets a primary outcome selector grid (11 options) at the top that drives form prefill. 4) Resolve buttons updated to use new keys and all 11 options. 5) Predict tab simplified (no question input). |
| `src/components/live/PredictionPanel.tsx` | Replace 2-column rectangular button grid with premium circular/pill cards — one per outcome, larger touch targets, strong visual states. |

No edge function changes needed. No schema changes needed — existing `options` JSONB column and `correct_answer` JSONB column already store `{ key, label }` objects, so new keys slot right in. Old windows with old keys (dot, 1, 2, 4, 6, wicket) remain readable as-is.

---

## Precise Plan

### 1. `src/pages/admin/AdminControl.tsx`

**A. Add shared constant at top of file (after imports):**
```typescript
const BALL_OUTCOMES = [
  { key: 'dot_ball',   label: 'Dot',        emoji: '•',  color: 'muted' },
  { key: 'runs_1',     label: '1',           emoji: '1',  color: 'neutral' },
  { key: 'runs_2',     label: '2',           emoji: '2',  color: 'neutral' },
  { key: 'runs_3',     label: '3',           emoji: '3',  color: 'neutral' },
  { key: 'boundary_4', label: '4',           emoji: '4',  color: 'accent' },
  { key: 'six_6',      label: '6',           emoji: '6',  color: 'primary' },
  { key: 'wide',       label: 'Wide',        emoji: 'WD', color: 'warning' },
  { key: 'no_ball',    label: 'No Ball',     emoji: 'NB', color: 'warning' },
  { key: 'byes',       label: 'Byes',        emoji: 'B',  color: 'info' },
  { key: 'leg_byes',   label: 'Leg Byes',   emoji: 'LB', color: 'info' },
  { key: 'wicket',     label: 'Wicket',      emoji: 'W',  color: 'destructive' },
] as const;
```

**B. Add `selectedOutcome` state** (string | null) in the delivery form state area. This drives form prefill.

**C. `handleOpenWindow`** — remove `windowQuestion` state dependency entirely. Always passes:
```typescript
question: 'What will happen on the next ball?'
options: BALL_OUTCOMES.map(o => ({ key: o.key, label: o.label }))
```

**D. Remove `windowQuestion` state** and all associated `<Input>` elements from both Command tab and Predict tab.

**E. Command tab — Delivery form**:
- ABOVE the existing "Ball X of 6" heading, add a new primary section: **"What happened on this ball?"** — render BALL_OUTCOMES as a tappable grid (3 per row, circular or pill-shaped with emoji/label). When admin taps one, set `selectedOutcome` and auto-prefill the delivery form fields:
  - `dot_ball` → runs_off_bat=0, extras_type=none, is_wicket=false
  - `runs_1` → runs_off_bat=1, extras_type=none
  - `runs_2` → runs_off_bat=2, extras_type=none
  - `runs_3` → runs_off_bat=3, extras_type=none
  - `boundary_4` → runs_off_bat=4, extras_type=none
  - `six_6` → runs_off_bat=6, extras_type=none
  - `wide` → runs_off_bat=0, extras_type=wide, extras_runs=1
  - `no_ball` → runs_off_bat=0, extras_type=no_ball, extras_runs=1
  - `byes` → runs_off_bat=0, extras_type=bye, extras_runs=0 (let admin fill count)
  - `leg_byes` → runs_off_bat=0, extras_type=leg_bye, extras_runs=0
  - `wicket` → is_wicket=true, runs_off_bat=0, extras_type=none
- The existing detailed fields (player selectors, runs input, extras, wicket subform) remain BELOW as-is — they just get prefilled by the primary selection. Admin can still override.
- Reset `selectedOutcome` to null after `handleRecordDelivery` succeeds.

**F. Predict tab — remove question Input**, replace with a simple info line: "Fixed question: 'What will happen on the next ball?'". Update the "Quick Resolve" grid to render all 11 `BALL_OUTCOMES` using new keys, styled consistently.

**G. `handleResolveWindow`** — no change needed (already takes a key string).

---

### 2. `src/components/live/PredictionPanel.tsx`

Replace the 2-column rectangular grid with circular/pill option cards.

**New layout for open window options** (instead of `grid grid-cols-2 gap-2.5`):
- Use a **3-column grid** (or 4-col for wider screens) of circular cards
- Each card: `w-full aspect-square` or fixed `h-16` pill with centered emoji large + label small underneath
- States:
  - **Default**: `border-2 border-border/40 bg-card/60 text-foreground` — translucent, soft border
  - **Hover/active (not submitted)**: `border-primary/70 bg-primary/10 scale-105` — immediate feel
  - **Selected/submitted**: `border-primary bg-primary/25 text-primary shadow-[0_0_12px_hsl(355_80%_55%/0.4)]` — glowing ring + filled
  - **Locked (window locked, can't change)**: `opacity-60 cursor-not-allowed border-border/20` — same selected glow but greyed
  - **Correct (resolved)**: `border-success bg-success/20 text-success shadow-[0_0_12px_hsl(142_70%_45%/0.4)]`
  - **Incorrect (resolved, was selected)**: `border-destructive/60 bg-destructive/10 text-destructive/80`
  - **Spinning**: Loader2 centered

**Layout structure per card:**
```tsx
<button className="flex flex-col items-center justify-center gap-1 rounded-2xl p-3 border-2 h-[72px] transition-all active:scale-95 touch-manipulation">
  <span className="text-xl font-black leading-none">{emoji}</span>
  <span className="text-[10px] font-bold uppercase tracking-wide leading-none">{label}</span>
</button>
```

**Resolved state footer** — keep existing correct/incorrect display in the closed window cards, just update to read from normalized keys (already works since labels come from `window.options`).

---

## What Does NOT Change
- `submit-prediction` edge function — unchanged
- `resolve-prediction-window` edge function — unchanged  
- `record-delivery` edge function — unchanged
- All DB tables — unchanged
- Realtime subscriptions — unchanged
- Leaderboard logic — unchanged
- PIN access, scanner, over control, innings — unchanged
- Old windows with old keys (`dot`, `1`, `2`, `4`, `6`, `wicket`) — still display correctly because labels come from `window.options` JSONB, not hardcoded

## No DB Migrations Required
The `options` column is already JSONB. New windows will store the new 11-key options array. Old windows remain intact with their old 6-key options. Resolution correctness check is `JSON.stringify(pred.prediction) === JSON.stringify(correct_answer)` in the edge function, which is key-based and works for both old and new keys.
