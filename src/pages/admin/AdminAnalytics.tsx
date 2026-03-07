import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Download, TrendingUp, Ticket, Users, IndianRupee,
  Activity, BarChart2, Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Match { id: string; name: string; status: string }

interface Order {
  id: string;
  payment_status: string;
  payment_method: string;
  total_amount: number;
  seats_count: number;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

const PAID_STATUSES = ['paid_verified', 'paid_manual_verified'];

const STATUS_COLORS: Record<string, string> = {
  paid_verified:        'hsl(var(--chart-2))',
  paid_manual_verified: 'hsl(var(--chart-3))',
  pending_verification: 'hsl(var(--chart-4))',
  unpaid:               'hsl(var(--muted-foreground))',
  paid_rejected:        'hsl(var(--destructive))',
};

const STATUS_LABELS: Record<string, string> = {
  paid_verified:        'Verified',
  paid_manual_verified: 'Manual Verified',
  pending_verification: 'Pending',
  unpaid:               'Unpaid',
  paid_rejected:        'Rejected',
};

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <GlassCard className={cn('p-5 flex flex-col gap-2', accent && 'border-primary/30')}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={cn('text-2xl font-display font-bold', accent ? 'text-primary' : 'text-foreground')}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </GlassCard>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminAnalytics() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedId, setSelectedId] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // Raw data
  const [orders, setOrders] = useState<Order[]>([]);
  const [checkedIn, setCheckedIn] = useState(0);
  const [totalTickets, setTotalTickets] = useState(0);
  const [windows, setWindows] = useState<{ id: string; question: string | null }[]>([]);
  const [predictions, setPredictions] = useState<{ id: string; window_id: string; mobile: string }[]>([]);
  const [ticketMobiles, setTicketMobiles] = useState<string[]>([]);

  // Load matches list once
  useEffect(() => {
    supabase.from('matches').select('id, name, status').order('created_at', { ascending: false })
      .then(({ data }) => setMatches(data || []));
  }, []);

  // Reload analytics when selection changes
  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const matchFilter = selectedId !== 'all' ? selectedId : undefined;

      // 1. Orders
      let ordersQ = supabase
        .from('orders')
        .select('id, payment_status, payment_method, total_amount, seats_count, created_at');
      if (matchFilter) ordersQ = ordersQ.eq('match_id', matchFilter);
      const { data: ordersData } = await ordersQ;
      setOrders((ordersData as Order[]) || []);

      // 2. Tickets
      let ticketsQBase = supabase.from('tickets').select('*', { count: 'exact', head: true });
      let ticketsQCI = supabase.from('tickets').select('*', { count: 'exact', head: true }).not('checked_in_at', 'is', null);
      if (matchFilter) {
        ticketsQBase = ticketsQBase.eq('match_id', matchFilter);
        ticketsQCI = ticketsQCI.eq('match_id', matchFilter);
      }
      const [{ count: total }, { count: ci }] = await Promise.all([ticketsQBase, ticketsQCI]);
      setTotalTickets(total || 0);
      setCheckedIn(ci || 0);

      // 3. Ticket holder mobiles (for participation rate)
      let ticketMobilesQ = supabase.from('tickets').select('order_id');
      if (matchFilter) ticketMobilesQ = ticketMobilesQ.eq('match_id', matchFilter);
      const { data: ticketRows } = await ticketMobilesQ;
      // Get unique purchaser mobiles from orders for those ticket order_ids
      if (ticketRows && ticketRows.length > 0) {
        const orderIds = [...new Set(ticketRows.map((t: { order_id: string }) => t.order_id))];
        const { data: orderMobiles } = await supabase
          .from('orders')
          .select('purchaser_mobile')
          .in('id', orderIds);
        setTicketMobiles([...new Set((orderMobiles || []).map((o: { purchaser_mobile: string }) => o.purchaser_mobile))]);
      } else {
        setTicketMobiles([]);
      }

      // 4. Prediction windows
      let windowsQ = supabase.from('prediction_windows').select('id, question, status');
      if (matchFilter) windowsQ = windowsQ.eq('match_id', matchFilter);
      const { data: windowsData } = await windowsQ;
      setWindows(windowsData || []);

      // 5. Predictions
      let predsQ = supabase.from('predictions').select('id, window_id, mobile');
      if (matchFilter) predsQ = predsQ.eq('match_id', matchFilter);
      const { data: predsData } = await predsQ;
      setPredictions(predsData || []);
    } finally {
      setLoading(false);
    }
  };

  // ─── Derived metrics ────────────────────────────────────────────────────────

  const totalOrders = orders.length;
  const totalSeats = orders.reduce((s, o) => s + o.seats_count, 0);
  const paidOrders = orders.filter(o => PAID_STATUSES.includes(o.payment_status));
  const conversionPct = pct(paidOrders.length, totalOrders);

  const verifiedRevenue = paidOrders.reduce((s, o) => s + o.total_amount, 0);
  const upiRevenue = paidOrders.filter(o => o.payment_method === 'upi_qr').reduce((s, o) => s + o.total_amount, 0);
  const hotelRevenue = paidOrders.filter(o => o.payment_method === 'pay_at_hotel').reduce((s, o) => s + o.total_amount, 0);
  const cashRevenue = paidOrders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + o.total_amount, 0);

  const occupancyPct = pct(checkedIn, totalTickets);

  const uniquePredictors = new Set(predictions.map(p => p.mobile)).size;
  const participationPct = pct(uniquePredictors, ticketMobiles.length);

  // Status breakdown for pie/bar
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      paid_verified: 0, paid_manual_verified: 0,
      pending_verification: 0, unpaid: 0, paid_rejected: 0,
    };
    orders.forEach(o => { counts[o.payment_status] = (counts[o.payment_status] || 0) + 1; });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: STATUS_LABELS[k] || k, value: v, key: k }));
  }, [orders]);

  // Per-window prediction counts (top 5)
  const windowChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    predictions.forEach(p => { counts[p.window_id] = (counts[p.window_id] || 0) + 1; });
    return windows
      .map(w => ({ name: w.question?.slice(0, 22) || w.id.slice(0, 8), count: counts[w.id] || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [windows, predictions]);

  // ─── CSV Export ─────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const matchName = selectedId === 'all'
      ? 'All Matches'
      : matches.find(m => m.id === selectedId)?.name || 'Unknown';

    const rows: string[] = [
      `T20 Fan Night Analytics — ${matchName}`,
      'DISCLAIMER: For entertainment purposes only. No gambling or wagering.',
      '',
      'TICKET SALES',
      'Metric,Value',
      `Total Registrations,${totalOrders}`,
      `Total Seats Sold,${totalSeats}`,
      `Paid Orders,${paidOrders.length}`,
      `Conversion Rate,${conversionPct}%`,
      '',
      'PAYMENT STATUS BREAKDOWN',
      'Status,Orders',
      ...statusCounts.map(s => `${s.name},${s.value}`),
      '',
      'REVENUE BY PAYMENT METHOD',
      'Method,Revenue',
      `UPI QR,${upiRevenue}`,
      `Pay at Hotel,${hotelRevenue}`,
      `Cash,${cashRevenue}`,
      `Total Verified,${verifiedRevenue}`,
      '',
      'CHECK-IN STATS',
      'Metric,Value',
      `Total Tickets,${totalTickets}`,
      `Checked In,${checkedIn}`,
      `Occupancy Rate,${occupancyPct}%`,
      '',
      'PREDICTION STATS',
      'Metric,Value',
      `Total Windows,${windows.length}`,
      `Total Predictions,${predictions.length}`,
      `Unique Predictors,${uniquePredictors}`,
      `Ticket Holders,${ticketMobiles.length}`,
      `Participation Rate,${participationPct}%`,
    ];

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${matchName.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const LoadSkel = () => <Skeleton className="h-28 w-full" />;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" />
            Analytics & Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Operational visibility across ticket sales, revenue, and engagement</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Select match" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Matches</SelectItem>
              {matches.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Section 1: KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <><LoadSkel /><LoadSkel /><LoadSkel /><LoadSkel /></>
        ) : (
          <>
            <StatCard icon={Ticket} label="Total Registrations" value={totalOrders} sub={`${totalSeats} seats`} />
            <StatCard icon={TrendingUp} label="Seats Sold" value={totalSeats} sub={`across ${totalOrders} orders`} />
            <StatCard icon={Users} label="Paid Conversion" value={`${conversionPct}%`} sub={`${paidOrders.length} of ${totalOrders} paid`} accent />
            <StatCard icon={IndianRupee} label="Verified Revenue" value={fmt(verifiedRevenue)} sub="Paid & verified orders" accent />
          </>
        )}
      </div>

      {/* ── Section 2: Payment Status + Occupancy ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Status Breakdown */}
        <GlassCard className="p-5 space-y-4">
          <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Payment Status Breakdown
          </h2>
          {loading ? <Skeleton className="h-40 w-full" /> : statusCounts.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No order data</p>
          ) : (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={statusCounts} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    paddingAngle={3} dataKey="value"
                  >
                    {statusCounts.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.key] || 'hsl(var(--muted))'} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      color: 'hsl(var(--popover-foreground))',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2">
                {statusCounts.map(s => (
                  <div key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[s.key] }} />
                    {s.name}: <span className="font-medium text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>

        {/* Live Occupancy Meter */}
        <GlassCard className="p-5 space-y-4">
          <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Live Occupancy
          </h2>
          {loading ? <Skeleton className="h-40 w-full" /> : (
            <div className="space-y-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-display font-bold text-foreground">{checkedIn}</p>
                  <p className="text-sm text-muted-foreground">checked in</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">{occupancyPct}%</p>
                  <p className="text-sm text-muted-foreground">of {totalTickets} tickets</p>
                </div>
              </div>
              <Progress value={occupancyPct} className="h-4" />
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="text-center">
                  <p className="text-base font-bold text-foreground">{totalTickets}</p>
                  <p className="text-xs text-muted-foreground">Total Tickets</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-foreground">{checkedIn}</p>
                  <p className="text-xs text-muted-foreground">Checked In</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-foreground">{totalTickets - checkedIn}</p>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* ── Section 3: Revenue + Predictions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Method */}
        <GlassCard className="p-5 space-y-4">
          <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-primary" />
            Revenue by Payment Method
          </h2>
          {loading ? <Skeleton className="h-40 w-full" /> : (
            <div className="space-y-3">
              {[
                { label: 'UPI QR', value: upiRevenue, color: 'text-chart-2' },
                { label: 'Pay at Hotel', value: hotelRevenue, color: 'text-chart-3' },
                { label: 'Cash', value: cashRevenue, color: 'text-chart-4' },
                { label: 'Razorpay', value: paidOrders.filter(o => o.payment_method === 'razorpay').reduce((s, o) => s + o.total_amount, 0), color: 'text-primary' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                  <span className="text-sm text-muted-foreground">{r.label}</span>
                  <span className="font-semibold text-foreground">{fmt(r.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-semibold text-foreground">Total Verified</span>
                <span className="font-bold text-primary text-lg">{fmt(verifiedRevenue)}</span>
              </div>
              {verifiedRevenue > 0 && (
                <div className="mt-3">
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart
                      data={[
                        { name: 'UPI QR', value: upiRevenue },
                        { name: 'Hotel', value: hotelRevenue },
                        { name: 'Cash', value: cashRevenue },
                      ].filter(d => d.value > 0)}
                      barCategoryGap="30%"
                    >
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip
                        formatter={(v: number) => [fmt(v), 'Revenue']}
                        contentStyle={{
                          background: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </GlassCard>

        {/* Prediction Participation */}
        <GlassCard className="p-5 space-y-4">
          <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Prediction Participation
          </h2>
          {loading ? <Skeleton className="h-40 w-full" /> : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="glass-card p-3 text-center">
                  <p className="text-xl font-bold text-foreground">{windows.length}</p>
                  <p className="text-xs text-muted-foreground">Windows</p>
                </div>
                <div className="glass-card p-3 text-center">
                  <p className="text-xl font-bold text-foreground">{predictions.length}</p>
                  <p className="text-xs text-muted-foreground">Predictions</p>
                </div>
                <div className="glass-card p-3 text-center">
                  <p className="text-xl font-bold text-primary">{participationPct}%</p>
                  <p className="text-xs text-muted-foreground">Participation</p>
                </div>
              </div>

              {windowChartData.length > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground font-medium">Top windows by predictions</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={windowChartData} layout="vertical" barCategoryGap="25%">
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={80} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No prediction windows yet</p>
              )}

              {ticketMobiles.length > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-3">
                  <span>{uniquePredictors} of {ticketMobiles.length} ticket holders predicted</span>
                  <Badge variant="outline" className={cn(
                    participationPct >= 60 ? 'border-chart-2 text-chart-2' :
                    participationPct >= 30 ? 'border-chart-4 text-chart-4' :
                    'border-destructive text-destructive'
                  )}>
                    {participationPct >= 60 ? 'High' : participationPct >= 30 ? 'Medium' : 'Low'} engagement
                  </Badge>
                </div>
              )}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
