
## Color Analysis from Reference Image

The reference image shows a cricket ground with:
- **Deep forest green** backgrounds (cricket pitch/outfield) — rich, saturated: approx `hsl(140 60% 8%)` to `hsl(145 55% 12%)`
- **Crimson/coral red** scoreboard panel — vibrant but warm: approx `hsl(355 75% 55%)`
- **Bronze/gold** frame trim on the scoreboard: approx `hsl(38 65% 50%)`
- **Bright white** text contrast against dark green

**New palette strategy:**
- Background: deep cricket-green (replacing cold navy blue)
- Primary/CTA: bright cricket crimson-red (replacing electric blue)
- Secondary accent: gold/bronze trim (replacing cyan)
- Muted: dark green-tinted surfaces
- Success stays green (natural cricket association)
- Warning stays amber

---

## Changes Required

### 1. `src/index.css` — All CSS variables + component styles

**:root token changes:**
```
--background:        140 55% 4%     (deep cricket green-black)
--card:              140 45% 7%     (dark green glass)
--popover:           140 50% 5%     (slightly lighter)
--primary:           355 80% 55%    (cricket crimson)
--primary-foreground: 0 0% 98%     (white)
--secondary:         38 75% 52%     (gold/bronze trim)
--secondary-foreground: 140 55% 4% (dark on gold)
--muted:             140 30% 12%   (green-tinted muted)
--muted-foreground:  140 15% 50%   (greyed green)
--accent:            355 70% 65%   (lighter crimson accent)
--accent-foreground: 0 0% 98%
--border:            140 30% 16%   (green-tinted border)
--input:             140 30% 14%
--ring:              355 80% 55%   (crimson ring)
--glass-bg:          140 45% 8% / 0.65
--glass-border:      355 40% 60% / 0.12  (faint crimson border glow)
```

**Gradient tokens:**
```
--gradient-hero:    135deg from deep green to slightly lighter green-black
--gradient-primary: 135deg crimson to gold/orange
--gradient-accent:  135deg from gold to crimson
--glow-primary:     crimson glow
--glow-secondary:   gold glow
```

**Sidebar:**
```
--sidebar-background: 140 60% 3%
--sidebar-primary:    355 80% 55%
--sidebar-ring:       355 80% 55%
```

**Component styles to update:**
- `.glass-input:focus` — crimson border/ring
- `.glass-card-glow` — crimson glow
- `.btn-gradient` — crimson-to-gold gradient
- `.shimmer` — crimson shimmer tint
- `.step-active` — crimson gradient
- `.seat-pass` — green background with crimson border
- `.seat-pass::before` — crimson-to-gold top strip
- `.qr-container` — gold glow
- Scrollbar thumb hover — crimson

### 2. `tailwind.config.ts` — Hardcoded gradient/shadow values

Update `backgroundImage` and `boxShadow` to match new crimson/gold/green palette:
- `gradient-primary`: crimson → gold
- `gradient-accent`: gold → crimson
- `glow-primary`: crimson
- `glow-cyan` → rename semantically stays as `glow-gold`: gold

**pulse-glow keyframe** — update to crimson color

---

## Files Changed

| File | Change |
|---|---|
| `src/index.css` | Replace all CSS variable values + component style colors |
| `tailwind.config.ts` | Update hardcoded gradient + glow values, pulse-glow keyframe |

Two files only. No component logic changes — purely the design token layer.
