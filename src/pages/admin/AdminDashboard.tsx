import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { Users, Ticket, CheckCircle2, DollarSign, TrendingUp, ScanLine, BookOpen, Trophy, ArrowRight, Loader2 } from 'lucide-react';

interface Stats {
  totalOrders: number;
  paidOrders: number;
  unpaidOrders: number;
  checkedInToday: number;
  totalSeats: number;
  pendingVerification: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMatch, setActiveMatch] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [matchRes, ordersRes] = await Promise.all([
      supabase.from('matches').select('*').eq('is_active_for_registration', true).single(),
      supabase.from('orders').select('id, payment_status, seats_count, created_at'),
    ]);

    setActiveMatch(matchRes.data || null);

    const orders = ordersRes.data || [];
    const today = new Date().toISOString().split('T')[0];

    // Get check-ins today
    const { count: checkinCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .not('checked_in_at', 'is', null)
      .gte('checked_in_at', today);

    setStats({
      totalOrders: orders.length,
      paidOrders: orders.filter(o => ['paid_verified', 'paid_manual_verified'].includes(o.payment_status)).length,
      unpaidOrders: orders.filter(o => o.payment_status === 'unpaid').length,
      pendingVerification: orders.filter(o => o.payment_status === 'pending_verification').length,
      checkedInToday: checkinCount || 0,
      totalSeats: orders.reduce((sum, o) => sum + (o.seats_count || 0), 0),
    });
    setLoading(false);
  };

  const statCards = stats ? [
    { icon: Users, label: 'Total Registrations', value: stats.totalOrders, color: 'text-primary', bg: 'bg-primary/10' },
    { icon: CheckCircle2, label: 'Paid', value: stats.paidOrders, color: 'text-success', bg: 'bg-success/10' },
    { icon: DollarSign, label: 'Unpaid', value: stats.unpaidOrders, color: 'text-destructive', bg: 'bg-destructive/10' },
    { icon: TrendingUp, label: 'Pending Review', value: stats.pendingVerification, color: 'text-warning', bg: 'bg-warning/10' },
    { icon: ScanLine, label: 'Check-ins Today', value: stats.checkedInToday, color: 'text-secondary', bg: 'bg-secondary/10' },
    { icon: Ticket, label: 'Total Seats', value: stats.totalSeats, color: 'text-accent', bg: 'bg-accent/10' },
  ] : [];

  const quickActions = [
    { icon: ScanLine, label: 'Gate Validate', desc: 'Scan QR & check-in', to: '/admin/validate', variant: 'primary' as const },
    { icon: BookOpen, label: 'Manual Booking', desc: 'Book for walk-in guest', to: '/admin/manual-booking', variant: 'accent' as const },
    { icon: Trophy, label: 'Manage Matches', desc: 'Create & activate matches', to: '/admin/matches', variant: 'ghost' as const },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold gradient-text-accent">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">T20 Fan Night Operations</p>
        </div>
        <GlassButton variant="ghost" size="sm" onClick={fetchData}>
          Refresh
        </GlassButton>
      </div>

      {/* Active Match Banner */}
      {activeMatch ? (
        <GlassCard className="p-4 border-l-4 border-primary" glow>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-medium text-success">Registration Open</span>
              </div>
              <h2 className="font-display text-xl font-bold text-foreground">{activeMatch.name}</h2>
              {activeMatch.opponent && <p className="text-sm text-muted-foreground">vs {activeMatch.opponent}</p>}
            </div>
            <Link to={`/admin/matches/${activeMatch.id}`}>
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
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map(({ icon: Icon, label, value, color, bg }) => (
            <GlassCard key={label} className="p-4">
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <p className={`font-display text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="font-display text-lg font-bold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quickActions.map(({ icon: Icon, label, desc, to, variant }) => (
            <Link key={to} to={to}>
              <GlassCard className="p-4 hover:border-primary/40 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="disclaimer-bar rounded-lg p-3 text-xs">
        ⚽ <strong>Fun Guess Game Disclaimer:</strong> This is a fun guess game for entertainment only. No betting, no wagering, no gambling.
      </div>
    </div>
  );
}
