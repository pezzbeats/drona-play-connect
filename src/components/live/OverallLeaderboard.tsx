import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { Trophy, Medal, Star, TrendingUp, Crown, Target } from 'lucide-react';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';

interface OverallEntry {
  mobile: string;
  player_name: string | null;
  total_points_overall: number;
  correct_predictions_overall: number;
  total_predictions_overall: number;
  matches_participated: number;
  matches_won: number;
  best_match_rank: number | null;
  rank_position_overall: number | null;
}

interface OverallLeaderboardProps {
  mobile?: string;
}

export function OverallLeaderboard({ mobile }: OverallLeaderboardProps) {
  const [entries, setEntries] = useState<OverallEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchOverall = useCallback(async () => {
    const { data } = await supabase
      .from('leaderboard_overall')
      .select('mobile, player_name, total_points_overall, correct_predictions_overall, total_predictions_overall, matches_participated, matches_won, best_match_rank, rank_position_overall')
      .order('rank_position_overall', { ascending: true, nullsFirst: false })
      .limit(50);

    if (data) setEntries(data as OverallEntry[]);
    setLoading(false);
  }, []);

  const debouncedFetch = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchOverall, 300);
  }, [fetchOverall]);

  const subscriptions = useMemo(() => [
    {
      event: '*' as const,
      schema: 'public',
      table: 'leaderboard_overall',
      callback: debouncedFetch,
    },
  ], [debouncedFetch]);

  useRealtimeChannel('overall-leaderboard', subscriptions, fetchOverall);

  useEffect(() => { fetchOverall(); }, [fetchOverall]);
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-4 w-4 text-secondary" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-muted-foreground" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-primary" />;
    return <span className="text-xs font-bold text-muted-foreground w-4 text-center tabular-nums">{rank}</span>;
  };

  if (loading) {
    return (
      <GlassCard className="overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="h-4 w-40 skeleton rounded animate-pulse" />
        </div>
        <div className="divide-y divide-border/30">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3.5 animate-pulse">
              <div className="w-6 h-4 skeleton rounded shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 skeleton rounded w-3/4" />
                <div className="h-3 skeleton rounded w-1/2" />
              </div>
              <div className="h-4 w-12 skeleton rounded shrink-0" />
            </div>
          ))}
        </div>
      </GlassCard>
    );
  }

  if (entries.length === 0) {
    return (
      <GlassCard className="p-5 text-center">
        <Star className="h-8 w-8 text-primary/30 mx-auto mb-2" />
        <p className="text-foreground font-bold">Season Leaderboard</p>
        <p className="text-muted-foreground text-sm">No data yet — play matches to appear here!</p>
      </GlassCard>
    );
  }

  const myEntry = mobile ? entries.find(e => e.mobile === mobile) : null;

  return (
    <div className="space-y-3">
      {/* My overall stats card */}
      {myEntry && (
        <GlassCard className="p-3 border border-primary/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-primary">
              #{myEntry.rank_position_overall} Season Rank
            </span>
            <span className="text-primary font-bold text-sm">
              {myEntry.total_points_overall} pts
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">{myEntry.matches_participated}</p>
              <p className="text-[10px] text-muted-foreground">Matches</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{myEntry.matches_won}</p>
              <p className="text-[10px] text-muted-foreground">Wins</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">
                {myEntry.total_predictions_overall > 0
                  ? ((myEntry.correct_predictions_overall / myEntry.total_predictions_overall) * 100).toFixed(0) + '%'
                  : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground">Accuracy</p>
            </div>
          </div>
        </GlassCard>
      )}

      <GlassCard className="overflow-hidden">
        <div className="p-3 border-b border-border">
          <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> Season Leaderboard
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cumulative points across all matches — fun rankings only
          </p>
        </div>
        <div className="divide-y divide-border/30">
          {entries.map((entry, i) => {
            const rank = entry.rank_position_overall ?? (i + 1);
            const isMe = !!(mobile && entry.mobile === mobile);
            const acc = entry.total_predictions_overall > 0
              ? ((entry.correct_predictions_overall / entry.total_predictions_overall) * 100).toFixed(0) + '%'
              : null;

            return (
              <div
                key={entry.mobile}
                className={`flex items-center gap-3 px-3 py-3 transition-all duration-300 ${
                  isMe ? 'bg-primary/15 border-l-2 border-primary' :
                  rank === 1 ? 'bg-secondary/10' :
                  rank === 2 ? 'bg-muted/30' :
                  rank === 3 ? 'bg-primary/5' : ''
                }`}
              >
                <div className="w-6 flex-shrink-0 flex justify-center">
                  {getRankIcon(rank)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isMe ? 'text-primary' : 'text-foreground'}`}>
                    {entry.player_name || `••••${entry.mobile.slice(-4)}`}
                    {isMe && <span className="ml-1.5 text-xs font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">you</span>}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{entry.matches_participated} match{entry.matches_participated !== 1 ? 'es' : ''}</span>
                    {entry.matches_won > 0 && (
                      <span className="text-secondary font-medium flex items-center gap-0.5">
                        <Trophy className="h-2.5 w-2.5" /> {entry.matches_won} win{entry.matches_won !== 1 ? 's' : ''}
                      </span>
                    )}
                    {acc && <span className="text-primary/70 font-medium">{acc}</span>}
                  </div>
                </div>
                <span className={`font-bold text-sm flex-shrink-0 tabular-nums ${isMe ? 'text-primary' : 'text-foreground'}`}>
                  {entry.total_points_overall} <span className="text-xs font-normal text-muted-foreground">pts</span>
                </span>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
