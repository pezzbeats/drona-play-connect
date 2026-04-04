import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Wifi, WifiOff, ChevronDown, ChevronUp, Trophy, Target, Flame } from 'lucide-react';
import { useRealtimeChannel, type ChannelSubscription } from '@/hooks/useRealtimeChannel';

interface LiveState {
  phase: string;
  innings1_score: number;
  innings1_wickets: number;
  innings1_overs: number;
  innings2_score: number;
  innings2_wickets: number;
  innings2_overs: number;
  current_innings: number;
  target_runs: number | null;
  last_delivery_summary: string | null;
  current_striker_id: string | null;
  current_non_striker_id: string | null;
  current_bowler_id: string | null;
  batting_team_id: string | null;
  bowling_team_id: string | null;
  super_over_active?: boolean;
  super_over_round?: number;
  super_over_innings?: number;
  super_over_score?: number;
  super_over_wickets?: number;
  super_over_overs?: number;
}

interface ScoreboardProps {
  matchId: string;
  initialState?: LiveState | null;
}

const phaseLabel: Record<string, string> = {
  pre: 'Pre-Match',
  innings1: '1st Innings',
  break: 'Break',
  innings2: '2nd Innings',
  super_over: '⚡ Super Over',
  ended: 'Match Ended',
};

interface MatchSummary {
  winnerTeam: string | null;
  winMargin: string | null;
  topScorer: { name: string; runs: number } | null;
  topWicketTaker: { name: string; wickets: number } | null;
}

export function Scoreboard({ matchId, initialState }: ScoreboardProps) {
  const [state, setState] = useState<LiveState | null>(initialState || null);
  const [teams, setTeams] = useState<Record<string, any>>({});
  const [players, setPlayers] = useState<Record<string, any>>({});
  const [superOverRounds, setSuperOverRounds] = useState<any[]>([]);
  const [flash, setFlash] = useState(false);
  const [scoreKey, setScoreKey] = useState(0);
  const [matchSummaryOpen, setMatchSummaryOpen] = useState(false);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);
  const prevScoreRef = useRef<number | null>(null);

  // Score animation trigger
  const triggerFlash = useCallback(() => {
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
  }, []);

  const fetchSuperOverRounds = useCallback(async () => {
    const { data } = await supabase
      .from('super_over_rounds')
      .select('*, team_a:teams!super_over_rounds_team_a_id_fkey(name,short_code), team_b:teams!super_over_rounds_team_b_id_fkey(name,short_code), winner:teams!super_over_rounds_winner_team_id_fkey(name,short_code)')
      .eq('match_id', matchId)
      .order('round_number');
    if (data) setSuperOverRounds(data);
  }, [matchId]);

  const fetchData = useCallback(async () => {
    const [stateRes, rosterRes] = await Promise.all([
      supabase.from('match_live_state').select('*').eq('match_id', matchId).single(),
      supabase.from('match_roster').select('*, team:teams(*)').eq('match_id', matchId),
    ]);

    if (stateRes.data) {
      const newState = stateRes.data as any;
      setState(newState);
      // Update score animation ref
      const isSO = newState.phase === 'super_over';
      const currentScore = isSO
        ? (newState.super_over_score ?? 0)
        : (newState.current_innings === 1 ? newState.innings1_score : newState.innings2_score);
      prevScoreRef.current = currentScore;
    }

    if (rosterRes.data) {
      const teamMap: Record<string, any> = {};
      for (const r of rosterRes.data) {
        if (r.team) teamMap[r.team.id] = r.team;
      }
      setTeams(teamMap);

      const teamIds = Object.keys(teamMap);
      if (teamIds.length > 0) {
        const { data: playerData } = await supabase
          .from('players')
          .select('*')
          .in('team_id', teamIds);
        if (playerData) {
          const pMap: Record<string, any> = {};
          for (const p of playerData) pMap[p.id] = p;
          setPlayers(pMap);
        }
      }
    }

    await fetchSuperOverRounds();
  }, [matchId, fetchSuperOverRounds]);

  const subscriptions = useMemo<ChannelSubscription[]>(() => [
    {
      event: '*',
      schema: 'public',
      table: 'match_live_state',
      filter: `match_id=eq.${matchId}`,
      callback: (payload) => {
        const newState = payload.new as LiveState;
        // Detect score change for animation
        const isSO = newState.phase === 'super_over';
        const currentScore = isSO
          ? (newState.super_over_score ?? 0)
          : (newState.current_innings === 1 ? newState.innings1_score : newState.innings2_score);
        if (prevScoreRef.current !== null && prevScoreRef.current !== currentScore) {
          setScoreKey(k => k + 1);
          triggerFlash();
        }
        prevScoreRef.current = currentScore;
        setState(newState);
      },
    },
    {
      event: '*',
      schema: 'public',
      table: 'super_over_rounds',
      filter: `match_id=eq.${matchId}`,
      callback: () => {
        fetchSuperOverRounds();
      },
    },
  ], [matchId, triggerFlash, fetchSuperOverRounds]);

  const { connected, reconnecting } = useRealtimeChannel(
    `scoreboard-${matchId}`,
    subscriptions,
    fetchData,
  );

  // API sync polling is now handled by useLiveMatchSync at the page level (Live.tsx).
  // This component only displays data.

  // Fetch match summary when phase is ended
  useEffect(() => {
    if (state?.phase !== 'ended' || Object.keys(teams).length === 0) return;

    const fetchMatchSummary = async () => {
      try {
        // Get roster to determine which team batted first
        const { data: rosterData } = await supabase
          .from('match_roster')
          .select('team_id, is_batting_first, side')
          .eq('match_id', matchId);

        let winnerTeam: string | null = null;
        let winMargin: string | null = null;

        if (rosterData && rosterData.length >= 2 && state) {
          const battingFirst = rosterData.find(r => r.is_batting_first);
          const battingSecond = rosterData.find(r => !r.is_batting_first);
          const inn1 = state.innings1_score;
          const inn2 = state.innings2_score;

          if (battingFirst && rosterData.some(r => r.is_batting_first)) {
            // Normal path: is_batting_first is properly set
            if (inn1 > inn2) {
              winnerTeam = teams[battingFirst.team_id]?.name || null;
              winMargin = `won by ${inn1 - inn2} runs`;
            } else if (inn2 > inn1 && battingSecond) {
              winnerTeam = teams[battingSecond.team_id]?.name || null;
              winMargin = `won by ${10 - state.innings2_wickets} wickets`;
            } else {
              winnerTeam = null;
              winMargin = 'Match Tied';
            }
          } else {
            // Fallback: is_batting_first not set — use batting_team_id from live state
            // batting_team_id at end of match = team that was batting last (2nd innings)
            const battingTeamId = state.batting_team_id;
            const bowlingTeamId = state.bowling_team_id;

            if (inn1 > inn2) {
              // Team that batted first won by runs
              // bowling_team_id at end = team bowling in 2nd innings = team that batted first
              const winTeamId = bowlingTeamId;
              winnerTeam = winTeamId ? (teams[winTeamId]?.name || null) : null;
              winMargin = `won by ${inn1 - inn2} runs`;
            } else if (inn2 > inn1) {
              // Team that batted second won by wickets
              const winTeamId = battingTeamId;
              winnerTeam = winTeamId ? (teams[winTeamId]?.name || null) : null;
              winMargin = `won by ${10 - state.innings2_wickets} wickets`;
            } else {
              winnerTeam = null;
              winMargin = 'Match Tied';
            }

            // If still no winner name, fall back to roster side names
            if (!winnerTeam && (inn1 !== inn2)) {
              const home = rosterData.find(r => r.side === 'home');
              const away = rosterData.find(r => r.side === 'away');
              if (inn1 > inn2 && home) {
                winnerTeam = teams[home.team_id]?.name || 'Home Team';
              } else if (inn2 > inn1 && away) {
                winnerTeam = teams[away.team_id]?.name || 'Away Team';
              }
              // This is a heuristic — home may not always bat first
            }
          }
        }

        // Top scorer from deliveries (may be empty)
        const { data: deliveries } = await supabase
          .from('deliveries')
          .select('striker_id, runs_off_bat')
          .eq('match_id', matchId);

        let topScorer: { name: string; runs: number } | null = null;
        if (deliveries && deliveries.length > 0) {
          const runsMap: Record<string, number> = {};
          for (const d of deliveries) {
            if (d.striker_id) {
              runsMap[d.striker_id] = (runsMap[d.striker_id] || 0) + d.runs_off_bat;
            }
          }
          const topId = Object.entries(runsMap).sort((a, b) => b[1] - a[1])[0];
          if (topId && players[topId[0]]) {
            topScorer = { name: players[topId[0]].name, runs: topId[1] };
          }
        }

        // Top wicket-taker (may be empty)
        let topWicketTaker: { name: string; wickets: number } | null = null;
        if (deliveries && deliveries.length > 0) {
          const { data: wicketDeliveries } = await supabase
            .from('deliveries')
            .select('bowler_id')
            .eq('match_id', matchId)
            .eq('is_wicket', true);

          if (wicketDeliveries && wicketDeliveries.length > 0) {
            const wicketMap: Record<string, number> = {};
            for (const d of wicketDeliveries) {
              if (d.bowler_id) {
                wicketMap[d.bowler_id] = (wicketMap[d.bowler_id] || 0) + 1;
              }
            }
            const topBowler = Object.entries(wicketMap).sort((a, b) => b[1] - a[1])[0];
            if (topBowler && players[topBowler[0]]) {
              topWicketTaker = { name: players[topBowler[0]].name, wickets: topBowler[1] };
            }
          }
        }

        // Check super over winner override
        if (superOverRounds.length > 0) {
          const lastRound = superOverRounds[superOverRounds.length - 1];
          if (lastRound.winner) {
            winnerTeam = lastRound.winner.name;
            winMargin = `won via Super Over`;
          }
        }

        setMatchSummary({ winnerTeam, winMargin, topScorer, topWicketTaker });
      } catch (e) {
        console.warn('Failed to fetch match summary:', e);
      }
    };

    fetchMatchSummary();
  }, [state?.phase, matchId, teams, superOverRounds]);

  const currentInnings = state?.current_innings || 1;
  const score = currentInnings === 1 ? state?.innings1_score : state?.innings2_score;
  const wickets = currentInnings === 1 ? state?.innings1_wickets : state?.innings2_wickets;
  const overs = currentInnings === 1 ? state?.innings1_overs : state?.innings2_overs;

  const latestRound = superOverRounds.length > 0 ? superOverRounds[superOverRounds.length - 1] : null;
  const hasDecidedViaSuperOver = state?.phase === 'ended' && superOverRounds.length > 0;

  if (!state) {
    return (
      <GlassCard className="p-4 relative overflow-hidden">
        {/* Skeleton matching actual scoreboard layout */}
        <div className="flex items-center justify-between mb-3">
          <div className="h-6 w-24 skeleton rounded-full" />
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-3.5 skeleton rounded-full" />
            <div className="h-3 w-10 skeleton rounded" />
          </div>
        </div>
        <div className="text-center mb-4">
          <div className="h-16 w-40 skeleton rounded-lg mx-auto mb-2" />
          <div className="h-4 w-32 skeleton rounded mx-auto" />
        </div>
        <div className="h-px bg-border/40 mb-3" />
        <div className="h-9 w-full skeleton rounded-xl mb-3" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="h-12 skeleton rounded-xl" />
          <div className="h-12 skeleton rounded-xl" />
          <div className="h-12 skeleton rounded-xl" />
        </div>
      </GlassCard>
    );
  }

  return (
    <div className={`transition-all duration-300 ${flash ? 'scale-[1.01]' : 'scale-100'}`}>
      <GlassCard className={`p-4 relative overflow-hidden ${state.phase === 'super_over' ? 'border border-warning/50' : ''}`} glow>
        {/* Phase + Connection */}
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            state.phase === 'innings1' || state.phase === 'innings2'
              ? 'bg-success/20 text-success'
              : state.phase === 'break'
              ? 'bg-warning/20 text-warning'
              : state.phase === 'super_over'
              ? 'bg-warning/20 text-warning border border-warning/40'
              : state.phase === 'ended'
              ? 'bg-muted/30 text-muted-foreground'
              : 'bg-primary/20 text-primary'
          }`}>
            {phaseLabel[state.phase] || state.phase}
            {state.phase === 'super_over' && latestRound && (
              <span className="ml-1">· Round {latestRound.round_number}</span>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            {reconnecting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 text-warning animate-spin" />
                <span className="text-xs text-warning">Reconnecting…</span>
              </>
            ) : connected ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-success" />
                <span className="text-xs text-muted-foreground">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Connecting…</span>
              </>
            )}
          </div>
        </div>

        {/* ── SUPER OVER phase ── */}
        {state.phase === 'super_over' && (
          <>
            <div className="text-center mb-4">
              <div
                key={scoreKey}
                className={`font-display font-black tabular-nums leading-none tracking-tight transition-colors duration-300 text-warning ${scoreKey > 0 ? 'animate-count-in' : ''}`}
                style={{ fontSize: 'clamp(3rem, 12vw, 5rem)' }}
              >
                {state.super_over_score ?? 0}/{state.super_over_wickets ?? 0}
              </div>
              <div className="text-muted-foreground text-sm mt-2 font-medium">
                {(() => { const o = Number(state.super_over_overs ?? 0); return o === Math.floor(o) ? Math.floor(o) : o.toFixed(1); })()} overs · Super Over
              </div>

              {/* Target line for innings B */}
              {latestRound && (latestRound.status === 'innings_b') && (
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-warning/15 border border-warning/25">
                  <span className="text-xs text-warning font-semibold">
                    Target {(latestRound.team_a_score || 0) + 1} ·{' '}
                    Need {Math.max(0, (latestRound.team_a_score || 0) + 1 - (state.super_over_score ?? 0))} more
                  </span>
                </div>
              )}
            </div>

            <div className="h-px bg-border/40 mb-3" />

            {/* Last delivery */}
            {state.last_delivery_summary && (
              <div className={`text-center text-sm rounded-xl p-2.5 transition-all duration-300 mb-3 ${flash ? 'bg-warning/20 text-warning' : 'bg-muted/20 text-muted-foreground'}`}>
                Last: {state.last_delivery_summary}
              </div>
            )}

            {/* Players */}
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              {state.current_striker_id && players[state.current_striker_id] && (
                <div className="bg-success/10 border border-success/20 rounded-xl px-3 py-2.5 flex items-center gap-2 sm:flex-col sm:text-center sm:gap-1">
                  <div className="text-success font-bold text-[10px] uppercase tracking-wider shrink-0">🏏 Striker</div>
                  <div className="text-foreground font-semibold text-sm sm:text-xs truncate">{players[state.current_striker_id].name}</div>
                </div>
              )}
              {state.current_non_striker_id && players[state.current_non_striker_id] && (
                <div className="bg-muted/20 border border-border/30 rounded-xl px-3 py-2.5 flex items-center gap-2 sm:flex-col sm:text-center sm:gap-1">
                  <div className="text-muted-foreground font-bold text-[10px] uppercase tracking-wider shrink-0">Non-Striker</div>
                  <div className="text-foreground font-semibold text-sm sm:text-xs truncate">{players[state.current_non_striker_id].name}</div>
                </div>
              )}
              {state.current_bowler_id && players[state.current_bowler_id] && (
                <div className="bg-primary/10 border border-primary/20 rounded-xl px-3 py-2.5 flex items-center gap-2 sm:flex-col sm:text-center sm:gap-1">
                  <div className="text-primary font-bold text-[10px] uppercase tracking-wider shrink-0">⚡ Bowler</div>
                  <div className="text-foreground font-semibold text-sm sm:text-xs truncate">{players[state.current_bowler_id].name}</div>
                </div>
              )}
            </div>

            {/* Collapsible regular match summary */}
            <div className="mt-4">
              <Collapsible open={matchSummaryOpen} onOpenChange={setMatchSummaryOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors text-xs text-muted-foreground">
                    <span className="font-semibold">Regular Match Summary</span>
                    {matchSummaryOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="flex justify-center gap-6 mt-2 text-xs text-muted-foreground px-3 pb-2">
                    <span className="flex flex-col items-center">
                      <span className="font-bold text-[10px] uppercase mb-0.5">Inn 1</span>
                      <span className="font-display font-bold text-foreground">{state.innings1_score}/{state.innings1_wickets}</span>
                      <span>({(() => { const o = Number(state.innings1_overs); return o === Math.floor(o) ? Math.floor(o) : o.toFixed(1); })()} ov)</span>
                    </span>
                    <div className="w-px bg-border/40" />
                    <span className="flex flex-col items-center">
                      <span className="font-bold text-[10px] uppercase mb-0.5">Inn 2</span>
                      <span className="font-display font-bold text-foreground">{state.innings2_score}/{state.innings2_wickets}</span>
                      <span>({(() => { const o = Number(state.innings2_overs); return o === Math.floor(o) ? Math.floor(o) : o.toFixed(1); })()} ov)</span>
                    </span>
                    <div className="w-px bg-border/40" />
                    <span className="flex flex-col items-center justify-center">
                      <span className="font-bold text-warning">Tied</span>
                      <span>{state.innings1_score} each</span>
                    </span>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </>
        )}

        {/* ── Regular innings ── */}
        {(state.phase === 'innings1' || state.phase === 'innings2') && (
          <>
            <div className="text-center mb-4">
              <div
                key={scoreKey}
                className={`font-display font-black tabular-nums leading-none tracking-tight transition-colors duration-300 ${
                  flash ? 'text-primary' : 'gradient-text'
                } ${scoreKey > 0 ? 'animate-count-in' : ''}`}
                style={{ fontSize: 'clamp(3rem, 12vw, 5rem)' }}
              >
                {score}/{wickets}
              </div>
              <div className="text-muted-foreground text-sm mt-2 font-medium">
                {(() => { const o = Number(overs); return o === Math.floor(o) ? Math.floor(o) : o.toFixed(1); })()} overs · Innings {currentInnings}
              </div>
              {state.target_runs && currentInnings === 2 && (
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/25">
                  <span className="text-xs text-primary font-semibold">
                    Target {state.target_runs} · Need {Math.max(0, state.target_runs - (score || 0))} in {(() => { const r = Math.max(0, 20 - Number(overs)); return r === Math.floor(r) ? Math.floor(r) : r.toFixed(1); })()} ov
                  </span>
                </div>
              )}
            </div>

            <div className="h-px bg-border/40 mb-3" />

            {state.phase === 'innings2' && (
              <div className="flex justify-center gap-6 text-xs text-muted-foreground mb-3">
                <span className="flex flex-col items-center">
                  <span className="section-title mb-0.5">Inn 1</span>
                  <span className="font-display font-bold text-foreground">{state.innings1_score}/{state.innings1_wickets}</span>
                  <span>({(() => { const o = Number(state.innings1_overs); return o === Math.floor(o) ? Math.floor(o) : o.toFixed(1); })()} ov)</span>
                </span>
                <div className="w-px bg-border/40" />
                <span className="flex flex-col items-center">
                  <span className="section-title mb-0.5">Inn 2</span>
                  <span className="font-display font-bold text-foreground">{state.innings2_score}/{state.innings2_wickets}</span>
                  <span>({(() => { const o = Number(state.innings2_overs); return o === Math.floor(o) ? Math.floor(o) : o.toFixed(1); })()} ov)</span>
                </span>
              </div>
            )}

            {state.last_delivery_summary && (
              <div className={`text-center text-sm rounded-xl p-2.5 transition-all duration-300 ${flash ? 'bg-primary/20 text-primary' : 'bg-muted/20 text-muted-foreground'}`}>
                Last: {state.last_delivery_summary}
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              {state.current_striker_id && players[state.current_striker_id] && (
                <div className="bg-success/10 border border-success/20 rounded-xl px-3 py-2.5 flex items-center gap-2 sm:flex-col sm:text-center sm:gap-1">
                  <div className="text-success font-bold text-[10px] uppercase tracking-wider shrink-0">🏏 Striker</div>
                  <div className="text-foreground font-semibold text-sm sm:text-xs truncate">{players[state.current_striker_id].name}</div>
                </div>
              )}
              {state.current_non_striker_id && players[state.current_non_striker_id] && (
                <div className="bg-muted/20 border border-border/30 rounded-xl px-3 py-2.5 flex items-center gap-2 sm:flex-col sm:text-center sm:gap-1">
                  <div className="text-muted-foreground font-bold text-[10px] uppercase tracking-wider shrink-0">Non-Striker</div>
                  <div className="text-foreground font-semibold text-sm sm:text-xs truncate">{players[state.current_non_striker_id].name}</div>
                </div>
              )}
              {state.current_bowler_id && players[state.current_bowler_id] && (
                <div className="bg-primary/10 border border-primary/20 rounded-xl px-3 py-2.5 flex items-center gap-2 sm:flex-col sm:text-center sm:gap-1">
                  <div className="text-primary font-bold text-[10px] uppercase tracking-wider shrink-0">⚡ Bowler</div>
                  <div className="text-foreground font-semibold text-sm sm:text-xs truncate">{players[state.current_bowler_id].name}</div>
                </div>
              )}
            </div>
          </>
        )}

        {state.phase === 'pre' && (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">🏏</div>
            <p className="font-display text-lg font-bold text-foreground">Match hasn't started yet</p>
            <p className="text-muted-foreground text-sm mt-1">Stay tuned — live updates will appear here</p>
          </div>
        )}

        {state.phase === 'break' && (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">☕</div>
            <p className="font-display text-xl font-bold text-foreground">Innings Break</p>
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/20 border border-border/30">
              <span className="text-sm text-muted-foreground font-medium">
                1st: {state.innings1_score}/{state.innings1_wickets} ({(() => { const o = Number(state.innings1_overs); return o === Math.floor(o) ? Math.floor(o) : o.toFixed(1); })()} ov)
              </span>
            </div>
            <div className="text-sm text-primary mt-2 font-semibold">
              Target: {(state.innings1_score || 0) + 1} runs
            </div>
            <p className="text-xs text-muted-foreground mt-3 animate-pulse">
              2nd innings starting soon…
            </p>
          </div>
        )}

        {state.phase === 'ended' && (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">🏆</div>
            <p className="font-display text-xl font-bold text-foreground">Match Ended</p>

            {/* Winner banner */}
            {matchSummary?.winnerTeam && (
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 border border-primary/30">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="text-sm text-primary font-bold">
                  {matchSummary.winnerTeam} {matchSummary.winMargin}
                </span>
              </div>
            )}
            {matchSummary && !matchSummary.winnerTeam && matchSummary.winMargin && (
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-warning/15 border border-warning/30">
                <span className="text-sm text-warning font-bold">{matchSummary.winMargin}</span>
              </div>
            )}

            {/* Innings scores */}
            <div className="flex justify-center gap-6 mt-4 text-sm text-muted-foreground">
              <span className="flex flex-col items-center">
                <span className="font-bold text-[10px] uppercase mb-0.5 tracking-wider">1st Inn</span>
                <span className="font-display font-bold text-foreground text-base">{state.innings1_score}/{state.innings1_wickets}</span>
                <span className="text-xs">({(() => { const o = Number(state.innings1_overs); return o === Math.floor(o) ? Math.floor(o) : o.toFixed(1); })()} ov)</span>
              </span>
              <div className="w-px bg-border/40" />
              <span className="flex flex-col items-center">
                <span className="font-bold text-[10px] uppercase mb-0.5 tracking-wider">2nd Inn</span>
                <span className="font-display font-bold text-foreground text-base">{state.innings2_score}/{state.innings2_wickets}</span>
                <span className="text-xs">({(() => { const o = Number(state.innings2_overs); return o === Math.floor(o) ? Math.floor(o) : o.toFixed(1); })()} ov)</span>
              </span>
            </div>

            {/* Top performers */}
            {matchSummary && (matchSummary.topScorer || matchSummary.topWicketTaker) && (
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {matchSummary.topScorer && (
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-success/10 border border-success/20">
                    <Flame className="h-3.5 w-3.5 text-success" />
                    <div className="text-left">
                      <div className="text-[10px] uppercase font-bold text-success tracking-wider">Top Scorer</div>
                      <div className="text-xs font-semibold text-foreground">{matchSummary.topScorer.name} — {matchSummary.topScorer.runs} runs</div>
                    </div>
                  </div>
                )}
                {matchSummary.topWicketTaker && (
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
                    <Target className="h-3.5 w-3.5 text-primary" />
                    <div className="text-left">
                      <div className="text-[10px] uppercase font-bold text-primary tracking-wider">Top Wickets</div>
                      <div className="text-xs font-semibold text-foreground">{matchSummary.topWicketTaker.name} — {matchSummary.topWicketTaker.wickets}W</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Super over note */}
            {hasDecidedViaSuperOver && latestRound && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/15 border border-warning/30">
                <span className="text-xs text-warning font-semibold">
                  ⚡ Decided via Super Over Round {latestRound.round_number}
                  {latestRound.winner ? ` — ${latestRound.winner.name} won` : ''}
                </span>
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
