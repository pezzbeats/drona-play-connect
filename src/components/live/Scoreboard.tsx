import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { Loader2, Wifi, WifiOff } from 'lucide-react';

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
  ended: 'Match Ended',
};

export function Scoreboard({ matchId, initialState }: ScoreboardProps) {
  const [state, setState] = useState<LiveState | null>(initialState || null);
  const [connected, setConnected] = useState(false);
  const [teams, setTeams] = useState<Record<string, any>>({});
  const [players, setPlayers] = useState<Record<string, any>>({});
  const [flash, setFlash] = useState(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    fetchInitialData();
    subscribeRealtime();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [matchId]);

  const fetchInitialData = async () => {
    const [stateRes, rosterRes] = await Promise.all([
      supabase.from('match_live_state').select('*').eq('match_id', matchId).single(),
      supabase.from('match_roster').select('*, team:teams(*)').eq('match_id', matchId),
    ]);

    if (stateRes.data) setState(stateRes.data as any);

    if (rosterRes.data) {
      const teamMap: Record<string, any> = {};
      for (const r of rosterRes.data) {
        if (r.team) teamMap[r.team.id] = r.team;
      }
      setTeams(teamMap);

      // Fetch players for these teams
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
  };

  const subscribeRealtime = () => {
    const channel = supabase
      .channel(`scoreboard-${matchId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'match_live_state',
        filter: `match_id=eq.${matchId}`,
      }, (payload) => {
        setState(payload.new as any);
        setFlash(true);
        setTimeout(() => setFlash(false), 600);
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });
    channelRef.current = channel;
  };

  const currentInnings = state?.current_innings || 1;
  const score = currentInnings === 1 ? state?.innings1_score : state?.innings2_score;
  const wickets = currentInnings === 1 ? state?.innings1_wickets : state?.innings2_wickets;
  const overs = currentInnings === 1 ? state?.innings1_overs : state?.innings2_overs;

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
      <GlassCard className="p-4 relative overflow-hidden" glow>
        {/* Phase + Connection */}
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            state.phase === 'innings1' || state.phase === 'innings2'
              ? 'bg-success/20 text-success'
              : state.phase === 'break'
              ? 'bg-warning/20 text-warning'
              : state.phase === 'ended'
              ? 'bg-muted/30 text-muted-foreground'
              : 'bg-primary/20 text-primary'
          }`}>
            {phaseLabel[state.phase] || state.phase}
          </span>
          <div className="flex items-center gap-1">
            {connected
              ? <Wifi className="h-3.5 w-3.5 text-success" />
              : <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground">{connected ? 'Live' : 'Connecting'}</span>
          </div>
        </div>

        {/* Main Score */}
        {(state.phase === 'innings1' || state.phase === 'innings2') && (
          <>
            <div className="text-center mb-3">
              <div className={`font-display text-5xl font-black transition-all duration-300 ${flash ? 'text-primary' : 'gradient-text'}`}>
                {score}/{wickets}
              </div>
              <div className="text-muted-foreground text-sm mt-1">
                Overs: {Number(overs).toFixed(1)} · Innings {currentInnings}
              </div>
              {state.target_runs && currentInnings === 2 && (
                <div className="text-xs mt-1 text-primary font-medium">
                  Target: {state.target_runs} · Need: {Math.max(0, state.target_runs - (score || 0))} in {Math.max(0, 20 - Number(overs)).toFixed(1)} ov
                </div>
              )}
            </div>

            {/* Both innings summary */}
            {state.phase === 'innings2' && (
              <div className="flex justify-center gap-4 text-xs text-muted-foreground mb-3">
                <span>Inn 1: {state.innings1_score}/{state.innings1_wickets} ({Number(state.innings1_overs).toFixed(1)})</span>
                <span>Inn 2: {state.innings2_score}/{state.innings2_wickets} ({Number(state.innings2_overs).toFixed(1)})</span>
              </div>
            )}

            {/* Last delivery */}
            {state.last_delivery_summary && (
              <div className={`text-center text-sm rounded-lg p-2 transition-all duration-300 ${flash ? 'bg-primary/20 text-primary' : 'bg-muted/20 text-muted-foreground'}`}>
                Last: {state.last_delivery_summary}
              </div>
            )}

            {/* Players */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              {state.current_striker_id && players[state.current_striker_id] && (
                <div className="bg-success/10 rounded-lg p-2 text-center">
                  <div className="text-success font-bold text-[10px]">STRIKER</div>
                  <div className="text-foreground font-medium truncate">{players[state.current_striker_id].name}</div>
                </div>
              )}
              {state.current_non_striker_id && players[state.current_non_striker_id] && (
                <div className="bg-muted/20 rounded-lg p-2 text-center">
                  <div className="text-muted-foreground font-bold text-[10px]">NON-STRIKER</div>
                  <div className="text-foreground font-medium truncate">{players[state.current_non_striker_id].name}</div>
                </div>
              )}
              {state.current_bowler_id && players[state.current_bowler_id] && (
                <div className="bg-accent/10 rounded-lg p-2 text-center">
                  <div className="text-accent-foreground font-bold text-[10px]">BOWLER</div>
                  <div className="text-foreground font-medium truncate">{players[state.current_bowler_id].name}</div>
                </div>
              )}
            </div>
          </>
        )}

        {state.phase === 'pre' && (
          <div className="text-center py-4">
            <div className="text-4xl mb-2">🏏</div>
            <p className="text-foreground font-bold">Match hasn't started yet</p>
            <p className="text-muted-foreground text-sm">Stay tuned — live updates will appear here</p>
          </div>
        )}

        {state.phase === 'break' && (
          <div className="text-center py-4">
            <div className="text-3xl mb-2">☕</div>
            <p className="text-foreground font-bold">Innings Break</p>
            <div className="text-sm text-muted-foreground">
              1st Innings: {state.innings1_score}/{state.innings1_wickets} ({Number(state.innings1_overs).toFixed(1)} ov)
            </div>
            <div className="text-xs text-primary mt-1 font-medium">
              Target: {(state.innings1_score || 0) + 1} runs
            </div>
          </div>
        )}

        {state.phase === 'ended' && (
          <div className="text-center py-4">
            <div className="text-4xl mb-2">🏆</div>
            <p className="text-foreground font-bold">Match Ended</p>
            <div className="text-sm text-muted-foreground mt-1">
              1st: {state.innings1_score}/{state.innings1_wickets} · 2nd: {state.innings2_score}/{state.innings2_wickets}
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
