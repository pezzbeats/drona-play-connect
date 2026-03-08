import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import {
  Loader2, Zap, Trophy, Users, ScanLine, CheckCircle, AlertCircle,
  Wifi, WifiOff, Loader, ShieldAlert, Lock, Unlock, AlertTriangle,
  UserPlus, RefreshCw, ArrowLeftRight, Swords, ChevronDown, ChevronUp,
  List, Play, Square, Flag, Shield,
} from 'lucide-react';

// ── Shared Ball Outcomes ───────────────────────────────────────────────────────
export const BALL_OUTCOMES = [
  { key: 'dot_ball',   label: 'Dot',      emoji: '•',  colorCls: 'border-border/60 text-muted-foreground' },
  { key: 'runs_1',     label: '1',        emoji: '1',  colorCls: 'border-border/60 text-foreground' },
  { key: 'runs_2',     label: '2',        emoji: '2',  colorCls: 'border-border/60 text-foreground' },
  { key: 'runs_3',     label: '3',        emoji: '3',  colorCls: 'border-border/60 text-foreground' },
  { key: 'boundary_4', label: '4',        emoji: '4',  colorCls: 'border-warning/60 text-warning' },
  { key: 'six_6',      label: '6',        emoji: '6',  colorCls: 'border-primary/70 text-primary' },
  { key: 'wide',       label: 'Wide',     emoji: 'WD', colorCls: 'border-warning/50 text-warning' },
  { key: 'no_ball',    label: 'No Ball',  emoji: 'NB', colorCls: 'border-warning/50 text-warning' },
  { key: 'byes',       label: 'Byes',     emoji: 'B',  colorCls: 'border-muted text-muted-foreground' },
  { key: 'leg_byes',   label: 'Leg Byes', emoji: 'LB', colorCls: 'border-muted text-muted-foreground' },
  { key: 'wicket',     label: 'Wicket',   emoji: 'W',  colorCls: 'border-destructive/70 text-destructive' },
] as const;

export type BallOutcomeKey = typeof BALL_OUTCOMES[number]['key'];

/** Derive the canonical outcome key from delivery fields — mirrors resolution logic */
export function deriveOutcomeKey(params: {
  runs_off_bat: number;
  extras_type: string;
  is_wicket: boolean;
}): BallOutcomeKey {
  const { runs_off_bat, extras_type, is_wicket } = params;
  if (is_wicket) return 'wicket';
  if (extras_type === 'wide') return 'wide';
  if (extras_type === 'no_ball') return 'no_ball';
  if (extras_type === 'bye') return 'byes';
  if (extras_type === 'leg_bye') return 'leg_byes';
  if (runs_off_bat === 1) return 'runs_1';
  if (runs_off_bat === 2) return 'runs_2';
  if (runs_off_bat === 3) return 'runs_3';
  if (runs_off_bat === 4) return 'boundary_4';
  if (runs_off_bat === 6) return 'six_6';
  return 'dot_ball';
}

// ── Types ─────────────────────────────────────────────────────────────────────
type TabId = 'command' | 'roster' | 'overs' | 'prediction' | 'super_over';

const BASE_TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'command',    label: 'Command',    icon: Zap },
  { id: 'roster',     label: 'Roster',     icon: Users },
  { id: 'overs',      label: 'Overs',      icon: List },
  { id: 'prediction', label: 'Predict',    icon: Trophy },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function PhaseBadge({ phase }: { phase: string }) {
  const map: Record<string, string> = {
    pre: 'bg-muted text-muted-foreground',
    innings1: 'bg-success/20 text-success border border-success/40',
    break: 'bg-warning/20 text-warning border border-warning/40',
    innings2: 'bg-primary/20 text-primary border border-primary/40',
    super_over: 'bg-warning/20 text-warning border border-warning/40',
    ended: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${map[phase] || 'bg-muted text-muted-foreground'}`}>
      {phase?.replace('_', ' ') || '—'}
    </span>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ok ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
      {label}
    </span>
  );
}

function DeliveryPill({ d }: { d: any }) {
  const isWide = d.extras_type === 'wide';
  const isNB = d.extras_type === 'no_ball';
  const isIllegal = isWide || isNB;
  const total = (d.runs_off_bat || 0) + (d.extras_runs || 0);
  let label = '';
  let cls = 'bg-muted/50 text-foreground';
  if (d.is_wicket) { label = 'W'; cls = 'bg-destructive/30 text-destructive font-bold'; }
  else if (isWide) { label = `WD${d.extras_runs > 1 ? '+' + d.extras_runs : ''}`; cls = 'bg-warning/20 text-warning'; }
  else if (isNB) { label = `NB${total > 1 ? '+' + total : ''}`; cls = 'bg-warning/20 text-warning'; }
  else if (total === 6) { label = '6'; cls = 'bg-primary/30 text-primary font-bold'; }
  else if (total === 4) { label = '4'; cls = 'bg-accent/30 text-accent-foreground font-bold'; }
  else if (total === 0) { label = '•'; cls = 'bg-muted/40 text-muted-foreground'; }
  else { label = String(total); }
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border ${isIllegal ? 'border-dashed border-warning/40' : 'border-border/30'} ${cls}`}>
      {label}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminControl() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('command');
  const [match, setMatch] = useState<any>(null);
  const [liveState, setLiveState] = useState<any>(null);
  const [activeOver, setActiveOver] = useState<any>(null);
  const [allOvers, setAllOvers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [activeWindow, setActiveWindow] = useState<any>(null);
  const [stats, setStats] = useState({ registrations: 0, paid: 0, checkins: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Over deliveries (balls in current over)
  const [overDeliveries, setOverDeliveries] = useState<any[]>([]);
  const overLegalBalls = useMemo(() => overDeliveries.filter(d => d.extras_type !== 'wide' && d.extras_type !== 'no_ball').length, [overDeliveries]);

  // Wicket flow
  const [needsNewBatsman, setNeedsNewBatsman] = useState(false);
  const [incomingBatsman, setIncomingBatsman] = useState('');
  const [incomingPosition, setIncomingPosition] = useState<'striker' | 'non_striker'>('striker');

  // Panic flags
  const [matchFlags, setMatchFlags] = useState<any>(null);
  const [freezeReason, setFreezeReason] = useState('');
  const [flagLoading, setFlagLoading] = useState<string | null>(null);

  // Confirmation dialogs
  const [confirmDialog, setConfirmDialog] = useState<{ action: string; label: string; body: any; successMsg?: string } | null>(null);

  // Correction mode
  const [correctionMode, setCorrectionMode] = useState(false);
  const [voidingDelivery, setVoidingDelivery] = useState<string | null>(null);

  // Super Over state
  const [superOverRounds, setSuperOverRounds] = useState<any[]>([]);
  const [soConfirmDialog, setSoConfirmDialog] = useState<{ action: string; label: string; body: any } | null>(null);

  // Delivery form state
  const [delivery, setDelivery] = useState({
    striker_id: '', non_striker_id: '', bowler_id: '',
    runs_off_bat: '0', extras_type: 'none', extras_runs: '0',
    is_wicket: false, wicket_type: '', out_player_id: '', fielder_id: '',
    free_hit: false, notes: '', auto_rotate: true,
  });

  // Bowler override for over
  const [overBowler, setOverBowler] = useState('');

  // Primary ball outcome selection (drives delivery form prefill)
  const [selectedOutcome, setSelectedOutcome] = useState<BallOutcomeKey | null>(null);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: matchData } = await supabase
      .from('matches').select('*').eq('is_active_for_registration', true).single();

    if (!matchData) { setLoading(false); return; }
    setMatch(matchData);

    const [stateRes, overRes, allOversRes, windowRes, ordersRes, ticketsRes, flagsRes, rosterRes, roundsRes] = await Promise.all([
      supabase.from('match_live_state').select('*').eq('match_id', matchData.id).single(),
      supabase.from('over_control').select('*').eq('match_id', matchData.id).eq('status', 'active').limit(1).maybeSingle(),
      supabase.from('over_control').select('*, players(name)').eq('match_id', matchData.id).order('innings_no').order('over_no'),
      supabase.from('prediction_windows').select('*').eq('match_id', matchData.id).eq('status', 'open').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('orders').select('id, payment_status').eq('match_id', matchData.id),
      supabase.from('tickets').select('id, status').eq('match_id', matchData.id),
      supabase.from('match_flags').select('*').eq('match_id', matchData.id).maybeSingle(),
      supabase.from('match_roster').select('*, teams(*)').eq('match_id', matchData.id),
      supabase.from('super_over_rounds').select('*, team_a:teams!super_over_rounds_team_a_id_fkey(name,short_code), team_b:teams!super_over_rounds_team_b_id_fkey(name,short_code), winner:teams!super_over_rounds_winner_team_id_fkey(name,short_code)').eq('match_id', matchData.id).order('round_number'),
    ]);

    setLiveState(stateRes.data);
    setActiveOver(overRes.data);
    setAllOvers(allOversRes.data || []);
    setActiveWindow(windowRes.data);
    setMatchFlags(flagsRes.data);
    setSuperOverRounds(roundsRes.data || []);

    // Fetch teams from roster
    const rosterTeams = (rosterRes.data || []).map((r: any) => r.teams).filter(Boolean);
    setTeams(rosterTeams);

    if (overRes.data) {
      const { data: deliveriesData } = await supabase
        .from('deliveries')
        .select('*, players!deliveries_striker_id_fkey(name), bowler:players!deliveries_bowler_id_fkey(name)')
        .eq('over_id', overRes.data.id)
        .order('delivery_no');
      setOverDeliveries(deliveriesData || []);
    } else {
      setOverDeliveries([]);
    }

    const orders = ordersRes.data || [];
    const tickets = ticketsRes.data || [];
    setStats({
      registrations: orders.length,
      paid: orders.filter(o => ['paid_verified', 'paid_manual_verified'].includes(o.payment_status)).length,
      checkins: tickets.filter(t => t.status === 'used').length,
    });

    // Players: prefer match_lineup (ordered by batting_order), fall back to all team players
    const teamIds = (rosterRes.data || []).map((r: any) => r.team_id);
    if (teamIds.length > 0) {
      const { data: lineupData } = await supabase
        .from('match_lineup')
        .select('*, players(*)')
        .eq('match_id', matchData.id)
        .order('batting_order');

      if (lineupData && lineupData.length > 0) {
        // Use lineup players, preserving batting order
        const lineupPlayers = lineupData
          .filter((l: any) => l.players)
          .map((l: any) => ({ ...l.players, _batting_order: l.batting_order, _is_captain: l.is_captain, _is_wk: l.is_wk }));
        setPlayers(lineupPlayers);
      } else {
        // Fallback: all players from roster teams
        const { data: playerData } = await supabase.from('players').select('*').in('team_id', teamIds);
        setPlayers(playerData || []);
      }
    }

    setLoading(false);
  }, []);

  // Realtime
  const subscriptions = useMemo(() => {
    if (!match?.id) return [];
    return [
      {
        event: '*' as const, schema: 'public', table: 'match_live_state',
        filter: `match_id=eq.${match.id}`,
        callback: (payload: any) => { if (payload.new) setLiveState(payload.new); },
      },
      {
        event: '*' as const, schema: 'public', table: 'over_control',
        filter: `match_id=eq.${match.id}`,
        callback: () => fetchAll(),
      },
      {
        event: '*' as const, schema: 'public', table: 'deliveries',
        filter: `match_id=eq.${match.id}`,
        callback: () => {
          if (activeOver) {
            supabase.from('deliveries')
              .select('*, players!deliveries_striker_id_fkey(name), bowler:players!deliveries_bowler_id_fkey(name)')
              .eq('over_id', activeOver.id)
              .order('delivery_no')
              .then(({ data }) => setOverDeliveries(data || []));
          }
        },
      },
      {
        event: '*' as const, schema: 'public', table: 'prediction_windows',
        filter: `match_id=eq.${match.id}`,
        callback: (payload: any) => {
          const s = (payload.new as any)?.status;
          if (s === 'open') setActiveWindow(payload.new);
          else setActiveWindow(null);
        },
      },
      {
        event: '*' as const, schema: 'public', table: 'match_flags',
        filter: `match_id=eq.${match.id}`,
        callback: (payload: any) => { if (payload.new) setMatchFlags(payload.new); },
      },
      {
        event: '*' as const, schema: 'public', table: 'super_over_rounds',
        filter: `match_id=eq.${match.id}`,
        callback: () => fetchAll(),
      },
    ];
  }, [match?.id, fetchAll, activeOver]);

  const { connected, reconnecting } = useRealtimeChannel('admin-control-live', subscriptions, fetchAll);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived player lists ──────────────────────────────────────────────────
  const battingPlayers = players.filter(p => p.team_id === liveState?.batting_team_id);
  const bowlingPlayers = players.filter(p => p.team_id === liveState?.bowling_team_id);
  const effectiveBatting = battingPlayers.length > 0 ? battingPlayers : players;
  const effectiveBowling = bowlingPlayers.length > 0 ? bowlingPlayers : players;

  const playerById = (id: string) => players.find(p => p.id === id);
  const teamById = (id: string) => teams.find(t => t.id === id);

  // ── Actions ───────────────────────────────────────────────────────────────
  const callFunction = async (fn: string, body: any, loadingKey: string, successMsg?: string) => {
    setActionLoading(loadingKey);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: successMsg ?? '✅ Done' });
      fetchAll();
      return data;
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
      return null;
    } finally {
      setActionLoading(null);
    }
  };

  const logActivity = (action: string, meta?: any) => {
    if (user) supabase.from('admin_activity').insert({ admin_id: user.id, action, entity_type: 'match', entity_id: match?.id, meta });
  };

  const upsertFlag = async (update: Record<string, any>, loadingKey: string) => {
    if (!match) return;
    setFlagLoading(loadingKey);
    try {
      const { error } = await supabase.from('match_flags').upsert({
        match_id: match.id, frozen_by_admin_id: user?.id, frozen_at: new Date().toISOString(), ...update,
      }, { onConflict: 'match_id' });
      if (error) throw error;
      logActivity(loadingKey, update);
      toast({ title: '⚡ Flag updated' });
      const { data } = await supabase.from('match_flags').select('*').eq('match_id', match.id).single();
      setMatchFlags(data);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
    } finally {
      setFlagLoading(null);
      setFreezeReason('');
    }
  };

  const handlePhase = (phase: string) => {
    const phaseLabels: Record<string, string> = {
      pre: '⏸ Match set to Pre',
      innings1: '▶ Innings 1 started',
      break: '☕ Innings break',
      innings2: '▶ Innings 2 started',
      ended: '🏁 Match ended',
    };
    const msg = phaseLabels[phase] ?? `✅ Phase: ${phase}`;
    if (['innings2', 'ended'].includes(phase)) {
      setConfirmDialog({ action: 'set_phase', label: `Set phase to "${phase}"?`, body: { action: 'set_phase', match_id: match?.id, phase }, successMsg: msg });
    } else {
      callFunction('match-control', { action: 'set_phase', match_id: match?.id, phase }, `phase-${phase}`, msg);
    }
  };

  const handleInitMatch = () => callFunction('match-control', { action: 'init', match_id: match?.id }, 'init', '✅ Match initialized');

  const handleCreateOver = () => callFunction('over-control', {
    action: 'create_over', match_id: match?.id,
    innings_no: liveState?.current_innings || 1,
    bowler_id: delivery.bowler_id || overBowler || null,
  }, 'create-over', '🏏 New over started');

  const handleCompleteOver = () => {
    if (!activeOver) return;
    callFunction('over-control', { action: 'update_over', over_id: activeOver.id, status: 'complete' }, 'complete-over', '✅ Over completed');
  };

  const handleUpdateOverStatus = (overId: string, status: string) => {
    setConfirmDialog({
      action: 'update_over', label: `Set over status to "${status}"?`,
      body: { action: 'update_over', over_id: overId, status },
    });
  };

  const handleRecordDelivery = async () => {
    if (!activeOver || !match) return;
    setActionLoading('record-delivery');
    try {
      const { data, error } = await supabase.functions.invoke('record-delivery', {
        body: {
          match_id: match.id, over_id: activeOver.id,
          innings_no: liveState?.current_innings || 1, over_no: activeOver.over_no,
          striker_id: delivery.striker_id || null, non_striker_id: delivery.non_striker_id || null,
          bowler_id: delivery.bowler_id || null,
          runs_off_bat: parseInt(delivery.runs_off_bat) || 0,
          extras_type: delivery.extras_type, extras_runs: parseInt(delivery.extras_runs) || 0,
          is_wicket: delivery.is_wicket, wicket_type: delivery.wicket_type || null,
          out_player_id: delivery.out_player_id || null, fielder_id: delivery.fielder_id || null,
          free_hit: delivery.free_hit, notes: delivery.notes || null,
          auto_rotate: delivery.auto_rotate,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: '✅ Delivery recorded' });

      // Auto-resolve the most recent locked prediction window using the delivery outcome
      const correctKey = deriveOutcomeKey({
        runs_off_bat: parseInt(delivery.runs_off_bat) || 0,
        extras_type: delivery.extras_type,
        is_wicket: delivery.is_wicket,
      });
      const { data: lockedWindow } = await supabase
        .from('prediction_windows')
        .select('id')
        .eq('match_id', match.id)
        .eq('status', 'locked')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lockedWindow) {
        const { data: resolveData, error: resolveError } = await supabase.functions.invoke('resolve-prediction-window', {
          body: { action: 'resolve', window_id: lockedWindow.id, match_id: match.id, correct_answer: { key: correctKey } },
        });
        if (resolveError || resolveData?.error) {
          toast({ variant: 'destructive', title: 'Auto-resolve failed', description: resolveData?.error || resolveError?.message });
        } else {
          const outcomeLabel = BALL_OUTCOMES.find(o => o.key === correctKey)?.label ?? correctKey;
          toast({ title: `🎯 Window resolved: ${outcomeLabel}`, description: `${resolveData.resolved ?? 0} prediction(s) scored` });
        }
      }

      if (data?.needs_new_batsman) {
        setNeedsNewBatsman(true);
        setIncomingPosition(delivery.out_player_id === delivery.striker_id ? 'striker' : 'non_striker');
      }
      setDelivery(d => ({
        ...d, runs_off_bat: '0', extras_type: 'none', extras_runs: '0',
        is_wicket: false, wicket_type: '', out_player_id: '', fielder_id: '',
        free_hit: false, notes: '',
      }));
      setSelectedOutcome(null);
      fetchAll();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleVoidLastDelivery = async () => {
    const last = overDeliveries[overDeliveries.length - 1];
    if (!last || !match) return;
    setVoidingDelivery(last.id);
    try {
      // Delete the delivery
      const { error } = await supabase.from('deliveries').delete().eq('id', last.id);
      if (error) throw error;
      // Recalculate score from remaining deliveries
      await fetchAll();
      logActivity('void_delivery', { delivery_id: last.id, over_no: last.over_no });
      toast({ title: '🗑 Last delivery voided', description: 'Scores recalculated. Verify live state.' });
      setCorrectionMode(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Void failed', description: e.message });
    } finally {
      setVoidingDelivery(null);
    }
  };

  const handleSetIncomingBatsman = async () => {
    if (!match || !incomingBatsman) return;
    setActionLoading('set-incoming');
    try {
      const body: any = { action: 'update_players', match_id: match.id };
      if (incomingPosition === 'striker') body.striker_id = incomingBatsman;
      else body.non_striker_id = incomingBatsman;
      const { data, error } = await supabase.functions.invoke('match-control', { body });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: '✅ Batsman set' });
      setNeedsNewBatsman(false);
      setIncomingBatsman('');
      fetchAll();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdatePlayers = (update: any) =>
    callFunction('match-control', { action: 'update_players', match_id: match?.id, ...update }, 'update-players');

  const handleSwapStriker = async () => {
    if (!liveState?.current_striker_id || !liveState?.current_non_striker_id) return;
    await handleUpdatePlayers({
      striker_id: liveState.current_non_striker_id,
      non_striker_id: liveState.current_striker_id,
    });
    logActivity('swap_striker', {});
  };

  const handleInningsTeamSwap = () => {
    if (!liveState) return;
    callFunction('match-control', {
      action: 'set_phase', match_id: match?.id, phase: liveState.phase,
      batting_team_id: liveState.bowling_team_id,
      bowling_team_id: liveState.batting_team_id,
    }, 'swap-teams');
  };

  const handleOpenWindow = () => {
    if (!match) return;
    callFunction('resolve-prediction-window', {
      action: 'open',
      match_id: match.id,
      question: 'What will happen on the next ball?',
      options: BALL_OUTCOMES.map(o => ({ key: o.key, label: o.label })),
    }, 'open-window', '🎯 Guess window opened');
  };

  const applyOutcomePrefill = (key: BallOutcomeKey) => {
    setSelectedOutcome(key);
    const prefill: Partial<typeof delivery> = {};
    if (key === 'dot_ball')   { prefill.runs_off_bat = '0'; prefill.extras_type = 'none'; prefill.is_wicket = false; }
    else if (key === 'runs_1') { prefill.runs_off_bat = '1'; prefill.extras_type = 'none'; prefill.is_wicket = false; }
    else if (key === 'runs_2') { prefill.runs_off_bat = '2'; prefill.extras_type = 'none'; prefill.is_wicket = false; }
    else if (key === 'runs_3') { prefill.runs_off_bat = '3'; prefill.extras_type = 'none'; prefill.is_wicket = false; }
    else if (key === 'boundary_4') { prefill.runs_off_bat = '4'; prefill.extras_type = 'none'; prefill.is_wicket = false; }
    else if (key === 'six_6')  { prefill.runs_off_bat = '6'; prefill.extras_type = 'none'; prefill.is_wicket = false; }
    else if (key === 'wide')   { prefill.runs_off_bat = '0'; prefill.extras_type = 'wide'; prefill.extras_runs = '1'; prefill.is_wicket = false; }
    else if (key === 'no_ball') { prefill.runs_off_bat = '0'; prefill.extras_type = 'no_ball'; prefill.extras_runs = '1'; prefill.is_wicket = false; }
    else if (key === 'byes')   { prefill.runs_off_bat = '0'; prefill.extras_type = 'bye'; prefill.extras_runs = '0'; prefill.is_wicket = false; }
    else if (key === 'leg_byes') { prefill.runs_off_bat = '0'; prefill.extras_type = 'leg_bye'; prefill.extras_runs = '0'; prefill.is_wicket = false; }
    else if (key === 'wicket') { prefill.runs_off_bat = '0'; prefill.extras_type = 'none'; prefill.is_wicket = true; }
    setDelivery(d => ({ ...d, ...prefill }));
  };

  const handleLockWindow = () => {
    if (!activeWindow) return;
    callFunction('resolve-prediction-window', { action: 'lock', window_id: activeWindow.id }, 'lock-window', '🔒 Guess window locked');
  };

  const handleResolveWindow = (correctKey: string) => {
    if (!match) return;
    supabase.from('prediction_windows').select('id')
      .eq('match_id', match.id).eq('status', 'locked')
      .order('created_at', { ascending: false }).limit(1).single()
      .then(({ data }) => {
        if (data) callFunction('resolve-prediction-window', { action: 'resolve', window_id: data.id, match_id: match.id, correct_answer: { key: correctKey } }, 'resolve-window', '✅ Window resolved');
      });
  };

  const handleFreezePredictions = (freeze: boolean) =>
    upsertFlag({ predictions_frozen: freeze, freeze_reason: freeze ? freezeReason : null }, freeze ? 'freeze_predictions' : 'unfreeze_predictions');
  const handleFreezeScanning = (freeze: boolean) =>
    upsertFlag({ scanning_frozen: freeze, freeze_reason: freeze ? freezeReason : null }, freeze ? 'freeze_scanning' : 'unfreeze_scanning');
  const handleLockAllWindows = async () => {
    if (!match) return;
    setFlagLoading('lock_all_windows');
    try {
      await supabase.from('prediction_windows').update({ status: 'resolved' }).eq('match_id', match.id).in('status', ['open', 'locked']);
      await upsertFlag({ windows_locked: true }, 'lock_all_windows');
    } finally { setFlagLoading(null); }
  };
  const handleUnlockWindows = () => upsertFlag({ windows_locked: false }, 'unlock_windows');

  // ── Confirm dialog exec ───────────────────────────────────────────────────
  const executeConfirmed = () => {
    if (!confirmDialog) return;
    if (confirmDialog.action === 'set_phase') {
      callFunction('match-control', confirmDialog.body, `phase-${confirmDialog.body.phase}`, confirmDialog.successMsg);
    } else if (confirmDialog.action === 'update_over') {
      callFunction('over-control', confirmDialog.body, 'update-over', confirmDialog.successMsg);
    }
    setConfirmDialog(null);
  };

  const anyFrozen = matchFlags?.predictions_frozen || matchFlags?.scanning_frozen || matchFlags?.windows_locked;
  const phaseButtons = [
    { phase: 'pre', label: '⏸ Pre', variant: 'ghost' as const },
    { phase: 'innings1', label: '▶ Inn 1', variant: 'primary' as const },
    { phase: 'break', label: '☕ Break', variant: 'ghost' as const },
    { phase: 'innings2', label: '▶ Inn 2', variant: 'primary' as const },
    { phase: 'ended', label: '🏁 End', variant: 'danger' as const },
  ];

  const currentInningsKey = (liveState?.current_innings || 1) === 1 ? 'innings1' : 'innings2';

  // Show super over tab when: already in super_over phase, OR match tied after innings2, OR ended with super over rounds
  const scoresAreTied = liveState && liveState.innings1_score === liveState.innings2_score && (
    ['innings2', 'ended', 'super_over'].includes(liveState.phase)
  );
  const showSuperOverTab = liveState?.super_over_active || scoresAreTied || superOverRounds.length > 0;

  const TABS = [
    ...BASE_TABS,
    ...(showSuperOverTab ? [{ id: 'super_over' as TabId, label: '⚡ Super Over', icon: Swords }] : []),
  ];

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  );

  if (!match) return (
    <div className="p-6">
      <GlassCard className="p-8 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h2 className="font-display text-xl font-bold text-foreground mb-2">No Active Match</h2>
        <p className="text-muted-foreground text-sm">Activate a match from the Matches page first.</p>
      </GlassCard>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto md:mx-0">
      {/* ── Sticky top bar ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-bold gradient-text-accent truncate">{match?.name}</h1>
              <div className="flex items-center gap-2">
                {liveState && <PhaseBadge phase={liveState.phase} />}
                {liveState && (
                  <span className="text-xs font-mono text-foreground">
                    {liveState[`${currentInningsKey}_score`]}/{liveState[`${currentInningsKey}_wickets`]}
                    <span className="text-muted-foreground ml-1">({Number(liveState[`${currentInningsKey}_overs`]).toFixed(1)} ov)</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeOver && (
              <span className="text-xs bg-primary/15 text-primary px-2.5 py-1 rounded-full font-semibold border border-primary/30">
                Over {activeOver.over_no} · {overLegalBalls}/6
              </span>
            )}
            {reconnecting ? (
              <span className="flex items-center gap-1 text-xs text-warning"><Loader className="h-3 w-3 animate-spin" /> Reconnecting</span>
            ) : connected ? (
              <span className="flex items-center gap-1 text-xs text-success"><Wifi className="h-3 w-3" /> Live</span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><WifiOff className="h-3 w-3" /> …</span>
            )}
            <button onClick={() => fetchAll()} className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Panic banner */}
        {anyFrozen && (
          <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/40 text-destructive text-xs font-medium">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            FROZEN:{matchFlags?.predictions_frozen && ' Predictions'}{matchFlags?.scanning_frozen && ' Scanning'}{matchFlags?.windows_locked && ' Windows'}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 mt-3 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-glow-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: COMMAND                                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'command' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Users, val: stats.registrations, label: 'Registered', cls: 'text-primary' },
                { icon: CheckCircle, val: stats.paid, label: 'Paid', cls: 'text-success' },
                { icon: ScanLine, val: stats.checkins, label: 'Check-ins', cls: 'text-accent-foreground' },
              ].map(s => (
                <GlassCard key={s.label} className="p-3 text-center">
                  <s.icon className={`h-4 w-4 ${s.cls} mx-auto mb-1`} />
                  <div className={`font-display text-2xl font-bold ${s.cls}`}>{s.val}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </GlassCard>
              ))}
            </div>

            {/* Live score */}
            {liveState && (
              <GlassCard className="p-4">
                <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">📊 Live Scoreboard</h2>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[
                    { label: 'Innings 1', score: liveState.innings1_score, wkts: liveState.innings1_wickets, overs: liveState.innings1_overs, cls: 'gradient-text', active: liveState.current_innings === 1 },
                    { label: 'Innings 2', score: liveState.innings2_score, wkts: liveState.innings2_wickets, overs: liveState.innings2_overs, cls: 'gradient-text-accent', active: liveState.current_innings === 2 },
                  ].map(inn => (
                    <div key={inn.label} className={`bg-card/50 rounded-lg p-3 text-center border ${inn.active ? 'border-primary/40' : 'border-border/30'}`}>
                      <div className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                        {inn.label} {inn.active && <span className="text-primary text-xs animate-pulse">●</span>}
                      </div>
                      <div className={`font-display text-2xl font-bold ${inn.cls}`}>{inn.score}/{inn.wkts}</div>
                      <div className="text-xs text-muted-foreground">{Number(inn.overs).toFixed(1)} ov</div>
                    </div>
                  ))}
                </div>
                {liveState.last_delivery_summary && (
                  <div className="text-center text-xs bg-primary/10 text-primary rounded-lg p-2 font-mono">
                    Last: {liveState.last_delivery_summary}
                  </div>
                )}
                {liveState.target_runs && (
                  <div className="mt-2 text-center text-xs text-muted-foreground">
                    Target: <strong className="text-primary">{liveState.target_runs}</strong> · Need:{' '}
                    <strong className="text-foreground">{Math.max(0, liveState.target_runs - liveState.innings2_score)}</strong> runs
                  </div>
                )}
              </GlassCard>
            )}

            {/* Phase Control */}
            <GlassCard className="p-4">
              <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">🎮 Match Phase</h2>
              {!liveState && (
                <GlassButton variant="primary" size="md" className="w-full mb-3" loading={actionLoading === 'init'} onClick={handleInitMatch}>
                  Initialize Live State
                </GlassButton>
              )}
              <div className="grid grid-cols-5 gap-1.5">
                {phaseButtons.map(b => (
                  <GlassButton
                    key={b.phase}
                    variant={liveState?.phase === b.phase ? 'primary' : b.variant}
                    size="sm"
                    loading={actionLoading === `phase-${b.phase}`}
                    onClick={() => handlePhase(b.phase)}
                    className={`text-xs ${liveState?.phase === b.phase ? 'ring-2 ring-primary' : ''}`}
                  >
                    {b.label}
                  </GlassButton>
                ))}
              </div>
            </GlassCard>

            {/* ── Over Management ────────────────────────────────────────── */}
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  🏏 Over Control
                </h2>
                {activeOver && (
                  <span className="text-xs text-primary font-mono">
                    Over {activeOver.over_no} — {overLegalBalls}/6 legal balls
                  </span>
                )}
              </div>

              <div className="flex gap-2 mb-3">
                <GlassButton variant="primary" size="sm" loading={actionLoading === 'create-over'} onClick={handleCreateOver} disabled={!!activeOver}>
                  <Play className="h-3.5 w-3.5" /> New Over
                </GlassButton>
                <GlassButton variant="ghost" size="sm" loading={actionLoading === 'complete-over'} onClick={handleCompleteOver} disabled={!activeOver}>
                  <Square className="h-3.5 w-3.5" /> Complete Over
                </GlassButton>
              </div>

              {/* Ball dots for current over */}
              {activeOver && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {overDeliveries.map(d => <DeliveryPill key={d.id} d={d} />)}
                    {[...Array(Math.max(0, 6 - overLegalBalls))].map((_, i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-dashed border-border/30 flex items-center justify-center">
                        <span className="text-xs text-muted-foreground/30">{overLegalBalls + i + 1}</span>
                      </div>
                    ))}
                  </div>
                  {overDeliveries.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {overDeliveries.length} deliveries · {overLegalBalls} legal · {overDeliveries.filter(d => d.is_wicket).length} wicket(s)
                    </p>
                  )}
                </div>
              )}

              {!activeOver && (
                <p className="text-xs text-muted-foreground italic">Start a new over to record deliveries.</p>
              )}

              {/* Wicket incoming batsman prompt */}
              {needsNewBatsman && activeOver && (
                <div className="mb-3 border border-warning/40 bg-warning/5 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-warning text-xs font-semibold">
                    <UserPlus className="h-4 w-4" /> Select Incoming Batsman
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={incomingPosition} onValueChange={v => setIncomingPosition(v as any)}>
                      <SelectTrigger className="glass-input h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="striker">Striker (facing)</SelectItem>
                        <SelectItem value="non_striker">Non-Striker</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={incomingBatsman} onValueChange={setIncomingBatsman}>
                      <SelectTrigger className="glass-input h-8 text-xs"><SelectValue placeholder="Batsman" /></SelectTrigger>
                      <SelectContent>
                        {effectiveBatting
                          .filter(p => p.id !== liveState?.current_striker_id && p.id !== liveState?.current_non_striker_id)
                          .map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <GlassButton variant="primary" size="sm" loading={actionLoading === 'set-incoming'} onClick={handleSetIncomingBatsman} disabled={!incomingBatsman}>
                      Confirm Batsman
                    </GlassButton>
                    <GlassButton variant="ghost" size="sm" onClick={() => setNeedsNewBatsman(false)}>Skip</GlassButton>
                  </div>
                </div>
              )}

              {/* ── Open Guess Window shortcut (shown when no window is currently open) ── */}
              {activeOver && !activeWindow && match?.predictions_enabled && !(matchFlags?.predictions_frozen) && !(matchFlags?.windows_locked) && (
                <div className="border border-success/30 rounded-xl p-3 bg-success/5 space-y-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
                    <span className="text-xs font-bold text-success uppercase tracking-wide">Ready for next ball</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Open the guess window so customers can predict before you record this ball.</p>
                  <GlassButton
                    variant="success" size="sm"
                    loading={actionLoading === 'open-window'}
                    onClick={handleOpenWindow}
                  >
                    <Unlock className="h-3.5 w-3.5" /> Open Guesses
                  </GlassButton>
                </div>
              )}

              {/* Delivery Form */}
              {activeOver && (
                <div className="border border-primary/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                      Ball {overLegalBalls + 1} of 6
                    </h3>
                    <div className="flex items-center gap-2">
                      {/* Correction mode */}
                      <button
                        onClick={() => setCorrectionMode(c => !c)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all ${correctionMode ? 'border-warning/60 bg-warning/10 text-warning' : 'border-border text-muted-foreground hover:border-warning/40'}`}
                      >
                        <RefreshCw className="h-3 w-3" /> Correction
                      </button>
                    </div>
                  </div>

                  {correctionMode && overDeliveries.length > 0 && (
                    <div className="rounded-lg bg-warning/5 border border-warning/30 p-3">
                      <p className="text-xs text-warning font-semibold mb-2">⚠️ Correction Mode — Void Last Delivery</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        Last: <span className="text-foreground font-mono">
                          {(() => {
                            const last = overDeliveries[overDeliveries.length - 1];
                            const r = (last.runs_off_bat || 0) + (last.extras_runs || 0);
                            return `${last.extras_type !== 'none' ? last.extras_type.toUpperCase() + '+' : ''}${r} runs${last.is_wicket ? ' + WICKET' : ''}`;
                          })()}
                        </span>
                      </div>
                      <GlassButton
                        variant="danger" size="sm"
                        loading={!!voidingDelivery}
                        onClick={handleVoidLastDelivery}
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Void Last Delivery
                      </GlassButton>
                    </div>
                  )}

                  {/* ── Primary Outcome Selector ── */}
                  <div className="border border-primary/20 rounded-xl p-3 bg-card/40 space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">What happened on this ball?</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {BALL_OUTCOMES.map(opt => {
                        const isSelected = selectedOutcome === opt.key;
                        return (
                          <button
                            key={opt.key}
                            onClick={() => applyOutcomePrefill(opt.key)}
                            className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 h-14 transition-all active:scale-95 ${
                              isSelected
                                ? `${opt.colorCls} bg-card/80 shadow-md`
                                : 'border-border/40 text-muted-foreground hover:border-border bg-card/20'
                            }`}
                          >
                            <span className={`text-base font-black leading-none ${isSelected ? opt.colorCls.split(' ')[1] : 'text-foreground'}`}>{opt.emoji}</span>
                            <span className="text-[9px] uppercase tracking-wide leading-none">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {selectedOutcome && (
                      <p className="text-[10px] text-muted-foreground">
                        ✓ Fields prefilled for <strong className="text-foreground">{BALL_OUTCOMES.find(o => o.key === selectedOutcome)?.label}</strong> — adjust below if needed
                      </p>
                    )}
                  </div>

                  {/* Players */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'STRIKER', key: 'striker_id', opts: effectiveBatting },
                      { label: 'NON STRIKER', key: 'non_striker_id', opts: effectiveBatting },
                      { label: 'BOWLER', key: 'bowler_id', opts: effectiveBowling },
                    ].map(f => (
                      <div key={f.key}>
                        <Label className="text-foreground mb-1 block text-xs">{f.label}</Label>
                        <Select value={(delivery as any)[f.key] || '__none__'} onValueChange={v => setDelivery(d => ({ ...d, [f.key]: v === '__none__' ? '' : v }))}>
                          <SelectTrigger className="glass-input h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {f.opts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>

                  {/* Quick runs */}
                  <div>
                    <Label className="text-foreground mb-1.5 block text-xs">RUNS OFF BAT</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {[0, 1, 2, 3, 4, 6].map(r => (
                        <button
                          key={r}
                          onClick={() => setDelivery(d => ({ ...d, runs_off_bat: String(r) }))}
                          className={`w-10 h-10 rounded-xl text-sm font-bold border transition-all ${
                            delivery.runs_off_bat === String(r)
                              ? r === 4 ? 'bg-accent/30 border-accent text-accent-foreground' :
                                r === 6 ? 'bg-primary/30 border-primary text-primary' :
                                'bg-primary/20 border-primary text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                      <Input
                        className="glass-input h-10 w-16 text-xs text-center"
                        type="number" min="0" max="6"
                        value={delivery.runs_off_bat}
                        onChange={e => setDelivery(d => ({ ...d, runs_off_bat: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <Label className="text-foreground mb-1 block text-xs">EXTRAS TYPE</Label>
                      <Select value={delivery.extras_type} onValueChange={v => setDelivery(d => ({ ...d, extras_type: v }))}>
                        <SelectTrigger className="glass-input h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="wide">Wide</SelectItem>
                          <SelectItem value="no_ball">No Ball</SelectItem>
                          <SelectItem value="bye">Bye</SelectItem>
                          <SelectItem value="leg_bye">Leg Bye</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-foreground mb-1 block text-xs">EXT RUNS</Label>
                      <Input className="glass-input h-8 text-xs" type="number" min="0" value={delivery.extras_runs} onChange={e => setDelivery(d => ({ ...d, extras_runs: e.target.value }))} />
                    </div>
                    <div className="flex flex-col justify-end gap-1 pb-0.5">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={delivery.is_wicket} onChange={e => setDelivery(d => ({ ...d, is_wicket: e.target.checked }))} />
                        <span className="text-destructive font-semibold">Wicket</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={delivery.free_hit} onChange={e => setDelivery(d => ({ ...d, free_hit: e.target.checked }))} />
                        Free Hit
                      </label>
                    </div>
                  </div>

                  {delivery.is_wicket && (
                    <div className="grid grid-cols-3 gap-2 border-t border-destructive/20 pt-3">
                      <div>
                        <Label className="text-foreground mb-1 block text-xs">WICKET TYPE</Label>
                        <Select value={delivery.wicket_type} onValueChange={v => setDelivery(d => ({ ...d, wicket_type: v }))}>
                          <SelectTrigger className="glass-input h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                          <SelectContent>
                            {['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket', 'obstructing'].map(t => (
                              <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-foreground mb-1 block text-xs">OUT PLAYER</Label>
                        <Select value={delivery.out_player_id || '__none__'} onValueChange={v => setDelivery(d => ({ ...d, out_player_id: v === '__none__' ? '' : v }))}>
                          <SelectTrigger className="glass-input h-8 text-xs"><SelectValue placeholder="Who" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {effectiveBatting.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-foreground mb-1 block text-xs">FIELDER</Label>
                        <Select value={delivery.fielder_id || '__none__'} onValueChange={v => setDelivery(d => ({ ...d, fielder_id: v === '__none__' ? '' : v }))}>
                          <SelectTrigger className="glass-input h-8 text-xs"><SelectValue placeholder="Fielder" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {players.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Checkbox id="auto-rotate" checked={delivery.auto_rotate} onCheckedChange={v => setDelivery(d => ({ ...d, auto_rotate: !!v }))} />
                    <label htmlFor="auto-rotate" className="text-xs text-muted-foreground cursor-pointer select-none">
                      Auto-rotate strike (uncheck for run-outs, overthrows)
                    </label>
                  </div>

                  {/* ── Prediction window guard: shown when a window is still OPEN ── */}
                  {activeWindow && (
                    <div className="rounded-xl border-2 border-warning bg-warning/10 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-warning text-xs font-bold">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Prediction window is OPEN
                      </div>
                      <p className="text-xs text-warning font-semibold">
                        You must lock the window before you can record this ball.
                      </p>
                      <PredictionCountBadge windowId={activeWindow.id} matchId={match.id} />
                    </div>
                  )}

                  <GlassButton
                    variant="primary" size="md"
                    className="w-full"
                    loading={actionLoading === 'record-delivery'}
                    onClick={handleRecordDelivery}
                    disabled={!!activeWindow}
                  >
                    🏏 Record Ball
                  </GlassButton>

                  <div className="rounded-xl border border-border bg-muted/10 px-3 py-2 text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-display text-lg font-bold text-foreground">
                      {parseInt(delivery.runs_off_bat || '0') + parseInt(delivery.extras_runs || '0')} runs
                      {delivery.is_wicket && <span className="text-destructive ml-1 text-sm">+W</span>}
                      {(delivery.extras_type === 'wide' || delivery.extras_type === 'no_ball') && (
                        <span className="text-warning ml-1 text-xs">+extra ball</span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </GlassCard>

            {/* ── Panic Controls ──────────────────────────────────────────── */}
            <GlassCard className={`p-4 border ${anyFrozen ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}>
              <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" /> Emergency Controls
              </h2>
              <p className="text-xs text-muted-foreground mb-3">Immediate server-enforced overrides.</p>
              <div className="mb-3">
                <Input className="glass-input text-xs h-8" placeholder="Freeze reason (optional)" value={freezeReason} onChange={e => setFreezeReason(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Predictions', frozen: matchFlags?.predictions_frozen, onFreeze: () => handleFreezePredictions(true), onUnfreeze: () => handleFreezePredictions(false), key: 'freeze_predictions' },
                  { label: 'Gate Scan', frozen: matchFlags?.scanning_frozen, onFreeze: () => handleFreezeScanning(true), onUnfreeze: () => handleFreezeScanning(false), key: 'freeze_scanning' },
                  { label: 'Pred. Windows', frozen: matchFlags?.windows_locked, onFreeze: handleLockAllWindows, onUnfreeze: handleUnlockWindows, key: 'lock_all_windows' },
                ].map(c => (
                  <div key={c.label} className={`rounded-xl border p-3 space-y-2 ${c.frozen ? 'border-destructive/60 bg-destructive/5' : 'border-border'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{c.label}</span>
                      <StatusPill ok={!c.frozen} label={c.frozen ? (c.label === 'Pred. Windows' ? 'LOCKED' : 'FROZEN') : 'ON'} />
                    </div>
                    {c.frozen ? (
                      <GlassButton variant="success" size="sm" className="w-full" loading={flagLoading === c.key} onClick={c.onUnfreeze}>
                        <Unlock className="h-3.5 w-3.5" /> Resume
                      </GlassButton>
                    ) : (
                      <GlassButton variant="danger" size="sm" className="w-full" loading={flagLoading === c.key} onClick={c.onFreeze}>
                        <Lock className="h-3.5 w-3.5" /> Freeze
                      </GlassButton>
                    )}
                  </div>
                ))}
              </div>
              {matchFlags?.freeze_reason && (
                <p className="text-xs text-muted-foreground mt-3">Reason: <span className="text-foreground">{matchFlags.freeze_reason}</span></p>
              )}
            </GlassCard>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: ROSTER                                                        */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'roster' && (
          <>
            {/* Innings teams */}
            {liveState && (
              <GlassCard className="p-4 space-y-3">
                <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-wider">⚔️ Innings Team Assignment</h2>
                <div className="grid grid-cols-2 gap-3">
                  {/* Batting */}
                  <div className="rounded-xl bg-success/5 border border-success/30 p-3 space-y-2">
                    <p className="text-xs font-bold text-success uppercase tracking-wide">🏏 Batting</p>
                    <Select
                      value={liveState.batting_team_id || ''}
                      onValueChange={id => callFunction('match-control', { action: 'update_players', match_id: match.id, batting_team_id: id }, 'set-batting')}
                    >
                      <SelectTrigger className="glass-input h-8 text-xs"><SelectValue placeholder="Select team" /></SelectTrigger>
                      <SelectContent>
                        {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {liveState.batting_team_id && (
                      <p className="text-xs text-success font-medium">{teamById(liveState.batting_team_id)?.name || '—'}</p>
                    )}
                  </div>
                  {/* Bowling */}
                  <div className="rounded-xl bg-primary/5 border border-primary/30 p-3 space-y-2">
                    <p className="text-xs font-bold text-primary uppercase tracking-wide">🎯 Bowling</p>
                    <Select
                      value={liveState.bowling_team_id || ''}
                      onValueChange={id => callFunction('match-control', { action: 'update_players', match_id: match.id, bowling_team_id: id }, 'set-bowling')}
                    >
                      <SelectTrigger className="glass-input h-8 text-xs"><SelectValue placeholder="Select team" /></SelectTrigger>
                      <SelectContent>
                        {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {liveState.bowling_team_id && (
                      <p className="text-xs text-primary font-medium">{teamById(liveState.bowling_team_id)?.name || '—'}</p>
                    )}
                  </div>
                </div>
                <GlassButton variant="ghost" size="sm" onClick={handleInningsTeamSwap} loading={actionLoading === 'swap-teams'} className="w-full">
                  <ArrowLeftRight className="h-3.5 w-3.5" /> Swap Batting / Bowling Teams
                </GlassButton>
              </GlassCard>
            )}

            {/* Active players */}
            {liveState && (
              <GlassCard className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-wider">🧑‍🤝‍🧑 Live Players</h2>
                  <GlassButton variant="ghost" size="sm" onClick={handleSwapStriker} loading={actionLoading === 'update-players'}>
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Swap Strike
                  </GlassButton>
                </div>

                {/* Striker / Non-Striker */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-success/5 border border-success/30 p-3">
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-xs font-bold text-success">STRIKER</span>
                      <span className="text-xs bg-success/20 text-success px-1.5 rounded-full">On Strike</span>
                    </div>
                    <Select
                      value={liveState.current_striker_id || ''}
                      onValueChange={id => handleUpdatePlayers({ striker_id: id || null })}
                    >
                      <SelectTrigger className="glass-input h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {effectiveBatting.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {liveState.current_striker_id && (
                      <p className="text-xs text-success font-semibold mt-1.5">{playerById(liveState.current_striker_id)?.name}</p>
                    )}
                  </div>

                  <div className="rounded-xl bg-muted/20 border border-border p-3">
                    <div className="mb-2">
                      <span className="text-xs font-bold text-muted-foreground">NON-STRIKER</span>
                    </div>
                    <Select
                      value={liveState.current_non_striker_id || ''}
                      onValueChange={id => handleUpdatePlayers({ non_striker_id: id || null })}
                    >
                      <SelectTrigger className="glass-input h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {effectiveBatting.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {liveState.current_non_striker_id && (
                      <p className="text-xs text-muted-foreground font-medium mt-1.5">{playerById(liveState.current_non_striker_id)?.name}</p>
                    )}
                  </div>
                </div>

                {/* Bowler */}
                <div className="rounded-xl bg-primary/5 border border-primary/30 p-3">
                  <div className="mb-2">
                    <span className="text-xs font-bold text-primary">CURRENT BOWLER</span>
                  </div>
                  <Select
                    value={liveState.current_bowler_id || ''}
                    onValueChange={id => {
                      handleUpdatePlayers({ bowler_id: id || null });
                      setDelivery(d => ({ ...d, bowler_id: id || '' }));
                    }}
                  >
                    <SelectTrigger className="glass-input h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {effectiveBowling.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {liveState.current_bowler_id && (
                    <p className="text-xs text-primary font-semibold mt-1.5">{playerById(liveState.current_bowler_id)?.name}</p>
                  )}
                </div>
              </GlassCard>
            )}

            {/* Full player list by team */}
            {teams.map(team => {
              const teamPlayers = players.filter(p => p.team_id === team.id);
              const isBatting = liveState?.batting_team_id === team.id;
              const isBowling = liveState?.bowling_team_id === team.id;
              return (
                <GlassCard key={team.id} className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-display text-sm font-bold text-foreground">{team.name}</h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{team.short_code}</span>
                    {isBatting && <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full border border-success/30">🏏 Batting</span>}
                    {isBowling && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full border border-primary/30">🎯 Bowling</span>}
                  </div>
                  {teamPlayers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No players added to this team. Go to Teams page.</p>
                  ) : (
                    <div className="space-y-1">
                      {teamPlayers.map(p => {
                        const isStriker = liveState?.current_striker_id === p.id;
                        const isNonStriker = liveState?.current_non_striker_id === p.id;
                        const isBowler = liveState?.current_bowler_id === p.id;
                        return (
                          <div key={p.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${isStriker ? 'bg-success/10 border border-success/30' : isNonStriker ? 'bg-muted/30' : isBowler ? 'bg-primary/10 border border-primary/30' : ''}`}>
                            {p.jersey_number && <span className="w-5 text-center text-muted-foreground font-mono">{p.jersey_number}</span>}
                            <span className={`font-medium flex-1 ${isStriker ? 'text-success' : isBowler ? 'text-primary' : 'text-foreground'}`}>{p.name}</span>
                            <span className="text-muted-foreground">{p.role?.replace('_', ' ')}</span>
                            {isStriker && <span className="text-xs font-bold text-success">★ Strike</span>}
                            {isNonStriker && <span className="text-xs text-muted-foreground">Non-strike</span>}
                            {isBowler && <span className="text-xs font-bold text-primary">🎳 Bowling</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: OVERS                                                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overs' && (
          <>
            <GlassCard className="p-4">
              <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">📋 All Overs</h2>
              {allOvers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No overs started yet.</p>
              ) : (
                <div className="space-y-2">
                  {allOvers.map(over => {
                    const statusColor: Record<string, string> = {
                      pending: 'text-muted-foreground bg-muted/20',
                      active: 'text-primary bg-primary/15 border-primary/30',
                      complete: 'text-success bg-success/10 border-success/20',
                      locked: 'text-destructive bg-destructive/10 border-destructive/20',
                    };
                    return (
                      <OverRow
                        key={over.id}
                        over={over}
                        statusColor={statusColor[over.status] || ''}
                        matchId={match.id}
                        players={players}
                        onStatusChange={handleUpdateOverStatus}
                        actionLoading={actionLoading}
                        bowlingPlayers={effectiveBowling}
                      />
                    );
                  })}
                </div>
              )}
            </GlassCard>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: PREDICTION                                                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'prediction' && (
          <>
            <GlassCard className="p-4">
              <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                🎯 Prediction Window
                {activeWindow && <span className="text-xs text-primary animate-pulse font-normal">● OPEN</span>}
                {matchFlags?.predictions_frozen && <span className="text-xs text-destructive font-normal flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Frozen</span>}
              </h2>

              {!activeWindow ? (
                <div className="space-y-2">
                  <div className="rounded-lg bg-muted/20 border border-border/40 px-3 py-2 text-xs text-muted-foreground">
                    Fixed question: <span className="text-foreground font-medium">"What will happen on the next ball?"</span>
                  </div>
                  <GlassButton
                    variant="primary" size="sm" loading={actionLoading === 'open-window'}
                    onClick={handleOpenWindow}
                    disabled={!!(matchFlags?.predictions_frozen || matchFlags?.windows_locked)}
                  >
                    Open Prediction Window
                  </GlassButton>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-foreground bg-primary/10 rounded-lg p-3">
                    <strong>Active:</strong> {activeWindow.question}
                  </div>
                  {/* Live submission count */}
                  <PredictionCountBadge windowId={activeWindow.id} matchId={match.id} />
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-warning/40 bg-warning/5 text-warning text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Lock the window <strong>before</strong> recording the ball for fairness. Recording auto-locks if you forget.</span>
                  </div>
                  <GlassButton variant="ghost" size="sm" loading={actionLoading === 'lock-window'} onClick={handleLockWindow}>
                    <Lock className="h-3.5 w-3.5" /> Lock Window Now
                  </GlassButton>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-border/40 bg-muted/10 px-3 py-2">
                <p className="text-xs text-muted-foreground text-center">
                  ✅ Windows are resolved automatically when a delivery is recorded.
                </p>
              </div>
            </GlassCard>

            {/* Leaderboard mini */}
            <GlassCard className="p-4">
              <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" /> Top Leaderboard
              </h2>
              <LeaderboardMini matchId={match.id} />
            </GlassCard>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: SUPER OVER                                                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'super_over' && (
          <SuperOverTab
            liveState={liveState}
            rounds={superOverRounds}
            teams={teams}
            match={match}
            actionLoading={actionLoading}
            onAction={(body: any, loadKey: string) => callFunction('super-over-control', body, loadKey)}
          />
        )}
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmDialog} onOpenChange={open => !open && setConfirmDialog(null)}>
        <AlertDialogContent className="glass-card-elevated border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display gradient-text">Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeConfirmed}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Super Over confirm dialog */}
      <AlertDialog open={!!soConfirmDialog} onOpenChange={open => !open && setSoConfirmDialog(null)}>
        <AlertDialogContent className="glass-card-elevated border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display gradient-text flex items-center gap-2">
              <Swords className="h-5 w-5 text-warning" /> Super Over
            </AlertDialogTitle>
            <AlertDialogDescription>{soConfirmDialog?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (soConfirmDialog) callFunction('super-over-control', soConfirmDialog.body, soConfirmDialog.action);
                setSoConfirmDialog(null);
              }}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Live Prediction Count Badge ───────────────────────────────────────────────
function PredictionCountBadge({ windowId, matchId }: { windowId: string; matchId: string }) {
  const [count, setCount] = useState<number | null>(null);

  const fetchCount = useCallback(async () => {
    const { count: c } = await supabase
      .from('predictions')
      .select('id', { count: 'exact', head: true })
      .eq('window_id', windowId);
    setCount(c ?? 0);
  }, [windowId]);

  // Initial fetch
  useEffect(() => { fetchCount(); }, [fetchCount]);

  // Realtime subscription on new predictions for this window
  useEffect(() => {
    const channel = supabase
      .channel(`pred-count-${windowId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'predictions', filter: `window_id=eq.${windowId}` },
        () => setCount(prev => (prev ?? 0) + 1)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [windowId]);

  if (count === null) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-semibold">
      <span className="w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
      <span><strong>{count}</strong> guess{count !== 1 ? 'es' : ''} received — lock before recording ball</span>
    </div>
  );
}

// ── Over Row Component ────────────────────────────────────────────────────────
function OverRow({ over, statusColor, matchId, players, onStatusChange, actionLoading, bowlingPlayers }: any) {
  const [expanded, setExpanded] = useState(false);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const playerById = (id: string) => players.find((p: any) => p.id === id);

  const loadDeliveries = async () => {
    if (deliveries.length > 0) { setExpanded(e => !e); return; }
    setLoadingDeliveries(true);
    const { data } = await supabase.from('deliveries').select('*').eq('over_id', over.id).order('delivery_no');
    setDeliveries(data || []);
    setLoadingDeliveries(false);
    setExpanded(true);
  };

  const legalCount = deliveries.filter(d => d.extras_type !== 'wide' && d.extras_type !== 'no_ball').length;

  return (
    <div className={`rounded-xl border p-3 ${statusColor}`}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs w-10 shrink-0">Ov {over.over_no}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
          {over.status.toUpperCase()}
        </span>
        <span className="text-xs text-muted-foreground flex-1 truncate">
          Inn {over.innings_no} {over.bowler_id && `· ${playerById(over.bowler_id)?.name || '—'}`}
        </span>
        {deliveries.length > 0 && (
          <span className="text-xs text-muted-foreground">{legalCount}/6</span>
        )}
        <button onClick={loadDeliveries} className="p-1 hover:bg-muted/30 rounded transition-colors">
          {loadingDeliveries ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {/* Status control */}
        {over.status === 'complete' && (
          <button
            onClick={() => onStatusChange(over.id, 'active')}
            className="text-xs text-warning border border-warning/40 px-2 py-0.5 rounded-lg hover:bg-warning/10 transition-colors"
          >
            Reopen
          </button>
        )}
        {over.status === 'active' && (
          <button
            onClick={() => onStatusChange(over.id, 'locked')}
            className="text-xs text-destructive border border-destructive/40 px-2 py-0.5 rounded-lg hover:bg-destructive/10 transition-colors"
          >
            Lock
          </button>
        )}
        {over.status === 'locked' && (
          <button
            onClick={() => onStatusChange(over.id, 'active')}
            className="text-xs text-success border border-success/40 px-2 py-0.5 rounded-lg hover:bg-success/10 transition-colors"
          >
            Unlock
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 border-t border-border/30 pt-3">
          {deliveries.length === 0 ? (
            <p className="text-xs text-muted-foreground">No deliveries recorded.</p>
          ) : (
            <div className="space-y-1">
              {deliveries.map(d => {
                const total = (d.runs_off_bat || 0) + (d.extras_runs || 0);
                const isIllegal = d.extras_type === 'wide' || d.extras_type === 'no_ball';
                return (
                  <div key={d.id} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground font-mono w-8">
                      {isIllegal ? '—' : `${d.over_no}.${d.ball_no}`}
                    </span>
                    <DeliveryPill d={d} />
                    <span className="text-muted-foreground">
                      {d.extras_type !== 'none' && `${d.extras_type.toUpperCase()} `}
                      {total} runs
                      {d.is_wicket && ' 🏏'}
                      {d.free_hit && ' ⚡FH'}
                    </span>
                    {d.striker_id && <span className="text-foreground truncate">{playerById(d.striker_id)?.name}</span>}
                  </div>
                );
              })}
              <div className="pt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span>Total: <strong className="text-foreground">{deliveries.reduce((s, d) => s + (d.runs_off_bat || 0) + (d.extras_runs || 0), 0)}</strong> runs</span>
                <span>Wickets: <strong className="text-destructive">{deliveries.filter(d => d.is_wicket).length}</strong></span>
                <span>Legal balls: <strong className="text-foreground">{legalCount}</strong></span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Leaderboard Mini ──────────────────────────────────────────────────────────
function LeaderboardMini({ matchId }: { matchId: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('leaderboard').select('player_name, mobile, total_points, correct_predictions, total_predictions')
      .eq('match_id', matchId).order('total_points', { ascending: false }).limit(10)
      .then(({ data }) => setEntries(data || []));
  }, [matchId]);
  if (entries.length === 0) return <p className="text-xs text-muted-foreground">No predictions yet</p>;
  return (
    <div className="space-y-1">
      {entries.map((e, i) => (
        <div key={e.mobile} className="flex items-center gap-2 text-sm">
          <span className="text-xs text-muted-foreground w-4 text-center">{i + 1}</span>
          <span className="flex-1 text-foreground truncate">{e.player_name || e.mobile.slice(-4).padStart(8, '•')}</span>
          <span className="text-primary font-bold text-xs">{e.total_points}pts</span>
          <span className="text-xs text-muted-foreground">{e.correct_predictions}/{e.total_predictions}</span>
        </div>
      ))}
    </div>
  );
}

// ── Super Over Tab Component ──────────────────────────────────────────────────
function SuperOverTab({ liveState, rounds, teams, match, actionLoading, onAction }: any) {
  const [soTeamA, setSoTeamA] = useState('');
  const [soTeamB, setSoTeamB] = useState('');
  const [historyOpen, setHistoryOpen] = useState<Record<number, boolean>>({});
  const { toast } = useToast();

  const currentRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const isActive = liveState?.super_over_active;
  const isTied = liveState?.innings1_score === liveState?.innings2_score &&
    ['innings2', 'ended', 'super_over'].includes(liveState?.phase);

  const callSO = (action: string, extra: any = {}, loadKey?: string) => {
    onAction({ action, match_id: match.id, ...extra }, loadKey || action);
  };

  return (
    <div className="space-y-4">
      {/* ── Tie detection / activation ── */}
      {!isActive && isTied && liveState?.phase !== 'super_over' && (
        <GlassCard className="p-4 border border-warning/50 bg-warning/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <h2 className="font-display text-sm font-bold text-warning">Match Tied!</h2>
          </div>
          <div className="flex justify-center gap-6 mb-4 text-sm">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Innings 1</p>
              <p className="font-display text-2xl font-bold text-foreground">
                {liveState?.innings1_score}/{liveState?.innings1_wickets}
              </p>
            </div>
            <div className="text-center self-center text-muted-foreground font-bold">vs</div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Innings 2</p>
              <p className="font-display text-2xl font-bold text-foreground">
                {liveState?.innings2_score}/{liveState?.innings2_wickets}
              </p>
            </div>
          </div>
          <GlassButton
            variant="primary"
            size="md"
            className="w-full border-warning/50"
            loading={actionLoading === 'activate'}
            onClick={() => callSO('activate', {}, 'activate')}
          >
            <Swords className="h-4 w-4" /> Activate Super Over
          </GlassButton>
        </GlassCard>
      )}

      {/* ── Active round panel ── */}
      {isActive && currentRound && (
        <GlassCard className="p-4 border border-warning/40">
          {/* Round header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-warning" />
              <h2 className="font-display text-sm font-bold text-warning">
                Super Over — Round {currentRound.round_number}
              </h2>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
              currentRound.status === 'pending' ? 'bg-muted text-muted-foreground' :
              currentRound.status === 'innings_a' ? 'bg-warning/20 text-warning border border-warning/40' :
              currentRound.status === 'innings_b' ? 'bg-primary/20 text-primary border border-primary/40' :
              'bg-success/20 text-success border border-success/40'
            }`}>
              {currentRound.status.replace('_', ' ')}
            </span>
          </div>

          {/* Score comparison */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-card/50 rounded-lg p-3 text-center border border-border/30">
              <p className="text-xs text-muted-foreground mb-1">{currentRound.team_a?.name || 'Team A'} (Innings A)</p>
              <p className="font-display text-xl font-bold text-foreground">
                {currentRound.team_a_score}/{currentRound.team_a_wickets}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Inn #{currentRound.innings_a_no}</p>
            </div>
            <div className="bg-card/50 rounded-lg p-3 text-center border border-border/30">
              <p className="text-xs text-muted-foreground mb-1">{currentRound.team_b?.name || 'Team B'} (Innings B)</p>
              <p className="font-display text-xl font-bold text-foreground">
                {currentRound.status === 'innings_b' || currentRound.status === 'complete'
                  ? `${currentRound.team_b_score}/${currentRound.team_b_wickets}`
                  : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Inn #{currentRound.innings_b_no}</p>
            </div>
          </div>

          {/* Live super over score */}
          {(currentRound.status === 'innings_a' || currentRound.status === 'innings_b') && (
            <div className="mb-3 text-center bg-warning/5 border border-warning/20 rounded-lg p-3">
              <p className="text-xs text-warning font-semibold mb-1">⚡ Live Super Over</p>
              <p className="font-display text-2xl font-bold text-foreground">
                {liveState?.super_over_score}/{liveState?.super_over_wickets}
              </p>
              <p className="text-xs text-muted-foreground">{Number(liveState?.super_over_overs).toFixed(1)} overs</p>
            </div>
          )}

          {/* Team assignment for innings start */}
          {currentRound.status === 'pending' && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Team A (batting first)</p>
                <Select value={soTeamA} onValueChange={setSoTeamA}>
                  <SelectTrigger className="glass-input h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Team B (chasing)</p>
                <Select value={soTeamB} onValueChange={setSoTeamB}>
                  <SelectTrigger className="glass-input h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            {(currentRound.status === 'pending') && (
              <GlassButton
                variant="primary" size="sm"
                loading={actionLoading === 'start_innings'}
                onClick={() => callSO('start_innings', {
                  innings_type: 'a',
                  batting_team_id: soTeamA || null,
                  bowling_team_id: soTeamB || null,
                }, 'start_innings')}
                className="col-span-2"
              >
                <Play className="h-3.5 w-3.5" /> Start Innings A
              </GlassButton>
            )}
            {(currentRound.status === 'innings_a') && (
              <GlassButton
                variant="ghost" size="sm"
                loading={actionLoading === 'complete_innings'}
                onClick={() => callSO('complete_innings', { innings_type: 'a' }, 'complete_innings')}
                className="col-span-2"
              >
                <Square className="h-3.5 w-3.5" /> Complete Innings A
              </GlassButton>
            )}
            {(currentRound.status === 'innings_b') && (
              <>
                <GlassButton
                  variant="primary" size="sm"
                  loading={actionLoading === 'start_innings_b'}
                  onClick={() => callSO('start_innings', {
                    innings_type: 'b',
                    batting_team_id: soTeamB || liveState?.bowling_team_id,
                    bowling_team_id: soTeamA || liveState?.batting_team_id,
                  }, 'start_innings_b')}
                >
                  <Play className="h-3.5 w-3.5" /> Start Inn B
                </GlassButton>
                <GlassButton
                  variant="ghost" size="sm"
                  loading={actionLoading === 'complete_innings'}
                  onClick={() => callSO('complete_innings', { innings_type: 'b' }, 'complete_innings')}
                >
                  <Square className="h-3.5 w-3.5" /> Complete Inn B
                </GlassButton>
              </>
            )}
          </div>

          {/* Round tied → add new round or finalize */}
          {currentRound.status === 'complete' && currentRound.is_tied && (
            <div className="mt-3 border-t border-warning/30 pt-3 space-y-2">
              <p className="text-xs text-warning font-semibold text-center">⚡ Round {currentRound.round_number} Tied Again!</p>
              <div className="grid grid-cols-2 gap-2">
                <GlassButton
                  variant="primary" size="sm"
                  loading={actionLoading === 'add_round'}
                  onClick={() => callSO('add_round', {}, 'add_round')}
                >
                  <Swords className="h-3.5 w-3.5" /> Round {currentRound.round_number + 1}
                </GlassButton>
                <GlassButton
                  variant="danger" size="sm"
                  loading={actionLoading === 'finalize'}
                  onClick={() => callSO('finalize', {}, 'finalize')}
                >
                  <Flag className="h-3.5 w-3.5" /> Finalize
                </GlassButton>
              </div>
            </div>
          )}

          {/* Round complete with winner → finalize */}
          {currentRound.status === 'complete' && !currentRound.is_tied && (
            <div className="mt-3 border-t border-success/30 pt-3 space-y-2">
              <p className="text-xs text-success font-semibold text-center">
                🏆 {currentRound.winner?.name || 'Winner'} won Round {currentRound.round_number}!
              </p>
              <GlassButton
                variant="success" size="sm" className="w-full"
                loading={actionLoading === 'finalize'}
                onClick={() => callSO('finalize', {}, 'finalize')}
              >
                <Flag className="h-3.5 w-3.5" /> Finalize Match
              </GlassButton>
            </div>
          )}
        </GlassCard>
      )}

      {/* ── Round history ── */}
      {rounds.length > 0 && (
        <GlassCard className="p-4">
          <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
            📋 Super Over History
          </h2>
          <div className="space-y-2">
            {rounds.map((r: any) => (
              <Collapsible
                key={r.id}
                open={historyOpen[r.round_number]}
                onOpenChange={v => setHistoryOpen(h => ({ ...h, [r.round_number]: v }))}
              >
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors text-left">
                    <span className="text-xs font-bold text-warning">Round {r.round_number}</span>
                    <span className="flex-1 text-xs text-muted-foreground">
                      {r.team_a?.short_code} {r.team_a_score}/{r.team_a_wickets} vs {r.team_b?.short_code} {r.team_b_score}/{r.team_b_wickets}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r.is_tied ? 'bg-warning/20 text-warning' :
                      r.winner_team_id ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                    }`}>
                      {r.is_tied ? 'Tied' : r.winner ? `${r.winner.short_code} won` : r.status}
                    </span>
                    {historyOpen[r.round_number] ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 py-2 text-xs text-muted-foreground space-y-1 border-t border-border/30 mt-1">
                    <div className="flex justify-between">
                      <span>{r.team_a?.name}: <strong className="text-foreground">{r.team_a_score}/{r.team_a_wickets}</strong></span>
                      <span>Innings #{r.innings_a_no}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{r.team_b?.name}: <strong className="text-foreground">{r.team_b_score}/{r.team_b_wickets}</strong></span>
                      <span>Innings #{r.innings_b_no}</span>
                    </div>
                    <div className="pt-1 font-semibold">
                      {r.is_tied ? '⚡ Tied' : r.winner ? `🏆 ${r.winner.name} won` : `Status: ${r.status}`}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Manual finalize fallback */}
      {isActive && (
        <GlassCard className="p-4 border border-destructive/30">
          <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
            <Shield className="h-4 w-4 text-destructive" /> Emergency Finalize
          </h2>
          <p className="text-xs text-muted-foreground mb-3">Force-end the match. Only use when no innings is active.</p>
          <GlassButton
            variant="danger" size="sm" className="w-full"
            loading={actionLoading === 'finalize'}
            onClick={() => callSO('finalize', {}, 'finalize')}
          >
            <Flag className="h-3.5 w-3.5" /> Finalize Match
          </GlassButton>
        </GlassCard>
      )}
    </div>
  );
}
