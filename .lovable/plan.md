
## Full Plan: Mandatory Legal Consent Gate for Prediction Game

### What this touches
- **New DB table**: `game_consents` — stores mobile, match_id, accepted_at, ip, user_agent, terms_version
- **New migration**: creates the table with RLS (public insert, authenticated select)
- **`src/pages/Play.tsx`**: after successful PIN verification, instead of immediately navigating to `/live`, show the consent screen inline (or skip it if consent already recorded for this match)
- **`src/pages/admin/AdminOrders.tsx`**: add a 5th tab "Consent" to the booking detail panel showing consent status + timestamp
- **No changes** to Live.tsx, game logic, leaderboard, realtime subscriptions, or any edge functions

---

### Database

New table: `game_consents`

```text
id              uuid PK
mobile          text  NOT NULL
match_id        uuid  NOT NULL
terms_version   text  NOT NULL  DEFAULT '1.0'
accepted_at     timestamptz DEFAULT now()
ip_address      text
user_agent      text
```

- Unique constraint on `(mobile, match_id)` — prevents double-recording for same match
- RLS: INSERT open to all (anon users), SELECT restricted to authenticated

---

### Flow change in Play.tsx

Current:
```
verify-game-pin → valid → localStorage.setItem → navigate('/live')
```

New:
```
verify-game-pin → valid → check game_consents for (mobile, match_id)
  → already consented → localStorage.setItem → navigate('/live')
  → not yet consented → show ConsentScreen (inline state: 'consent')
      → Accept → insert into game_consents → localStorage.setItem → navigate('/live')
      → Decline → navigate('/')
```

No new route needed — the consent screen is a state within the Play page (`view: 'form' | 'consent'`), shown after verification passes but before session is stored.

---

### ConsentScreen component (inline in Play.tsx)

Full-screen panel (replaces the PIN form area) with:
- Header: `🎮 Prediction Game – Participation Terms`
- 8 numbered/bulleted clause cards (all 8 terms from the prompt)
- Scrollable content area with fixed-bottom consent controls
- Checkbox: "I have read and understood the participation terms..."
- Two buttons: **Accept & Enter Game** (disabled until checkbox checked) + **Decline**
- Saving state while inserting consent record

Auto-skip logic: on page load, if `game_session` exists and consent already recorded for that match → go straight to `/live` (already handled by existing auto-redirect, but we add a consent check too)

---

### Admin Bookings — Consent tab

Add a 5th tab `'consent'` to `DetailTab` type in `AdminOrders.tsx`.

`renderConsentTab(order)`:
- Queries `game_consents` where `mobile = order.purchaser_mobile AND match_id = order.match_id`
- Shows: status chip (Accepted / Not Yet), accepted_at timestamp, IP address, user agent, terms version
- Loads when tab is clicked (lazy, same pattern as existing tabs)

Tab icon: `ShieldCheck` from lucide-react

---

### Files changed

| File | Change |
|---|---|
| `supabase/migrations/[new].sql` | Create `game_consents` table + RLS |
| `src/pages/Play.tsx` | Add consent state + ConsentScreen inline |
| `src/pages/admin/AdminOrders.tsx` | Add 5th Consent tab to booking detail |

---

### What is NOT changed
- `src/pages/Live.tsx` — untouched
- All edge functions — untouched
- Leaderboard, prediction, match control — untouched
- All existing Play page logic (PIN form, realtime match status, auto-redirect) — preserved

---

### Terms version
Hardcoded as `'1.0'` in the insert. When terms update in future, bump to `'1.1'` etc. and the existing check queries by `(mobile, match_id)` only — so users who accepted v1.0 won't be re-prompted unless we add version gating later.
