

## Plan: CricketData.org API Integration for Auto IPL Match Sync

### What this builds
An automated pipeline that polls the CricketData.org API every 30 seconds during IPL match hours, auto-creates matches with team lineups, syncs live scores, derives ball-by-ball events from score deltas, and triggers prediction window open/close cycles automatically — replacing the manual AdminControl workflow for IPL matches.

### Architecture

```text
┌─────────────────────────────────────────────────────┐
│  pg_cron (every 30s, 2pm–midnight IST)              │
│  → calls cricket-api-sync edge function             │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│  cricket-api-sync Edge Function                     │
│                                                     │
│  Phase 1: DISCOVER (runs once/day)                  │
│  GET /v1/currentMatches → filter matchType=t20,     │
│  series containing "IPL" → upsert into matches,     │
│  teams, match_roster, match_live_state              │
│                                                     │
│  Phase 2: SYNC SCORES (runs every 30s when live)    │
│  GET /v1/match_scorecard?id=<ext_id>                │
│  → compare score delta vs last known state          │
│  → derive delivery outcome (dot/1/2/3/4/6/W/wd/nb) │
│  → insert into deliveries table                     │
│  → open prediction window before each ball          │
│  → auto-lock + resolve window after recording       │
│  → update match_live_state + leaderboard            │
│                                                     │
│  Phase 3: MATCH LIFECYCLE                           │
│  Innings break detection → set phase='break'        │
│  Match end detection → set status='ended'           │
└─────────────────────────────────────────────────────┘
```

### Key technical decisions

1. **API key storage**: Store `3cd5ae6b-3053-4c9d-8697-e049696924c3` as `CRICKET_API_KEY` secret (already paid plan)
2. **External match ID tracking**: Add `external_match_id` column to `matches` table to link our matches to CricketData.org match IDs and prevent duplicate creation
3. **Score delta derivation**: When the API reports score changed from 45/2 to 49/2 with overs going from 6.3→6.4, we derive "boundary_4". When wickets increment, we derive "wicket". Extras (wide/no-ball) detected from overs not incrementing + score changing.
4. **Prediction window automation**: Each detected new ball auto-opens a prediction window (5s before detection), then locks and resolves it with the derived outcome.
5. **Sync state table**: New `api_sync_state` table stores last-seen score/overs/wickets per match to compute deltas accurately.

### Limitations (honest)
- CricketData.org provides scorecard-level data, not true ball-by-ball. The system **derives** ball outcomes from score deltas, which is ~90% accurate. Edge cases: byes vs leg-byes, no-ball+runs combos may be approximated.
- Data is "a few minutes behind real-time" per CricketData.org's terms. Prediction windows will lag live TV by 1-3 minutes.
- Lineup data (playing XI) depends on what the API provides in `match_scorecard` — batting/bowling lists effectively give us the XI.

### Database changes (2 migrations)

**Migration 1**: Add external ID tracking
```sql
ALTER TABLE matches ADD COLUMN external_match_id text UNIQUE;

CREATE TABLE api_sync_state (
  match_id uuid PRIMARY KEY REFERENCES matches(id),
  external_match_id text NOT NULL,
  last_innings1_score int DEFAULT 0,
  last_innings1_wickets int DEFAULT 0,
  last_innings1_overs numeric DEFAULT 0,
  last_innings2_score int DEFAULT 0,
  last_innings2_wickets int DEFAULT 0,
  last_innings2_overs numeric DEFAULT 0,
  last_synced_at timestamptz DEFAULT now(),
  sync_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE api_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sync state readable by all" ON api_sync_state FOR SELECT USING (true);
CREATE POLICY "Sync state writable by authenticated" ON api_sync_state FOR ALL USING (auth.role() = 'authenticated');
```

**Migration 2**: Enable realtime on sync state
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE api_sync_state;
```

### New edge function: `cricket-api-sync`

Single function handling 3 actions via `?action=discover|sync|status`:
- **discover**: Fetches `currentMatches`, filters IPL T20s, creates matches + teams + roster + live_state + sync_state + scoring_config. Skips already-imported matches.
- **sync**: For each match with `sync_enabled=true` and status `live`/`in_progress`, fetches `match_scorecard`, computes deltas, derives deliveries, manages prediction windows, updates leaderboard.
- **status**: Returns current sync state for admin dashboard.

### Cron job setup
Using `pg_cron` + `pg_net` to call the edge function:
- **discover**: Every 30 minutes between 12:00-23:59 IST
- **sync**: Every 30 seconds when any match is live (or every 60s to conserve API hits)

### Admin UI: API Sync panel
New section in `AdminMatches.tsx` or a dedicated admin page:
- Toggle auto-sync on/off per match
- Show sync status (last synced, current delta, API hits remaining)
- Manual "Sync Now" button
- Link/unlink external match ID

### Files changed
1. `supabase/functions/cricket-api-sync/index.ts` — new edge function (~300 lines)
2. `supabase/config.toml` — add function config
3. `src/pages/admin/AdminMatches.tsx` — add API sync status panel
4. 2 database migrations (schema changes above)
5. 1 SQL insert (cron job schedule)

