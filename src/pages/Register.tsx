import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import {
  CheckCircle2, ChevronRight, CreditCard, Smartphone, Users, MapPin,
  Upload, Loader2, AlertCircle, Star, Info, Zap, Shield, RefreshCw,
  Phone, Mail, ArrowRight, XCircle, Clock, ArrowLeft
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import hotelLogo from '@/assets/hotel-logo.png';

declare global {
  interface Window { Razorpay: any; }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface Match {
  id: string; name: string; opponent: string | null;
  match_type: string; start_time: string | null; venue: string; status: string;
}
interface PriceQuote {
  seats: Array<{ seat_index: number; price: number; reason: string }>;
  total: number; seating_type: string;
}

const steps = ['Your Details', 'Seats & Price', 'Payment', 'Your Tickets'];

function StepBar({ step }: { step: number }) {
  return (
    <div className="mb-6">
      <div className="relative h-2 bg-muted rounded-full mb-3 overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${(step / (steps.length - 1)) * 100}%`, background: 'var(--gradient-primary)' }}
        />
      </div>
      <div className="flex justify-between">
        {steps.map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-1" style={{ width: `${100 / steps.length}%` }}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < step ? 'bg-success text-success-foreground shadow-glow-success' :
              i === step ? 'step-active text-primary-foreground' : 'step-inactive text-muted-foreground'
            }`}>
              {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium text-center leading-tight ${i === step ? 'text-primary' : 'text-muted-foreground'}`}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Payment method icons (emoji-based, clean) ────────────────────────────────
function RazorpayBadges() {
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
      {['💳 Cards', '📱 UPI', '🏦 Netbanking', '👛 Wallets'].map(m => (
        <span key={m} className="text-xs bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full border border-border/50">{m}</span>
      ))}
    </div>
  );
}

// ─── Pre-payment confirmation summary ────────────────────────────────────────
function PrePaymentSummary({
  match, fullName, mobile, seatsCount, seatingType, total, onConfirm, onBack, loading
}: {
  match: Match; fullName: string; mobile: string; seatsCount: number;
  seatingType: string; total: number; onConfirm: () => void; onBack: () => void; loading: boolean;
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-1.5 mb-3">
          <Shield className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">Secure Online Payment</span>
        </div>
        <h3 className="font-display text-xl font-bold text-foreground">Confirm Your Order</h3>
        <p className="text-xs text-muted-foreground mt-1">Review your booking before proceeding to payment</p>
      </div>

      {/* Order summary card */}
      <GlassCard className="p-5 space-y-3">
        <div className="flex items-center gap-2 pb-3 border-b border-border/50">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-base">🏟️</div>
          <div>
            <p className="font-display font-bold text-foreground text-sm">{match.name}</p>
            {match.opponent && <p className="text-xs text-muted-foreground">vs {match.opponent}</p>}
          </div>
        </div>

        {[
          { label: 'Venue', value: match.venue },
          { label: 'Name', value: fullName },
          { label: 'Mobile', value: mobile },
          { label: 'Seats', value: `${seatsCount} × ${seatingType}` },
          { label: 'Payment via', value: '⚡ Razorpay' },
        ].map(row => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium text-foreground">{row.value}</span>
          </div>
        ))}

        <div className="pt-3 border-t border-border/50 flex items-center justify-between">
          <span className="font-display font-bold text-foreground">Total Payable</span>
          <span className="font-display text-2xl font-bold gradient-text">₹{total}</span>
        </div>
      </GlassCard>

      {/* Trust note */}
      <div className="rounded-xl bg-success/5 border border-success/20 px-4 py-3 text-xs text-muted-foreground text-center leading-relaxed">
        ✅ Your passes will be generated <strong className="text-foreground">automatically</strong> after successful payment verification — no screenshot upload required.
      </div>

      {/* Actions */}
      <GlassButton variant="primary" size="lg" className="w-full" loading={loading} onClick={onConfirm}>
        <Zap className="h-4 w-4" /> Pay ₹{total} via Razorpay
      </GlassButton>
      <GlassButton variant="ghost" size="md" className="w-full" onClick={onBack}>← Back</GlassButton>

      {/* Support footer */}
      <div className="text-center space-y-1 pt-1">
        <p className="text-xs text-muted-foreground">Need help? Contact us</p>
        <div className="flex items-center justify-center gap-4 text-xs">
          <a href="tel:7217016170" className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
            <Phone className="h-3 w-3" /> 7217016170
          </a>
          <a href="mailto:dronapalace@gmail.com" className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
            <Mail className="h-3 w-3" /> dronapalace@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Payment generating / processing state ────────────────────────────────────
function PaymentProcessing() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4 animate-fade-in">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
      <div className="text-center">
        <p className="font-display text-lg font-bold text-foreground">Confirming Payment</p>
        <p className="text-sm text-muted-foreground mt-1">Verifying with Razorpay…</p>
      </div>
    </div>
  );
}

// ─── Payment failure / cancel state ──────────────────────────────────────────
function PaymentFailed({
  reason, onRetryRazorpay, onSwitchMethod, loading
}: {
  reason: 'failed' | 'cancelled' | 'pending';
  onRetryRazorpay: () => void;
  onSwitchMethod: () => void;
  loading: boolean;
}) {
  const config = {
    failed:    { icon: <XCircle className="h-10 w-10 text-destructive" />, title: 'Payment Not Completed', desc: 'Your payment could not be processed. Your booking is saved — you can retry safely.' },
    cancelled: { icon: <XCircle className="h-10 w-10 text-muted-foreground" />, title: 'Payment Cancelled', desc: 'You closed the payment window. Your booking is reserved — complete payment when ready.' },
    pending:   { icon: <Clock className="h-10 w-10 text-warning" />, title: "Confirming Your Payment", desc: "This can take a moment. If you already paid, your passes will appear automatically once confirmed." },
  }[reason];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        {config.icon}
        <div>
          <p className="font-display text-lg font-bold text-foreground">{config.title}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{config.desc}</p>
        </div>
      </div>

      {/* Primary: Retry */}
      <GlassButton variant="primary" size="lg" className="w-full" loading={loading} onClick={onRetryRazorpay}>
        <RefreshCw className="h-4 w-4" /> Retry Razorpay Payment
      </GlassButton>

      {/* Secondary options */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onSwitchMethod}
          className="rounded-xl border border-border bg-muted/20 py-3 px-3 text-xs font-semibold text-foreground hover:bg-muted/40 transition-all text-center"
        >
          <Smartphone className="h-4 w-4 mx-auto mb-1 text-success" />
          Pay via UPI QR
        </button>
        <button
          onClick={onSwitchMethod}
          className="rounded-xl border border-border bg-muted/20 py-3 px-3 text-xs font-semibold text-foreground hover:bg-muted/40 transition-all text-center"
        >
          <CreditCard className="h-4 w-4 mx-auto mb-1 text-warning" />
          Pay at Hotel
        </button>
      </div>

      {/* Support */}
      <div className="text-center text-xs text-muted-foreground pt-1">
        Already paid?{' '}
        <a href="tel:7217016170" className="text-primary underline underline-offset-2">Call 7217016170</a>
        {' '}or{' '}
        <a href="mailto:dronapalace@gmail.com" className="text-primary underline underline-offset-2">email us</a>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RegisterPage() {
  const { toast } = useToast();
  const { get: getConfig } = useSiteConfig();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);

  const previewMatchId = new URLSearchParams(window.location.search).get('preview');
  const isPreviewMode = !!previewMatchId;

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const mobileValid = /^\d{10}$/.test(mobile);
  const mobileError = mobile.length > 0 && !mobileValid;
  const nameError = fullName.length > 0 && fullName.trim().length < 2;

  // Eligibility check state
  const [eligibilityStatus, setEligibilityStatus] = useState<'idle' | 'checking' | 'eligible' | 'standard'>('idle');


  // Step 2
  const [seatsCount, setSeatsCount] = useState(1);
  const [seatingType, setSeatingType] = useState<'regular' | 'family'>('regular');
  const [priceQuote, setPriceQuote] = useState<PriceQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Step 3 — payment state machine
  type PaymentState = 'select_method' | 'razorpay_summary' | 'razorpay_processing' | 'razorpay_failed' | 'razorpay_cancelled' | 'razorpay_pending' | 'upi_qr';
  const [paymentState, setPaymentState] = useState<PaymentState>('select_method');
  const [paymentMethod, setPaymentMethod] = useState<'pay_at_hotel' | 'upi_qr' | 'razorpay'>('razorpay');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null);
  const [razorpayKeyId, setRazorpayKeyId] = useState<string | null>(null);
  const [razorpayAmount, setRazorpayAmount] = useState<number>(0);
  const [razorpayCurrency, setRazorpayCurrency] = useState('INR');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [razorpayLoading, setRazorpayLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 4
  const [tickets, setTickets] = useState<any[]>([]);
  const [paymentVerifiedAt, setPaymentVerifiedAt] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveMatch();
    setTimeout(() => nameRef.current?.focus(), 300);
  }, []);

  // Debounced eligibility check when mobile is valid
  useEffect(() => {
    if (!mobileValid) {
      setEligibilityStatus('idle');
      return;
    }
    setEligibilityStatus('checking');
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('semifinal_eligibility')
        .select('id')
        .eq('mobile', mobile)
        .maybeSingle();
      setEligibilityStatus(data ? 'eligible' : 'standard');
    }, 400);
    return () => clearTimeout(timer);
  }, [mobile, mobileValid]);


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
      const { data: assets } = await supabase.from('match_assets').select('*').eq('match_id', data.id).eq('asset_type', 'banner_image').single();
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

  const handleCreateOrder = async (overrideMethod?: string) => {
    if (!activeMatch || !priceQuote) return null;
    setLoading(true);
    try {
      const method = overrideMethod || paymentMethod;
      const { data, error } = await supabase.functions.invoke('create-order', {
        body: {
          match_id: activeMatch.id,
          purchaser_full_name: fullName,
          purchaser_mobile: mobile,
          purchaser_email: email || null,
          seating_type: seatingType,
          seats_count: seatsCount,
          payment_method: method,
          pricing_snapshot: priceQuote,
        }
      });
      if (error) throw error;
      setOrderId(data.order_id);
      if (method === 'pay_at_hotel') {
        setTickets(data.tickets || []);
        setStep(3);
      }
      setLoading(false);
      return data.order_id as string;
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Order failed', description: e.message });
      setLoading(false);
      return null;
    }
  };

  const openRazorpayCheckout = async (internalOrderId: string, rzpOrderId: string, keyId: string, amount: number, currency: string) => {
    const loaded = await loadRazorpayScript();
    if (!loaded) throw new Error('Payment gateway failed to load. Please try again.');

    setPaymentState('razorpay_processing');

    const options = {
      key: keyId,
      amount,
      currency,
      name: getConfig('register_header_venue', 'Hotel Drona Palace'),
      description: `T20 Fan Night — ${activeMatch?.name}`,
      order_id: rzpOrderId,
      prefill: { name: fullName, contact: `+91${mobile}`, email: email || undefined },
      theme: { color: '#e8423c' },
      handler: async (response: any) => {
        try {
          const { data: verifyData, error: verifyErr } = await supabase.functions.invoke('razorpay-verify-payment', {
            body: {
              order_id: internalOrderId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }
          });
          if (verifyErr || !verifyData?.verified) {
            setPaymentState('razorpay_failed');
            setRazorpayLoading(false);
            return;
          }
          setTickets(verifyData.tickets || []);
          setPaymentVerifiedAt(new Date().toISOString());
          setStep(3);
          toast({ title: '✅ Payment Confirmed!', description: 'Your passes are ready.' });
        } catch (e: any) {
          setPaymentState('razorpay_failed');
          setRazorpayLoading(false);
        }
      },
      modal: {
        ondismiss: () => {
          setPaymentState('razorpay_cancelled');
          setRazorpayLoading(false);
        }
      }
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const handleRazorpayPayment = async () => {
    if (!activeMatch || !priceQuote) return;
    setRazorpayLoading(true);
    try {
      let currentOrderId = orderId;
      if (!currentOrderId) {
        currentOrderId = await handleCreateOrder('razorpay');
        if (!currentOrderId) { setRazorpayLoading(false); return; }
      }

      let currentRzpOrderId = razorpayOrderId;
      let keyId = razorpayKeyId;
      let amount = razorpayAmount || priceQuote.total * 100;
      let currency = razorpayCurrency;

      if (!currentRzpOrderId) {
        const { data: rzpData, error: rzpErr } = await supabase.functions.invoke('razorpay-create-order', {
          body: { order_id: currentOrderId, amount_paise: priceQuote.total * 100, currency: 'INR', receipt: `order_${currentOrderId.slice(0, 12)}` }
        });
        if (rzpErr || !rzpData?.razorpay_order_id) throw new Error(rzpErr?.message || 'Failed to create payment order');
        currentRzpOrderId = rzpData.razorpay_order_id;
        keyId = rzpData.key_id;
        amount = rzpData.amount;
        currency = rzpData.currency;
        setRazorpayOrderId(currentRzpOrderId);
        setRazorpayKeyId(keyId);
        setRazorpayAmount(amount);
        setRazorpayCurrency(currency);
      }

      await openRazorpayCheckout(currentOrderId, currentRzpOrderId!, keyId!, amount, currency);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Payment failed', description: e.message });
      setPaymentState('razorpay_failed');
      setRazorpayLoading(false);
    }
  };

  const handleSwitchPaymentMethod = () => {
    // Reset Razorpay state but keep orderId so we don't recreate it
    setPaymentState('select_method');
    setPaymentMethod('upi_qr');
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
      const { data, error } = await supabase.functions.invoke('verify-payment-proof', { body: formData });
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

  const payeeVpa = getConfig('payment_vpa', 'paytmqr5oka4x@ptys');
  const payeeName = getConfig('payment_payee_name', 'Hotel Drona Palace');
  const upiQRValue = priceQuote && activeMatch
    ? `upi://pay?pa=${payeeVpa}&pn=${encodeURIComponent(payeeName)}&am=${priceQuote.total}&cu=INR&tn=${encodeURIComponent(`${fullName}_${seatsCount}_${mobile}`)}`
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

      {isPreviewMode && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-warning/90 text-warning-foreground text-sm font-semibold py-2 px-4 backdrop-blur-sm">
          ⚠️ PREVIEW MODE — This page is not live. Changes are not saved.
        </div>
      )}

      <div className="disclaimer-bar text-center text-xs py-2 px-4 relative z-10">
        {getConfig('disclaimer_bar_text', '🎯 Fun Guess Game only — entertainment. No betting. Event fees are for hospitality only.')}
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-5">
        {/* Back to Home */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
        </Link>
        {/* Header */}
        <div className="text-center mb-5">
          <div className="flex flex-col items-center mb-3 gap-1.5">
            <div className="w-14 h-14 flex items-center justify-center rounded-full bg-[hsl(38_60%_10%)] shadow-[0_0_20px_hsl(38_75%_52%/0.65),0_0_40px_hsl(38_75%_52%/0.25)]" style={{border:'2px solid hsl(38 75% 52% / 0.55)'}}>
              <img src={hotelLogo} alt="Hotel Drona Palace" className="w-9 h-9 object-contain drop-shadow-[0_0_6px_hsl(38_75%_52%/0.8)]" />
            </div>
            <div>
              <p className="font-display text-sm font-bold text-secondary leading-tight">Hotel Drona Palace</p>
              <p className="text-xs text-muted-foreground">A Unit of SR Leisure Inn</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-3xl">🏏</span>
            <h1 className="font-display text-3xl font-bold gradient-text">{getConfig('register_header_title', 'T20 Fan Night')}</h1>
          </div>
        </div>

        {bannerUrl && (
          <div className="mb-4 rounded-xl overflow-hidden">
            <img src={bannerUrl} alt="Match Banner" className="w-full h-40 object-cover" />
          </div>
        )}

        <GlassCard className="p-4 mb-5 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-xl flex-shrink-0">🏟️</div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">{activeMatch.name}</h2>
              {activeMatch.opponent && <p className="text-sm text-muted-foreground">vs {activeMatch.opponent}</p>}
            </div>
          </div>
          {activeMatch.start_time && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {activeMatch.venue} · {new Date(activeMatch.start_time).toLocaleString('en-IN')}
            </div>
          )}
        </GlassCard>

        <StepBar step={step} />

        {/* ─── Step 0: Personal Details ─── */}
        {step === 0 && (
          <GlassCard className="p-6 animate-fade-in" glow>
            <div className="flex items-center justify-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-full step-active flex items-center justify-center text-sm font-bold text-primary-foreground">①</div>
              <h3 className="font-display text-xl font-bold text-foreground">Your Details</h3>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-foreground mb-1.5 block text-center">Full Name *</Label>
                <Input ref={nameRef} className={`glass-input ${nameError ? 'border-destructive' : ''}`}
                  placeholder="Enter your full name" value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" />
                {nameError && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Please enter your full name</p>}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-foreground w-full text-center">Mobile Number *</Label>
                  <span className={`text-xs font-mono ${mobileValid ? 'text-success' : 'text-muted-foreground'}`}>{mobile.length}/10</span>
                </div>
                <Input className={`glass-input ${mobileError ? 'border-destructive' : mobileValid ? 'border-success/50' : ''}`}
                  placeholder="10-digit mobile number" value={mobile}
                  onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  inputMode="numeric" type="tel" autoComplete="tel" />
                {mobileError && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Enter a valid 10-digit number</p>}
                {mobileValid && <p className="text-xs text-success mt-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Valid mobile number</p>}
                {/* Eligibility badge */}
                {eligibilityStatus === 'checking' && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/40 text-xs text-muted-foreground animate-pulse">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking eligibility…
                  </div>
                )}
                {eligibilityStatus === 'eligible' && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/30 text-xs text-success font-semibold">
                    <Star className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Semifinal attendee — you qualify for <strong>₹949/seat</strong> 🎉</span>
                  </div>
                )}
                {eligibilityStatus === 'standard' && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20 border border-border/30 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Standard pricing — <strong className="text-foreground">₹999/seat</strong></span>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-foreground mb-1.5 block text-center">Email (optional)</Label>
                <Input className="glass-input" placeholder="your@email.com" type="email"
                  value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                By continuing, you agree to our{' '}
                <Link to="/terms" target="_blank" className="text-primary underline underline-offset-2 hover:text-primary/80">Event Terms & Conditions</Link>
              </p>
              <GlassButton variant="primary" size="lg" className="w-full mt-2" onClick={handleStep1} disabled={!fullName.trim() || !mobileValid}>
                Continue <ChevronRight className="h-4 w-4" />
              </GlassButton>
            </div>
          </GlassCard>
        )}

        {/* ─── Step 1: Seats & Pricing ─── */}
        {step === 1 && (
          <GlassCard className="p-6 animate-fade-in" glow>
            <div className="flex items-center justify-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-full step-active flex items-center justify-center text-sm font-bold text-primary-foreground">②</div>
              <h3 className="font-display text-xl font-bold text-foreground">Seats & Pricing</h3>
            </div>
            <div className="space-y-5">
              <div>
                <Label className="text-foreground mb-3 block text-sm font-semibold text-center">Number of Seats</Label>
                <div className="flex items-center gap-4">
                  <button onClick={() => setSeatsCount(Math.max(1, seatsCount - 1))}
                    className="w-12 h-12 rounded-xl border-2 border-border bg-muted/30 text-foreground text-xl font-bold flex items-center justify-center hover:border-primary/50 hover:bg-primary/10 active:scale-95 transition-all">−</button>
                  <span className="font-display text-3xl font-bold text-foreground w-12 text-center tabular-nums">{seatsCount}</span>
                  <button onClick={() => setSeatsCount(Math.min(10, seatsCount + 1))}
                    className="w-12 h-12 rounded-xl border-2 border-border bg-muted/30 text-foreground text-xl font-bold flex items-center justify-center hover:border-primary/50 hover:bg-primary/10 active:scale-95 transition-all">+</button>
                  <span className="text-sm text-muted-foreground">seat{seatsCount > 1 ? 's' : ''}</span>
                </div>
              </div>
              <div>
                <Label className="text-foreground mb-3 block text-sm font-semibold text-center">Seating Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(['regular', 'family'] as const).map(type => (
                    <button key={type} onClick={() => setSeatingType(type)}
                      className={`p-4 rounded-xl border-2 text-sm font-semibold transition-all active:scale-95 ${
                        seatingType === type ? 'border-primary bg-primary/15 text-primary shadow-glow-primary' : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/40'
                      }`}>
                      <div className="text-2xl mb-1">{type === 'regular' ? '🪑' : '👨‍👩‍👧'}</div>
                      <div>{type === 'regular' ? 'Regular' : 'Family'}</div>
                    </button>
                  ))}
                </div>
              </div>
              {quoteLoading ? (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Getting price…</span>
                </div>
              ) : priceQuote ? (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Price Breakdown</p>
                  {priceQuote.seats.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Seat {i + 1}
                        {s.reason !== 'new_customer' && <span className="ml-1 text-xs text-success font-medium">({s.reason.replace(/_/g, ' ')})</span>}
                      </span>
                      <span className="font-semibold text-foreground">₹{s.price}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                    <span className="font-display font-bold text-foreground">Total</span>
                    <span className="font-display text-2xl font-bold gradient-text">₹{priceQuote.total}</span>
                  </div>
                </div>
              ) : null}
              <div className="flex gap-3 pt-1">
                <GlassButton variant="ghost" size="md" className="flex-1 h-12" onClick={() => setStep(0)}>Back</GlassButton>
                <GlassButton variant="primary" size="lg" className="flex-1" onClick={handleStep2} disabled={!priceQuote}>
                  Continue <ChevronRight className="h-4 w-4" />
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        )}

        {/* ─── Step 2: Payment ─── */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">

            {/* Pre-payment summary before opening Razorpay */}
            {paymentState === 'razorpay_summary' && priceQuote && (
              <GlassCard className="p-6" glow>
                <PrePaymentSummary
                  match={activeMatch}
                  fullName={fullName} mobile={mobile}
                  seatsCount={seatsCount} seatingType={seatingType}
                  total={priceQuote.total}
                  onConfirm={handleRazorpayPayment}
                  onBack={() => setPaymentState('select_method')}
                  loading={razorpayLoading}
                />
              </GlassCard>
            )}

            {/* Razorpay processing */}
            {paymentState === 'razorpay_processing' && (
              <GlassCard className="p-6" glow>
                <PaymentProcessing />
              </GlassCard>
            )}

            {/* Payment failed / cancelled / pending */}
            {(paymentState === 'razorpay_failed' || paymentState === 'razorpay_cancelled' || paymentState === 'razorpay_pending') && (
              <GlassCard className="p-6" glow>
                <PaymentFailed
                  reason={paymentState === 'razorpay_failed' ? 'failed' : paymentState === 'razorpay_pending' ? 'pending' : 'cancelled'}
                  onRetryRazorpay={handleRazorpayPayment}
                  onSwitchMethod={handleSwitchPaymentMethod}
                  loading={razorpayLoading}
                />
              </GlassCard>
            )}

            {/* UPI QR flow */}
            {paymentState === 'upi_qr' && orderId && (
              <GlassCard className="p-6" glow>
                <div className="space-y-5">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-3">Scan to pay <span className="font-bold gradient-text">₹{priceQuote?.total}</span></p>
                    <div className="qr-container mx-auto w-fit" style={{ padding: 16 }}>
                      <QRCodeSVG value={upiQRValue} size={200} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">UPI: {payeeVpa}</p>
                    <p className="text-xs text-muted-foreground">Remark: <span className="text-primary">{fullName}_{seatsCount}_{mobile}</span></p>
                  </div>
                  <div className="border-t border-border pt-5">
                    <Label className="text-foreground mb-2 block font-semibold text-center">Upload Payment Screenshot</Label>
                    <p className="text-xs text-muted-foreground mb-3 text-center">Upload your UPI payment screenshot for instant AI verification</p>
                    {verifyLoading ? (
                      <div className="flex items-center justify-center gap-2 py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Verifying with AI...</span>
                      </div>
                    ) : verifyResult ? (
                      <div className={`rounded-lg p-4 border ${
                        verifyResult.verdict === 'verified' ? 'bg-success/10 border-success/30' :
                        verifyResult.verdict === 'rejected' ? 'bg-destructive/10 border-destructive/30' : 'bg-warning/10 border-warning/30'
                      }`}>
                        <p className="font-medium text-sm">
                          {verifyResult.verdict === 'verified' ? '✅ Payment Verified' :
                           verifyResult.verdict === 'rejected' ? '❌ Payment Rejected' : '⏳ Manual Review Required'}
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
              </GlassCard>
            )}

            {/* Main payment method selector */}
            {paymentState === 'select_method' && (
              <GlassCard className="p-6" glow>
                <div className="flex items-center justify-center gap-2 mb-5">
                  <div className="w-7 h-7 rounded-full step-active flex items-center justify-center text-sm font-bold text-primary-foreground">③</div>
                  <h3 className="font-display text-xl font-bold text-foreground">Payment</h3>
                </div>

                {/* Total amount — prominent */}
                <div className="text-center mb-5 py-3 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Amount</p>
                  <p className="font-display text-4xl font-bold gradient-text">₹{priceQuote?.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">{seatsCount} seat{seatsCount > 1 ? 's' : ''} · {seatingType}</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-foreground block text-center text-sm">Choose Payment Method</Label>

                  {/* ── Razorpay — Premium option ── */}
                  <button
                    onClick={() => setPaymentMethod('razorpay')}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all relative overflow-hidden ${
                      paymentMethod === 'razorpay' ? 'border-primary bg-primary/10 shadow-glow-primary' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    {paymentMethod === 'razorpay' && (
                      <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-bl-lg">Recommended</div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${paymentMethod === 'razorpay' ? 'bg-primary/20' : 'bg-muted/40'}`}>
                        <Zap className={`h-5 w-5 ${paymentMethod === 'razorpay' ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-display font-bold text-base ${paymentMethod === 'razorpay' ? 'text-primary' : 'text-foreground'}`}>Pay via Razorpay</span>
                          <span className="text-xs bg-success/15 text-success px-2 py-0.5 rounded-full font-semibold border border-success/20">Instant Confirmation</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">No screenshot upload • Passes generated automatically</p>
                        <RazorpayBadges />
                        <div className="flex items-center gap-1 mt-1.5">
                          <Shield className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Powered by Razorpay · 256-bit SSL</span>
                        </div>
                      </div>
                      {paymentMethod === 'razorpay' && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />}
                    </div>
                  </button>

                  {/* ── UPI QR ── */}
                  <button
                    onClick={() => setPaymentMethod('upi_qr')}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'upi_qr' ? 'border-success bg-success/10' : 'border-border hover:border-success/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${paymentMethod === 'upi_qr' ? 'bg-success/20' : 'bg-muted/40'}`}>
                        <Smartphone className={`h-5 w-5 ${paymentMethod === 'upi_qr' ? 'text-success' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <span className={`font-display font-bold text-base ${paymentMethod === 'upi_qr' ? 'text-success' : 'text-foreground'}`}>Pay via UPI / QR</span>
                        <p className="text-xs text-muted-foreground mt-0.5">Scan QR code & upload screenshot — AI verification</p>
                      </div>
                      {paymentMethod === 'upi_qr' && <CheckCircle2 className="h-5 w-5 text-success ml-auto flex-shrink-0" />}
                    </div>
                  </button>

                  {/* ── Pay at Hotel ── */}
                  <button
                    onClick={() => setPaymentMethod('pay_at_hotel')}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'pay_at_hotel' ? 'border-warning bg-warning/10' : 'border-border hover:border-warning/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${paymentMethod === 'pay_at_hotel' ? 'bg-warning/20' : 'bg-muted/40'}`}>
                        <CreditCard className={`h-5 w-5 ${paymentMethod === 'pay_at_hotel' ? 'text-warning' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <span className={`font-display font-bold text-base ${paymentMethod === 'pay_at_hotel' ? 'text-warning' : 'text-foreground'}`}>Pay at Hotel</span>
                        <p className="text-xs text-muted-foreground mt-0.5">Book now — pay cash or UPI at the venue on arrival</p>
                      </div>
                      {paymentMethod === 'pay_at_hotel' && <CheckCircle2 className="h-5 w-5 text-warning ml-auto flex-shrink-0" />}
                    </div>
                  </button>

                  {paymentMethod === 'pay_at_hotel' && (
                    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning flex items-start gap-2">
                      <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>Passes marked <strong>Unpaid</strong>. Pay the full amount at the venue before entry.</span>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1 pt-1">
                    <Star className="h-3 w-3" />
                    All fees are for event hospitality only. The Fun Guess Game is free to play.
                  </p>

                  <div className="flex gap-3 pt-1">
                    <GlassButton variant="ghost" size="md" className="flex-1 h-12" onClick={() => setStep(1)}>Back</GlassButton>
                    {paymentMethod === 'razorpay' ? (
                      <GlassButton variant="primary" size="lg" className="flex-1" onClick={() => setPaymentState('razorpay_summary')}>
                        <ArrowRight className="h-4 w-4" /> Review & Pay
                      </GlassButton>
                    ) : (
                      <GlassButton variant="primary" size="lg" className="flex-1" loading={loading}
                        onClick={async () => {
                          if (paymentMethod === 'upi_qr') {
                            const newOrderId = await handleCreateOrder('upi_qr');
                            if (newOrderId) setPaymentState('upi_qr');
                          } else {
                            handleCreateOrder();
                          }
                        }}>
                        {paymentMethod === 'pay_at_hotel' ? 'Get My Tickets' : 'Proceed to Pay'} <ChevronRight className="h-4 w-4" />
                      </GlassButton>
                    )}
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        )}

        {/* ─── Step 3: Tickets ─── */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            {/* Success banner */}
            <div className="rounded-xl p-5 text-center border-2 border-success/50 bg-success/10 animate-pulse-glow">
              <div className="text-5xl mb-2">🎟️</div>
              <h3 className="font-display text-2xl font-bold text-success">
                {paymentMethod === 'pay_at_hotel' ? 'Booking Confirmed!' : 'Payment Confirmed!'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {paymentMethod === 'pay_at_hotel'
                  ? 'Pay the full amount at the venue on arrival'
                  : 'Your passes are ready — show QR at the gate'}
              </p>
              {paymentMethod === 'razorpay' && paymentVerifiedAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  ✅ Verified at {new Date(paymentVerifiedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>

            {tickets.map((ticket, i) => (
              <GlassCard key={ticket.id} className="seat-pass p-5">
                {/* Payment status banner */}
                <div className={`-mt-5 -mx-5 mb-4 px-5 py-3 flex items-center justify-center gap-2 font-display text-sm font-bold tracking-wide ${
                  paymentMethod === 'pay_at_hotel'
                    ? 'bg-warning/20 border-b border-warning/30 text-warning'
                    : 'bg-success/20 border-b border-success/30 text-success'
                }`}>
                  {paymentMethod === 'pay_at_hotel'
                    ? '⚠️ UNPAID — Pay at Hotel on Arrival'
                    : paymentMethod === 'razorpay'
                    ? '✅ PAID via Razorpay — Entry Confirmed'
                    : '✅ PAID — Entry Confirmed'}
                </div>

                <div className="flex items-start justify-between mb-4">
                  <div className="text-center flex-1">
                    <p className="font-display text-lg font-bold text-foreground">{fullName}</p>
                    <p className="text-sm text-muted-foreground">{activeMatch?.name}</p>
                    <p className="text-xs text-muted-foreground">{activeMatch?.venue}</p>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">SEAT</div>
                    <div className="font-display text-3xl font-bold gradient-text">
                      {i + 1} <span className="text-base text-muted-foreground">of {tickets.length}</span>
                    </div>
                  </div>
                </div>

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

            {/* Support footer on ticket page */}
            <div className="rounded-xl bg-muted/20 border border-border p-4 text-center space-y-2">
              <p className="text-xs font-semibold text-foreground">Need Help?</p>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <a href="tel:7217016170" className="flex items-center gap-1 hover:text-primary transition-colors"><Phone className="h-3 w-3" /> 7217016170</a>
                <a href="mailto:dronapalace@gmail.com" className="flex items-center gap-1 hover:text-primary transition-colors"><Mail className="h-3 w-3" /> dronapalace@gmail.com</a>
              </div>
              <p className="text-xs text-muted-foreground">Also accessible at{' '}
                <Link to="/ticket" className="text-primary underline">/ticket</Link> using your mobile ·{' '}
                <Link to="/terms" target="_blank" className="text-muted-foreground underline">Event Terms</Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
