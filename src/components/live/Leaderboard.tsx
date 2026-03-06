import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { Trophy, Medal, Star } from 'lucide-react';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';

interface LeaderboardEntry {
  mobile: string;
  player_name: string | null;
  total_points: number;
  points_adjustment: number;
  correct_predictions: number;
  total_predictions: number;
  rank_position: number | null;
}

interface LeaderboardProps {
  matchId: string;
  mobile?: string; // highlight this user
}

export function Leaderboard({ matchId, mobile }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchLeaderboard = useCallback(async () => {
    const { data } = await supabase
      .from('leaderboard')
      .select('mobile, player_name, total_points, points_adjustment, correct_predictions, total_predictions, rank_position')
      .eq('match_id', matchId)
      .order('rank_position', { ascending: true, nullsFirst: false })
      .limit(20);

    if (data) setEntries(data as LeaderboardEntry[]);
  }, [matchId]);

  const debouncedFetch = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchLeaderboard(), 200);
  }, [fetchLeaderboard]);

  const subscriptions = useMemo(() => [
    {
      event: '*' as const,
      schema: 'public',
      table: 'leaderboard',
      filter: `match_id=eq.${matchId}`,
      callback: debouncedFetch,
    },
  ], [matchId, debouncedFetch]);

  useRealtimeChannel(
    `leaderboard-${matchId}`,
    subscriptions,
    fetchLeaderboard,
  );

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4 text-primary" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-muted-foreground" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-accent-foreground" />;
    return <span className="text-xs text-muted-foreground w-4 text-center">{rank}</span>;
  };

  if (entries.length === 0) {
    return (
      <GlassCard className="p-5 text-center">
        <Star className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-foreground font-bold">Leaderboard Empty</p>
        <p className="text-muted-foreground text-sm">Make predictions to appear here</p>
      </GlassCard>
    );
  }

  // Find "my" position using rank_position or fallback index
  const myIdx = mobile ? entries.findIndex(e => e.mobile === mobile) : -1;
  const myEntry = myIdx >= 0 ? entries[myIdx] : null;
  const myRank = myEntry?.rank_position ?? (myIdx >= 0 ? myIdx + 1 : -1);

  return (
    <div className="space-y-3">
      {/* My rank card if outside top 10 visible */}
      {myEntry && myRank > 10 && (
        <GlassCard className="p-3 border border-primary/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary">#{myRank}</span>
              <span className="text-sm font-medium text-foreground">
                {myEntry.player_name || 'You'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {myEntry.total_predictions > 0 && (
                <span className="text-xs text-muted-foreground">
                  {((myEntry.correct_predictions / myEntry.total_predictions) * 100).toFixed(0)}% acc
                </span>
              )}
              <span className="text-primary font-bold text-sm">
                {(myEntry.total_points + (myEntry.points_adjustment || 0))} pts
              </span>
            </div>
          </div>
        </GlassCard>
      )}

      <GlassCard className="overflow-hidden">
        <div className="p-3 border-b border-border">
          <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> Leaderboard
          </h3>
        </div>
        <div className="divide-y divide-border/30">
          {entries.map((entry, i) => {
            const rank = entry.rank_position ?? (i + 1);
            const isMe = mobile && entry.mobile === mobile;
            const totalPts = (entry.total_points || 0) + (entry.points_adjustment || 0);
            const acc = entry.total_predictions > 0
              ? ((entry.correct_predictions / entry.total_predictions) * 100).toFixed(0) + '%'
              : null;

            return (
              <div
                key={entry.mobile}
                className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${isMe ? 'bg-primary/10' : ''}`}
              >
                <div className="w-5 flex-shrink-0 flex justify-center">
                  {getRankIcon(rank)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isMe ? 'text-primary' : 'text-foreground'}`}>
                    {entry.player_name || entry.mobile.slice(-4).padStart(10, '•')}
                    {isMe && <span className="ml-1 text-xs">(you)</span>}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{entry.correct_predictions}/{entry.total_predictions} correct</span>
                    {acc && <span className="text-primary/70">{acc}</span>}
                  </div>
                </div>
                <span className={`font-bold text-sm flex-shrink-0 ${isMe ? 'text-primary' : 'text-foreground'}`}>
                  {totalPts}
                </span>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
