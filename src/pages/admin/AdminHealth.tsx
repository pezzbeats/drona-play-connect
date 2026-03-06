import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  HeartPulse, RefreshCw, CheckCircle2, XCircle, Loader2,
  Database, Shield, Zap, Wifi, Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

type Status = 'ok' | 'error' | 'checking';

interface HealthCard {
  label: string;
  status: Status;
  detail: string;
  icon: React.ElementType;
}

const EDGE_FUNCTIONS = [
  'create-order',
  'verify-game-pin',
  'submit-prediction',
  'match-control',
  'over-control',
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export default function AdminHealth() {
  const [cards, setCards] = useState<HealthCard[]>([
    { label: 'Database', status: 'checking', detail: 'Checking…', icon: Database },
    { label: 'Auth Service', status: 'checking', detail: 'Checking…', icon: Shield },
    { label: 'Edge Functions', status: 'checking', detail: 'Checking…', icon: Zap },
    { label: 'Realtime', status: 'checking', detail: 'Checking…', icon: Wifi },
  ]);
  const [activeMatch, setActiveMatch] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefreshSec, setAutoRefreshSec] = useState(30);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  const runChecks = useCallback(async () => {
    setCards(c => c.map(card => ({ ...card, status: 'checking', detail: 'Checking…' })));

    // ── 1. DB connectivity ────────────────────────────────────────────────────
    const dbStart = Date.now();
    let dbStatus: Status = 'error';
    let dbDetail = 'Failed';
    try {
      const { error } = await supabase.from('matches').select('id', { count: 'exact', head: true });
      const ms = Date.now() - dbStart;
      dbStatus = error ? 'error' : 'ok';
      dbDetail = error ? error.message : `${ms}ms latency`;
    } catch { dbDetail = 'Network error'; }

    // ── 2. Auth service ───────────────────────────────────────────────────────
    let authStatus: Status = 'error';
    let authDetail = 'Failed';
    try {
      const { error } = await supabase.auth.getSession();
      authStatus = error ? 'error' : 'ok';
      authDetail = error ? error.message : 'Session valid';
    } catch { authDetail = 'Network error'; }

    // ── 3. Edge functions (OPTIONS ping) ──────────────────────────────────────
    let edgeStatus: Status = 'ok';
    let reachable = 0;
    await Promise.all(
      EDGE_FUNCTIONS.map(async fn => {
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: 'OPTIONS', signal: AbortSignal.timeout(5000) });
          if (res.ok || res.status === 204 || res.status === 401 || res.status === 405) reachable++;
        } catch { /* unreachable */ }
      })
    );
    if (reachable < EDGE_FUNCTIONS.length) edgeStatus = reachable === 0 ? 'error' : 'ok';
    const edgeDetail = `${reachable}/${EDGE_FUNCTIONS.length} reachable`;

    // ── 4. Realtime ───────────────────────────────────────────────────────────
    let realtimeStatus: Status = 'checking';
    let realtimeDetail = 'Connecting…';
    const ch = supabase.channel('health-ping-' + Date.now());
    await new Promise<void>(resolve => {
      const t = setTimeout(() => {
        realtimeStatus = 'error';
        realtimeDetail = 'Timeout';
        supabase.removeChannel(ch);
        resolve();
      }, 5000);
      ch.subscribe(s => {
        clearTimeout(t);
        realtimeStatus = s === 'SUBSCRIBED' ? 'ok' : 'error';
        realtimeDetail = s === 'SUBSCRIBED' ? 'Connected' : `Status: ${s}`;
        supabase.removeChannel(ch);
        resolve();
      });
    });

    setCards([
      { label: 'Database', status: dbStatus, detail: dbDetail, icon: Database },
      { label: 'Auth Service', status: authStatus, detail: authDetail, icon: Shield },
      { label: 'Edge Functions', status: edgeStatus, detail: edgeDetail, icon: Zap },
      { label: 'Realtime', status: realtimeStatus, detail: realtimeDetail, icon: Wifi },
    ]);

    // ── Active match ──────────────────────────────────────────────────────────
    const { data: matchData } = await supabase
      .from('matches')
      .select('id, name, status, is_active_for_registration')
      .eq('is_active_for_registration', true)
      .maybeSingle();
    setActiveMatch(matchData);

    // ── Recent activity ───────────────────────────────────────────────────────
    const { data: actData } = await supabase
      .from('admin_activity')
      .select('action, admin_id, entity_type, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentActivity(actData || []);

    setLastRefresh(new Date());
    setAutoRefreshSec(30);
  }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    runChecks();
    timerRef.current = setInterval(runChecks, 30_000);
    countdownRef.current = setInterval(() => setAutoRefreshSec(s => Math.max(0, s - 1)), 1000);
    return () => {
      clearInterval(timerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [runChecks]);

  const allOk = cards.every(c => c.status === 'ok');
  const anyError = cards.some(c => c.status === 'error');

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
          <HeartPulse className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold gradient-text-accent">System Health</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Last refresh {formatDistanceToNow(lastRefresh, { addSuffix: true })} · auto in {autoRefreshSec}s
          </p>
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={runChecks}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh Now
        </Button>
      </div>

      {/* Overall status banner */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium',
        anyError
          ? 'bg-destructive/10 border-destructive/40 text-destructive'
          : allOk
          ? 'bg-success/10 border-success/30 text-success'
          : 'bg-muted/60 border-border text-muted-foreground'
      )}>
        {anyError ? <XCircle className="h-4 w-4" /> : allOk ? <CheckCircle2 className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
        {anyError ? 'One or more services are degraded' : allOk ? 'All systems operational' : 'Running health checks…'}
      </div>

      {/* Health cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <GlassCard key={card.label} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <Icon className="h-5 w-5 text-muted-foreground" />
                {card.status === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {card.status === 'ok' && <CheckCircle2 className="h-4 w-4 text-success" />}
                {card.status === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
              </div>
              <p className="font-display font-bold text-sm text-foreground">{card.label}</p>
              <p className={cn(
                'text-xs mt-0.5',
                card.status === 'ok' ? 'text-success' : card.status === 'error' ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {card.detail}
              </p>
            </GlassCard>
          );
        })}
      </div>

      {/* Active match */}
      <GlassCard className="p-4">
        <h3 className="font-display font-bold text-sm text-foreground mb-3">Active Match</h3>
        {activeMatch ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{activeMatch.name}</span>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                activeMatch.status === 'live' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
              )}>
                {activeMatch.status === 'live' ? '● Live' : activeMatch.status}
              </span>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Registration: {activeMatch.is_active_for_registration ? '🟢 Open' : '🔴 Closed'}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active match</p>
        )}
      </GlassCard>

      {/* Recent activity */}
      <GlassCard className="p-4">
        <h3 className="font-display font-bold text-sm text-foreground mb-3">Recent Admin Activity</h3>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((row, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary/50 flex-shrink-0" />
                  <span className="font-mono text-foreground">{row.action}</span>
                  {row.entity_type && (
                    <span className="text-muted-foreground">on {row.entity_type}</span>
                  )}
                </div>
                <span className="text-muted-foreground flex-shrink-0 ml-2">
                  {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
