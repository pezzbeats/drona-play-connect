import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
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
      // Update order status
      await supabase
        .from('orders')
        .update({
          payment_status: verdict,
          payment_verified_at: new Date().toISOString(),
          payment_verified_by_admin_id: user?.id,
        } as any)
        .eq('id', orderId);

      // Write audit trail to the latest payment_proof row
      const order = orders.find(o => o.id === orderId);
      const latestProof = order?.proofs?.slice(-1)?.[0];
      if (latestProof) {
        await supabase
          .from('payment_proofs')
          .update({
            override_reason: overrideReason.trim(),
            overridden_by_admin_id: user?.id,
            overridden_at: new Date().toISOString(),
          } as any)
          .eq('id', latestProof.id);
      }

      // Log to admin_activity with reason
      await supabase.from('admin_activity').insert({
        admin_id: user?.id,
        action: verdict,
        entity_type: 'order',
        entity_id: orderId,
        meta: { reason: overrideReason.trim() },
      });

      // Generate tickets on manual verify if none exist yet
      if (verdict === 'paid_manual_verified') {
        const { count: ticketCount } = await supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('order_id', orderId);

        if ((ticketCount ?? 0) === 0 && order) {
          for (let i = 0; i < order.seats_count; i++) {
            const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
            const qrText = `T20FN-${order.match_id.slice(0, 8)}-${order.purchaser_mobile}-S${i + 1}-${Date.now()}-${rand}`;
            await supabase.from('tickets').insert({
              match_id: order.match_id,
              event_id: order.event_id,
              order_id: orderId,
              seat_index: i,
              qr_text: qrText,
              status: 'active',
            });
          }
        }
      }

      toast({
        title: verdict === 'paid_manual_verified' ? '✅ Manually Verified' : '❌ Rejected',
        description: `Reason recorded: ${overrideReason.trim()}`,
      });
      setOverrideTarget(null);
      setOverrideReason('');
      fetchOrders();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
    }
    setUpdatingId(null);
  };

  const handleViewProof = async (filePath: string) => {
    setViewingProof(filePath);
    try {
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(filePath, 300); // 5 min expiry
      if (error || !data?.signedUrl) throw new Error('Could not generate proof URL');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Cannot open proof', description: e.message });
    }
    setViewingProof(null);
  };

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.purchaser_full_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.purchaser_mobile?.includes(search);
    const matchStatus = statusFilter === 'all' || o.payment_status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold gradient-text-accent">Orders</h1>
        <p className="text-muted-foreground text-sm">All registrations and payment status</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="glass-input pl-9"
            placeholder="Search name or mobile..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="glass-input w-48">
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
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <GlassCard className="p-8 text-center">
              <p className="text-muted-foreground">No orders found</p>
            </GlassCard>
          )}
          {filtered.map(order => (
            <GlassCard key={order.id} className="overflow-hidden">
              <button
                className="w-full p-4 text-left"
                onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{order.purchaser_full_name}</span>
                      <span className="text-sm text-muted-foreground">{order.purchaser_mobile}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <StatusBadge status={order.payment_status} />
                      <span className="text-xs text-muted-foreground">{order.match?.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {order.seats_count} seat{order.seats_count > 1 ? 's' : ''} · ₹{order.total_amount}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString('en-IN')}
                    </span>
                    {expandedId === order.id
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>
                </div>
              </button>

              {expandedId === order.id && (
                <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="text-foreground truncate">{order.purchaser_email || '—'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Method:</span>
                      <p className="text-foreground capitalize">{order.payment_method?.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Source:</span>
                      <p className="text-foreground capitalize">{order.created_source?.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Seating:</span>
                      <p className="text-foreground capitalize">{order.seating_type}</p>
                    </div>
                  </div>

                  {order.proofs?.length > 0 && (
                    <div className="bg-muted/20 rounded-lg p-3 text-sm space-y-2">
                      <p className="font-medium text-foreground">Latest Payment Proof</p>
                      {order.proofs.slice(-1).map((proof: any) => (
                        <div key={proof.id} className="space-y-2 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <StatusBadge status={proof.ai_verdict} />
                            {proof.ai_confidence && (
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                proof.ai_confidence === 'high' ? 'bg-green-500/20 text-green-400' :
                                proof.ai_confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {proof.ai_confidence} confidence
                              </span>
                            )}
                            <span className="text-muted-foreground">{proof.ai_reason}</span>
                          </div>

                          {/* Fraud flags */}
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

                          {proof.extracted_amount && (
                            <p className="text-muted-foreground">Amount: ₹{proof.extracted_amount}</p>
                          )}
                          {proof.extracted_txn_id && (
                            <p className="text-muted-foreground">TXN: {proof.extracted_txn_id}</p>
                          )}

                          {/* Override audit trail */}
                          {proof.override_reason && (
                            <div className="flex items-start gap-1.5 pt-1 border-t border-border/30">
                              <Shield className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                              <div>
                                <span className="text-primary font-medium">Admin override: </span>
                                <span className="text-muted-foreground">{proof.override_reason}</span>
                                {proof.overridden_at && (
                                  <span className="text-muted-foreground/60 ml-1">
                                    · {new Date(proof.overridden_at).toLocaleString('en-IN')}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* View Proof button */}
                          {proof.file_path && (
                            <button
                              onClick={() => handleViewProof(proof.file_path)}
                              disabled={viewingProof === proof.file_path}
                              className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors font-medium mt-1"
                            >
                              {viewingProof === proof.file_path
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <ExternalLink className="h-3.5 w-3.5" />
                              }
                              View Proof
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inline override reason form */}
                  {overrideTarget?.orderId === order.id ? (
                    <div className="bg-muted/30 rounded-lg p-3 space-y-2 border border-border/50">
                      <p className="text-sm font-medium text-foreground">
                        {overrideTarget.verdict === 'paid_manual_verified'
                          ? '✅ Manual Verify — enter reason'
                          : '❌ Reject — enter reason'}
                      </p>
                      <Textarea
                        className="glass-input text-sm resize-none"
                        placeholder="Enter a reason (min 5 characters)..."
                        rows={2}
                        value={overrideReason}
                        onChange={e => setOverrideReason(e.target.value)}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <GlassButton
                          variant={overrideTarget.verdict === 'paid_manual_verified' ? 'success' : 'danger'}
                          size="sm"
                          loading={updatingId === order.id}
                          onClick={handleOverrideSubmit}
                          disabled={overrideReason.trim().length < 5}
                        >
                          Confirm
                        </GlassButton>
                        <GlassButton
                          variant="ghost"
                          size="sm"
                          onClick={() => { setOverrideTarget(null); setOverrideReason(''); }}
                        >
                          Cancel
                        </GlassButton>
                      </div>
                    </div>
                  ) : (
                    ['pending_verification', 'paid_rejected', 'unpaid'].includes(order.payment_status) && (
                      <div className="flex gap-2">
                        <GlassButton
                          variant="success"
                          size="sm"
                          onClick={() => setOverrideTarget({ orderId: order.id, verdict: 'paid_manual_verified' })}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Manual Verify
                        </GlassButton>
                        <GlassButton
                          variant="danger"
                          size="sm"
                          onClick={() => setOverrideTarget({ orderId: order.id, verdict: 'paid_rejected' })}
                        >
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
