import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard, RefreshCw, Search, ChevronDown, ChevronRight,
  Copy, Check, Eye, EyeOff, AlertTriangle, ShieldAlert, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

type RazorpayOrder = {
  id: string;
  purchaser_full_name: string;
  purchaser_mobile: string;
  total_amount: number;
  payment_status: string;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  gateway_response: Record<string, unknown> | null;
  created_at: string;
};

// ─── Copy Button ─────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="ml-1 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid_verified: 'bg-green-500/15 text-green-400 border-green-500/30',
    paid_manual_verified: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    pending_verification: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    unpaid: 'bg-muted text-muted-foreground border-border',
    paid_rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full border font-medium ${map[status] ?? 'bg-muted text-muted-foreground border-border'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab() {
  const [orders, setOrders] = useState<RazorpayOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'paid_verified' | 'unpaid' | 'pending_verification'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('id, purchaser_full_name, purchaser_mobile, total_amount, payment_status, razorpay_payment_id, razorpay_order_id, gateway_response, created_at')
      .eq('payment_method', 'razorpay')
      .order('created_at', { ascending: false });
    if (!error && data) setOrders(data as RazorpayOrder[]);
    setLoading(false);
  }, []);

  const exportCSV = () => {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ['Date', 'Customer Name', 'Mobile', 'Amount (INR)', 'Payment ID', 'Order ID', 'Status'];
    const rows = filtered.map(o => [
      format(new Date(o.created_at), 'dd MMM yyyy HH:mm'),
      o.purchaser_full_name,
      o.purchaser_mobile,
      String(o.total_amount),
      o.razorpay_payment_id ?? '',
      o.razorpay_order_id ?? '',
      o.payment_status,
    ].map(escape).join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `razorpay-transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} transaction${filtered.length !== 1 ? 's' : ''}`);
  };

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o => {
    if (filter !== 'all' && o.payment_status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.purchaser_full_name.toLowerCase().includes(q) ||
        o.purchaser_mobile.includes(q) ||
        (o.razorpay_payment_id ?? '').toLowerCase().includes(q) ||
        (o.razorpay_order_id ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const total = orders.length;
  const verified = orders.filter(o => o.payment_status === 'paid_verified' || o.payment_status === 'paid_manual_verified').length;
  const totalAmount = orders
    .filter(o => o.payment_status === 'paid_verified' || o.payment_status === 'paid_manual_verified')
    .reduce((s, o) => s + o.total_amount, 0);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Orders', value: total },
          { label: 'Verified', value: verified },
          { label: 'Amount Collected', value: `₹${totalAmount.toLocaleString('en-IN')}` },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
            <p className="text-xl font-bold text-foreground font-display">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, mobile, payment ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'paid_verified', 'unpaid', 'pending_verification'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={exportCSV}
          disabled={loading || filtered.length === 0}
          title={`Export ${filtered.length} row${filtered.length !== 1 ? 's' : ''}`}
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-6"></th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Payment ID</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Order ID</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                    Loading transactions…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                    No Razorpay transactions found
                  </td>
                </tr>
              ) : (
                filtered.map(o => (
                  <React.Fragment key={o.id}>
                    <tr
                      className="border-b border-border hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                    >
                      <td className="px-4 py-3 text-muted-foreground">
                        {expanded === o.id
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{o.purchaser_full_name}</p>
                        <p className="text-xs text-muted-foreground">{o.purchaser_mobile}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        ₹{o.total_amount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.payment_status} />
                      </td>
                      <td className="px-4 py-3">
                        {o.razorpay_payment_id ? (
                          <span className="font-mono text-xs text-foreground flex items-center gap-0.5">
                            {o.razorpay_payment_id.slice(0, 18)}…
                            <CopyBtn text={o.razorpay_payment_id} />
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {o.razorpay_order_id ? (
                          <span className="font-mono text-xs text-foreground flex items-center gap-0.5">
                            {o.razorpay_order_id.slice(0, 18)}…
                            <CopyBtn text={o.razorpay_order_id} />
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(o.created_at), 'dd MMM yy, HH:mm')}
                      </td>
                    </tr>
                    {expanded === o.id && (
                      <tr className="border-b border-border bg-muted/10">
                        <td colSpan={7} className="px-6 py-4">
                          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                            Gateway Response
                          </p>
                          <pre className="text-xs font-mono bg-background border border-border rounded-lg p-3 overflow-x-auto text-foreground/80 leading-relaxed">
                            {o.gateway_response
                              ? JSON.stringify(o.gateway_response, null, 2)
                              : 'No gateway response recorded'}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Gateway Settings Tab ─────────────────────────────────────────────────────

function GatewaySettingsTab() {
  const { role, user } = useAuth();
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentKeyId, setCurrentKeyId] = useState<string | null>(null);
  const [secretSet, setSecretSet] = useState(false);
  const [webhookSecretSet, setWebhookSecretSet] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCurrent = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('gateway_secrets' as any)
      .select('key, value, updated_at')
      .in('key', ['razorpay_key_id', 'razorpay_key_secret', 'razorpay_webhook_secret']);

    if (data) {
      const rows = (data as unknown) as { key: string; value: string; updated_at: string }[];
      const kid = rows.find(r => r.key === 'razorpay_key_id');
      const ks = rows.find(r => r.key === 'razorpay_key_secret');
      const wh = rows.find(r => r.key === 'razorpay_webhook_secret');
      setCurrentKeyId(kid?.value || null);
      setSecretSet(!!(ks?.value));
      setWebhookSecretSet(!!(wh?.value));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadCurrent(); }, [loadCurrent]);

  if (role !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <ShieldAlert className="h-10 w-10 text-destructive/60" />
        <p className="text-sm font-semibold text-foreground">Access Restricted</p>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Gateway secret management is restricted to super admins only.
        </p>
      </div>
    );
  }

  const handleSave = async () => {
    if (!keyId && !keySecret && !webhookSecret) {
      toast.error('Enter at least one value to update');
      return;
    }
    setSaving(true);
    try {
      const updates: { key: string; value: string; updated_at: string; updated_by_admin_id: string | undefined }[] = [];
      if (keyId) {
        updates.push({ key: 'razorpay_key_id', value: keyId, updated_at: new Date().toISOString(), updated_by_admin_id: user?.id });
      }
      if (keySecret) {
        updates.push({ key: 'razorpay_key_secret', value: keySecret, updated_at: new Date().toISOString(), updated_by_admin_id: user?.id });
      }
      if (webhookSecret) {
        updates.push({ key: 'razorpay_webhook_secret', value: webhookSecret, updated_at: new Date().toISOString(), updated_by_admin_id: user?.id });
      }

      for (const row of updates) {
        const { error } = await supabase
          .from('gateway_secrets' as any)
          .upsert(row, { onConflict: 'key' });
        if (error) throw error;
      }

      toast.success('Gateway credentials updated successfully');
      setKeyId('');
      setKeySecret('');
      setWebhookSecret('');
      loadCurrent();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update credentials');
    }
    setSaving(false);
  };

  const maskedKeyId = currentKeyId
    ? currentKeyId.length > 8
      ? `${currentKeyId.slice(0, 8)}${'•'.repeat(Math.max(0, currentKeyId.length - 12))}${currentKeyId.slice(-4)}`
      : currentKeyId
    : null;

  return (
    <div className="max-w-lg space-y-5">
      {/* Warning banner */}
      <div className="flex gap-3 p-4 rounded-xl border border-warning/30 bg-warning/10">
        <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-warning">Handle with care</p>
          <p className="text-xs text-warning/80 mt-0.5">
            Changing these values will affect all future Razorpay payments immediately.
            Incorrect credentials will cause checkout failures.
          </p>
        </div>
      </div>

      {/* Current state */}
      {!loading && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current State</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Key ID</span>
            {maskedKeyId
              ? <span className="font-mono text-xs text-success">{maskedKeyId}</span>
              : <Badge variant="outline" className="text-xs text-muted-foreground">Not set</Badge>}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Key Secret</span>
            {secretSet
              ? <span className="font-mono text-xs text-success">••••••••••••••••</span>
              : <Badge variant="outline" className="text-xs text-muted-foreground">Not set</Badge>}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Webhook Secret</span>
            {webhookSecretSet
              ? <span className="font-mono text-xs text-success">••••••••••••••••</span>
              : <Badge variant="outline" className="text-xs text-muted-foreground">Not set</Badge>}
          </div>
        </div>
      )}

      {/* Webhook URL info */}
      <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Webhook Configuration</p>
        <p className="text-xs text-muted-foreground">Register this URL in your Razorpay Dashboard → Webhooks. Subscribe to <code className="bg-muted px-1 rounded text-foreground">payment.captured</code> event.</p>
        <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
          <code className="text-xs font-mono text-foreground flex-1 break-all">
            https://fkblggtrpyubuglndotz.supabase.co/functions/v1/razorpay-webhook
          </code>
          <button
            onClick={() => { navigator.clipboard.writeText('https://fkblggtrpyubuglndotz.supabase.co/functions/v1/razorpay-webhook'); toast.success('Copied!'); }}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Razorpay Key ID</label>
          <Input
            placeholder="rzp_live_…"
            value={keyId}
            onChange={e => setKeyId(e.target.value)}
            className="font-mono text-sm bg-background"
          />
          <p className="text-xs text-muted-foreground">Leave blank to keep the existing Key ID.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Razorpay Key Secret</label>
          <div className="relative">
            <Input
              type={showSecret ? 'text' : 'password'}
              placeholder="Enter new Key Secret (write-only)"
              value={keySecret}
              onChange={e => setKeySecret(e.target.value)}
              className="font-mono text-sm pr-10 bg-background"
            />
            <button
              type="button"
              onClick={() => setShowSecret(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            This is stored in a secured table. The existing value is never shown.
            Leave blank to keep the existing secret.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Webhook Secret</label>
          <div className="relative">
            <Input
              type={showWebhookSecret ? 'text' : 'password'}
              placeholder="Enter Webhook Secret from Razorpay Dashboard"
              value={webhookSecret}
              onChange={e => setWebhookSecret(e.target.value)}
              className="font-mono text-sm pr-10 bg-background"
            />
            <button
              type="button"
              onClick={() => setShowWebhookSecret(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Found in Razorpay Dashboard → Settings → Webhooks. Used to verify incoming webhook events.
            Leave blank to keep the existing webhook secret.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving || (!keyId && !keySecret && !webhookSecret)} className="w-full">
          {saving ? 'Saving…' : 'Save Credentials'}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPayments() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold font-display text-foreground">Payments</h1>
          <p className="text-xs text-muted-foreground">Razorpay transactions &amp; gateway settings</p>
        </div>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList className="bg-muted/40">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="settings">Gateway Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="transactions" className="mt-5">
          <TransactionsTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-5">
          <GatewaySettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
