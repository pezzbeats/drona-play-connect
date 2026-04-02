import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { SkeletonStatCard } from '@/components/ui/SkeletonCard';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { useRealtimeChannel, type ChannelSubscription } from '@/hooks/useRealtimeChannel';
import { Users, Ticket, CheckCircle2, DollarSign, TrendingUp, ScanLine, BookOpen, Trophy, ArrowRight, AlertTriangle, Zap, Calendar, Clock } from 'lucide-react';

interface Stats {
  totalOrders: number;
  paidOrders: number;
  unpaidOrders: number;
  checkedInToday: number;
  totalSeats: number;
  pendingVerification: number;
  balanceDueTotal: number;
  balanceDueCount: number;
}

interface UpcomingMatch {
  id: string;
  name: string;
  status: string;
  start_time: string | null;
  opponent: string | null;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMatch, setActiveMatch] = useState<any>(null);
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const matchRes = await supabase.from('matches').select('*').eq('is_active_for_registration', true).single();
      setActiveMatch(matchRes.data || null);
      const activeMatchId = matchRes.data?.id;

      const [ordersRes, upcomingRes] = await Promise.all([
        activeMatchId
          ? supabase.from('orders').select('id, payment_status, seats_count, created_at, advance_paid, total_amount').eq('match_id', activeMatchId)
          : supabase.from('orders').select('id, payment_status, seats_count, created_at, advance_paid, total_amount').limit(500),
        supabase.from('matches').select('id, name, status, start_time, opponent')
          .in('status', ['draft', 'registrations_open', 'registrations_closed', 'live'])
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(5),
      ]);

      setUpcomingMatches(upcomingRes.data || []);

      const orders = ordersRes.data || [];
      const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const today = nowIST.toISOString().split('T')[0];

      const { count: checkinCount } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .not('checked_in_at', 'is', null)
        .gte('checked_in_at', today);

      const notPaidOrders = orders.filter(o =>
        !['paid_verified', 'paid_manual_verified'].includes(o.payment_status)
      );

      setStats({
        totalOrders: orders.length,
        paidOrders: orders.filter(o => ['paid_verified', 'paid_manual_verified'].includes(o.payment_status)).length,
        unpaidOrders: notPaidOrders.length,
        pendingVerification: orders.filter(o => o.payment_status === 'pending_verification').length,
        checkedInToday: checkinCount || 0,
        totalSeats: orders.reduce((sum, o) => sum + (o.seats_count || 0), 0),
        balanceDueCount: notPaidOrders.length,
        balanceDueTotal: notPaidOrders.reduce((sum, o) => sum + Math.max(0, (o.total_amount ?? 0) - (o.advance_paid ?? 0)), 0),
      });
    } catch (err) {
      console.error('[AdminDashboard] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const realtimeSubscriptions = useMemo<ChannelSubscription[]>(() => [
    { event: 'INSERT', schema: 'public', table: 'orders', callback: () => { fetchData(); } },
    { event: 'UPDATE', schema: 'public', table: 'orders', callback: () => { fetchData(); } },
    { event: 'INSERT', schema: 'public', table: 'matches', callback: () => { fetchData(); } },
    { event: 'UPDATE', schema: 'public', table: 'matches', callback: () => { fetchData(); } },
  ], [fetchData]);

  useRealtimeChannel('dashboard-orders', realtimeSubscriptions, fetchData);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statCards = stats ? [
    { icon: Users,        label: 'Registrations',  value: stats.totalOrders,          color: 'text-primary',     bg: 'bg-primary/10',     to: null },
    { icon: CheckCircle2, label: 'Paid',            value: stats.paidOrders,           color: 'text-success',     bg: 'bg-success/10',     to: '/admin/orders?filter=paid_verified' },
    { icon: DollarSign,   label: 'Not Paid',        value: stats.unpaidOrders,         color: 'text-destructive', bg: 'bg-destructive/10', to: '/admin/orders?filter=unpaid' },
    { icon: TrendingUp,   label: 'Pending',         value: stats.pendingVerification,  color: 'text-warning',     bg: 'bg-warning/10',     to: '/admin/orders?filter=pending_verification' },
    { icon: ScanLine,     label: 'Check-ins Today', value: stats.checkedInToday,       color: 'text-secondary',   bg: 'bg-secondary/10',   to: null },
    { icon: Ticket,       label: 'Total Seats',     value: stats.totalSeats,           color: 'text-accent',      bg: 'bg-accent/10',      to: null },
  ] : [];

  const quickActions = [
    { icon: ScanLine,  label: 'Gate Validate',  desc: 'Scan QR & check-in',         to: '/admin/validate' },
    { icon: BookOpen,  label: 'Manual Booking', desc: 'Book for walk-in guest',      to: '/admin/manual-booking' },
    ...(activeMatch?.status === 'live'
      ? [{ icon: Zap,    label: 'Match Control',  desc: 'Live scoring & guesses',      to: '/admin/control' }]
      : [{ icon: Trophy, label: 'Manage Matches', desc: 'Create & activate matches',   to: '/admin/matches' }]
    ),
  ];

  return (
    <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto md:max-w-none md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold gradient-text-accent">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">T20 Fan Night Operations</p>
        </div>
        <GlassButton variant="ghost" size="sm" loading={loading} onClick={fetchData}>Refresh</GlassButton>
      </div>

      {/* Active Match Banner */}
      {activeMatch ? (
        <GlassCard className="p-4 border-l-4 border-primary" glow>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
                <span className="text-xs font-medium text-success">Registration Open</span>
              </div>
              <h2 className="font-display text-lg font-bold text-foreground leading-tight">{activeMatch.name}</h2>
              {activeMatch.opponent && <p className="text-sm text-muted-foreground">vs {activeMatch.opponent}</p>}
            </div>
            <Link to={`/admin/matches/${activeMatch.id}`} className="shrink-0">
              <GlassButton variant="outline" size="sm">
                Manage <ArrowRight className="h-3 w-3" />
              </GlassButton>
            </Link>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="p-4 border-l-4 border-destructive">
          <p className="text-sm text-muted-foreground">⚠️ No active match. <Link to="/admin/matches" className="text-primary hover:underline">Create or activate one →</Link></p>
        </GlassCard>
      )}

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {statCards.map(({ icon: Icon, label, value, color, bg, to }, i) => {
            const card = (
              <GlassCard
                key={label}
                className={`p-4 animate-slide-up${to ? ' hover:border-primary/40 cursor-pointer transition-colors' : ''}`}
                style={{ animationDelay: `${i * 0.05}s` } as React.CSSProperties}
              >
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-2.5`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className={`stat-number ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-tight">{label}</p>
                {to && <p className="text-xs text-primary mt-1 opacity-70">View →</p>}
              </GlassCard>
            );
            return to ? <Link key={label} to={to}>{card}</Link> : card;
          })}
        </div>
      )}

      {/* Balance Due Alert Card */}
      {stats && stats.balanceDueCount > 0 && (
        <Link to="/admin/orders">
          <GlassCard className="p-4 border border-warning/40 bg-warning/5 hover:border-warning/60 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-warning text-sm leading-tight">Balance Outstanding</p>
                <p className="text-foreground font-bold text-lg leading-tight">₹{stats.balanceDueTotal.toLocaleString('en-IN')}</p>
                <p className="text-xs text-muted-foreground">across {stats.balanceDueCount} unpaid/partial order{stats.balanceDueCount !== 1 ? 's' : ''}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-warning shrink-0" />
            </div>
          </GlassCard>
        </Link>
      )}

      {/* Quick Actions */}
      <div>
        <p className="section-title mb-3">Quick Actions</p>
        <div className="space-y-2 sm:grid sm:grid-cols-3 sm:gap-3 sm:space-y-0">
          {quickActions.map(({ icon: Icon, label, desc, to }) => (
            <Link key={to} to={to}>
              <GlassCard className={`p-4 hover:border-primary/40 cursor-pointer group active:scale-95 transition-transform${label === 'Match Control' ? ' border-primary/30 bg-primary/5' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${label === 'Match Control' ? 'bg-primary/20 group-hover:bg-primary/30' : 'bg-primary/10 group-hover:bg-primary/20'}`}>
                    <Icon className={`h-5 w-5 ${label === 'Match Control' ? 'text-primary animate-pulse' : 'text-primary'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>

      {/* Upcoming Matches */}
      {upcomingMatches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title">Upcoming Matches</p>
            <Link to="/admin/matches" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {upcomingMatches.slice(0, 3).map(m => (
              <Link key={m.id} to={`/admin/matches/${m.id}`}>
                <GlassCard className="p-3.5 hover:border-primary/40 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {m.status === 'live' ? (
                        <Zap className="h-4 w-4 text-success" />
                      ) : (
                        <Calendar className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground text-sm truncate">{m.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {m.status === 'live' ? (
                          <span className="text-xs font-bold text-success">🔴 Live</span>
                        ) : m.start_time ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(m.start_time).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No date set</span>
                        )}
                      </div>
                    </div>
                    {m.start_time && m.status !== 'live' && new Date(m.start_time) > new Date() && (
                      <div className="shrink-0">
                        <CountdownTimer targetTime={m.start_time} variant="compact" />
                      </div>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="disclaimer-bar rounded-lg p-3 text-xs">
        🏏 <strong>Fun Guess Game Disclaimer:</strong> Entertainment only. No betting, no wagering.
      </div>
    </div>
  );
}
