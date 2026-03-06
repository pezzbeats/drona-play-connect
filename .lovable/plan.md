
## Analysis of Current State

**`AdminMatches.tsx`** — list page:
- "New Match" dialog: basic fields only, no clone option
- Activate toggle exists but no confirmation guard — one accidental tap deactivates a live match
- No registration toggle separate from the "Active" toggle (they're conflated)
- No preview link per match

**`AdminMatchDetail.tsx`** — detail page (opened from Edit button):
- Has match info, pricing, and asset sections — all functional
- Pricing section exists but has no visual price-tier cards
- No "Clone from previous match" button
- No "Preview Registration Page" link
- Status dropdown includes `registrations_open/closed` but it's buried in a plain Select — no dedicated toggle
- Asset thumbnails are small (w-12 h-12) and hard to verify at a glance

**`Register.tsx`** — public page:
- Reads from the `is_active_for_registration` flag on `matches` table
- Supports `match_id` in the URL query already? No — it always reads the active match. We can add a `?preview=<matchId>` mode.

---

## Plan

### Changes: `AdminMatchDetail.tsx` (primary target — most features land here)

**1. Clone from previous match**
- Add a "Clone from" button in the header area → opens a small popover/dialog listing all other matches
- On select: fetches that match's `match_pricing_rules`, `match_assets`, and `match_scoring_config`, then fills the current page's forms. Does NOT save automatically — admin still clicks "Save Changes" / "Save Pricing" to commit.

**2. Visual pricing tiers**
- Replace the flat input grid with two side-by-side pricing cards:
  - Left card: "New Customer" (blue tint) — price input + badge showing savings vs. returning
  - Right card: "Returning / Loyal" (green tint) — price input + loyalty link selector
- Shows a live "savings badge": "₹50 off for returning fans" calculated from the two values
- Loyalty link select (already exists) stays below, but now shown contextually inside the Returning card with a visual indicator

**3. Larger asset previews + drag-to-replace UX**
- Asset grid cells: increase preview image to `w-full h-24 object-cover` (instead of w-12 h-12)
- Add a "Replace" button on hover overlay for already-uploaded assets
- Add a "Remove" button (sets file to empty / deletes the asset row)

**4. Registration toggle + status quick-actions (dedicated section)**
- Add a "Registration Controls" card with:
  - **Status quick-toggle row**: button-group for `draft | registrations_open | registrations_closed` (highlights current)
  - **Active for Registration switch**: styled Switch component with confirmation dialog when turning ON (warns if another match is active) — calls `set-match-active` edge function
  - Shows current state prominently

**5. Preview Registration Page button**
- Add a "Preview Registration Page" button that navigates to `/register?preview=<matchId>` in a new tab
- In `Register.tsx`: read `?preview=<matchId>` query param — if present AND user is coming from admin (we can check `document.referrer` or just always allow it for the demo), fetch that specific match instead of the active one, show a "PREVIEW MODE" banner at the top

### Changes: `AdminMatches.tsx`

**6. Safety confirmation for Activate toggle**
- Wrap the Activate button in an `AlertDialog` confirmation: "Are you sure? This will deactivate any currently active match and open registration for [match name]."
- Add a clone icon button next to Edit — clicking it navigates to create-new-match flow but pre-fills the form via URL params `?clone=<matchId>`

---

## Files changed

| File | What changes |
|---|---|
| `src/pages/admin/AdminMatchDetail.tsx` | Clone dialog, visual pricing cards, larger assets, registration controls card, preview button |
| `src/pages/admin/AdminMatches.tsx` | AlertDialog confirmation on activate toggle |
| `src/pages/Register.tsx` | Read `?preview=<matchId>` param, show PREVIEW banner |

No DB schema changes needed — all within existing tables.

---

## Detail: Clone logic
```typescript
const handleClone = async (sourceMatchId: string) => {
  const [pricingRes, configRes] = await Promise.all([
    supabase.from('match_pricing_rules').select('*').eq('match_id', sourceMatchId).single(),
    supabase.from('match_scoring_config').select('*').eq('match_id', sourceMatchId).maybeSingle(),
  ]);
  // Pre-fill pricingForm from pricingRes.data (don't save yet)
  // Pre-fill scoringConfig from configRes.data
  toast({ title: 'Settings cloned — review and save to apply' });
};
```
Assets are NOT cloned (they need to be re-uploaded per match — file paths are match-scoped).

## Detail: Preview mode in Register.tsx
```typescript
const previewMatchId = new URLSearchParams(window.location.search).get('preview');
// if previewMatchId exists, fetch that specific match + show banner
```
No auth check — preview is read-only so safe to expose. Shows a yellow "⚠️ PREVIEW MODE — Not live" sticky banner.

## Detail: Registration Controls card layout
```
┌─────────────────────────────────────────────────┐
│ Registration Controls                            │
│                                                  │
│ Status:  [Draft] [Open ✓] [Closed]              │
│          (button-group, one active)              │
│                                                  │
│ Active for registration:  ●──── ON              │
│  [Only one match can be active at a time]        │
│                                                  │
│ [👁 Preview Registration Page ↗]                │
└─────────────────────────────────────────────────┘
```
