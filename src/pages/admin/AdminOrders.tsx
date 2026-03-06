import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Search, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from('orders').select(`*, match:matches!match_id(name), proofs:payment_proofs(id, ai_verdict, ai_reason, extracted_amount, extracted_txn_id, created_at)`).order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  const handleManualVerify = async (orderId: string, verdict: 'paid_manual_verified' | 'paid_rejected') => {
    setUpdatingId(orderId);
    try {
      await supabase.from('orders').update({ payment_status: verdict, payment_verified_at: new Date().toISOString(), payment_verified_by_admin_id: user?.id } as any).eq('id', orderId);
      await supabase.from('admin_activity').insert({ admin_id: user?.id, action: verdict, entity_type: 'order', entity_id: orderId });
      toast({ title: verdict === 'paid_manual_verified' ? '✅ Manually Verified' : '❌ Rejected' });
      fetchOrders();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setUpdatingId(null);
  };

  const filtered = orders.filter(o => {
    const matchSearch = !search || o.purchaser_full_name?.toLowerCase().includes(search.toLowerCase()) || o.purchaser_mobile?.includes(search);
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
          <Input className="glass-input pl-9" placeholder="Search name or mobile..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="glass-input w-48"><SelectValue placeholder="All Statuses" /></SelectTrigger>
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
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && <GlassCard className="p-8 text-center"><p className="text-muted-foreground">No orders found</p></GlassCard>}
          {filtered.map(order => (
            <GlassCard key={order.id} className="overflow-hidden">
              <button className="w-full p-4 text-left" onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{order.purchaser_full_name}</span>
                      <span className="text-sm text-muted-foreground">{order.purchaser_mobile}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <StatusBadge status={order.payment_status} />
                      <span className="text-xs text-muted-foreground">{order.match?.name}</span>
                      <span className="text-xs text-muted-foreground">{order.seats_count} seat{order.seats_count > 1 ? 's' : ''} · ₹{order.total_amount}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString('en-IN')}</span>
                    {expandedId === order.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </button>

              {expandedId === order.id && (
                <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Email:</span><p className="text-foreground truncate">{order.purchaser_email || '—'}</p></div>
                    <div><span className="text-muted-foreground">Method:</span><p className="text-foreground capitalize">{order.payment_method?.replace('_', ' ')}</p></div>
                    <div><span className="text-muted-foreground">Source:</span><p className="text-foreground capitalize">{order.created_source?.replace('_', ' ')}</p></div>
                    <div><span className="text-muted-foreground">Seating:</span><p className="text-foreground capitalize">{order.seating_type}</p></div>
                  </div>

                  {order.proofs?.length > 0 && (
                    <div className="bg-muted/20 rounded-lg p-3 text-sm">
                      <p className="font-medium text-foreground mb-2">Latest Payment Proof</p>
                      {order.proofs.slice(-1).map((proof: any) => (
                        <div key={proof.id} className="space-y-1 text-xs">
                          <div className="flex items-center gap-2"><StatusBadge status={proof.ai_verdict} /><span className="text-muted-foreground">{proof.ai_reason}</span></div>
                          {proof.extracted_amount && <p className="text-muted-foreground">Amount: ₹{proof.extracted_amount}</p>}
                          {proof.extracted_txn_id && <p className="text-muted-foreground">TXN: {proof.extracted_txn_id}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {['pending_verification', 'paid_rejected', 'unpaid'].includes(order.payment_status) && (
                    <div className="flex gap-2">
                      <GlassButton variant="success" size="sm" loading={updatingId === order.id} onClick={() => handleManualVerify(order.id, 'paid_manual_verified')}>
                        <CheckCircle2 className="h-4 w-4" /> Manual Verify
                      </GlassButton>
                      <GlassButton variant="danger" size="sm" loading={updatingId === order.id} onClick={() => handleManualVerify(order.id, 'paid_rejected')}>
                        <XCircle className="h-4 w-4" /> Reject
                      </GlassButton>
                    </div>
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
