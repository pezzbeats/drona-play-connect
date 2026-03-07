import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Search, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, ExternalLink, AlertTriangle, Shield } from 'lucide-react';

type OverrideTarget = { orderId: string; verdict: 'paid_manual_verified' | 'paid_rejected' } | null;

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<OverrideTarget>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [viewingProof, setViewingProof] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        match:matches!match_id(name),
        proofs:payment_proofs(
          id, ai_verdict, ai_reason, extracted_amount, extracted_txn_id,
          file_path, created_at, ai_confidence, fraud_flags,
          override_reason, overridden_at, overridden_by_admin_id
        )
      `)
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  const handleOverrideSubmit = async () => {
    if (!overrideTarget) return;
    if (overrideReason.trim().length < 5) {
      toast({ variant: 'destructive', title: 'Reason too short', description: 'Please enter at least 5 characters.' });
      return;
    }
    const { orderId, verdict } = overrideTarget;
    setUpdatingId(orderId);
    try {
      await supabase.from('orders').update({
        payment_status: verdict,
        payment_verified_at: new Date().toISOString(),
        payment_verified_by_admin_id: user?.id,
      } as any).eq('id', orderId);

      const order = orders.find(o => o.id === orderId);
      const latestProof = order?.proofs?.slice(-1)?.[0];
      if (latestProof) {
        await supabase.from('payment_proofs').update({
          override_reason: overrideReason.trim(),
          overridden_by_admin_id: user?.id,
          overridden_at: new Date().toISOString(),
        } as any).eq('id', latestProof.id);
      }
      await supabase.from('admin_activity').insert({
        admin_id: user?.id, action: verdict, entity_type: 'order', entity_id: orderId,
        meta: { reason: overrideReason.trim() },
      });
      if (verdict === 'paid_manual_verified') {
        const { count: ticketCount } = await supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('order_id', orderId);
        if ((ticketCount ?? 0) === 0 && order) {
          for (let i = 0; i < order.seats_count; i++) {
            const { data: issuedTicket } = await supabase.functions.invoke('reissue-qr', {
              body: { ticket_id: '__new__', admin_id: user?.id, _generate_new: true, match_id: order.match_id, mobile: order.purchaser_mobile, seat_index: i, order_id: orderId, event_id: order.event_id }
            });
            if (!issuedTicket?.success) {
              const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
              const qrText = `T20FN-${order.match_id.slice(0, 8)}-${order.purchaser_mobile}-S${i + 1}-${Date.now()}-${rand}`;
              await supabase.from('tickets').insert({ match_id: order.match_id, event_id: order.event_id, order_id: orderId, seat_index: i, qr_text: qrText, status: 'active' });
            }
          }
        }
      }
      toast({ title: verdict === 'paid_manual_verified' ? '✅ Manually Verified' : '❌ Rejected', description: `Reason: ${overrideReason.trim()}` });
      setOverrideTarget(null); setOverrideReason('');
      fetchOrders();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setUpdatingId(null);
  };

  const handleViewProof = async (filePath: string) => {
    setViewingProof(filePath);
    try {
      const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(filePath, 300);
      if (error || !data?.signedUrl) throw new Error('Could not generate proof URL');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) { toast({ variant: 'destructive', title: 'Cannot open proof', description: e.message }); }
    setViewingProof(null);
  };

  const filtered = orders.filter(o => {
    const matchSearch = !search || o.purchaser_full_name?.toLowerCase().includes(search.toLowerCase()) || o.purchaser_mobile?.includes(search);
    const matchStatus = statusFilter === 'all' || o.payment_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paymentMethodBadge = (method: string) => {
    switch (method) {
      case 'razorpay':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">Razorpay</span>;
      case 'upi_qr':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success/15 text-success border border-success/30">UPI QR</span>;
      case 'pay_at_hotel':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/15 text-warning border border-warning/30">Pay at Hotel</span>;
      case 'cash':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary/15 text-secondary border border-secondary/30">Cash</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">{method?.replace(/_/g, ' ')}</span>;
    }
  };

  const confidenceClass = (c: string) =>
    c === 'high'   ? 'bg-success/20 text-success' :
    c === 'medium' ? 'bg-warning/20 text-warning' :
                     'bg-destructive/20 text-destructive';

  return (
    <div className="px-4 py-5 space-y-4 max-w-2xl mx-auto md:max-w-none md:p-6">
      <div>
        <h1 className="font-display text-2xl font-bold gradient-text-accent">Orders</h1>
        <p className="text-muted-foreground text-sm">All registrations and payment status</p>
      </div>

      {/* Filters — stacked on mobile */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="glass-input pl-9 h-12 text-base"
            placeholder="Search name or mobile..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="glass-input h-12 sm:w-52">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="pending_verification">Pending</SelectItem>
            <SelectItem value="paid_verified">Paid Verified</SelectItem>
            <SelectItem value="paid_rejected">Rejected</SelectItem>
            <SelectItem value="paid_manual_verified">Manual Verified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} lines={3} showAvatar />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <GlassCard className="p-10 text-center">
              <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-display text-lg font-bold text-foreground">No orders found</p>
              <p className="text-muted-foreground text-sm mt-1">Try adjusting your search or filter</p>
            </GlassCard>
          )}
          {filtered.map(order => {
            const balanceDue = Math.max(0, (order.total_amount ?? 0) - (order.advance_paid ?? 0));
            const hasAdvance = (order.advance_paid ?? 0) > 0;
            const isPaidFully = ['paid_verified', 'paid_manual_verified'].includes(order.payment_status);
            return (
            <GlassCard key={order.id} className="overflow-hidden">
              {/* Mobile-optimised row */}
              <button
                className="w-full p-4 text-left active:bg-muted/10"
                onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground leading-snug">{order.purchaser_full_name}</p>
                    <p className="text-sm text-muted-foreground">{order.purchaser_mobile}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <StatusBadge status={order.payment_status} />
                      {paymentMethodBadge(order.payment_method)}
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">{order.match?.name}</span>
                    </div>
                    {/* Advance / balance chips */}
                    {hasAdvance && !isPaidFully && (
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success/15 text-success border border-success/30">
                          Adv ₹{order.advance_paid}
                        </span>
                        {balanceDue > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-warning/15 text-warning border border-warning/40">
                            ⚠ Due ₹{balanceDue}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-display font-bold text-primary text-base">₹{order.total_amount}</span>
                    <span className="text-xs text-muted-foreground">{order.seats_count} seat{order.seats_count > 1 ? 's' : ''}</span>
                    {(() => {
                      const snapshot = order.pricing_model_snapshot;
                      const seats: any[] = Array.isArray(snapshot?.seats) ? snapshot.seats : [];
                      const hasSpecial = seats.some((s: any) => s.reason === 'semifinal_attendee' || s.reason === 'loyal_base');
                      return hasSpecial
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success/15 text-success border border-success/30">⭐ Special ₹949</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted/40 text-muted-foreground border border-border/30">Standard ₹999</span>;
                    })()}
                    {expandedId === order.id
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground mt-1" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground mt-1" />}
                  </div>
                </div>
              </button>

              {expandedId === order.id && (
                <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                  {/* Detail grid — 2 cols */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      { label: 'Email',   value: order.purchaser_email || '—' },
                      { label: 'Method',  value: order.payment_method?.replace(/_/g, ' ') },
                      { label: 'Source',  value: order.created_source?.replace(/_/g, ' ') },
                      { label: 'Seating', value: order.seating_type },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-foreground capitalize truncate">{value}</p>
                      </div>
                    ))}
                    {/* Advance payment details */}
                    {hasAdvance && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Advance Paid</p>
                          <p className="text-success font-bold">₹{order.advance_paid}
                            {order.advance_payment_method && (
                              <span className="text-muted-foreground font-normal ml-1 capitalize">({order.advance_payment_method})</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Balance Due</p>
                          <p className={`font-bold ${balanceDue > 0 ? 'text-warning' : 'text-success'}`}>
                            {balanceDue > 0 ? `₹${balanceDue}` : '✅ Cleared'}
                          </p>
                        </div>
                      </>
                    )}
                    {order.razorpay_payment_id && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Razorpay Payment ID</p>
                        <p className="text-foreground font-mono text-xs truncate">{order.razorpay_payment_id}</p>
                      </div>
                    )}
                    {order.razorpay_order_id && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Razorpay Order ID</p>
                        <p className="text-foreground font-mono text-xs truncate">{order.razorpay_order_id}</p>
                      </div>
                    )}
                  </div>

                  {order.proofs?.length > 0 && (
                    <div className="glass-card-sunken p-3 text-sm space-y-2">
                      <p className="font-medium text-foreground text-xs section-title">Latest Payment Proof</p>
                      {order.proofs.slice(-1).map((proof: any) => (
                        <div key={proof.id} className="space-y-1.5 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <StatusBadge status={proof.ai_verdict} />
                            {proof.ai_confidence && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${confidenceClass(proof.ai_confidence)}`}>
                                {proof.ai_confidence} confidence
                              </span>
                            )}
                          </div>
                          {proof.ai_reason && <p className="text-muted-foreground">{proof.ai_reason}</p>}
                          {Array.isArray(proof.fraud_flags) && proof.fraud_flags.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                              {proof.fraud_flags.map((flag: string) => (
                                <span key={flag} className="px-1.5 py-0.5 rounded bg-destructive/20 text-destructive text-xs font-medium">
                                  {flag.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          )}
                          {proof.extracted_amount && <p className="text-muted-foreground">Amount: ₹{proof.extracted_amount}</p>}
                          {proof.extracted_txn_id && <p className="text-muted-foreground">TXN: {proof.extracted_txn_id}</p>}
                          {proof.override_reason && (
                            <div className="flex items-start gap-1.5 pt-1 border-t border-border/30">
                              <Shield className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                              <div>
                                <span className="text-primary font-medium">Override: </span>
                                <span className="text-muted-foreground">{proof.override_reason}</span>
                              </div>
                            </div>
                          )}
                          {proof.file_path && (
                            <button
                              onClick={() => handleViewProof(proof.file_path)}
                              disabled={viewingProof === proof.file_path}
                              className="flex items-center gap-1.5 text-primary hover:text-primary/80 font-medium mt-1"
                            >
                              {viewingProof === proof.file_path ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                              View Proof
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Override form */}
                  {overrideTarget?.orderId === order.id ? (
                    <div className="glass-card-sunken p-3 space-y-2 border border-border/50">
                      <p className="text-sm font-medium text-foreground">
                        {overrideTarget.verdict === 'paid_manual_verified' ? '✅ Manual Verify' : '❌ Reject'} — enter reason
                      </p>
                      <Textarea
                        className="glass-input text-sm resize-none"
                        placeholder="Reason (min 5 chars)..."
                        rows={2}
                        value={overrideReason}
                        onChange={e => setOverrideReason(e.target.value)}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <GlassButton
                          variant={overrideTarget.verdict === 'paid_manual_verified' ? 'success' : 'danger'}
                          size="sm" loading={updatingId === order.id}
                          onClick={handleOverrideSubmit}
                          disabled={overrideReason.trim().length < 5}
                        >Confirm</GlassButton>
                        <GlassButton variant="ghost" size="sm" onClick={() => { setOverrideTarget(null); setOverrideReason(''); }}>Cancel</GlassButton>
                      </div>
                    </div>
                  ) : (
                    ['pending_verification', 'paid_rejected', 'unpaid'].includes(order.payment_status) && (
                      <div className="flex gap-2">
                        <GlassButton variant="success" size="sm" className="flex-1 h-11"
                          onClick={() => setOverrideTarget({ orderId: order.id, verdict: 'paid_manual_verified' })}>
                          <CheckCircle2 className="h-4 w-4" /> Verify
                        </GlassButton>
                        <GlassButton variant="danger" size="sm" className="flex-1 h-11"
                          onClick={() => setOverrideTarget({ orderId: order.id, verdict: 'paid_rejected' })}>
                          <XCircle className="h-4 w-4" /> Reject
                        </GlassButton>
                      </div>
                    )
                  )}
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
