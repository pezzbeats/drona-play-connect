

## Problem

The match summary (winner, top scorer, top wicket-taker) doesn't show because the underlying data is missing:

1. **No players** exist for RR or CSK in the `players` table (0 records)
2. **`is_batting_first` is `false` for both roster entries** — the API sync never set it
3. **No deliveries** recorded for this match (the sync was broken earlier)
4. The guard `Object.keys(players).length === 0` prevents the summary function from running at all

Since the API sync didn't record ball-by-ball data, we can't compute top scorer/wicket-taker from `deliveries`. However, we CAN still show the winner by comparing the innings scores already stored in `match_live_state`.

## Solution

**File: `src/components/live/Scoreboard.tsx`**

1. **Remove the `players` guard** from the summary useEffect — don't require players to be loaded since they may not exist
2. **Determine winner without `is_batting_first`**: Fall back to using team names from roster + side (`home`/`away`). If `is_batting_first` isn't set for either team, use a heuristic: the home team usually bats based on toss, but more reliably, just show "Team A" and "Team B" with scores and let the score differential speak
3. **Better approach**: Query `match_roster` with `side` — assume `innings1` corresponds to the team marked `is_batting_first=true`, but if neither is marked, determine winner by comparing scores and show the team name from the roster side with the higher score
4. **Gracefully handle missing deliveries** — skip top scorer/wicket-taker chips when no deliveries exist (already handled, just don't block the whole summary)

### Specific changes:

- **Line 205**: Change guard from requiring both `teams` AND `players` to only requiring `teams`:
  ```ts
  if (state?.phase !== 'ended' || Object.keys(teams).length === 0) return;
  ```

- **Lines 218-234**: Improve winner logic to handle case where neither team has `is_batting_first = true`. Fetch roster with `side` field and use a fallback: if no `is_batting_first` is set, determine by comparing scores — the team that scored more in 2nd innings won (chasing), or if inn1 > inn2, the other team won by runs. Use the roster `side` to map: query the `match_live_state` for `batting_team_id`/`bowling_team_id` as another fallback.

- **Simplified fallback winner logic**:
  ```ts
  // If is_batting_first not set, just show winner based on score comparison
  if (!battingFirst && !battingSecond) {
    if (inn1 > inn2) {
      winMargin = `won by ${inn1 - inn2} runs`;
      // Can't definitively name team, show both scores
    } else if (inn2 > inn1) {
      winMargin = `won by ${10 - state.innings2_wickets} wickets`;
    }
    // Try to identify winner from batting_team_id in live state
  }
  ```

- Also fetch `batting_team_id` from `match_live_state` to identify which team was batting last (2nd innings) — if `inn2 >= inn1`, that team won.

| File | Change |
|---|---|
| `src/components/live/Scoreboard.tsx` | Remove players guard; add fallback winner logic when `is_batting_first` not set; handle missing deliveries gracefully |

