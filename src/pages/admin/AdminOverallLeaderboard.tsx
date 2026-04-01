import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import { useToast } from '@/hooks/use-toast';
import {
  Trophy, Download, Search, AlertTriangle, RefreshCw, Crown, Eye,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface OverallEntry {
  id: string;
  mobile: string;
  player_name: string | null;
  total_points_overall: number;
  correct_predictions_overall: number;
  total_predictions_overall: number;
  matches_participated: number;
  matches_won: number;
  best_match_rank: number | null;
  rank_position_overall: number | null;
  last_updated: string;
}

interface MatchHistoryEntry {
  match_id: string;
  player_name: string | null;
  final_rank: number | null;
  final_points: number;
  correct_predictions: number;
  total_predictions: number;
  accuracy_percentage: number;
  participated_at: string;
}

export default function AdminOverallLeaderboard() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<OverallEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // History dialog
  const [historyMobile, setHistoryMobile] = useState<string | null>(null);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    const { data } = await supabase
      .from('leaderboard_overall')
      .select('*')
      .order('rank_position_overall', { ascending: true, nullsFirst: false });
    if (data) setEntries(data as OverallEntry[]);
    setLoading(false);
  }, []);

  const debouncedFetch = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchEntries, 300);
  }, [fetchEntries]);

  const subscriptions = useMemo(() => [
    { event: '*' as const, schema: 'public', table: 'leaderboard_overall', callback: debouncedFetch },
  ], [debouncedFetch]);

  useRealtimeChannel('admin-overall-lb', subscriptions, fetchEntries);
  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // CSV export
  const handleExport = () => {
    const disclaimer = '# Fun entertainment leaderboard. Points have no monetary value.';
    const header = 'Rank,Name,Mobile,Total Points,Matches,Wins,Best Rank,Accuracy';
    const rows = entries.map((e, i) => {
      const acc = e.total_predictions_overall > 0
        ? ((e.correct_predictions_overall / e.total_predictions_overall) * 100).toFixed(1) + '%'
        : '0%';
      return `${e.rank_position_overall ?? i + 1},${(e.player_name || e.mobile).replace(/,/g, ' ')},${e.mobile},${e.total_points_overall},${e.matches_participated},${e.matches_won},${e.best_match_rank || '-'},${acc}`;
    });
    const csv = [disclaimer, header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `season-leaderboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // View player history
  const viewHistory = async (mobile: string) => {
    setHistoryMobile(mobile);
    setHistoryLoading(true);
    const { data } = await supabase
      .from('leaderboard_match_history')
      .select('match_id, player_name, final_rank, final_points, correct_predictions, total_predictions, accuracy_percentage, participated_at')
      .eq('mobile', mobile)
      .order('participated_at', { ascending: false });
    setHistory((data as MatchHistoryEntry[]) || []);
    setHistoryLoading(false);
  };

  const filtered = useMemo(() =>
    search.trim()
      ? entries.filter(e =>
          (e.player_name || '').toLowerCase().includes(search.toLowerCase()) ||
          e.mobile.includes(search)
        )
      : entries,
    [entries, search]
  );

  return (
    <div className="space-y-5 p-1">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/60 border border-border text-muted-foreground text-xs">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-accent-foreground" />
        <span><strong>Entertainment only.</strong> Points have no monetary value. Season leaderboard for fun rewards only.</span>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" /> Season Leaderboard
            <span className="text-xs font-normal text-muted-foreground">({entries.length} players)</span>
          </h3>
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input
              placeholder="Search name or mobile…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={fetchEntries}>
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport} disabled={entries.length === 0}>
              <Download className="h-3 w-3 mr-1" /> Export
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No players found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Player</th>
                  <th className="px-3 py-2 text-right">Points</th>
                  <th className="px-3 py-2 text-right">Matches</th>
                  <th className="px-3 py-2 text-right">Wins</th>
                  <th className="px-3 py-2 text-right">Best</th>
                  <th className="px-3 py-2 text-right">Accuracy</th>
                  <th className="px-3 py-2 text-center">History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((e, i) => {
                  const rank = e.rank_position_overall ?? i + 1;
                  const acc = e.total_predictions_overall > 0
                    ? ((e.correct_predictions_overall / e.total_predictions_overall) * 100).toFixed(1) + '%'
                    : '—';
                  return (
                    <tr key={e.id} className={rank <= 3 ? 'bg-primary/5' : ''}>
                      <td className="px-3 py-2.5 font-bold text-muted-foreground">{rank}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-foreground truncate max-w-[200px]">
                          {e.player_name || `••••${e.mobile.slice(-4)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">{e.mobile}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-foreground">{e.total_points_overall}</td>
                      <td className="px-3 py-2.5 text-right">{e.matches_participated}</td>
                      <td className="px-3 py-2.5 text-right">{e.matches_won}</td>
                      <td className="px-3 py-2.5 text-right">{e.best_match_rank || '—'}</td>
                      <td className="px-3 py-2.5 text-right text-primary">{acc}</td>
                      <td className="px-3 py-2.5 text-center">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => viewHistory(e.mobile)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* History dialog */}
      <Dialog open={!!historyMobile} onOpenChange={() => setHistoryMobile(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Match History — {historyMobile}
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground p-4 text-center">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">No match history found</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/40 border border-border/50 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">
                      Rank #{h.final_rank || '—'}
                    </span>
                    <span className="font-bold text-primary">{h.final_points} pts</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{h.correct_predictions}/{h.total_predictions} correct</span>
                    <span>{h.accuracy_percentage.toFixed(1)}%</span>
                    <span>{new Date(h.participated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
