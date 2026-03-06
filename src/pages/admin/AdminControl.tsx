import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Zap, Trophy, Users, ScanLine, CheckCircle, AlertCircle, Wifi } from 'lucide-react';

export default function AdminControl() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [match, setMatch] = useState<any>(null);
  const [liveState, setLiveState] = useState<any>(null);
  const [activeOver, setActiveOver] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [activeWindow, setActiveWindow] = useState<any>(null);
  const [stats, setStats] = useState({ registrations: 0, paid: 0, checkins: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  // Delivery form state
  const [delivery, setDelivery] = useState({
    striker_id: '', non_striker_id: '', bowler_id: '',
    runs_off_bat: '0', extras_type: 'none', extras_runs: '0',
    is_wicket: false, wicket_type: '', out_player_id: '', fielder_id: '',
    free_hit: false, notes: '',
  });

  // Prediction window form
  const [windowQuestion, setWindowQuestion] = useState('What will happen on the next ball?');

  useEffect(() => {
    fetchAll();
    subscribeRealtime();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .eq('is_active_for_registration', true)
      .single();

    if (!matchData) { setLoading(false); return; }
    setMatch(matchData);

    const [stateRes, overRes, windowRes, ordersRes, ticketsRes] = await Promise.all([
      supabase.from('match_live_state').select('*').eq('match_id', matchData.id).single(),
      supabase.from('over_control').select('*').eq('match_id', matchData.id).eq('status', 'active').limit(1).single(),
      supabase.from('prediction_windows').select('*').eq('match_id', matchData.id).eq('status', 'open').order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('orders').select('id, payment_status').eq('match_id', matchData.id),
      supabase.from('tickets').select('id, status').eq('match_id', matchData.id),
    ]);

    setLiveState(stateRes.data);
    setActiveOver(overRes.data);
    setActiveWindow(windowRes.data);

    const orders = ordersRes.data || [];
    const tickets = ticketsRes.data || [];
    setStats({
      registrations: orders.length,
      paid: orders.filter(o => ['paid_verified', 'paid_manual_verified'].includes(o.payment_status)).length,
      checkins: tickets.filter(t => t.status === 'used').length,
    });

    // Fetch players for roster
    const { data: roster } = await supabase
      .from('match_roster')
      .select('team_id')
      .eq('match_id', matchData.id);

    if (roster && roster.length > 0) {
      const teamIds = roster.map(r => r.team_id);
      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .in('team_id', teamIds);
      setPlayers(playerData || []);
    }

    setLoading(false);
  };

  const subscribeRealtime = async () => {
    const { data: m } = await supabase.from('matches').select('id').eq('is_active_for_registration', true).single();
    if (!m) return;

    const channel = supabase
      .channel('admin-control-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_live_state', filter: `match_id=eq.${m.id}` },
        (payload) => setLiveState(payload.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'over_control', filter: `match_id=eq.${m.id}` },
        () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prediction_windows', filter: `match_id=eq.${m.id}` },
        (payload) => { if ((payload.new as any)?.status === 'open') setActiveWindow(payload.new); else if ((payload.new as any)?.status !== 'open') setActiveWindow(null); })
      .subscribe();
    channelRef.current = channel;
  };

  const callFunction = async (fn: string, body: any, loadingKey: string) => {
    setActionLoading(loadingKey);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: '✅ Done' });
      fetchAll();
      return data;
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
      return null;
    } finally {
      setActionLoading(null);
    }
  };

  const handlePhase = (phase: string) => callFunction('match-control', { action: 'set_phase', match_id: match?.id, phase }, `phase-${phase}`);

  const handleInitMatch = () => callFunction('match-control', { action: 'init', match_id: match?.id }, 'init');

  const handleCreateOver = () => callFunction('over-control', {
    action: 'create_over', match_id: match?.id,
    innings_no: liveState?.current_innings || 1,
    bowler_id: delivery.bowler_id || null,
  }, 'create-over');

  const handleCompleteOver = () => {
    if (!activeOver) return;
    callFunction('over-control', { action: 'update_over', over_id: activeOver.id, status: 'complete' }, 'complete-over');
  };

  const handleRecordDelivery = () => {
    if (!activeOver || !match) return;
    callFunction('record-delivery', {
      match_id: match.id,
      over_id: activeOver.id,
      innings_no: liveState?.current_innings || 1,
      over_no: activeOver.over_no,
      striker_id: delivery.striker_id || null,
      non_striker_id: delivery.non_striker_id || null,
      bowler_id: delivery.bowler_id || null,
      runs_off_bat: parseInt(delivery.runs_off_bat) || 0,
      extras_type: delivery.extras_type,
      extras_runs: parseInt(delivery.extras_runs) || 0,
      is_wicket: delivery.is_wicket,
      wicket_type: delivery.wicket_type || null,
      out_player_id: delivery.out_player_id || null,
      fielder_id: delivery.fielder_id || null,
      free_hit: delivery.free_hit,
      notes: delivery.notes || null,
    }, 'record-delivery');
  };

  const handleOpenWindow = () => {
    if (!match) return;
    callFunction('resolve-prediction-window', {
      action: 'open',
      match_id: match.id,
      question: windowQuestion,
      options: [
        { key: 'dot', label: 'Dot Ball' },
        { key: '1', label: '1 Run' },
        { key: '2', label: '2 Runs' },
        { key: '4', label: '4 Boundary' },
        { key: '6', label: '6 Sixer' },
        { key: 'wicket', label: 'Wicket 🏏' },
      ],
    }, 'open-window');
  };

  const handleLockWindow = () => {
    if (!activeWindow) return;
    callFunction('resolve-prediction-window', { action: 'lock', window_id: activeWindow.id }, 'lock-window');
  };

  const handleResolveWindow = (correctKey: string) => {
    if (!activeWindow && !match) return;
    // find last locked window
    supabase.from('prediction_windows').select('id').eq('match_id', match.id).eq('status', 'locked').order('created_at', { ascending: false }).limit(1).single()
      .then(({ data }) => {
        if (data) {
          callFunction('resolve-prediction-window', { action: 'resolve', window_id: data.id, correct_answer: { key: correctKey } }, 'resolve-window');
        }
      });
  };

  const phaseButtons = [
    { phase: 'pre', label: 'Pre-Match', variant: 'ghost' as const },
    { phase: 'innings1', label: '▶ Innings 1', variant: 'primary' as const },
    { phase: 'break', label: '☕ Break', variant: 'ghost' as const },
    { phase: 'innings2', label: '▶ Innings 2', variant: 'primary' as const },
    { phase: 'ended', label: '🏁 End Match', variant: 'danger' as const },
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
    <div className="p-4 space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
          <Zap className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold gradient-text-accent">Live Control</h1>
          <p className="text-muted-foreground text-sm">{match?.name}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Wifi className="h-4 w-4 text-success" />
          <span className="text-xs text-success font-medium">Realtime Active</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-3 text-center">
          <Users className="h-5 w-5 text-primary mx-auto mb-1" />
          <div className="font-display text-2xl font-bold gradient-text">{stats.registrations}</div>
          <div className="text-xs text-muted-foreground">Registrations</div>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <CheckCircle className="h-5 w-5 text-success mx-auto mb-1" />
          <div className="font-display text-2xl font-bold text-success">{stats.paid}</div>
          <div className="text-xs text-muted-foreground">Paid</div>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <ScanLine className="h-5 w-5 text-accent-foreground mx-auto mb-1" />
          <div className="font-display text-2xl font-bold text-accent-foreground">{stats.checkins}</div>
          <div className="text-xs text-muted-foreground">Check-ins</div>
        </GlassCard>
      </div>

      {/* Live Score Preview */}
      {liveState && (
        <GlassCard className="p-4">
          <h2 className="font-display text-sm font-bold text-foreground mb-3">📊 Live Scoreboard</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card/50 rounded-lg p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Innings 1</div>
              <div className="font-display text-2xl font-bold gradient-text">
                {liveState.innings1_score}/{liveState.innings1_wickets}
              </div>
              <div className="text-xs text-muted-foreground">{Number(liveState.innings1_overs).toFixed(1)} ov</div>
            </div>
            <div className="bg-card/50 rounded-lg p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Innings 2</div>
              <div className="font-display text-2xl font-bold gradient-text-accent">
                {liveState.innings2_score}/{liveState.innings2_wickets}
              </div>
              <div className="text-xs text-muted-foreground">{Number(liveState.innings2_overs).toFixed(1)} ov</div>
            </div>
          </div>
          {liveState.last_delivery_summary && (
            <div className="mt-2 text-center text-xs bg-primary/10 text-primary rounded p-2">
              Last: {liveState.last_delivery_summary}
            </div>
          )}
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>Phase: <strong className="text-foreground">{liveState.phase}</strong></span>
            <span>Innings: <strong className="text-foreground">{liveState.current_innings}</strong></span>
            {liveState.target_runs && <span>Target: <strong className="text-primary">{liveState.target_runs}</strong></span>}
          </div>
        </GlassCard>
      )}

      {/* Phase Control */}
      <GlassCard className="p-4">
        <h2 className="font-display text-sm font-bold text-foreground mb-3">🎮 Match Phase Control</h2>
        {!liveState && (
          <GlassButton variant="primary" size="md" className="w-full mb-3" loading={actionLoading === 'init'} onClick={handleInitMatch}>
            Initialize Live State
          </GlassButton>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {phaseButtons.map(b => (
            <GlassButton
              key={b.phase}
              variant={liveState?.phase === b.phase ? 'primary' : b.variant}
              size="sm"
              loading={actionLoading === `phase-${b.phase}`}
              onClick={() => handlePhase(b.phase)}
              className={liveState?.phase === b.phase ? 'ring-2 ring-primary' : ''}
            >
              {b.label}
            </GlassButton>
          ))}
        </div>
      </GlassCard>

      {/* Over Management */}
      <GlassCard className="p-4">
        <h2 className="font-display text-sm font-bold text-foreground mb-3">
          🏏 Over Management
          {activeOver && <span className="ml-2 text-xs text-primary font-normal">Over {activeOver.over_no} active</span>}
        </h2>
        <div className="flex gap-2 mb-3">
          <GlassButton variant="primary" size="sm" loading={actionLoading === 'create-over'} onClick={handleCreateOver} disabled={!!activeOver}>
            New Over
          </GlassButton>
          <GlassButton variant="ghost" size="sm" loading={actionLoading === 'complete-over'} onClick={handleCompleteOver} disabled={!activeOver}>
            Complete Over
          </GlassButton>
        </div>

        {/* Delivery Form */}
        {activeOver && (
          <div className="border border-primary/20 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Record Delivery — Over {activeOver.over_no}</h3>

            <div className="grid grid-cols-3 gap-2">
              {['striker_id', 'non_striker_id', 'bowler_id'].map(field => (
                <div key={field}>
                  <Label className="text-foreground mb-1 block text-xs">{field.replace('_id', '').replace('_', ' ').toUpperCase()}</Label>
                  <Select value={(delivery as any)[field]} onValueChange={v => setDelivery(d => ({ ...d, [field]: v }))}>
                    <SelectTrigger className="glass-input h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {players.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <Label className="text-foreground mb-1 block text-xs">RUNS</Label>
                <Input className="glass-input h-8 text-xs" type="number" min="0" max="6" value={delivery.runs_off_bat} onChange={e => setDelivery(d => ({ ...d, runs_off_bat: e.target.value }))} />
              </div>
              <div>
                <Label className="text-foreground mb-1 block text-xs">EXTRAS</Label>
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
              <div className="flex flex-col gap-1">
                <Label className="text-foreground text-xs">FLAGS</Label>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" checked={delivery.is_wicket} onChange={e => setDelivery(d => ({ ...d, is_wicket: e.target.checked }))} />
                  Wicket
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" checked={delivery.free_hit} onChange={e => setDelivery(d => ({ ...d, free_hit: e.target.checked }))} />
                  Free Hit
                </label>
              </div>
            </div>

            {delivery.is_wicket && (
              <div className="grid grid-cols-3 gap-2">
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
                  <Select value={delivery.out_player_id} onValueChange={v => setDelivery(d => ({ ...d, out_player_id: v }))}>
                    <SelectTrigger className="glass-input h-8 text-xs"><SelectValue placeholder="Who" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {players.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-foreground mb-1 block text-xs">FIELDER</Label>
                  <Select value={delivery.fielder_id} onValueChange={v => setDelivery(d => ({ ...d, fielder_id: v }))}>
                    <SelectTrigger className="glass-input h-8 text-xs"><SelectValue placeholder="Fielder" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {players.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <GlassButton variant="primary" size="md" className="w-full" loading={actionLoading === 'record-delivery'} onClick={handleRecordDelivery}>
              Record Delivery
            </GlassButton>
          </div>
        )}
      </GlassCard>

      {/* Prediction Window Controls */}
      <GlassCard className="p-4">
        <h2 className="font-display text-sm font-bold text-foreground mb-3">
          🎯 Prediction Window
          {activeWindow && <span className="ml-2 text-xs text-primary animate-pulse">● OPEN</span>}
        </h2>

        {!activeWindow ? (
          <div className="space-y-2">
            <Input
              className="glass-input text-sm"
              value={windowQuestion}
              onChange={e => setWindowQuestion(e.target.value)}
              placeholder="Prediction question..."
            />
            <GlassButton variant="primary" size="sm" loading={actionLoading === 'open-window'} onClick={handleOpenWindow}>
              Open Prediction Window
            </GlassButton>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-foreground bg-primary/10 rounded-lg p-2">
              <strong>Active:</strong> {activeWindow.question}
            </div>
            <GlassButton variant="ghost" size="sm" loading={actionLoading === 'lock-window'} onClick={handleLockWindow}>
              Lock Window
            </GlassButton>
          </div>
        )}

        {/* Quick resolve buttons */}
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-2">Quick Resolve (for locked window):</p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'dot', label: 'Dot' },
              { key: '1', label: '1 Run' },
              { key: '2', label: '2 Runs' },
              { key: '4', label: '4 Boundary' },
              { key: '6', label: '6 Sixer' },
              { key: 'wicket', label: 'Wicket 🏏' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => handleResolveWindow(opt.key)}
                className="px-2 py-1 text-xs rounded-lg border border-border hover:border-primary hover:bg-primary/10 text-foreground transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Top Leaderboard Preview */}
      {match && (
        <GlassCard className="p-4">
          <h2 className="font-display text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> Top Leaderboard
          </h2>
          <LeaderboardMini matchId={match.id} />
        </GlassCard>
      )}
    </div>
  );
}

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
