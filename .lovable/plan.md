
## Audit of what's already done vs. what's requested

After reading the current code:

### 1. Running score in PredictionPanel — **ALREADY IMPLEMENTED**
Lines 74-85 and 237-248 of `PredictionPanel.tsx` already have:
- The `myScore` state + `useEffect` that fetches from `leaderboard`
- The banner rendering `{myScore.total_points} pts` and `{myScore.correct_predictions}/{myScore.total_predictions} correct`

**Remaining gap**: The banner doesn't update in real-time when a window resolves and points are awarded. The user will see stale "0 pts · 0/0" until they leave and re-enter the tab. Need to add a **Realtime subscription on the leaderboard table** to refresh `myScore` when their row updates, and also update `myScore` locally when a prediction is resolved.

### 2. sessionStorage form persistence in Register — **ALREADY IMPLEMENTED**
Lines 325-328: `fullName`, `mobile`, `email` are initialised from `sessionStorage` on mount.  
Line 476-479: They are saved to `sessionStorage` on `handleStep1`.

**Remaining gap**: `seatsCount` is NOT persisted (the user's request explicitly mentions it). Also, sessionStorage is never cleared after successful booking, so it will auto-fill the form on the next visit. Need to:
- Restore `seatsCount` from sessionStorage on mount
- Save `seatsCount` in `handleStep1`
- Clear all `reg_*` keys from sessionStorage after step 3 completes (booking success)

### 3. Live page "Match Ended" state — **NOT IMPLEMENTED**
The current code at lines 241-251 fetches the session's match by `sess.match_id` when no active match is found, but it doesn't check `status`. When no `matchId` is resolved, it shows the generic "No Active Match" card (lines 276-291). There's no distinction between "hasn't started" and "match ended".

**Required changes**:
- In `initSession`, also fetch `status` from the matches query
- Add a `matchStatus` state variable
- When the session match is found but `is_active_for_registration` is false and status is `ended`, set `matchStatus = 'ended'` and still set the `matchId`
- In the "No Active Match" fallback render, if `matchStatus === 'ended'` and `matchId` exists, show "Match has ended" with a "View Final Leaderboard" button that switches to the leaderboard tab or navigates to `/live` with the leaderboard tab

Actually re-reading: the "No Active Match" fallback fires when `!matchId || !session`. The best approach is:
- Track a `matchEnded` boolean state
- If the session's match is found but status is `ended`, set `matchEnded = true` AND still set `matchId` so `LiveContent` renders with the leaderboard tab open by default
- OR: show a special ended-match card with a "See Final Leaderboard" button that renders `<Leaderboard>` inline

The cleanest approach: fetch `status` alongside the match data, store it in state, and when rendering the no-match fallback, show a contextual message. Also when a valid match IS found with `ended` status, render `LiveContent` but auto-switch to leaderboard tab.

## Plan

### File: `src/components/live/PredictionPanel.tsx`
- Add Realtime subscription on `leaderboard` table filtered to `match_id=eq.{matchId}` and `mobile=eq.{mobile}`, updating `myScore` when the row changes
- Update score display label to match requested format: `Your Score: 30 pts · 3/5 correct`

### File: `src/pages/Register.tsx`
- Init `seatsCount` from `sessionStorage.getItem('reg_seatsCount')` (parse as int, default 1)
- In `handleStep1`, add `sessionStorage.setItem('reg_seatsCount', seatsCount.toString())`
- After successful booking (when `setStep(3)` is called / `setTickets` is set), clear all `reg_*` keys: `sessionStorage.removeItem('reg_fullName')` etc.

### File: `src/pages/Live.tsx`
- Extend `initSession` to also select `status` from matches
- Add `matchStatus` state: `useState<string>('')`
- In the `if (!match)` block where we look up `sess.match_id`, also fetch `status` and set `matchStatus`
- Change the `if (!matchId || !session)` render to distinguish: if `matchStatus === 'ended'` show "Match has ended 🏆" with "View Final Leaderboard" — which navigates to `/live` but we can just render a mini leaderboard inline. Actually simplest: show ended state card with a "View Leaderboard" button that sets a local `showLeaderboard` state and renders `<Leaderboard matchId={...} mobile={...} />` directly in the card/fullscreen

Actually the cleanest approach for the ended state: when match is ended and we have matchId + session, **still render LiveContent** but default the tab to `leaderboard`. The LiveContent component accepts `predictionsEnabled` and the tab system. We can pass an `initialTab` prop.

### Concrete changes:

**`src/pages/Live.tsx`**:
1. Add `matchStatus` state: `const [matchStatus, setMatchStatus] = useState<string>('');`
2. In `initSession`, change the session match query to also select `status`: `.select('id, name, predictions_enabled, status')`
3. When sessionMatch found, `setMatchStatus(sessionMatch.status)` 
4. When active match found, `setMatchStatus(match.status)`
5. Pass `matchStatus` to `LiveContent` as a new prop `matchStatus`
6. In `LiveContent`, add `matchStatus` prop and in `useState<Tab>('score')` → default to `'leaderboard'` when `matchStatus === 'ended'`
7. Change the "No Active Match" fallback to check: if `!matchId && matchStatus === 'ended'` show "Match Ended" card with "View Leaderboard" (navigate to leaderboard on the play page). If `!matchId` (generic), show current message. But actually if match is ended, `matchId` WILL be set (from sessionMatch), so we'd fall into `LiveContent` with leaderboard tab defaulted. The fallback only fires when neither active nor session match is resolved.

**`src/components/live/PredictionPanel.tsx`**:
1. Add realtime subscription for leaderboard updates using `useRealtimeChannel`
2. Update the score banner text to: `Your Score: {total_points} pts · {correct}/{total} correct`

**`src/pages/Register.tsx`**:
1. Init `seatsCount` from sessionStorage
2. Save `seatsCount` on `handleStep1`  
3. Clear all `reg_*` on booking success (in the effect that calls `setStep(3)` after order creation)
