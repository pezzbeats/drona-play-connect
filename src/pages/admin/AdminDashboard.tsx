import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { SkeletonStatCard } from '@/components/ui/SkeletonCard';
import { Users, Ticket, CheckCircle2, DollarSign, TrendingUp, ScanLine, BookOpen, Trophy, ArrowRight, AlertTriangle } from 'lucide-react';

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

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMatch, setActiveMatch] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [matchRes, ordersRes] = await Promise.all([
        supabase.from('matches').select('*').eq('is_active_for_registration', true).single(),
        supabase.from('orders').select('id, payment_status, seats_count, created_at, advance_paid, total_amount'),
      ]);

      setActiveMatch(matchRes.data || null);

      const orders = ordersRes.data || [];
      // IST-aware today date (UTC+5:30)
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
    } catch {
      // non-blocking — keep any existing stats visible
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + 60-second auto-refresh
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const statCards = stats ? [
    { icon: Users,        label: 'Registrations',  value: stats.totalOrders,          color: 'text-primary',     bg: 'bg-primary/10' },
    { icon: CheckCircle2, label: 'Paid',            value: stats.paidOrders,           color: 'text-success',     bg: 'bg-success/10' },
    { icon: DollarSign,   label: 'Not Paid',        value: stats.unpaidOrders,         color: 'text-destructive', bg: 'bg-destructive/10' },
    { icon: TrendingUp,   label: 'Pending',         value: stats.pendingVerification,  color: 'text-warning',     bg: 'bg-warning/10' },
    { icon: ScanLine,     label: 'Check-ins Today', value: stats.checkedInToday,       color: 'text-secondary',   bg: 'bg-secondary/10' },
    { icon: Ticket,       label: 'Total Seats',     value: stats.totalSeats,           color: 'text-accent',      bg: 'bg-accent/10' },
  ] : [];

  const quickActions = [
    { icon: ScanLine,  label: 'Gate Validate',  desc: 'Scan QR & check-in',         to: '/admin/validate' },
    { icon: BookOpen,  label: 'Manual Booking', desc: 'Book for walk-in guest',      to: '/admin/manual-booking' },
    { icon: Trophy,    label: 'Manage Matches', desc: 'Create & activate matches',   to: '/admin/matches' },
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

      {/* Stats Grid — 2 cols on mobile, 3 on desktop */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {statCards.map(({ icon: Icon, label, value, color, bg }, i) => (
            <GlassCard
              key={label}
              className="p-4 animate-slide-up"
              style={{ animationDelay: `${i * 0.05}s` } as React.CSSProperties}
            >
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-2.5`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className={`stat-number ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-tight">{label}</p>
            </GlassCard>
          ))}
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
              <GlassCard className="p-4 hover:border-primary/40 cursor-pointer group active:scale-95 transition-transform">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
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

      {/* Disclaimer */}
      <div className="disclaimer-bar rounded-lg p-3 text-xs">
        🏏 <strong>Fun Guess Game Disclaimer:</strong> Entertainment only. No betting, no wagering.
      </div>
    </div>
  );
}
