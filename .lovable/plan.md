
## Plan: Update Landing Page for Ended Match

The match is over — India won by 79 runs. The landing page still shows "Registrations Open" badge, "Reserve Your Seats Now" CTA, a broken countdown timer, and a sticky bar with a "Reserve" button. All of these need to change to reflect the match ended state.

### Changes to `src/pages/Index.tsx`

**1. Match card — status badge (line 418-428)**
Currently shows "Registrations Open" green pulse badge for all matches. Change to a conditional:
- `status === 'ended'` → Trophy icon + amber "Match Ended" badge + result score summary (IND 255/5 vs NZ 176/10)
- `status === 'live'` → green pulse "Live Now"
- other → green pulse "Registrations Open"

**2. Match card — result score row**
When `status === 'ended'`, replace the `CountdownTimer` with a victory announcement block:
- "🏆 India Won!" headline in gold gradient
- "by 79 runs" subtext  
- Two-column mini scorecard: IND 255/5 (20 ov) | NZ 176/10 (20 ov)

**3. Primary CTA section (lines 467–479)**
When `status === 'ended'`, replace "Reserve Your Seats Now" + "Already Booked? View Your Passes" with:
- "View Your Match Passes" (green button → `/ticket`) — still useful for people who attended
- "See Match Results" (outlined button → `/live`) — shows the scoreboard

**4. Sticky bottom bar (lines 722–760)**
When `status === 'ended'`, replace the "Reserve" button with a "🏆 Results" button (→ `/live`). Keep "My Passes" and "🎮 Play" buttons as-is.

**5. The `GameLoginCard` component — badge (line 82–91)**
Currently shows "⏳ Soon" for non-live matches. For `ended` status, show "🏆 Ended" with an amber style instead of "⏳ Soon".

### How to detect ended state
The `match` object already has `status: 'ended'` from the fetch — just add `match.status === 'ended'` conditionals.

### No new data fetching required
All data is already in the `match` state object.

### Files changed
- `src/pages/Index.tsx` only
