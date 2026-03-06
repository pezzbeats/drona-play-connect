import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import { useToast } from '@/hooks/use-toast';
import {
  Trophy, Download, Snowflake, Flame, Search, Pencil, Check, X,
  AlertTriangle, RefreshCw, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
interface Match { id: string; name: string; }

interface ScoringConfig {
  match_id: string;
  points_per_correct: number;
  points_per_over_correct: number;
  speed_bonus_enabled: boolean;
  speed_bonus_points: number;
  speed_bonus_first_n: number;
  tiebreaker_mode: string;
  leaderboard_frozen: boolean;
}

interface LeaderboardEntry {
  id: string;
  mobile: string;
  player_name: string | null;
  total_points: number;
  points_adjustment: number;
  adjustment_reason: string | null;
  correct_predictions: number;
  total_predictions: number;
  tiebreaker_score: number;
  last_correct_at: string | null;
  last_updated: string;
  rank_position: number | null;
}

const DEFAULT_CONFIG: Omit<ScoringConfig, 'match_id'> = {
  points_per_correct: 10,
  points_per_over_correct: 25,
  speed_bonus_enabled: false,
  speed_bonus_points: 5,
  speed_bonus_first_n: 10,
  tiebreaker_mode: 'accuracy',
  leaderboard_frozen: false,
};

// ──────────────────────────────────────────────────────────────────────────────
export default function AdminLeaderboard() {
  const { toast } = useToast();

  // Match list & selection
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');

  // Scoring config
  const [config, setConfig] = useState<Omit<ScoringConfig, 'match_id'>>(DEFAULT_CONFIG);
  const [configDirty, setConfigDirty] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Leaderboard entries
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [search, setSearch] = useState('');

  // Inline adjustment state: row id → {delta, reason}
  const [adjusting, setAdjusting] = useState<Record<string, { delta: string; reason: string }>>({});
  const [savingAdj, setSavingAdj] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Fetch matches ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('matches').select('id, name').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) {
        setMatches(data);
        if (data.length > 0) setSelectedMatchId(data[0].id);
      }
    });
  }, []);

  // ── Fetch scoring config ──────────────────────────────────────────────────
  const fetchConfig = useCallback(async (mId: string) => {
    const { data } = await supabase
      .from('match_scoring_config')
      .select('*')
      .eq('match_id', mId)
      .maybeSingle();
    setConfig({ ...DEFAULT_CONFIG, ...(data || {}) });
    setConfigDirty(false);
  }, []);

  // ── Fetch leaderboard ─────────────────────────────────────────────────────
  const fetchLeaderboard = useCallback(async () => {
    if (!selectedMatchId) return;
    const { data } = await supabase
      .from('leaderboard')
      .select('id, mobile, player_name, total_points, points_adjustment, adjustment_reason, correct_predictions, total_predictions, tiebreaker_score, last_correct_at, last_updated, rank_position')
      .eq('match_id', selectedMatchId)
      .order('rank_position', { ascending: true, nullsFirst: false });
    if (data) setEntries(data as LeaderboardEntry[]);
  }, [selectedMatchId]);

  const debouncedFetch = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchLeaderboard, 300);
  }, [fetchLeaderboard]);

  useEffect(() => {
    if (!selectedMatchId) return;
    fetchConfig(selectedMatchId);
    fetchLeaderboard();
  }, [selectedMatchId, fetchConfig, fetchLeaderboard]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // ── Realtime ──────────────────────────────────────────────────────────────
  const subscriptions = useMemo(() => selectedMatchId ? [
    {
      event: '*' as const,
      schema: 'public',
      table: 'leaderboard',
      filter: `match_id=eq.${selectedMatchId}`,
      callback: debouncedFetch,
    },
  ] : [], [selectedMatchId, debouncedFetch]);

  useRealtimeChannel(`admin-leaderboard-${selectedMatchId}`, subscriptions, fetchLeaderboard);

  // ── Save scoring config ───────────────────────────────────────────────────
  const handleSaveConfig = async () => {
    if (!selectedMatchId) return;
    setSavingConfig(true);
    const { error } = await supabase
      .from('match_scoring_config')
      .upsert({ match_id: selectedMatchId, ...config, updated_at: new Date().toISOString() });
    setSavingConfig(false);
    if (error) {
      toast({ title: 'Error saving config', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Config saved' });
      setConfigDirty(false);
    }
  };

  // ── Toggle freeze ─────────────────────────────────────────────────────────
  const handleToggleFreeze = async () => {
    if (!selectedMatchId) return;
    const newFrozen = !config.leaderboard_frozen;
    const { error } = await supabase
      .from('match_scoring_config')
      .upsert({ match_id: selectedMatchId, ...config, leaderboard_frozen: newFrozen, updated_at: new Date().toISOString() });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setConfig(c => ({ ...c, leaderboard_frozen: newFrozen }));
      toast({ title: newFrozen ? '❄️ Leaderboard frozen' : '🔥 Leaderboard unfrozen' });
    }
  };

  // ── Inline adjustment ─────────────────────────────────────────────────────
  const startAdjust = (id: string, current: number, reason: string | null) => {
    setAdjusting(a => ({ ...a, [id]: { delta: current.toString(), reason: reason || '' } }));
  };

  const cancelAdjust = (id: string) => {
    setAdjusting(a => { const n = { ...a }; delete n[id]; return n; });
  };

  const saveAdjust = async (entry: LeaderboardEntry) => {
    setSavingAdj(entry.id);
    const delta = parseInt(adjusting[entry.id]?.delta || '0', 10);
    const reason = adjusting[entry.id]?.reason || null;
    const { error } = await supabase
      .from('leaderboard')
      .update({ points_adjustment: delta, adjustment_reason: reason, last_updated: new Date().toISOString() })
      .eq('id', entry.id);
    setSavingAdj(null);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      cancelAdjust(entry.id);
      toast({ title: 'Adjustment saved' });
      fetchLeaderboard();
    }
  };

  // ── CSV export ────────────────────────────────────────────────────────────
  const handleExport = () => {
    const matchName = matches.find(m => m.id === selectedMatchId)?.name || 'match';
    const disclaimer = '# DISCLAIMER: This is a fun entertainment leaderboard. Points have no monetary value. No gambling or wagering.';
    const header = 'Rank,Name,Mobile,Points,Adjustment,Total,Accuracy,Windows Predicted,Last Correct';
    const rows = entries.map((e, i) => {
      const total = (e.total_points || 0) + (e.points_adjustment || 0);
      const acc = e.total_predictions > 0
        ? ((e.correct_predictions / e.total_predictions) * 100).toFixed(1) + '%'
        : '0%';
      const lastCorrect = e.last_correct_at
        ? new Date(e.last_correct_at).toLocaleString()
        : '-';
      const rank = e.rank_position ?? i + 1;
      const name = (e.player_name || e.mobile).replace(/,/g, ' ');
      return `${rank},${name},${e.mobile},${e.total_points},${e.points_adjustment},${total},${acc},${e.total_predictions},${lastCorrect}`;
    });
    const csv = [disclaimer, header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leaderboard-${matchName.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Filtered entries ──────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    search.trim()
      ? entries.filter(e =>
          (e.player_name || '').toLowerCase().includes(search.toLowerCase()) ||
          e.mobile.includes(search)
        )
      : entries,
    [entries, search]
  );

  const updateConfig = <K extends keyof typeof DEFAULT_CONFIG>(k: K, v: typeof DEFAULT_CONFIG[K]) => {
    setConfig(c => ({ ...c, [k]: v }));
    setConfigDirty(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 p-1">
      {/* Disclaimer banner */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/60 border border-border text-muted-foreground text-xs">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-accent-foreground" />
        <span>
          <strong>Entertainment only.</strong> Points have no monetary value. This leaderboard is for fun rewards only — no gambling or wagering.
        </span>
      </div>

      {/* Match selector */}
      <GlassCard className="p-4">
        <Label className="text-xs text-muted-foreground mb-1 block">Match</Label>
        <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
          <SelectTrigger>
            <SelectValue placeholder="Select match…" />
          </SelectTrigger>
          <SelectContent>
            {matches.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </GlassCard>

      {selectedMatchId && (
        <>
          {/* Scoring config */}
          <GlassCard className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Scoring Config
              </h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleToggleFreeze}
                  className={config.leaderboard_frozen ? 'border-primary text-primary' : ''}
                >
                  {config.leaderboard_frozen
                    ? <><Snowflake className="h-3 w-3 mr-1" /> Frozen</>
                    : <><Flame className="h-3 w-3 mr-1" /> Live</>
                  }
                </Button>
                <Button size="sm" onClick={handleSaveConfig} disabled={!configDirty || savingConfig}>
                  {savingConfig ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Save'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Pts / Ball Correct</Label>
                <Input
                  type="number"
                  value={config.points_per_correct}
                  onChange={e => updateConfig('points_per_correct', parseInt(e.target.value) || 0)}
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Pts / Over Correct</Label>
                <Input
                  type="number"
                  value={config.points_per_over_correct}
                  onChange={e => updateConfig('points_per_over_correct', parseInt(e.target.value) || 0)}
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tiebreaker Mode</Label>
                <Select
                  value={config.tiebreaker_mode}
                  onValueChange={v => updateConfig('tiebreaker_mode', v)}
                >
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accuracy">Accuracy</SelectItem>
                    <SelectItem value="time">Fastest Response</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Speed bonus row */}
            <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-border/50">
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.speed_bonus_enabled}
                  onCheckedChange={v => updateConfig('speed_bonus_enabled', v)}
                />
                <Label className="text-xs text-muted-foreground">Speed Bonus</Label>
              </div>
              {config.speed_bonus_enabled && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">Bonus Pts</Label>
                    <Input
                      type="number"
                      value={config.speed_bonus_points}
                      onChange={e => updateConfig('speed_bonus_points', parseInt(e.target.value) || 0)}
                      className="mt-1 h-7 text-xs w-20"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">First N Correct</Label>
                    <Input
                      type="number"
                      value={config.speed_bonus_first_n}
                      onChange={e => updateConfig('speed_bonus_first_n', parseInt(e.target.value) || 0)}
                      className="mt-1 h-7 text-xs w-20"
                    />
                  </div>
                </>
              )}
            </div>
          </GlassCard>

          {/* Leaderboard table */}
          <GlassCard className="overflow-hidden">
            <div className="p-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" /> Leaderboard
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
              <Button size="sm" variant="outline" onClick={handleExport} disabled={entries.length === 0}>
                <Download className="h-3 w-3 mr-1" /> Export CSV
              </Button>
            </div>

            {config.leaderboard_frozen && (
              <div className="bg-primary/10 border-b border-primary/20 px-3 py-1.5 flex items-center gap-2 text-xs text-primary">
                <Snowflake className="h-3 w-3" />
                Leaderboard is frozen — points won't update until unfrozen
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="px-3 py-2 text-left w-10">#</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-right">Points</th>
                    <th className="px-3 py-2 text-right">Adj.</th>
                    <th className="px-3 py-2 text-right font-bold">Total</th>
                    <th className="px-3 py-2 text-right">Accuracy</th>
                    <th className="px-3 py-2 text-right">Windows</th>
                    <th className="px-3 py-2 text-right">Last Correct</th>
                    <th className="px-3 py-2 text-center w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                        No entries yet
                      </td>
                    </tr>
                  ) : (
                    filtered.map((entry, i) => {
                      const rank = entry.rank_position ?? i + 1;
                      const total = (entry.total_points || 0) + (entry.points_adjustment || 0);
                      const acc = entry.total_predictions > 0
                        ? ((entry.correct_predictions / entry.total_predictions) * 100).toFixed(0) + '%'
                        : '-';
                      const isAdj = !!adjusting[entry.id];

                      return (
                        <tr key={entry.id} className={cn('hover:bg-muted/30 transition-colors', isAdj && 'bg-primary/5')}>
                          <td className="px-3 py-2 text-muted-foreground">{rank}</td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-foreground">{entry.player_name || '—'}</p>
                            <p className="text-muted-foreground">{entry.mobile}</p>
                          </td>
                          <td className="px-3 py-2 text-right text-foreground">{entry.total_points}</td>
                          <td className="px-3 py-2 text-right">
                            {isAdj ? (
                              <Input
                                type="number"
                                value={adjusting[entry.id].delta}
                                onChange={e => setAdjusting(a => ({ ...a, [entry.id]: { ...a[entry.id], delta: e.target.value } }))}
                                className="h-6 w-16 text-xs text-right ml-auto"
                              />
                            ) : (
                              <span className={entry.points_adjustment !== 0 ? (entry.points_adjustment > 0 ? 'text-primary' : 'text-destructive') : 'text-muted-foreground'}>
                                {entry.points_adjustment > 0 ? '+' : ''}{entry.points_adjustment}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-foreground">{total}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{acc}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{entry.total_predictions}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">
                            {entry.last_correct_at
                              ? new Date(entry.last_correct_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '-'}
                          </td>
                          <td className="px-3 py-2">
                            {isAdj ? (
                              <div className="flex flex-col gap-1">
                                <Input
                                  placeholder="Reason…"
                                  value={adjusting[entry.id].reason}
                                  onChange={e => setAdjusting(a => ({ ...a, [entry.id]: { ...a[entry.id], reason: e.target.value } }))}
                                  className="h-6 text-xs"
                                />
                                <div className="flex gap-1 justify-center">
                                  <button
                                    onClick={() => saveAdjust(entry)}
                                    disabled={savingAdj === entry.id}
                                    className="p-1 rounded hover:bg-primary/20 text-primary"
                                  >
                                    {savingAdj === entry.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                  </button>
                                  <button
                                    onClick={() => cancelAdjust(entry.id)}
                                    className="p-1 rounded hover:bg-destructive/20 text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => startAdjust(entry.id, entry.points_adjustment, entry.adjustment_reason)}
                                className="mx-auto flex items-center gap-1 p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                                title="Adjust points"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}
