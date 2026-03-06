import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2, ChevronRight, CreditCard, Smartphone, Users, MapPin,
  Upload, Loader2, AlertCircle, Star, Info
} from 'lucide-react';
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

const steps = ['Your Details', 'Seats & Price', 'Payment', 'Your Tickets'];

function StepBar({ step }: { step: number }) {
  return (
    <div className="mb-6">
      {/* Progress bar */}
      <div className="relative h-2 bg-muted rounded-full mb-3 overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{
            width: `${(step / (steps.length - 1)) * 100}%`,
            background: 'var(--gradient-primary)',
          }}
        />
      </div>
      {/* Step labels */}
      <div className="flex justify-between">
        {steps.map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-1" style={{ width: `${100 / steps.length}%` }}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < step ? 'bg-success text-success-foreground shadow-glow-success' :
              i === step ? 'step-active text-primary-foreground' :
              'step-inactive text-muted-foreground'
            }`}>
              {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium text-center leading-tight ${i === step ? 'text-primary' : 'text-muted-foreground'}`}>
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const nameRef = useRef<HTMLInputElement>(null);

  // Inline validation
  const mobileValid = /^\d{10}$/.test(mobile);
  const mobileError = mobile.length > 0 && !mobileValid;
  const nameError = fullName.length > 0 && fullName.trim().length < 2;

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
    // autoFocus on first field
    setTimeout(() => nameRef.current?.focus(), 300);
  }, []);

  const fetchActiveMatch = async () => {
    setMatchLoading(true);
    let data: any = null;

    if (isPreviewMode && previewMatchId) {
      const res = await supabase.from('matches').select('*').eq('id', previewMatchId).single();
      data = res.data;
    } else {
      const res = await supabase.from('matches').select('*').eq('is_active_for_registration', true).single();
      data = res.data;
    }

    if (data) {
      setActiveMatch(data);
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
    if (!fullName.trim() || fullName.trim().length < 2)
      return toast({ variant: 'destructive', title: 'Enter your full name' });
    if (!mobileValid)
      return toast({ variant: 'destructive', title: 'Invalid mobile', description: 'Enter a 10-digit mobile number' });
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
    <div className="min-h-screen relative" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <BackgroundOrbs />

      {/* Preview mode banner */}
      {isPreviewMode && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-warning/90 text-warning-foreground text-sm font-semibold py-2 px-4 backdrop-blur-sm">
          ⚠️ PREVIEW MODE — This page is not live. Changes are not saved.
        </div>
      )}

      {/* Disclaimer bar */}
      <div className="disclaimer-bar text-center text-xs py-2 px-4 relative z-10">
        🎯 Fun Guess Game only — entertainment. No betting. Event fees are for hospitality only.
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-5">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="flex items-center justify-center gap-2 mb-1">
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
        <GlassCard className="p-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-xl flex-shrink-0">🏟️</div>
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
        <StepBar step={step} />

        {/* Step 0: Personal Details */}
        {step === 0 && (
          <GlassCard className="p-6 animate-fade-in" glow>
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-full step-active flex items-center justify-center text-sm font-bold text-primary-foreground">①</div>
              <h3 className="font-display text-xl font-bold text-foreground">Your Details</h3>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-foreground mb-1.5 block">Full Name *</Label>
                <Input
                  ref={nameRef}
                  className={`glass-input ${nameError ? 'border-destructive' : ''}`}
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  autoComplete="name"
                />
                {nameError && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Please enter your full name
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-foreground">Mobile Number *</Label>
                  <span className={`text-xs font-mono ${mobileValid ? 'text-success' : 'text-muted-foreground'}`}>
                    {mobile.length}/10
                  </span>
                </div>
                <Input
                  className={`glass-input ${mobileError ? 'border-destructive' : mobileValid ? 'border-success/50' : ''}`}
                  placeholder="10-digit mobile number"
                  value={mobile}
                  onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  inputMode="numeric"
                  type="tel"
                  autoComplete="tel"
                />
                {mobileError && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Enter a valid 10-digit number
                  </p>
                )}
                {mobileValid && (
                  <p className="text-xs text-success mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Valid mobile number
                  </p>
                )}
              </div>
              <div>
                <Label className="text-foreground mb-1.5 block">Email (optional)</Label>
                <Input
                  className="glass-input"
                  placeholder="your@email.com"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              {/* Terms notice */}
              <p className="text-xs text-muted-foreground">
                By continuing, you agree to our{' '}
                <Link to="/terms" target="_blank" className="text-primary underline underline-offset-2 hover:text-primary/80">
                  Event Terms & Conditions
                </Link>
              </p>

              <GlassButton
                variant="primary" size="lg" className="w-full mt-2"
                onClick={handleStep1}
                disabled={!fullName.trim() || !mobileValid}
              >
                Continue <ChevronRight className="h-4 w-4" />
              </GlassButton>
            </div>
          </GlassCard>
        )}

        {/* Step 1: Seats & Pricing */}
        {step === 1 && (
          <GlassCard className="p-6 animate-fade-in" glow>
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-full step-active flex items-center justify-center text-sm font-bold text-primary-foreground">②</div>
              <h3 className="font-display text-xl font-bold text-foreground">Seats & Pricing</h3>
            </div>
            <div className="space-y-5">
              <div>
                <Label className="text-foreground mb-3 block text-sm font-semibold">Number of Seats</Label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSeatsCount(Math.max(1, seatsCount - 1))}
                    className="w-12 h-12 rounded-xl border-2 border-border bg-muted/30 text-foreground text-xl font-bold flex items-center justify-center hover:border-primary/50 hover:bg-primary/10 active:scale-95 transition-all"
                  >−</button>
                  <span className="font-display text-3xl font-bold text-foreground w-12 text-center tabular-nums">{seatsCount}</span>
                  <button
                    onClick={() => setSeatsCount(Math.min(10, seatsCount + 1))}
                    className="w-12 h-12 rounded-xl border-2 border-border bg-muted/30 text-foreground text-xl font-bold flex items-center justify-center hover:border-primary/50 hover:bg-primary/10 active:scale-95 transition-all"
                  >+</button>
                  <span className="text-sm text-muted-foreground">seat{seatsCount > 1 ? 's' : ''}</span>
                </div>
              </div>

              <div>
                <Label className="text-foreground mb-3 block text-sm font-semibold">Seating Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(['regular', 'family'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setSeatingType(type)}
                      className={`p-4 rounded-xl border-2 text-sm font-semibold transition-all active:scale-95 ${
                        seatingType === type
                          ? 'border-primary bg-primary/15 text-primary shadow-glow-primary'
                          : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      <div className="text-2xl mb-1">{type === 'regular' ? '🪑' : '👨‍👩‍👧'}</div>
                      <div>{type === 'regular' ? 'Regular' : 'Family'}</div>
                    </button>
                  ))}
                </div>
              </div>

...

              <div className="flex gap-3 pt-1">
                <GlassButton variant="ghost" size="md" className="flex-1 h-12" onClick={() => setStep(0)}>Back</GlassButton>
                <GlassButton variant="primary" size="lg" className="flex-1" onClick={handleStep2} disabled={!priceQuote}>
                  Continue <ChevronRight className="h-4 w-4" />
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Step 2: Payment */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <GlassCard className="p-6" glow>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-full step-active flex items-center justify-center text-sm font-bold text-primary-foreground">③</div>
                <h3 className="font-display text-xl font-bold text-foreground">Payment</h3>
              </div>

              {/* Total amount — prominent */}
              <div className="text-center mb-5 py-3 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Amount</p>
                <p className="font-display text-4xl font-bold gradient-text">₹{priceQuote?.total}</p>
                <p className="text-xs text-muted-foreground mt-1">{seatsCount} seat{seatsCount > 1 ? 's' : ''} · {seatingType}</p>
              </div>

              {!orderId ? (
                <div className="space-y-4">
                  <Label className="text-foreground block">Choose Payment Method</Label>

                  {/* UPI QR — recommended */}
                  <button
                    onClick={() => setPaymentMethod('upi_qr')}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'upi_qr'
                        ? 'border-success bg-success/10'
                        : 'border-border hover:border-success/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Smartphone className={`h-6 w-6 mt-0.5 flex-shrink-0 ${paymentMethod === 'upi_qr' ? 'text-success' : 'text-muted-foreground'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-display font-bold text-base ${paymentMethod === 'upi_qr' ? 'text-success' : 'text-foreground'}`}>
                            Pay via UPI / QR
                          </span>
                          <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full font-semibold">Recommended</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Scan QR & upload screenshot — instant verification</p>
                      </div>
                      {paymentMethod === 'upi_qr' && (
                        <CheckCircle2 className="h-5 w-5 text-success ml-auto flex-shrink-0" />
                      )}
                    </div>
                  </button>

                  {/* Pay at Hotel */}
                  <button
                    onClick={() => setPaymentMethod('pay_at_hotel')}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'pay_at_hotel'
                        ? 'border-warning bg-warning/10'
                        : 'border-border hover:border-warning/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <CreditCard className={`h-6 w-6 mt-0.5 flex-shrink-0 ${paymentMethod === 'pay_at_hotel' ? 'text-warning' : 'text-muted-foreground'}`} />
                      <div>
                        <span className={`font-display font-bold text-base ${paymentMethod === 'pay_at_hotel' ? 'text-warning' : 'text-foreground'}`}>
                          Pay at Hotel
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">Book now, pay cash/UPI at the venue on arrival</p>
                      </div>
                      {paymentMethod === 'pay_at_hotel' && (
                        <CheckCircle2 className="h-5 w-5 text-warning ml-auto flex-shrink-0" />
                      )}
                    </div>
                  </button>

                  {paymentMethod === 'pay_at_hotel' && (
                    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning flex items-start gap-2">
                      <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>Tickets will be marked <strong>Unpaid</strong>. Pay the full amount at the venue before entry.</span>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                    <Star className="h-3 w-3" />
                    All fees are for event hospitality only. The Fun Guess Game is free to play.
                  </p>

                  <div className="flex gap-3 pt-1">
                    <GlassButton variant="ghost" size="md" className="flex-1 h-12" onClick={() => setStep(1)}>Back</GlassButton>
                    <GlassButton variant="primary" size="lg" className="flex-1" loading={loading} onClick={handleCreateOrder}>
                      {paymentMethod === 'pay_at_hotel' ? 'Get My Tickets' : 'Proceed to Pay'} <ChevronRight className="h-4 w-4" />
                    </GlassButton>
                  </div>
                </div>
              ) : (
                // UPI QR + Proof Upload
                <div className="space-y-5">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-3">Scan to pay <span className="font-bold gradient-text">₹{priceQuote?.total}</span></p>
                    <div className="qr-container mx-auto w-fit" style={{ padding: 16 }}>
                      <QRCodeSVG value={upiQRValue} size={200} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">UPI: {PAYEE_VPA}</p>
                    <p className="text-xs text-muted-foreground">Remark: <span className="text-primary">{fullName}_{seatsCount}_{mobile}</span></p>
                  </div>

                  <div className="border-t border-border pt-5">
                    <Label className="text-foreground mb-2 block font-semibold">Upload Payment Screenshot</Label>
                    <p className="text-xs text-muted-foreground mb-3">Upload your UPI payment screenshot for instant AI verification</p>
                    {verifyLoading ? (
                      <div className="flex items-center justify-center gap-2 py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Verifying with AI...</span>
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
                      <label className="flex flex-col items-center justify-center w-full min-h-[100px] border-2 border-dashed border-primary/30 rounded-2xl cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all active:scale-[0.98] bg-muted/10">
                        <Upload className="h-8 w-8 text-primary mb-2 mt-4" />
                        <span className="text-sm font-semibold text-foreground">Tap to Upload Screenshot</span>
                        <span className="text-xs text-muted-foreground mt-1 mb-4">or PDF — AI verifies instantly</span>
                        <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf" onChange={handleProofUpload} />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </GlassCard>
          </div>
        )}

        {/* Step 3: Tickets */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            {/* Prominent success banner */}
            <div className="rounded-xl p-4 text-center border-2 border-success/50 bg-success/10 animate-pulse-glow">
              <div className="text-4xl mb-2">🎟️</div>
              <h3 className="font-display text-2xl font-bold text-success">Your Tickets are Ready!</h3>
              <p className="text-sm text-muted-foreground mt-1">Show the QR code at the gate for check-in</p>
            </div>

            {tickets.map((ticket, i) => (
              <GlassCard key={ticket.id} className="seat-pass p-5">
                {/* Payment status banner at top */}
                <div className={`-mt-5 -mx-5 mb-4 px-5 py-3 flex items-center justify-center gap-2 font-display text-base font-bold tracking-wide ${
                  paymentMethod === 'pay_at_hotel'
                    ? 'bg-warning/20 border-b border-warning/30 text-warning'
                    : 'bg-success/20 border-b border-success/30 text-success'
                }`}>
                  {paymentMethod === 'pay_at_hotel'
                    ? '⚠️ UNPAID — Pay at Hotel on Arrival'
                    : '✅ PAID — Entry Confirmed'}
                </div>

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-display text-lg font-bold text-foreground">{fullName}</p>
                    <p className="text-sm text-muted-foreground">{activeMatch?.name}</p>
                    <p className="text-xs text-muted-foreground">{activeMatch?.venue}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">SEAT</div>
                    <div className="font-display text-3xl font-bold gradient-text">
                      {i + 1} <span className="text-base text-muted-foreground">of {tickets.length}</span>
                    </div>
                  </div>
                </div>

                {/* Large QR */}
                <div className="flex flex-col items-center mb-4">
                  <div className="qr-container" style={{ padding: 16 }}>
                    <QRCodeSVG value={ticket.qr_text} size={140} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{mobile}</p>
                </div>

                <div className="pt-3 border-t border-border/40 text-xs text-muted-foreground font-mono truncate text-center">
                  {ticket.qr_text.slice(0, 30)}...
                </div>
              </GlassCard>
            ))}

            <GlassButton variant="primary" size="lg" className="w-full no-print" onClick={() => window.print()}>
              🖨️ Print Tickets
            </GlassButton>

            <p className="text-xs text-muted-foreground text-center">
              Also accessible at{' '}
              <Link to="/ticket" className="text-primary underline">
                /ticket
              </Link>{' '}
              using your mobile number ·{' '}
              <Link to="/terms" target="_blank" className="text-muted-foreground underline">
                View Event Terms
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
