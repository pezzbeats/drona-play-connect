import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, ChevronRight, CreditCard, Smartphone, Users, MapPin, Ticket, Upload, X, Loader2, Star, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface Match {
  id: string;
  name: string;
  opponent: string | null;
  match_type: string;
  start_time: string | null;
  venue: string;
  status: string;
}

interface PriceQuote {
  seats: Array<{ seat_index: number; price: number; reason: string }>;
  total: number;
  seating_type: string;
}

const PAYEE_VPA = 'paytmqr5oka4x@ptys';
const PAYEE_NAME = 'Hotel Drona Palace';

const steps = ['Your Details', 'Seats & Pricing', 'Payment', 'Your Tickets'];

export default function RegisterPage() {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);

  // Preview mode
  const previewMatchId = new URLSearchParams(window.location.search).get('preview');
  const isPreviewMode = !!previewMatchId;

  // Step 1
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');

  // Step 2
  const [seatsCount, setSeatsCount] = useState(1);
  const [seatingType, setSeatingType] = useState<'regular' | 'family'>('regular');
  const [priceQuote, setPriceQuote] = useState<PriceQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Step 3
  const [paymentMethod, setPaymentMethod] = useState<'pay_at_hotel' | 'upi_qr'>('upi_qr');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 4
  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    fetchActiveMatch();
  }, []);

  const fetchActiveMatch = async () => {
    setMatchLoading(true);
    let data: any = null;

    if (isPreviewMode && previewMatchId) {
      // Preview mode: load specific match regardless of active status
      const res = await supabase.from('matches').select('*').eq('id', previewMatchId).single();
      data = res.data;
    } else {
      // Normal mode: load the active match
      const res = await supabase.from('matches').select('*').eq('is_active_for_registration', true).single();
      data = res.data;
    }

    if (data) {
      setActiveMatch(data);
      // Fetch banner
      const { data: assets } = await supabase
        .from('match_assets')
        .select('*')
        .eq('match_id', data.id)
        .eq('asset_type', 'banner_image')
        .single();
      if (assets?.file_path) {
        const { data: url } = supabase.storage.from('match-assets').getPublicUrl(assets.file_path);
        setBannerUrl(url?.publicUrl || null);
      }
    }
    setMatchLoading(false);
  };

  const fetchQuote = async () => {
    if (!activeMatch) return;
    setQuoteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pricing-quote', {
        body: { mobile, seats_count: seatsCount, seating_type: seatingType, match_id: activeMatch.id }
      });
      if (error) throw error;
      setPriceQuote(data);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Quote failed', description: e.message });
    }
    setQuoteLoading(false);
  };

  useEffect(() => {
    if (step === 1 && activeMatch && mobile) fetchQuote();
  }, [step, seatsCount, seatingType]);

  const handleStep1 = () => {
    if (!fullName.trim()) return toast({ variant: 'destructive', title: 'Name required' });
    if (!/^\d{10}$/.test(mobile)) return toast({ variant: 'destructive', title: 'Invalid mobile', description: 'Enter a 10-digit mobile number' });
    setStep(1);
  };

  const handleStep2 = async () => {
    if (!priceQuote) return toast({ variant: 'destructive', title: 'Please wait for price quote' });
    setStep(2);
  };

  const handleCreateOrder = async () => {
    if (!activeMatch || !priceQuote) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-order', {
        body: {
          match_id: activeMatch.id,
          purchaser_full_name: fullName,
          purchaser_mobile: mobile,
          purchaser_email: email || null,
          seating_type: seatingType,
          seats_count: seatsCount,
          payment_method: paymentMethod,
          pricing_snapshot: priceQuote,
        }
      });
      if (error) throw error;
      setOrderId(data.order_id);
      if (paymentMethod === 'pay_at_hotel') {
        setTickets(data.tickets || []);
        setStep(3);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Order failed', description: e.message });
    }
    setLoading(false);
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orderId) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('order_id', orderId);
      const { data, error } = await supabase.functions.invoke('verify-payment-proof', {
        body: formData,
      });
      if (error) throw error;
      setVerifyResult(data);
      if (data.verdict === 'verified') {
        toast({ title: '✅ Payment Verified!', description: 'Your tickets are being generated...' });
        // Fetch tickets
        const { data: ticketData } = await supabase.from('tickets').select('*').eq('order_id', orderId);
        setTickets(ticketData || []);
        setStep(3);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Verification failed', description: e.message });
    }
    setVerifyLoading(false);
  };

  const upiQRValue = priceQuote && activeMatch
    ? `upi://pay?pa=${PAYEE_VPA}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${priceQuote.total}&cu=INR&tn=${encodeURIComponent(`${fullName}_${seatsCount}_${mobile}`)}`
    : '';

  if (matchLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <BackgroundOrbs />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeMatch) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <BackgroundOrbs />
        <div className="relative z-10 text-center max-w-md">
          <GlassCard className="p-8">
            <div className="text-6xl mb-4">🏏</div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-3">Registrations Closed</h1>
            <p className="text-muted-foreground">No active match is currently open for registration. Check back soon!</p>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <BackgroundOrbs />

      {/* Preview mode banner */}
      {isPreviewMode && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-warning/90 text-warning-foreground text-sm font-semibold py-2 px-4 backdrop-blur-sm">
          ⚠️ PREVIEW MODE — This page is not live. Changes are not saved.
        </div>
      )}

      {/* Disclaimer bar */}
      <div className="disclaimer-bar text-center text-xs py-2 px-4 relative z-10">
        ⚽ This is a fun guess game for entertainment only. No betting, no wagering, no gambling.
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl">🏏</span>
            <h1 className="font-display text-3xl font-bold gradient-text">T20 Fan Night</h1>
          </div>
          <p className="text-muted-foreground text-sm">Hotel Drona Palace</p>
        </div>

        {/* Match Banner */}
        {bannerUrl && (
          <div className="mb-4 rounded-xl overflow-hidden">
            <img src={bannerUrl} alt="Match Banner" className="w-full h-40 object-cover" />
          </div>
        )}

        {/* Match Info Card */}
        <GlassCard className="p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-xl">🏟️</div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">{activeMatch.name}</h2>
              {activeMatch.opponent && <p className="text-sm text-muted-foreground">vs {activeMatch.opponent}</p>}
            </div>
          </div>
          {activeMatch.start_time && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {activeMatch.venue} · {new Date(activeMatch.start_time).toLocaleString('en-IN')}
            </div>
          )}
        </GlassCard>

        {/* Step Indicators */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < step ? 'step-completed text-success-foreground' :
                  i === step ? 'step-active text-primary-foreground' :
                  'step-inactive text-muted-foreground'
                }`}>
                  {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span className="text-xs text-muted-foreground hidden sm:block">{s}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-px mx-1 transition-all ${i < step ? 'bg-success' : 'bg-border'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step 0: Personal Details */}
        {step === 0 && (
          <GlassCard className="p-6 animate-fade-in" glow>
            <h3 className="font-display text-xl font-bold text-foreground mb-5 flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" /> Your Details
            </h3>
            <div className="space-y-4">
              <div>
                <Label className="text-foreground mb-1.5 block">Full Name *</Label>
                <Input
                  className="glass-input"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-foreground mb-1.5 block">Mobile Number *</Label>
                <Input
                  className="glass-input"
                  placeholder="10-digit mobile"
                  value={mobile}
                  onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  type="tel"
                />
              </div>
              <div>
                <Label className="text-foreground mb-1.5 block">Email (optional)</Label>
                <Input
                  className="glass-input"
                  placeholder="your@email.com"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <GlassButton variant="primary" size="lg" className="w-full mt-2" onClick={handleStep1}>
                Continue <ChevronRight className="h-4 w-4" />
              </GlassButton>
            </div>
          </GlassCard>
        )}

        {/* Step 1: Seats & Pricing */}
        {step === 1 && (
          <GlassCard className="p-6 animate-fade-in" glow>
            <h3 className="font-display text-xl font-bold text-foreground mb-5 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Seats & Pricing
            </h3>
            <div className="space-y-5">
              <div>
                <Label className="text-foreground mb-2 block">Number of Seats</Label>
                <div className="flex items-center gap-3">
                  <GlassButton variant="ghost" size="sm" onClick={() => setSeatsCount(Math.max(1, seatsCount - 1))}>−</GlassButton>
                  <span className="font-display text-2xl font-bold text-foreground w-10 text-center">{seatsCount}</span>
                  <GlassButton variant="ghost" size="sm" onClick={() => setSeatsCount(Math.min(10, seatsCount + 1))}>+</GlassButton>
                </div>
              </div>

              <div>
                <Label className="text-foreground mb-2 block">Seating Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(['regular', 'family'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setSeatingType(type)}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                        seatingType === type
                          ? 'border-primary bg-primary/10 text-primary shadow-glow-primary'
                          : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      {type === 'regular' ? '🪑 Regular' : '👨‍👩‍👧 Family'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Quote Table */}
              {quoteLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground text-sm">Calculating price...</span>
                </div>
              ) : priceQuote ? (
                <div>
                  <Label className="text-foreground mb-2 block">Price Breakdown</Label>
                  <div className="rounded-lg overflow-hidden border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30">
                          <th className="text-left p-2.5 text-muted-foreground font-medium">Seat</th>
                          <th className="text-left p-2.5 text-muted-foreground font-medium">Type</th>
                          <th className="text-right p-2.5 text-muted-foreground font-medium">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceQuote.seats.map((s) => (
                          <tr key={s.seat_index} className="border-t border-border/50">
                            <td className="p-2.5 text-foreground">#{s.seat_index + 1}</td>
                            <td className="p-2.5 text-muted-foreground capitalize text-xs">{s.reason.replace('_', ' ')}</td>
                            <td className="p-2.5 text-right font-medium text-foreground">₹{s.price}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-primary/30 bg-primary/5">
                          <td colSpan={2} className="p-2.5 font-display font-bold text-foreground">Total</td>
                          <td className="p-2.5 text-right font-display text-xl font-bold gradient-text">₹{priceQuote.total}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <GlassButton variant="outline" size="sm" onClick={fetchQuote}>Get Price Quote</GlassButton>
              )}

              <div className="flex gap-3">
                <GlassButton variant="ghost" size="md" className="flex-1" onClick={() => setStep(0)}>Back</GlassButton>
                <GlassButton variant="primary" size="md" className="flex-1" onClick={handleStep2} disabled={!priceQuote}>
                  Continue <ChevronRight className="h-4 w-4" />
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Step 2: Payment */}
        {step === 2 && (
          <GlassCard className="p-6 animate-fade-in" glow>
            <h3 className="font-display text-xl font-bold text-foreground mb-5 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Payment
            </h3>

            {!orderId ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Total: <span className="text-2xl font-display font-bold gradient-text">₹{priceQuote?.total}</span></p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod('upi_qr')}
                    className={`p-4 rounded-lg border text-sm font-medium transition-all ${
                      paymentMethod === 'upi_qr'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    <Smartphone className="h-5 w-5 mb-1.5 mx-auto" />
                    UPI / QR
                  </button>
                  <button
                    onClick={() => setPaymentMethod('pay_at_hotel')}
                    className={`p-4 rounded-lg border text-sm font-medium transition-all ${
                      paymentMethod === 'pay_at_hotel'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    <CreditCard className="h-5 w-5 mb-1.5 mx-auto" />
                    Pay at Hotel
                  </button>
                </div>
                {paymentMethod === 'pay_at_hotel' && (
                  <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning">
                    ⚠️ Pay at Hotel: Your tickets will be generated but marked as unpaid. Pay at the venue.
                  </div>
                )}
                <div className="flex gap-3">
                  <GlassButton variant="ghost" size="md" className="flex-1" onClick={() => setStep(1)}>Back</GlassButton>
                  <GlassButton variant="primary" size="md" className="flex-1" loading={loading} onClick={handleCreateOrder}>
                    {paymentMethod === 'pay_at_hotel' ? 'Get Tickets' : 'Proceed to Pay'}
                  </GlassButton>
                </div>
              </div>
            ) : (
              // UPI QR + Proof Upload
              <div className="space-y-5">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-3">Scan to pay <span className="font-bold gradient-text">₹{priceQuote?.total}</span></p>
                  <div className="qr-container mx-auto w-fit">
                    <QRCodeSVG value={upiQRValue} size={180} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">UPI: {PAYEE_VPA}</p>
                  <p className="text-xs text-muted-foreground">Remark: <span className="text-primary">{fullName}_{seatsCount}_{mobile}</span></p>
                </div>

                <div className="border-t border-border pt-5">
                  <Label className="text-foreground mb-2 block">Upload Payment Screenshot / PDF</Label>
                  {verifyLoading ? (
                    <div className="flex items-center justify-center gap-2 py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Verifying payment with AI...</span>
                    </div>
                  ) : verifyResult ? (
                    <div className={`rounded-lg p-4 border ${
                      verifyResult.verdict === 'verified' ? 'bg-success/10 border-success/30' :
                      verifyResult.verdict === 'rejected' ? 'bg-destructive/10 border-destructive/30' :
                      'bg-warning/10 border-warning/30'
                    }`}>
                      <p className="font-medium text-sm">
                        {verifyResult.verdict === 'verified' ? '✅ Payment Verified' :
                         verifyResult.verdict === 'rejected' ? '❌ Payment Rejected' :
                         '⏳ Manual Review Required'}
                      </p>
                      {verifyResult.reason && <p className="text-xs mt-1 text-muted-foreground">{verifyResult.reason}</p>}
                      {verifyResult.verdict !== 'verified' && (
                        <GlassButton variant="outline" size="sm" className="mt-3" onClick={() => { setVerifyResult(null); if (fileRef.current) fileRef.current.value = ''; }}>
                          Try Again
                        </GlassButton>
                      )}
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                      <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Click to upload screenshot or PDF</span>
                      <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf" onChange={handleProofUpload} />
                    </label>
                  )}
                </div>
              </div>
            )}
          </GlassCard>
        )}

        {/* Step 3: Tickets */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center">
              <CheckCircle2 className="h-14 w-14 text-success mx-auto mb-3" />
              <h3 className="font-display text-2xl font-bold gradient-text">Tickets Generated!</h3>
              <p className="text-sm text-muted-foreground mt-1">Show QR at the gate for check-in</p>
            </div>
            {tickets.map((ticket, i) => (
              <GlassCard key={ticket.id} className="seat-pass p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-display text-lg font-bold text-foreground">{fullName}</p>
                    <p className="text-sm text-muted-foreground">{activeMatch?.name}</p>
                    <p className="text-xs text-muted-foreground">{activeMatch?.venue}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl font-bold gradient-text">#{i + 1}</div>
                    <div className="text-xs text-muted-foreground">Seat</div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="qr-container">
                    <QRCodeSVG value={ticket.qr_text} size={90} />
                  </div>
                  <div className="ml-4 text-right space-y-1">
                    <div className="text-xs text-muted-foreground">{mobile}</div>
                    <div className={`text-xs px-2 py-0.5 rounded-full ${paymentMethod === 'pay_at_hotel' ? 'badge-pending' : 'badge-active'}`}>
                      {paymentMethod === 'pay_at_hotel' ? '💳 Pay at Hotel' : '✅ Paid'}
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground font-mono truncate">
                  {ticket.qr_text}
                </div>
              </GlassCard>
            ))}
            <GlassButton variant="primary" size="lg" className="w-full no-print" onClick={() => window.print()}>
              🖨️ Print Tickets
            </GlassButton>
          </div>
        )}
      </div>
    </div>
  );
}
