import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Wifi, WifiOff, ChevronDown, ChevronUp } from 'lucide-react';
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

export function Scoreboard({ matchId, initialState }: ScoreboardProps) {
  const [state, setState] = useState<LiveState | null>(initialState || null);
  const [teams, setTeams] = useState<Record<string, any>>({});
  const [players, setPlayers] = useState<Record<string, any>>({});
  const [superOverRounds, setSuperOverRounds] = useState<any[]>([]);
  const [flash, setFlash] = useState(false);
  const [scoreKey, setScoreKey] = useState(0);
  const [matchSummaryOpen, setMatchSummaryOpen] = useState(false);
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

  // Auto-poll cricket API sync with AI-adaptive interval while match is live
  const pollIntervalRef = useRef<number>(20);

  useEffect(() => {
    const isLivePhase = state?.phase === 'innings1' || state?.phase === 'innings2' || state?.phase === 'break' || state?.phase === 'super_over';
    if (!isLivePhase) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const { data } = await supabase.functions.invoke('cricket-api-sync', {
          body: null,
          headers: {},
        });
        if (data?.recommended_interval) {
          pollIntervalRef.current = data.recommended_interval;
        }
      } catch (e) {
        console.warn('API sync poll failed:', e);
      }
      if (!cancelled) {
        timeoutId = setTimeout(poll, pollIntervalRef.current * 1000);
      }
    };

    // Poll immediately, then schedule dynamically
    poll();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [state?.phase]);

  const currentInnings = state?.current_innings || 1;
  const score = currentInnings === 1 ? state?.innings1_score : state?.innings2_score;
  const wickets = currentInnings === 1 ? state?.innings1_wickets : state?.innings2_wickets;
  const overs = currentInnings === 1 ? state?.innings1_overs : state?.innings2_overs;

  const latestRound = superOverRounds.length > 0 ? superOverRounds[superOverRounds.length - 1] : null;
  const hasDecidedViaSuperOver = state?.phase === 'ended' && superOverRounds.length > 0;

  if (!state) {
    return (
      <GlassCard className="p-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
        <p className="text-muted-foreground text-sm">Loading scoreboard...</p>
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
            <div className="flex justify-center gap-6 mt-3 text-sm text-muted-foreground">
              <span>1st: {state.innings1_score}/{state.innings1_wickets}</span>
              <span>2nd: {state.innings2_score}/{state.innings2_wickets}</span>
            </div>
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
