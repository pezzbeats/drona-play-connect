import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { Trophy, Medal, Star, TrendingUp } from 'lucide-react';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

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
  mobile?: string;
}

export function Leaderboard({ matchId, mobile }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [improvedMobiles, setImprovedMobiles] = useState<Set<string>>(new Set());
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const flashTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchLeaderboard = useCallback(async () => {
    const { data } = await supabase
      .from('leaderboard')
      .select('mobile, player_name, total_points, points_adjustment, correct_predictions, total_predictions, rank_position')
      .eq('match_id', matchId)
      .order('rank_position', { ascending: true, nullsFirst: false })
      .limit(20);

    if (data) {
      const newEntries = data as LeaderboardEntry[];

      // Compare ranks to detect improvements
      const improved = new Set<string>();
      newEntries.forEach(entry => {
        const newRank = entry.rank_position ?? 999;
        const prevRank = prevRanksRef.current.get(entry.mobile);
        if (prevRank !== undefined && newRank < prevRank) {
          improved.add(entry.mobile);
        }
      });

      // Update prev ranks map
      const newRanksMap = new Map<string, number>();
      newEntries.forEach(e => newRanksMap.set(e.mobile, e.rank_position ?? 999));
      prevRanksRef.current = newRanksMap;

      // Flash improved rows then clear after 1.6s
      if (improved.size > 0) {
        setImprovedMobiles(prev => new Set([...prev, ...improved]));
        improved.forEach(m => {
          // Clear any existing timer for this mobile
          const existing = flashTimersRef.current.get(m);
          if (existing) clearTimeout(existing);
          const timer = setTimeout(() => {
            setImprovedMobiles(prev => {
              const next = new Set(prev);
              next.delete(m);
              return next;
            });
            flashTimersRef.current.delete(m);
          }, 1600);
          flashTimersRef.current.set(m, timer);
        });
      }

      setEntries(newEntries);
    }
    setLoading(false);
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
  useEffect(() => () => {
    clearTimeout(debounceRef.current);
    flashTimersRef.current.forEach(t => clearTimeout(t));
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4 text-secondary" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-muted-foreground" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-primary" />;
    return <span className="text-xs font-bold text-muted-foreground w-4 text-center tabular-nums">{rank}</span>;
  };

  const getRowBg = (rank: number, isMe: boolean, isImproved: boolean) => {
    if (isImproved) return 'bg-success/20 border-l-2 border-success';
    if (isMe) return 'bg-primary/15 border-l-2 border-primary';
    if (rank === 1) return 'bg-secondary/10';
    if (rank === 2) return 'bg-muted/30';
    if (rank === 3) return 'bg-primary/5';
    return '';
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <GlassCard className="p-3 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-4 w-8 skeleton rounded" />
              <div className="h-4 w-24 skeleton rounded" />
            </div>
            <div className="h-4 w-14 skeleton rounded" />
          </div>
        </GlassCard>
        <GlassCard className="overflow-hidden">
          <div className="p-3 border-b border-border">
            <div className="h-4 w-40 skeleton rounded" />
            <div className="h-3 w-56 skeleton rounded mt-2" />
          </div>
          <div className="divide-y divide-border/30">
            {Array.from({ length: 7 }).map((_, i) => (
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
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <GlassCard className="p-5 text-center">
        <Star className="h-8 w-8 text-primary/30 mx-auto mb-2" />
        <p className="text-foreground font-bold">Leaderboard Empty</p>
        <p className="text-muted-foreground text-sm">Make guesses to appear here</p>
        <p className="text-xs text-muted-foreground mt-2">Fun participation rankings only — no cash prize</p>
      </GlassCard>
    );
  }

  const myIdx = mobile ? entries.findIndex(e => e.mobile === mobile) : -1;
  const myEntry = myIdx >= 0 ? entries[myIdx] : null;
  const myRank = myEntry?.rank_position ?? (myIdx >= 0 ? myIdx + 1 : -1);

  return (
    <div className="space-y-3">
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
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> Fun Guess Leaderboard
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Fun participation rankings — no cash prize, entertainment only</p>
        </div>
        <div className="divide-y divide-border/30">
          {entries.map((entry, i) => {
            const rank = entry.rank_position ?? (i + 1);
            const isMe = !!(mobile && entry.mobile === mobile);
            const isImproved = improvedMobiles.has(entry.mobile);
            const totalPts = (entry.total_points || 0) + (entry.points_adjustment || 0);
            const acc = entry.total_predictions > 0
              ? ((entry.correct_predictions / entry.total_predictions) * 100).toFixed(0) + '%'
              : null;

            return (
              <div
                key={entry.mobile}
                className={`flex items-center gap-3 px-3 py-3.5 transition-all duration-500 animate-slide-up ${getRowBg(rank, isMe, isImproved)}`}
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' } as React.CSSProperties}
              >
                <div className="w-6 flex-shrink-0 flex justify-center">
                  {isImproved
                    ? <TrendingUp className="h-4 w-4 text-success animate-pulse" />
                    : getRankIcon(rank)
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isImproved ? 'text-success' : isMe ? 'text-primary' : 'text-foreground'}`}>
                    {entry.player_name || `••••${entry.mobile.slice(-4)}`}
                    {isMe && !isImproved && <span className="ml-1.5 text-xs font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">you</span>}
                    {isImproved && <span className="ml-1.5 text-xs font-bold bg-success/20 text-success px-1.5 py-0.5 rounded-full">↑ up</span>}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{entry.correct_predictions}/{entry.total_predictions} correct</span>
                    {acc && <span className="text-primary/70 font-medium">{acc}</span>}
                  </div>
                </div>
                <span className={`font-bold text-sm flex-shrink-0 tabular-nums ${isImproved ? 'text-success' : isMe ? 'text-primary' : 'text-foreground'}`}>
                  {totalPts} <span className="text-xs font-normal text-muted-foreground">pts</span>
                </span>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
