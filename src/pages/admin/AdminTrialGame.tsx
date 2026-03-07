import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FlaskConical, Loader2, Trash2, Play, Lock, CheckCircle2,
  AlertTriangle, RefreshCw, Zap, Circle, Users, Copy, ExternalLink,
} from 'lucide-react';
import { BALL_OUTCOMES, BallOutcomeKey, deriveOutcomeKey } from './AdminControl';
import { cn } from '@/lib/utils';

// ── Seed constants ─────────────────────────────────────────────────────────────
const TRIAL_NAME = '[TRIAL] Staff Rehearsal';
const TRIAL_TEAM_A = { name: '[TRIAL] Team Alpha', short_code: 'TRA' };
const TRIAL_TEAM_B = { name: '[TRIAL] Team Beta', short_code: 'TRB' };
const DUMMY_BATTERS_A = ['Trial Batter 1', 'Trial Batter 2', 'Trial Batter 3', 'Trial Batter 4', 'Trial Batter 5'];
const DUMMY_BATTERS_B = ['Trial Batter 6', 'Trial Batter 7', 'Trial Batter 8'];
const DUMMY_BOWLERS_A = ['Trial Bowler A1', 'Trial Bowler A2'];
const DUMMY_BOWLERS_B = ['Trial Bowler B1', 'Trial Bowler B2', 'Trial Bowler B3'];

// Dummy customer mobile numbers — use obvious patterns that staff won't confuse with real data
const DUMMY_CUSTOMERS = [
  { mobile: '9000000001', name: 'Trial Staff A' },
  { mobile: '9000000002', name: 'Trial Staff B' },
  { mobile: '9000000003', name: 'Trial Staff C' },
];
const TRIAL_PIN = '1234';

type WindowStatus = 'open' | 'locked' | 'resolved' | 'none';

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function BallPill({ delivery }: { delivery: any }) {
  const isWide = delivery.extras_type === 'wide';
  const isNB = delivery.extras_type === 'no_ball';
  const total = (delivery.runs_off_bat || 0) + (delivery.extras_runs || 0);
  let label = '';
  let cls = 'bg-muted/50 text-foreground';
  if (delivery.is_wicket) { label = 'W'; cls = 'bg-destructive/30 text-destructive font-bold'; }
  else if (isWide) { label = 'WD'; cls = 'bg-warning/20 text-warning'; }
  else if (isNB) { label = 'NB'; cls = 'bg-warning/20 text-warning'; }
  else if (total === 6) { label = '6'; cls = 'bg-primary/30 text-primary font-bold'; }
  else if (total === 4) { label = '4'; cls = 'bg-accent/30 text-accent-foreground font-bold'; }
  else if (total === 0) { label = '•'; cls = 'bg-muted/40 text-muted-foreground'; }
  else { label = String(total); }
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border border-border/30 ${cls}`}>
      {label}
    </div>
  );
}

export default function AdminTrialGame() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [trialMatch, setTrialMatch] = useState<any>(null);
  const [liveState, setLiveState] = useState<any>(null);
  const [activeOver, setActiveOver] = useState<any>(null);
  const [activeWindow, setActiveWindow] = useState<any>(null);
  const [windowStatus, setWindowStatus] = useState<WindowStatus>('none');
  const [predictionCount, setPredictionCount] = useState(0);
  const [recentDeliveries, setRecentDeliveries] = useState<any[]>([]);
  const [selectedOutcome, setSelectedOutcome] = useState<BallOutcomeKey | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [dummyCustomers, setDummyCustomers] = useState<{ mobile: string; name: string; hasAccess: boolean }[]>([]);

  const [setupLoading, setSetupLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [wipeConfirmOpen, setWipeConfirmOpen] = useState(false);

  // ── Fetch existing trial match ───────────────────────────────────────────────
  const fetchTrial = useCallback(async () => {
    setPageLoading(true);
    try {
      const { data: matchData } = await supabase
        .from('matches')
        .select('*')
        .ilike('name', '[TRIAL]%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!matchData) {
        setTrialMatch(null);
        setLiveState(null);
        setActiveOver(null);
        setActiveWindow(null);
        setWindowStatus('none');
        setRecentDeliveries([]);
        setPlayers([]);
        setDummyCustomers([]);
        return;
      }

      setTrialMatch(matchData);

      const [stateRes, overRes, windowOpenRes, windowLockedRes] = await Promise.all([
        supabase.from('match_live_state').select('*').eq('match_id', matchData.id).maybeSingle(),
        supabase.from('over_control').select('*').eq('match_id', matchData.id).eq('status', 'active').limit(1).maybeSingle(),
        supabase.from('prediction_windows').select('*').eq('match_id', matchData.id).eq('status', 'open').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('prediction_windows').select('*').eq('match_id', matchData.id).eq('status', 'locked').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      setLiveState(stateRes.data);
      setActiveOver(overRes.data);

      if (windowOpenRes.data) {
        setActiveWindow(windowOpenRes.data);
        setWindowStatus('open');
        const { count } = await supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('window_id', windowOpenRes.data.id);
        setPredictionCount(count || 0);
      } else if (windowLockedRes.data) {
        setActiveWindow(windowLockedRes.data);
        setWindowStatus('locked');
        const { count } = await supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('window_id', windowLockedRes.data.id);
        setPredictionCount(count || 0);
      } else {
        setActiveWindow(null);
        setWindowStatus('none');
        setPredictionCount(0);
      }

      // Recent deliveries
      if (overRes.data) {
        const { data: dels } = await supabase
          .from('deliveries').select('*').eq('over_id', overRes.data.id).order('delivery_no');
        setRecentDeliveries(dels || []);
      } else {
        const { data: dels } = await supabase
          .from('deliveries').select('*').eq('match_id', matchData.id).order('created_at', { ascending: false }).limit(6);
        setRecentDeliveries((dels || []).reverse());
      }

      // Players
      const { data: lineup } = await supabase
        .from('match_lineup').select('*, players(*)').eq('match_id', matchData.id).order('batting_order');
      if (lineup && lineup.length > 0) {
        setPlayers(lineup.filter((l: any) => l.players).map((l: any) => l.players));
      }

      // Check game_access for dummy customers
      const { data: accessRows } = await supabase
        .from('game_access')
        .select('mobile')
        .eq('match_id', matchData.id)
        .in('mobile', DUMMY_CUSTOMERS.map(c => c.mobile));
      const activeMobiles = new Set((accessRows || []).map((r: any) => r.mobile));
      setDummyCustomers(DUMMY_CUSTOMERS.map(c => ({ ...c, hasAccess: activeMobiles.has(c.mobile) })));
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrial(); }, [fetchTrial]);

  // ── Setup trial match ────────────────────────────────────────────────────────
  const handleSetupTrial = async () => {
    setSetupLoading(true);
    try {
      // 1. Get first active event
      const { data: eventData, error: eventError } = await supabase
        .from('events').select('id').eq('is_active', true).limit(1).maybeSingle();
      if (eventError || !eventData) throw new Error('No active event found. Create an event first.');

      // 2. Create or reuse dummy teams
      let teamAId: string, teamBId: string;
      const { data: existTeamA } = await supabase.from('teams').select('id').eq('name', TRIAL_TEAM_A.name).maybeSingle();
      if (existTeamA) {
        teamAId = existTeamA.id;
      } else {
        const { data: ta, error } = await supabase.from('teams').insert(TRIAL_TEAM_A).select('id').single();
        if (error) throw error;
        teamAId = ta.id;
      }
      const { data: existTeamB } = await supabase.from('teams').select('id').eq('name', TRIAL_TEAM_B.name).maybeSingle();
      if (existTeamB) {
        teamBId = existTeamB.id;
      } else {
        const { data: tb, error } = await supabase.from('teams').insert(TRIAL_TEAM_B).select('id').single();
        if (error) throw error;
        teamBId = tb.id;
      }

      // 3. Create dummy players
      await supabase.from('players').delete().eq('team_id', teamAId);
      await supabase.from('players').delete().eq('team_id', teamBId);
      const playersToInsert = [
        ...DUMMY_BATTERS_A.map(name => ({ name, team_id: teamAId, role: 'batsman' as const })),
        ...DUMMY_BOWLERS_A.map(name => ({ name, team_id: teamAId, role: 'bowler' as const })),
        ...DUMMY_BATTERS_B.map(name => ({ name, team_id: teamBId, role: 'batsman' as const })),
        ...DUMMY_BOWLERS_B.map(name => ({ name, team_id: teamBId, role: 'bowler' as const })),
      ];
      const { data: createdPlayers, error: playerError } = await supabase.from('players').insert(playersToInsert).select('id, name, team_id');
      if (playerError) throw playerError;

      // 4. Create trial match
      const { data: matchData, error: matchError } = await supabase.from('matches').insert({
        name: TRIAL_NAME,
        event_id: eventData.id,
        is_active_for_registration: false,
        status: 'draft',
        venue: 'Trial Ground',
        prediction_mode: 'per_ball',
        predictions_enabled: true,
      }).select('id').single();
      if (matchError) throw matchError;
      const matchId = matchData.id;

      // 5. Create roster
      await supabase.from('match_roster').insert([
        { match_id: matchId, team_id: teamAId, side: 'home', is_batting_first: true },
        { match_id: matchId, team_id: teamBId, side: 'away', is_batting_first: false },
      ]);

      // 6. Create lineup
      const teamAPlayers = (createdPlayers || []).filter(p => p.team_id === teamAId);
      const teamBPlayers = (createdPlayers || []).filter(p => p.team_id === teamBId);
      const lineupInsert = [
        ...teamAPlayers.map((p, i) => ({ match_id: matchId, team_id: teamAId, player_id: p.id, batting_order: i + 1 })),
        ...teamBPlayers.map((p, i) => ({ match_id: matchId, team_id: teamBId, player_id: p.id, batting_order: i + 1 })),
      ];
      await supabase.from('match_lineup').insert(lineupInsert);

      // 7. Init match live state
      const { data: initData, error: initError } = await supabase.functions.invoke('match-control', {
        body: { action: 'init', match_id: matchId },
      });
      if (initError || initData?.error) throw new Error(initData?.error || initError?.message);

      // 8. Set phase + teams
      await supabase.functions.invoke('match-control', {
        body: {
          action: 'set_phase', match_id: matchId, phase: 'innings1',
          batting_team_id: teamAId, bowling_team_id: teamBId,
        },
      });

      // 9. Set opener batsmen & bowler
      const openerStriker = teamAPlayers[0]?.id ?? null;
      const openerNonStriker = teamAPlayers[1]?.id ?? null;
      const openBowler = teamBPlayers[teamBPlayers.length - 1]?.id ?? null;
      if (openerStriker) {
        await supabase.functions.invoke('match-control', {
          body: { action: 'update_players', match_id: matchId, striker_id: openerStriker, non_striker_id: openerNonStriker, bowler_id: openBowler },
        });
      }

      // 10. Create first over
      await supabase.functions.invoke('over-control', {
        body: { action: 'create_over', match_id: matchId, innings_no: 1, bowler_id: openBowler },
      });

      // 11. Seed dummy customer orders + tickets + game_access
      const pinHash = await sha256Hex(TRIAL_PIN);
      for (const customer of DUMMY_CUSTOMERS) {
        // Create order via edge function to get proper ticket generation (HMAC-signed QR)
        const { data: orderResult } = await supabase.functions.invoke('create-order', {
          body: {
            match_id: matchId,
            purchaser_full_name: customer.name,
            purchaser_mobile: customer.mobile,
            seats_count: 1,
            payment_method: 'cash',
            seating_type: 'regular',
            pricing_snapshot: { total: 0, seats: [{ seat_index: 0, price: 0, reason: 'standard' }] },
            created_source: 'manual_booking',
            admin_id: user?.id,
            advance_paid: 0,
          },
        });

        const ticketId = orderResult?.tickets?.[0]?.id;
        if (!ticketId) continue;

        // Create game_access entry with known PIN
        await supabase.from('game_access').insert({
          match_id: matchId,
          mobile: customer.mobile,
          pin_hash: pinHash,
          ticket_id: ticketId,
          is_active: true,
        });
      }

      toast({ title: '⚗️ Trial match created!', description: 'Dummy teams, players & 3 test customer accounts ready.' });
      await fetchTrial();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Setup failed', description: e.message });
    } finally {
      setSetupLoading(false);
    }
  };

  // ── Open prediction window ───────────────────────────────────────────────────
  const handleOpenWindow = async () => {
    if (!trialMatch) return;
    setActionLoading('open-window');
    try {
      const { data, error } = await supabase.functions.invoke('resolve-prediction-window', {
        body: {
          action: 'open',
          match_id: trialMatch.id,
          question: 'What will happen on the next ball?',
          options: BALL_OUTCOMES.map(o => ({ key: o.key, label: o.label })),
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: '🟢 Guesses open!' });
      await fetchTrial();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
    } finally {
      setActionLoading(null);
    }
  };

  // ── Lock prediction window ───────────────────────────────────────────────────
  const handleLockWindow = async () => {
    if (!activeWindow) return;
    setActionLoading('lock-window');
    try {
      const { data, error } = await supabase.functions.invoke('resolve-prediction-window', {
        body: { action: 'lock', window_id: activeWindow.id },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: '🔒 Window locked!' });
      await fetchTrial();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
    } finally {
      setActionLoading(null);
    }
  };

  // ── Record ball & auto-resolve ───────────────────────────────────────────────
  const handleRecordBall = async (key: BallOutcomeKey) => {
    if (!activeOver || !trialMatch) return;
    if (windowStatus === 'open') {
      toast({ variant: 'destructive', title: 'Lock the window first', description: 'Lock the prediction window before recording the ball.' });
      return;
    }
    setActionLoading('record-ball');
    try {
      const deliveryFields: any = {
        match_id: trialMatch.id,
        over_id: activeOver.id,
        innings_no: liveState?.current_innings || 1,
        over_no: activeOver.over_no,
        striker_id: liveState?.current_striker_id || players.find(p => p.team_id === liveState?.batting_team_id)?.id || null,
        non_striker_id: liveState?.current_non_striker_id || null,
        bowler_id: liveState?.current_bowler_id || null,
        runs_off_bat: 0,
        extras_type: 'none',
        extras_runs: 0,
        is_wicket: false,
        wicket_type: null,
        out_player_id: null,
        fielder_id: null,
        free_hit: false,
        auto_rotate: true,
      };

      if (key === 'dot_ball')    { /* all defaults */ }
      else if (key === 'runs_1') { deliveryFields.runs_off_bat = 1; }
      else if (key === 'runs_2') { deliveryFields.runs_off_bat = 2; }
      else if (key === 'runs_3') { deliveryFields.runs_off_bat = 3; }
      else if (key === 'boundary_4') { deliveryFields.runs_off_bat = 4; }
      else if (key === 'six_6')  { deliveryFields.runs_off_bat = 6; }
      else if (key === 'wide')   { deliveryFields.extras_type = 'wide'; deliveryFields.extras_runs = 1; }
      else if (key === 'no_ball') { deliveryFields.extras_type = 'no_ball'; deliveryFields.extras_runs = 1; }
      else if (key === 'byes')   { deliveryFields.extras_type = 'bye'; deliveryFields.extras_runs = 1; }
      else if (key === 'leg_byes') { deliveryFields.extras_type = 'leg_bye'; deliveryFields.extras_runs = 1; }
      else if (key === 'wicket') {
        deliveryFields.is_wicket = true;
        deliveryFields.wicket_type = 'caught';
        const striker = players.find(p => p.id === liveState?.current_striker_id);
        if (striker) deliveryFields.out_player_id = striker.id;
      }

      const { data: delData, error: delError } = await supabase.functions.invoke('record-delivery', { body: deliveryFields });
      if (delError || delData?.error) throw new Error(delData?.error || delError?.message);
      toast({ title: '✅ Ball recorded' });

      // Auto-resolve locked window
      const correctKey = deriveOutcomeKey({
        runs_off_bat: deliveryFields.runs_off_bat,
        extras_type: deliveryFields.extras_type,
        is_wicket: deliveryFields.is_wicket,
      });
      const { data: lockedWin } = await supabase
        .from('prediction_windows')
        .select('id')
        .eq('match_id', trialMatch.id)
        .eq('status', 'locked')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lockedWin) {
        const { data: resolveData, error: resolveError } = await supabase.functions.invoke('resolve-prediction-window', {
          body: { action: 'resolve', window_id: lockedWin.id, match_id: trialMatch.id, correct_answer: { key: correctKey } },
        });
        if (resolveError || resolveData?.error) {
          toast({ variant: 'destructive', title: 'Auto-resolve failed', description: resolveData?.error || resolveError?.message });
        } else {
          const outcomeLabel = BALL_OUTCOMES.find(o => o.key === correctKey)?.label ?? correctKey;
          toast({ title: `🎯 Resolved: ${outcomeLabel}`, description: `${resolveData?.resolved ?? 0} prediction(s) scored` });
        }
      }

      setSelectedOutcome(null);
      await fetchTrial();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
    } finally {
      setActionLoading(null);
    }
  };

  // ── Wipe trial data ──────────────────────────────────────────────────────────
  const handleWipeTrial = async () => {
    if (!trialMatch) return;
    setWipeConfirmOpen(false);
    setActionLoading('wipe');
    try {
      const { data, error } = await supabase.functions.invoke('trial-game-cleanup', {
        body: { match_id: trialMatch.id },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: '🗑 Trial data wiped', description: 'All trial match data has been deleted.' });
      setTrialMatch(null);
      setLiveState(null);
      setActiveOver(null);
      setActiveWindow(null);
      setWindowStatus('none');
      setRecentDeliveries([]);
      setPlayers([]);
      setDummyCustomers([]);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Wipe failed', description: e.message });
    } finally {
      setActionLoading(null);
    }
  };

  const isLoading = (key: string) => actionLoading === key;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Copied!', description: text });
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-warning/15 border border-warning/30 flex items-center justify-center">
            <FlaskConical className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-lg leading-tight">Trial Game</h1>
            <p className="text-xs text-muted-foreground">Staff rehearsal — not visible to customers</p>
          </div>
        </div>
        {trialMatch && (
          <button
            onClick={fetchTrial}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Trial Mode Banner */}
      <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/8 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
        <p className="text-xs text-warning leading-relaxed">
          <strong>TRIAL MODE</strong> — This match uses dummy data and is hidden from all customer-facing pages. Wipe it when done to keep the database clean.
        </p>
      </div>

      {/* ── SETUP PHASE ─────────────────────────────────────────────────────── */}
      {!trialMatch && (
        <GlassCard className="p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center mx-auto">
            <FlaskConical className="h-8 w-8 text-warning" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground text-lg">No Trial Match Found</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Create a trial match to rehearse the full prediction game loop with your staff.
            </p>
          </div>
          <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-3 text-left space-y-1">
            <p className="font-medium text-foreground">What gets created:</p>
            <p>• 2 dummy teams (Team Alpha & Team Beta)</p>
            <p>• 10 dummy players seeded into lineup</p>
            <p>• 3 dummy customer accounts (PIN: <strong className="text-foreground font-mono">{TRIAL_PIN}</strong>)</p>
            <p>• Match live state + first over ready to go</p>
            <p>• Status: draft, not visible to customers</p>
          </div>
          <Button
            onClick={handleSetupTrial}
            disabled={setupLoading}
            className="w-full"
          >
            {setupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
            Create Trial Match
          </Button>
        </GlassCard>
      )}

      {/* ── ACTIVE PHASE ────────────────────────────────────────────────────── */}
      {trialMatch && (
        <div className="space-y-4">

          {/* ── DUMMY CUSTOMER CREDENTIALS ──────────────────────────────────── */}
          <GlassCard className="p-4 space-y-3 border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Test Customer Logins</h3>
              </div>
              <a
                href="/play"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                Open /play <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Open <strong>/play</strong> in another tab and log in as one of these to test the customer-side prediction experience. All use PIN&nbsp;
              <button
                onClick={() => copyToClipboard(TRIAL_PIN)}
                className="font-mono font-bold text-foreground bg-muted/40 px-1.5 py-0.5 rounded border border-border/40 hover:bg-muted/60 transition-colors inline-flex items-center gap-1"
              >
                {TRIAL_PIN} <Copy className="h-2.5 w-2.5" />
              </button>
            </p>
            <div className="space-y-2">
              {dummyCustomers.map(c => (
                <div key={c.mobile} className="flex items-center justify-between gap-3 rounded-lg border border-border/30 bg-muted/15 px-3 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-foreground">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{c.mobile}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0.5 h-auto', c.hasAccess ? 'border-success/40 text-success bg-success/5' : 'border-muted text-muted-foreground')}>
                      {c.hasAccess ? 'Active' : 'No access'}
                    </Badge>
                    <button
                      onClick={() => copyToClipboard(c.mobile)}
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                      title="Copy mobile"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Note: The /play page shows the <em>active registration match</em>. These customers can access the trial match directly via the game PIN verification, but the scoreboard/guesses will use the trial match data.
            </p>
          </GlassCard>

          {/* Status Bar */}
          <GlassCard className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Phase:</span>
              <span className="text-xs font-bold text-primary uppercase tracking-wide">
                {liveState?.phase?.replace('_', ' ') || '—'}
              </span>
              <span className="text-muted-foreground/40">|</span>
              <span className="text-xs font-medium text-muted-foreground">Over:</span>
              <span className="text-xs font-bold text-foreground">
                {activeOver ? `${activeOver.over_no}.${recentDeliveries.filter(d => d.extras_type !== 'wide' && d.extras_type !== 'no_ball').length}` : '—'}
              </span>
              <span className="text-muted-foreground/40">|</span>
              <span className="text-xs font-medium text-muted-foreground">Window:</span>
              <span className={cn('text-xs font-bold uppercase tracking-wide', {
                'text-success': windowStatus === 'open',
                'text-warning': windowStatus === 'locked',
                'text-muted-foreground': windowStatus === 'none',
              })}>
                {windowStatus === 'none' ? 'Closed' : windowStatus}
              </span>
              {windowStatus !== 'none' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-auto">
                  {predictionCount} guess{predictionCount !== 1 ? 'es' : ''}
                </Badge>
              )}
            </div>
          </GlassCard>

          {/* Step Guide */}
          <GlassCard className="px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground overflow-x-auto">
              <StepBadge num={1} label="Open Guesses" done={windowStatus !== 'none'} active={windowStatus === 'none'} />
              <span className="text-border flex-shrink-0">→</span>
              <StepBadge num={2} label="Lock Window" done={windowStatus === 'locked'} active={windowStatus === 'open'} />
              <span className="text-border flex-shrink-0">→</span>
              <StepBadge num={3} label="Record Ball" done={false} active={windowStatus === 'locked' || windowStatus === 'none'} />
            </div>
          </GlassCard>

          {/* Prediction Window Controls */}
          <GlassCard className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Prediction Window</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={handleOpenWindow}
                disabled={windowStatus === 'open' || !!actionLoading}
                variant={windowStatus === 'none' ? 'default' : 'outline'}
              >
                {isLoading('open-window') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                <span className="ml-1.5">Open Guesses</span>
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleLockWindow}
                disabled={windowStatus !== 'open' || !!actionLoading}
                variant={windowStatus === 'open' ? 'default' : 'outline'}
              >
                {isLoading('lock-window') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                <span className="ml-1.5">Lock Window</span>
              </Button>
            </div>
            {windowStatus === 'open' && (
              <p className="text-[11px] text-success flex items-center gap-1.5">
                <Circle className="h-2 w-2 fill-success text-success" />
                Window is open — {predictionCount} prediction{predictionCount !== 1 ? 's' : ''} submitted
              </p>
            )}
            {windowStatus === 'locked' && (
              <p className="text-[11px] text-warning flex items-center gap-1.5">
                <Lock className="h-2.5 w-2.5" />
                Window locked — ready to record ball
              </p>
            )}
          </GlassCard>

          {/* Ball Outcome Grid */}
          <GlassCard className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Record Ball</h3>
              {windowStatus === 'open' && (
                <span className="text-[11px] text-destructive font-medium">Lock window first</span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {BALL_OUTCOMES.map(({ key, label, emoji, colorCls }) => (
                <button
                  key={key}
                  onClick={() => setSelectedOutcome(key as BallOutcomeKey)}
                  disabled={!!actionLoading}
                  className={cn(
                    'relative flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl border text-xs font-semibold transition-all',
                    selectedOutcome === key
                      ? 'ring-2 ring-primary border-primary/60 bg-primary/10'
                      : `border-border/40 bg-muted/20 hover:bg-muted/40 ${colorCls}`,
                    !!actionLoading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className="text-base leading-none">{emoji}</span>
                  <span className="text-[10px] leading-none opacity-80">{label}</span>
                </button>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={!selectedOutcome || windowStatus === 'open' || !!actionLoading}
              onClick={() => selectedOutcome && handleRecordBall(selectedOutcome)}
            >
              {isLoading('record-ball') ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {selectedOutcome
                ? `Record: ${BALL_OUTCOMES.find(o => o.key === selectedOutcome)?.label}`
                : 'Select an outcome first'}
            </Button>
          </GlassCard>

          {/* Recent Balls */}
          {recentDeliveries.length > 0 && (
            <GlassCard className="px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Last balls</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {recentDeliveries.slice(-8).map((d, i) => (
                  <BallPill key={d.id ?? i} delivery={d} />
                ))}
              </div>
            </GlassCard>
          )}

          {/* New Over */}
          {!activeOver && liveState?.phase === 'innings1' && (
            <GlassCard className="p-4">
              <p className="text-xs text-muted-foreground mb-2">No active over. Start a new one to record balls.</p>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={!!actionLoading}
                onClick={async () => {
                  setActionLoading('new-over');
                  try {
                    const { data, error } = await supabase.functions.invoke('over-control', {
                      body: { action: 'create_over', match_id: trialMatch.id, innings_no: liveState?.current_innings || 1, bowler_id: liveState?.current_bowler_id || null },
                    });
                    if (error || data?.error) throw new Error(data?.error || error?.message);
                    toast({ title: '⚡ New over started' });
                    await fetchTrial();
                  } catch (e: any) {
                    toast({ variant: 'destructive', title: 'Failed', description: e.message });
                  } finally {
                    setActionLoading(null);
                  }
                }}
              >
                {isLoading('new-over') ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
                Start New Over
              </Button>
            </GlassCard>
          )}

          {/* Wipe Zone */}
          <GlassCard className="p-4 border-destructive/30 bg-destructive/5">
            <div className="flex items-start gap-3">
              <Trash2 className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-destructive">Wipe Trial Data</p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                  Permanently deletes this trial match and all associated data (predictions, windows, deliveries, overs, leaderboard, dummy orders, test accounts, teams, players).
                </p>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setWipeConfirmOpen(true)}
                  disabled={!!actionLoading}
                  className="w-full"
                >
                  {isLoading('wipe') ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                  Delete All Trial Data
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Wipe Confirmation Dialog */}
      <AlertDialog open={wipeConfirmOpen} onOpenChange={setWipeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Wipe All Trial Data?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the trial match, all dummy teams/players, every delivery recorded, all prediction windows, dummy orders, test customer accounts, and all leaderboard entries. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWipeTrial}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Wipe Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StepBadge({ num, label, done, active }: { num: number; label: string; done: boolean; active: boolean }) {
  return (
    <div className={cn('flex items-center gap-1.5 flex-shrink-0', {
      'text-success': done,
      'text-foreground font-medium': active && !done,
      'text-muted-foreground': !active && !done,
    })}>
      <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border', {
        'bg-success/20 border-success/40 text-success': done,
        'bg-primary/20 border-primary/40 text-primary': active && !done,
        'bg-muted/40 border-border/40 text-muted-foreground': !active && !done,
      })}>
        {done ? '✓' : num}
      </div>
      <span className="text-[11px]">{label}</span>
    </div>
  );
}
