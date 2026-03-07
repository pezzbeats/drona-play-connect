import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Loader2, ChevronRight, User, UserX, UserPlus, IndianRupee } from 'lucide-react';

export default function AdminManualBooking() {
  const [searchMobile, setSearchMobile] = useState('');
  const [existing, setExisting] = useState<any>(null);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeMatch, setActiveMatch] = useState<any>(null);
  const [priceQuote, setPriceQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    seats_count: '1',
    seating_type: 'regular',
    payment_method: 'cash',
    advance_paid: '',
    advance_payment_method: 'cash',
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    supabase.from('matches').select('*').eq('is_active_for_registration', true).single()
      .then(({ data }) => setActiveMatch(data));
  }, []);

  const handleSearch = async () => {
    if (!/^\d{10}$/.test(searchMobile)) return toast({ variant: 'destructive', title: 'Enter 10-digit mobile' });
    setSearching(true); setExisting(null); setSearched(false); setPriceQuote(null);
    const { data } = await supabase.from('orders').select('*, match:matches!match_id(name)')
      .eq('purchaser_mobile', searchMobile).eq('match_id', activeMatch?.id).single();
    setExisting(data || null);
    setSearched(true);
    setSearching(false);
  };

  const fetchQuote = async () => {
    if (!activeMatch) return;
    setQuoteLoading(true);
    const { data } = await supabase.functions.invoke('pricing-quote', {
      body: { mobile: searchMobile, seats_count: parseInt(form.seats_count), seating_type: form.seating_type, match_id: activeMatch.id }
    });
    setPriceQuote(data);
    setQuoteLoading(false);
  };

  const handleCreate = async () => {
    if (!form.full_name.trim()) return toast({ variant: 'destructive', title: 'Name required' });
    if (!priceQuote) return toast({ variant: 'destructive', title: 'Get quote first' });

    const totalAmount = priceQuote.total ?? 0;
    const advancePaid = parseInt(form.advance_paid) || 0;

    if (advancePaid < 0) return toast({ variant: 'destructive', title: 'Advance cannot be negative' });
    if (advancePaid > totalAmount) return toast({ variant: 'destructive', title: `Advance cannot exceed total ₹${totalAmount}` });

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-order', {
        body: {
          match_id: activeMatch.id,
          purchaser_full_name: form.full_name,
          purchaser_mobile: searchMobile,
          purchaser_email: form.email || null,
          seating_type: form.seating_type,
          seats_count: parseInt(form.seats_count),
          payment_method: form.payment_method,
          pricing_snapshot: priceQuote,
          created_source: 'manual_booking',
          admin_id: user?.id,
          advance_paid: advancePaid,
          advance_payment_method: advancePaid > 0 ? form.advance_payment_method : null,
        }
      });
      if (error) throw error;

      const balanceDue = data.balance_due ?? 0;
      const successMsg = balanceDue > 0
        ? `Order ID: ${data.order_id} · Balance due at entry: ₹${balanceDue}`
        : `Order ID: ${data.order_id} · Fully paid`;

      toast({ title: '✅ Order created', description: successMsg });
      await supabase.from('admin_activity').insert({
        admin_id: user?.id,
        action: 'manual_booking',
        entity_type: 'order',
        entity_id: data.order_id,
        meta: { mobile: searchMobile, name: form.full_name, advance_paid: advancePaid, balance_due: balanceDue },
      });
      setExisting(null); setPriceQuote(null); setSearched(false);
      setForm({ full_name: '', email: '', seats_count: '1', seating_type: 'regular', payment_method: 'cash', advance_paid: '', advance_payment_method: 'cash' });
      handleSearch();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setCreating(false);
  };

  const noCustomerFound = searched && !existing && searchMobile.length === 10 && activeMatch;
  const advancePaidNum = parseInt(form.advance_paid) || 0;
  const totalAmount = priceQuote?.total ?? 0;
  const balanceDue = Math.max(0, totalAmount - advancePaidNum);

  return (
    <div className="px-4 py-5 space-y-4 max-w-lg mx-auto md:p-6">
      <div>
        <h1 className="font-display text-2xl font-bold gradient-text-accent">Manual Booking</h1>
        <p className="text-muted-foreground text-sm">Walk-in / phone booking with audit trail</p>
      </div>

      {!activeMatch && (
        <GlassCard className="p-4">
          <p className="text-sm text-muted-foreground">⚠️ No active match for registration.</p>
        </GlassCard>
      )}

      {/* Search card */}
      <GlassCard className="p-4" glow>
        <h2 className="font-display text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />Search by Mobile
        </h2>
        <div className="flex gap-2">
          <Input
            className="glass-input flex-1 h-12 text-base"
            placeholder="10-digit mobile"
            type="tel"
            inputMode="numeric"
            value={searchMobile}
            onChange={e => { setSearchMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); setSearched(false); }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <GlassButton variant="primary" size="lg" loading={searching} onClick={handleSearch} disabled={!activeMatch} className="h-12 px-5">
            <ChevronRight className="h-5 w-5" />
          </GlassButton>
        </div>
      </GlassCard>

      {/* Existing registration found */}
      {existing && (
        <GlassCard className="p-4 border-warning/40">
          <p className="text-sm font-medium text-warning mb-2">⚠️ Existing registration found</p>
          <p className="text-foreground font-bold">{existing.purchaser_full_name}</p>
          <p className="text-sm text-muted-foreground">{existing.match?.name} · {existing.seats_count} seats · ₹{existing.total_amount}</p>
          {existing.advance_paid > 0 && (
            <div className="mt-1.5 flex items-center gap-3">
              <span className="text-xs text-success font-medium">Advance: ₹{existing.advance_paid}</span>
              {existing.total_amount - existing.advance_paid > 0 && (
                <span className="text-xs text-warning font-bold">⚠ Balance: ₹{existing.total_amount - existing.advance_paid}</span>
              )}
            </div>
          )}
          <StatusBadge status={existing.payment_status} className="mt-2" />
        </GlassCard>
      )}

      {/* Empty state — no customer found */}
      {noCustomerFound && !priceQuote && (
        <GlassCard className="p-6 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center">
            <UserX className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-display text-base font-bold text-foreground">No registration found</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="font-mono text-foreground">{searchMobile}</span> hasn't booked for this match.
            </p>
          </div>
          <GlassButton variant="primary" size="sm" className="mt-1 gap-2" onClick={() => setPriceQuote(undefined)}>
            <UserPlus className="h-4 w-4" /> Create New Booking
          </GlassButton>
        </GlassCard>
      )}

      {/* Booking form */}
      {noCustomerFound && (priceQuote !== undefined || priceQuote === undefined) && (
        <GlassCard variant="elevated" className="p-4">
          <h2 className="font-display text-base font-bold text-foreground mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />New Booking
          </h2>
          <div className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block text-sm">Full Name *</Label>
              <Input className="glass-input h-12 text-base" placeholder="Guest full name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block text-sm">Email</Label>
              <Input className="glass-input h-12 text-base" type="email" placeholder="optional" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground mb-1.5 block text-sm">Seats</Label>
                <Input className="glass-input h-12 text-base text-center" type="number" min={1} max={10} value={form.seats_count} onChange={e => setForm(f => ({ ...f, seats_count: e.target.value }))} />
              </div>
              <div>
                <Label className="text-foreground mb-1.5 block text-sm">Seating</Label>
                <Select value={form.seating_type} onValueChange={v => setForm(f => ({ ...f, seating_type: v }))}>
                  <SelectTrigger className="glass-input h-12 text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block text-sm">Primary Payment Method</Label>
              <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                <SelectTrigger className="glass-input h-12 text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="pay_at_hotel">Pay at Hotel (Unpaid)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Quote */}
            {quoteLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Getting quote...</span>
              </div>
            ) : priceQuote ? (
              <GlassCard variant="sunken" className="p-3">
                <p className="text-foreground font-medium mb-2 text-sm">Price Breakdown</p>
                {priceQuote.seats?.map((s: any) => (
                  <div key={s.seat_index} className="flex justify-between text-muted-foreground text-xs py-0.5">
                    <span>Seat #{s.seat_index + 1} ({s.reason})</span>
                    <span>₹{s.price}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-foreground mt-2 pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="gradient-text text-lg">₹{priceQuote.total}</span>
                </div>
              </GlassCard>
            ) : (
              <GlassButton variant="outline" size="md" className="w-full h-12" onClick={fetchQuote}>
                Get Price Quote
              </GlassButton>
            )}

            {/* Advance Payment section — only shown after quote */}
            {priceQuote && (
              <div className="space-y-3 pt-2 border-t border-border/50">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <IndianRupee className="h-4 w-4 text-warning" />
                  Advance Payment <span className="text-muted-foreground font-normal">(optional)</span>
                </p>
                <p className="text-xs text-muted-foreground -mt-1">If a partial amount is collected now, the balance will be shown at entry.</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-foreground mb-1.5 block text-sm">Advance Paid (₹)</Label>
                    <Input
                      className="glass-input h-12 text-base font-semibold"
                      type="number"
                      min={0}
                      max={priceQuote.total}
                      placeholder="0"
                      value={form.advance_paid}
                      onChange={e => setForm(f => ({ ...f, advance_paid: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-foreground mb-1.5 block text-sm">Advance Mode</Label>
                    <Select
                      value={form.advance_payment_method}
                      onValueChange={v => setForm(f => ({ ...f, advance_payment_method: v }))}
                      disabled={!form.advance_paid || parseInt(form.advance_paid) === 0}
                    >
                      <SelectTrigger className="glass-input h-12 text-base"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Balance summary */}
                {advancePaidNum > 0 && (
                  <div className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 ${
                    balanceDue === 0
                      ? 'bg-success/10 border-success/40 text-success'
                      : 'bg-warning/10 border-warning/40 text-warning'
                  }`}>
                    {balanceDue === 0 ? (
                      <span className="font-bold text-sm">✅ Fully Paid</span>
                    ) : (
                      <>
                        <span className="text-sm font-medium">Advance: ₹{advancePaidNum}</span>
                        <span className="font-display font-bold text-base">Balance Due: ₹{balanceDue}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <GlassButton variant="primary" size="lg" className="w-full h-14 text-base" loading={creating} onClick={handleCreate} disabled={!priceQuote}>
              {advancePaidNum > 0 && balanceDue > 0
                ? `Create Booking · ₹${balanceDue} at entry`
                : 'Create Booking'}
            </GlassButton>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
