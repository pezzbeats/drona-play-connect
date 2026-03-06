import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { Trophy, Medal, Star } from 'lucide-react';

interface LeaderboardEntry {
  mobile: string;
  player_name: string | null;
  total_points: number;
  correct_predictions: number;
  total_predictions: number;
}

interface LeaderboardProps {
  matchId: string;
  mobile?: string; // highlight this user
}

export function Leaderboard({ matchId, mobile }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    fetchLeaderboard();
    subscribeRealtime();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [matchId]);

  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from('leaderboard')
      .select('mobile, player_name, total_points, correct_predictions, total_predictions')
      .eq('match_id', matchId)
      .order('total_points', { ascending: false })
      .limit(20);

    if (data) setEntries(data);
  };

  const subscribeRealtime = () => {
    const channel = supabase
      .channel(`leaderboard-${matchId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leaderboard',
        filter: `match_id=eq.${matchId}`,
      }, () => {
        fetchLeaderboard();
      })
      .subscribe();
    channelRef.current = channel;
  };

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

  const myRank = mobile ? entries.findIndex(e => e.mobile === mobile) + 1 : -1;
  const myEntry = mobile ? entries.find(e => e.mobile === mobile) : null;

  return (
    <div className="space-y-3">
      {/* My rank card if not in top 20 visible area */}
      {myEntry && myRank > 10 && (
        <GlassCard className="p-3 border border-primary/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary">#{myRank}</span>
              <span className="text-sm font-medium text-foreground">
                {myEntry.player_name || 'You'}
              </span>
            </div>
            <span className="text-primary font-bold text-sm">{myEntry.total_points} pts</span>
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
            const rank = i + 1;
            const isMe = mobile && entry.mobile === mobile;
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
                  <p className="text-xs text-muted-foreground">
                    {entry.correct_predictions}/{entry.total_predictions} correct
                  </p>
                </div>
                <span className={`font-bold text-sm flex-shrink-0 ${isMe ? 'text-primary' : 'text-foreground'}`}>
                  {entry.total_points}
                </span>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
