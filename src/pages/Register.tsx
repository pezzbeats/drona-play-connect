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
  CheckCircle2, ChevronRight, CreditCard, Smartphone,
  Upload, Loader2, AlertCircle, Star, Info, Zap, Shield, RefreshCw,
  Phone, Mail, ArrowRight, XCircle, Clock, ArrowLeft, Share2, MessageCircle, MapPin
} from 'lucide-react';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import hotelLogo from '@/assets/hotel-logo.png';

// ── Ticket data shape used by pass renderer ────────────────────────────────
interface TicketData {
  id: string;
  seat_index: number;
  qr_text: string;
  status: string;
  issued_at: string;
  order: {
    purchaser_full_name: string;
    purchaser_mobile: string;
    payment_status: string;
    seats_count: number;
    total_amount: number;
    seating_type: string;
    advance_paid: number;
    match: {
      name: string;
      venue: string;
      start_time: string | null;
      opponent: string | null;
    };
  };
}

function isPaid(status: string) {
  return ['paid_verified', 'paid_manual_verified'].includes(status);
}

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
  is_semifinal_eligible?: boolean;
  loyalty_seat_cap?: number;
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
            <span className={`text-[10px] font-medium text-center leading-tight truncate w-full ${i === step ? 'text-primary' : 'text-muted-foreground'}`}>{s}</span>
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
  match, fullName, mobile, seatsCount, seatingType, total, onConfirm, onBack, loading,
  eligibilityStatus, priceQuote,
}: {
  match: Match; fullName: string; mobile: string; seatsCount: number;
  seatingType: string; total: number; onConfirm: () => void; onBack: () => void; loading: boolean;
  eligibilityStatus?: 'idle' | 'checking' | 'eligible' | 'standard';
  priceQuote?: { seats: Array<{ seat_index: number; price: number; reason: string }>; total: number } | null;
}) {
  const reasonLabel = (reason: string) => {
    if (reason === 'semifinal_attendee' || reason === 'loyal_base') return '⭐ Special rate';
    return 'Standard rate';
  };

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

      {/* Eligibility banner */}
      {eligibilityStatus === 'eligible' && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-success/10 border border-success/30">
          <Star className="h-4 w-4 text-success flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-success">Semifinal Attendee Discount Applied</p>
            <p className="text-xs text-muted-foreground mt-0.5">Your eligible seats are priced at the special ₹949 rate.</p>
          </div>
        </div>
      )}
      {eligibilityStatus === 'standard' && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-muted/20 border border-border/30">
          <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">Standard pricing — ₹999/seat</p>
        </div>
      )}

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
          { label: 'Payment via', value: '⚡ Razorpay' },
        ].map(row => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium text-foreground">{row.value}</span>
          </div>
        ))}

        {/* Per-seat breakdown */}
        <div className="pt-1">
          <p className="text-xs text-muted-foreground mb-2">Seats ({seatingType})</p>
          <div className="space-y-1.5">
            {priceQuote?.seats.map((seat) => (
              <div key={seat.seat_index} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  Seat {seat.seat_index + 1}
                  {(seat.reason === 'semifinal_attendee' || seat.reason === 'loyal_base') && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-success/15 text-success border border-success/20 font-semibold">
                      ⭐ Special
                    </span>
                  )}
                </span>
                <span className="font-semibold text-foreground">₹{seat.price}</span>
              </div>
            )) ?? (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{seatsCount} × {seatingType}</span>
              </div>
            )}
          </div>
        </div>

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
  const [emailError, setEmailError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const mobileValid = /^\d{10}$/.test(mobile);
  const mobileError = mobile.length > 0 && !mobileValid;
  const nameError = fullName.length > 0 && fullName.trim().length < 2;
  const isEmailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

  // Eligibility check state
  const [eligibilityStatus, setEligibilityStatus] = useState<'idle' | 'checking' | 'eligible' | 'standard'>('idle');
  const [eligibleSeats, setEligibleSeats] = useState<number>(0);


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

  // Auto-download full pass PNGs when step 3 loads (staggered to avoid browser blocking)
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null);
  useEffect(() => {
    if (step !== 3 || tickets.length === 0 || !activeMatch) return;
    let cancelled = false;
    setDownloadProgress({ done: 0, total: tickets.length });
    const run = async () => {
      await new Promise(r => setTimeout(r, 800));
      for (let i = 0; i < tickets.length; i++) {
        if (cancelled) return;
        const ticket = tickets[i];
        const shaped = buildTicketShape(ticket);
        try {
          const canvas = await buildPassCanvas(shaped);
          await new Promise<void>((resolve) => {
            canvas.toBlob((blob) => {
              if (!blob) { resolve(); return; }
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `pass-seat-${ticket.seat_index + 1}.png`;
              a.click();
              setTimeout(() => { URL.revokeObjectURL(url); resolve(); }, 2000);
            });
          });
          setDownloadProgress({ done: i + 1, total: tickets.length });
          // Stagger each download by 350ms so the browser doesn't block them
          if (tickets.length > 1) await new Promise(r => setTimeout(r, 350));
        } catch { /* silent */ }
      }
      if (!cancelled) setDownloadProgress(null);
    };
    run();
    return () => { cancelled = true; };
  }, [step, tickets]);

  useEffect(() => {
    fetchActiveMatch();
    setTimeout(() => nameRef.current?.focus(), 300);
  }, []);

  // Debounced eligibility check when mobile is valid
  useEffect(() => {
    if (!mobileValid) {
      setEligibilityStatus('idle');
      setEligibleSeats(0);
      return;
    }
    setEligibilityStatus('checking');
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('semifinal_eligibility')
        .select('id, eligible_seats')
        .eq('mobile', mobile)
        .maybeSingle();
      setEligibilityStatus(data ? 'eligible' : 'standard');
      setEligibleSeats(data?.eligible_seats ?? 0);
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
      // Supabase SDK wraps non-200 in FunctionsHttpError with generic "non-2xx" message.
      // Our function now always returns 200 — check data.success instead.
      if (error) {
        // Still handle network-level errors
        throw new Error(error.message || 'Network error calling create-order');
      }
      if (!data?.success) {
        throw new Error(data?.error || 'Order creation failed');
      }
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

  // ── Pass canvas helpers ───────────────────────────────────────────────────
  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  /** Build a TicketData-compatible shape from local Register state */
  const buildTicketShape = (ticket: any): TicketData => {
    // Map payment method to the correct status for pass banner colour:
    // razorpay → paid_verified (green), upi_qr → paid_manual_verified (green),
    // pay_at_hotel → unpaid (amber)
    const paymentStatus =
      paymentMethod === 'razorpay' ? 'paid_verified' :
      paymentMethod === 'pay_at_hotel' ? 'unpaid' :
      'paid_manual_verified';
    return {
      id: ticket.id,
      seat_index: ticket.seat_index,
      qr_text: ticket.qr_text,
      status: ticket.status ?? 'active',
      issued_at: ticket.issued_at ?? new Date().toISOString(),
      order: {
        purchaser_full_name: fullName,
        purchaser_mobile: mobile,
        payment_status: paymentStatus,
        seats_count: seatsCount,
        total_amount: priceQuote?.total ?? 0,
        seating_type: seatingType,
        advance_paid: 0,
        match: {
          name: activeMatch!.name,
          venue: activeMatch!.venue,
          start_time: activeMatch!.start_time ?? null,
          opponent: activeMatch!.opponent ?? null,
        },
      },
    };
  };

  const buildPassCanvas = async (ticket: TicketData): Promise<HTMLCanvasElement> => {
    const order = ticket.order as any;
    const match = order?.match;
    const paidStatus = isPaid(order?.payment_status);
    const balanceDue = Math.max(0, (order?.total_amount ?? 0) - (order?.advance_paid ?? 0));
    const hasBalance = !paidStatus && balanceDue > 0;
    const isPartiallyPaid = (order?.advance_paid ?? 0) > 0 && !paidStatus;

    const W = 750;
    const BANNER_H = 52;
    const BODY_TOP = BANNER_H;
    const PAD = 40;
    const QR_SIZE = 260;
    const FOOTER_H = 72;

    let contentH = 0;
    contentH += 20;
    contentH += 30;
    contentH += 26;
    contentH += 22;
    contentH += 22;
    contentH += 22;
    if (hasBalance) contentH += 36;
    contentH += 24;
    contentH += 1;
    contentH += 28;
    contentH += QR_SIZE + 28 + 2;
    contentH += 30;
    contentH += 26;
    contentH += 32;
    const H = BANNER_H + contentH + FOOTER_H;

    const DPR = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(DPR, DPR);

    roundRect(ctx, 0, 0, W, H, 20);
    ctx.fillStyle = '#17100a';
    ctx.fill();

    roundRect(ctx, 0.5, 0.5, W - 1, H - 1, 20);
    ctx.strokeStyle = paidStatus ? 'hsla(142,60%,35%,0.5)' : 'hsla(38,60%,35%,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const bannerGrad = ctx.createLinearGradient(0, 0, W, 0);
    if (paidStatus) {
      bannerGrad.addColorStop(0, 'hsl(142,60%,22%)');
      bannerGrad.addColorStop(1, 'hsl(142,50%,28%)');
    } else {
      bannerGrad.addColorStop(0, 'hsl(38,80%,28%)');
      bannerGrad.addColorStop(1, 'hsl(38,70%,34%)');
    }
    ctx.save();
    roundRect(ctx, 0, 0, W, BANNER_H, 20);
    ctx.clip();
    ctx.fillStyle = bannerGrad as any;
    ctx.fillRect(0, 0, W, BANNER_H);
    ctx.restore();
    ctx.strokeStyle = paidStatus ? 'hsla(142,60%,40%,0.6)' : 'hsla(38,80%,45%,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, BANNER_H); ctx.lineTo(W, BANNER_H); ctx.stroke();

    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = paidStatus ? 'hsl(142,80%,80%)' : 'hsl(38,90%,85%)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const bannerText = paidStatus
      ? '☑  PAID — Entry Confirmed'
      : isPartiallyPaid
        ? '⚠  ADVANCE PAID — Balance Due at Entry'
        : '⚠  UNPAID — Pay at Hotel on Arrival';
    ctx.fillText(bannerText, W / 2, BANNER_H / 2 + 1);

    let y = BODY_TOP + 28;
    const leftX = PAD;
    const rightX = W - PAD;
    const seatBadgeW = 120;
    const textRightBound = rightX - seatBadgeW - 16;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(38,90%,88%)';
    ctx.fillText(order?.purchaser_full_name ?? '', leftX, y, textRightBound - leftX);
    y += 36;

    ctx.font = '500 20px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(38,60%,65%)';
    const matchTitle = `${match?.name ?? ''}${match?.opponent ? ` vs ${match.opponent}` : ''}`;
    ctx.fillText(matchTitle, leftX, y, textRightBound - leftX);
    y += 26;

    if (match?.start_time) {
      ctx.font = '400 17px system-ui, sans-serif';
      ctx.fillStyle = 'hsl(38,40%,55%)';
      ctx.fillText(new Date(match.start_time).toLocaleString('en-IN'), leftX, y);
      y += 24;
    }

    ctx.font = '400 17px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(38,40%,55%)';
    ctx.fillText(match?.venue ?? '', leftX, y);
    y += 24;

    if (order?.seating_type) {
      const sType = order.seating_type.charAt(0).toUpperCase() + order.seating_type.slice(1);
      ctx.font = '600 17px system-ui, sans-serif';
      ctx.fillStyle = 'hsl(38,80%,65%)';
      ctx.fillText(`${sType} Seating`, leftX, y);
      y += 24;
    }

    if (hasBalance) {
      const pillText = `⚠  Balance Due: ₹${balanceDue}${isPartiallyPaid ? `  (Adv: ₹${order?.advance_paid})` : ''}`;
      ctx.font = 'bold 15px system-ui, sans-serif';
      const pillW = ctx.measureText(pillText).width + 28;
      const pillH = 30;
      const pillY = y;
      roundRect(ctx, leftX, pillY, pillW, pillH, 15);
      ctx.fillStyle = 'hsla(38,80%,45%,0.18)';
      ctx.fill();
      roundRect(ctx, leftX, pillY, pillW, pillH, 15);
      ctx.strokeStyle = 'hsla(38,80%,50%,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'hsl(38,90%,72%)';
      ctx.textBaseline = 'middle';
      ctx.fillText(pillText, leftX + 14, pillY + pillH / 2);
      ctx.textBaseline = 'top';
      y += 42;
    }

    const seatTopY = BODY_TOP + 28;
    ctx.textAlign = 'center';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(38,50%,50%)';
    ctx.textBaseline = 'top';
    ctx.fillText('SEAT', rightX - seatBadgeW / 2, seatTopY);

    const seatNumGrad = ctx.createLinearGradient(rightX - seatBadgeW, seatTopY + 18, rightX, seatTopY + 90);
    seatNumGrad.addColorStop(0, 'hsl(38,95%,65%)');
    seatNumGrad.addColorStop(1, 'hsl(38,80%,50%)');
    ctx.font = 'bold 80px system-ui, sans-serif';
    ctx.fillStyle = seatNumGrad as any;
    ctx.textBaseline = 'top';
    ctx.fillText(String(ticket.seat_index + 1), rightX - seatBadgeW / 2, seatTopY + 18);

    ctx.font = '400 15px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(38,40%,50%)';
    ctx.fillText(`of ${order?.seats_count}`, rightX - seatBadgeW / 2, seatTopY + 108);
    ctx.textAlign = 'left';

    y += 8;
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'hsl(38,30%,25%)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
    ctx.restore();
    y += 28;

    const qrCanvas = document.getElementById(`qr-canvas-${ticket.id}`) as HTMLCanvasElement | null;
    if (qrCanvas) {
      const qrBoxPad = 14;
      const qrBoxSize = QR_SIZE + qrBoxPad * 2;
      const qrBoxX = (W - qrBoxSize) / 2;
      const qrBoxY = y;
      ctx.save();
      roundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 14);
      ctx.shadowColor = paidStatus ? 'hsla(142,60%,45%,0.5)' : 'hsla(38,80%,50%,0.45)';
      ctx.shadowBlur = 28;
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
      ctx.drawImage(qrCanvas, qrBoxX + qrBoxPad, qrBoxY + qrBoxPad, QR_SIZE, QR_SIZE);
      y += qrBoxSize + 22;
    }

    ctx.textAlign = 'center';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(38,70%,65%)';
    ctx.textBaseline = 'top';
    ctx.fillText(order?.purchaser_mobile ?? '', W / 2, y);
    y += 26;

    ctx.font = '400 13px monospace, system-ui';
    ctx.fillStyle = 'hsl(38,30%,42%)';
    ctx.fillText(`${ticket.qr_text.slice(0, 28)}…`, W / 2, y);
    ctx.textAlign = 'left';

    const footerY = H - FOOTER_H;
    ctx.strokeStyle = 'hsl(38,25%,18%)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, footerY); ctx.lineTo(W, footerY); ctx.stroke();
    ctx.fillStyle = 'hsl(30,18%,6%)';
    ctx.fillRect(0, footerY, W, FOOTER_H);

    const logoCircleR = 22;
    const logoCircleX = PAD + logoCircleR;
    const logoCircleY = footerY + FOOTER_H / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoCircleX, logoCircleY, logoCircleR, 0, Math.PI * 2);
    ctx.fillStyle = 'hsl(38,60%,10%)';
    ctx.fill();
    ctx.strokeStyle = 'hsla(38,60%,30%,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.clip();
    try {
      const logoImg = await loadImage(hotelLogo);
      const logoSize = logoCircleR * 1.4;
      ctx.drawImage(logoImg, logoCircleX - logoSize / 2, logoCircleY - logoSize / 2, logoSize, logoSize);
    } catch { /* logo unavailable */ }
    ctx.restore();

    const textX = PAD + logoCircleR * 2 + 14;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(38,80%,65%)';
    ctx.fillText('Hotel Drona Palace', textX, logoCircleY - 9);
    ctx.font = '400 13px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(38,30%,42%)';
    ctx.fillText('A Unit of SR Leisure Inn', textX, logoCircleY + 10);

    ctx.textAlign = 'right';
    ctx.font = '400 13px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(38,30%,42%)';
    ctx.fillText(
      new Date(ticket.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' }),
      W - PAD,
      logoCircleY
    );

    return canvas;
  };

  const downloadPassAsPng = async (ticket: TicketData) => {
    const canvas = await buildPassCanvas(ticket);
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pass-seat-${ticket.seat_index + 1}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  };

  const buildConfirmationWALink = (): string => {
    const ticketUrl = `https://drona-play-connect.lovable.app/ticket?mobile=${mobile}`;
    const matchName = activeMatch?.name ?? 'T20 Fan Night';
    const matchOpp = activeMatch?.opponent ? ` vs ${activeMatch.opponent}` : '';
    const matchVenue = activeMatch?.venue ?? '';
    const matchDate = activeMatch?.start_time
      ? new Date(activeMatch.start_time).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    const paidLine = paymentMethod === 'pay_at_hotel'
      ? `💳 Payment: Pay ₹${priceQuote?.total ?? ''} at the venue on arrival`
      : `✅ Payment: ₹${priceQuote?.total ?? ''} Confirmed`;
    const seatNos = tickets.map(t => `Seat ${t.seat_index + 1}`).join(', ');

    const lines = [
      `🎟️ Booking Confirmed — Hotel Drona Palace`,
      ``,
      `Hi ${fullName}! Your T20 Fan Night pass${tickets.length > 1 ? 's are' : ' is'} ready.`,
      ``,
      `🏏 Match: ${matchName}${matchOpp}`,
      matchVenue ? `📍 Venue: ${matchVenue}` : null,
      matchDate  ? `🗓️ Date: ${matchDate}` : null,
      `🪑 Seats: ${seatNos}`,
      paidLine,
      ``,
      `🎫 View passes anytime: ${ticketUrl}`,
      ``,
      `— Hotel Drona Palace`,
    ].filter(Boolean).join('\n');

    return `https://wa.me/91${mobile}?text=${encodeURIComponent(lines)}`;
  };

  const handleWhatsAppShare = async () => {
    const ticketUrl = `https://drona-play-connect.lovable.app/ticket?mobile=${mobile}`;
    const matchName = activeMatch?.name || 'T20 Fan Night';
    const text = `🎫 My T20 Fan Night Pass — ${matchName} — ${tickets.length} seat${tickets.length > 1 ? 's' : ''}\nView tickets: ${ticketUrl}`;

    if (navigator.canShare && tickets.length > 0) {
      try {
        const files: File[] = [];
        for (const ticket of tickets) {
          const shaped = buildTicketShape(ticket);
          const passCanvas = await buildPassCanvas(shaped);
          const blob = await new Promise<Blob | null>(res => passCanvas.toBlob(res));
          if (blob) {
            files.push(new File([blob], `pass-seat-${ticket.seat_index + 1}.png`, { type: 'image/png' }));
          }
        }
        if (files.length > 0 && navigator.canShare({ files })) {
          await navigator.share({ files, title: 'My T20 Fan Night Passes', text });
          return;
        }
      } catch { /* fall through */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

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
          {activeMatch.start_time && (
            <div className="mt-3 pt-3 border-t border-border/40">
              <CountdownTimer targetTime={activeMatch.start_time} variant="compact" />
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
                <Label className="text-foreground mb-1.5 block">Full Name *</Label>
                <Input ref={nameRef} className={`glass-input ${nameError ? 'border-destructive' : ''}`}
                  placeholder="e.g. Rajesh Kumar" value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name"
                  onKeyDown={e => { if (e.key === 'Enter' && fullName.trim().length >= 2) document.querySelector<HTMLInputElement>('input[type="tel"]')?.focus(); }} />
                {nameError && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Please enter your full name</p>}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-foreground">Mobile Number *</Label>
                  <span className={`text-xs font-mono flex-shrink-0 ${mobileValid ? 'text-success' : 'text-muted-foreground'}`}>{mobile.length}/10</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center justify-center px-3 rounded-md border border-border bg-muted/40 text-sm text-muted-foreground font-medium select-none flex-shrink-0">
                    +91
                  </div>
                  <Input className={`glass-input flex-1 ${mobileError ? 'border-destructive' : mobileValid ? 'border-success/50' : ''}`}
                    placeholder="98765 43210" value={mobile}
                    onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    inputMode="numeric" type="tel" autoComplete="tel" />
                </div>
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
                    {eligibleSeats > 0
                      ? <span>Semifinal attendee — <strong>{eligibleSeats} seat{eligibleSeats > 1 ? 's' : ''} at ₹949</strong>, extras at ₹999 🎉</span>
                      : <span>Semifinal attendee — you qualify for <strong>₹949/seat</strong> 🎉</span>
                    }
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
                <Label className="text-foreground mb-1.5 block">Email (optional)</Label>
                <Input
                  className={`glass-input ${emailError ? 'border-destructive' : ''}`}
                  placeholder="your@email.com"
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                  onBlur={() => {
                    if (email && !isEmailValid(email)) setEmailError('Please enter a valid email address');
                    else setEmailError('');
                  }}
                  autoComplete="email"
                />
                {emailError && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {emailError}</p>}
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

            {/* Eligibility badge — mirrored from Step 1 */}
            {eligibilityStatus === 'eligible' && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-success/10 border border-success/30 text-xs text-success font-semibold">
                <Star className="h-3.5 w-3.5 flex-shrink-0" />
                {eligibleSeats > 0
                  ? <span>Semifinal discount — <strong>{eligibleSeats} seat{eligibleSeats > 1 ? 's' : ''} at ₹949</strong>, extras at ₹999 🎉</span>
                  : <span>Semifinal attendee discount applied — qualifying seats at <strong>₹949/seat</strong> 🎉</span>
                }
              </div>
            )}
            {eligibilityStatus === 'standard' && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/20 border border-border/30 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Standard pricing — <strong className="text-foreground">₹999/seat</strong></span>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <Label className="text-foreground mb-3 block text-sm font-semibold text-center">Number of Seats</Label>
                <div className="flex items-center gap-4">
                  <button onClick={() => { setSeatsCount(Math.max(1, seatsCount - 1)); setPriceQuote(null); }}
                    className="w-12 h-12 rounded-xl border-2 border-border bg-muted/30 text-foreground text-xl font-bold flex items-center justify-center hover:border-primary/50 hover:bg-primary/10 active:scale-95 transition-all">−</button>
                  <span className="font-display text-3xl font-bold text-foreground w-12 text-center tabular-nums">{seatsCount}</span>
                  <button onClick={() => { setSeatsCount(Math.min(10, seatsCount + 1)); setPriceQuote(null); }}
                    className="w-12 h-12 rounded-xl border-2 border-border bg-muted/30 text-foreground text-xl font-bold flex items-center justify-center hover:border-primary/50 hover:bg-primary/10 active:scale-95 transition-all">+</button>
                  <span className="text-sm text-muted-foreground">seat{seatsCount > 1 ? 's' : ''}</span>
                </div>
              </div>
              <div>
                <Label className="text-foreground mb-3 block text-sm font-semibold text-center">Seating Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(['regular', 'family'] as const).map(type => (
                    <button key={type} onClick={() => { setSeatingType(type); setPriceQuote(null); }}
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
                  {priceQuote.seats.map((s, i) => {
                    const reasonLabel: Record<string, string> = {
                      semifinal_attendee: '⭐ Special ₹949 eligible',
                      loyal_base: '⭐ Returning rate',
                      extra_seat: 'Standard rate',
                      new_customer: '',
                    };
                    const label = reasonLabel[s.reason] ?? s.reason.replace(/_/g, ' ');
                    return (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Seat {i + 1}
                          {label && <span className="ml-1 text-xs text-success font-medium">({label})</span>}
                        </span>
                        <span className="font-semibold text-foreground">₹{s.price}</span>
                      </div>
                    );
                  })}
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
                  eligibilityStatus={eligibilityStatus}
                  priceQuote={priceQuote}
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
                <div className="text-center mb-3 py-3 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Amount</p>
                  <p className="font-display text-4xl font-bold gradient-text">₹{priceQuote?.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">{seatsCount} seat{seatsCount > 1 ? 's' : ''} · {seatingType}</p>
                </div>

                {/* Eligibility badge below total */}
                {eligibilityStatus === 'eligible' && (
                  <div className="flex items-center gap-2.5 px-4 py-3 mb-5 rounded-xl bg-success/10 border border-success/30">
                    <Star className="h-4 w-4 text-success flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-success">⭐ Semifinal Attendee Discount Applied</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Eligible seats at the special ₹949 rate.</p>
                    </div>
                  </div>
                )}
                {eligibilityStatus === 'standard' && (
                  <div className="flex items-center gap-2 px-4 py-2.5 mb-5 rounded-xl bg-muted/20 border border-border/30">
                    <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">Standard pricing — ₹999/seat</p>
                  </div>
                )}

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
                      <span><strong>Your seat is reserved ✓</strong> Pay ₹{priceQuote?.total ?? ''} cash or UPI at the hotel on arrival before entry.</span>
                    </div>
                  )}

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

        {/* ─── Step 3: Tickets (Full Pass Design) ─── */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            {/* Success banner */}
            <div className="rounded-xl p-5 text-center border-2 border-success/50 bg-success/10">
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
              {downloadProgress ? (
                <div className="flex items-center justify-center gap-2 mt-2 text-xs text-primary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Downloading pass {downloadProgress.done + 1} of {downloadProgress.total}…
                </div>
              ) : (
                <p className="text-xs text-success/70 mt-1">✓ Passes downloaded</p>
              )}
            </div>

            {/* Hidden high-res QR canvases for buildPassCanvas */}
            <div className="sr-only" aria-hidden="true">
              {tickets.map((ticket) => (
                <QRCodeCanvas
                  key={ticket.id}
                  id={`qr-canvas-${ticket.id}`}
                  value={ticket.qr_text}
                  size={600}
                  bgColor="#ffffff"
                  fgColor="#111111"
                />
              ))}
            </div>

            {/* Full Pass Cards */}
            {tickets.map((ticket) => {
              const shaped = buildTicketShape(ticket);
              const order = shaped.order;
              const match = order.match;
              const paidStatus = isPaid(order.payment_status);
              const balanceDue = Math.max(0, order.total_amount - order.advance_paid);
              const hasBalance = !paidStatus && balanceDue > 0;
              const isPartiallyPaid = order.advance_paid > 0 && !paidStatus;

              return (
                <div
                  key={ticket.id}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(145deg, hsl(30 20% 9%), hsl(30 15% 7%))',
                    border: '1px solid hsl(38 30% 20%)',
                    boxShadow: paidStatus
                      ? '0 8px 40px hsl(142 60% 35% / 0.25), 0 0 0 1px hsl(142 60% 35% / 0.15)'
                      : '0 8px 40px hsl(38 80% 50% / 0.2), 0 0 0 1px hsl(38 80% 50% / 0.15)',
                  }}
                >
                  {/* Status Banner */}
                  <div
                    className="flex items-center justify-center gap-2 py-2.5 px-4 font-display text-sm font-bold tracking-wide"
                    style={{
                      background: paidStatus
                        ? 'linear-gradient(90deg, hsl(142 60% 25%), hsl(142 50% 30%))'
                        : 'linear-gradient(90deg, hsl(38 80% 35%), hsl(38 70% 40%))',
                      borderBottom: `1px solid ${paidStatus ? 'hsl(142 60% 35% / 0.6)' : 'hsl(38 80% 45% / 0.6)'}`,
                      color: paidStatus ? 'hsl(142 80% 80%)' : 'hsl(38 90% 85%)',
                    }}
                  >
                    {paidStatus
                      ? <><span>☑</span> PAID — Entry Confirmed</>
                      : isPartiallyPaid
                        ? <><span>⚠</span> ADVANCE PAID — Balance Due at Entry</>
                        : <><span>⚠</span> UNPAID — Pay at Hotel on Arrival</>
                    }
                  </div>

                  {/* Main Body */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="font-display text-xl font-bold leading-tight mb-0.5" style={{ color: 'hsl(38 90% 88%)' }}>
                          {order.purchaser_full_name}
                        </p>
                        <p className="text-sm font-medium" style={{ color: 'hsl(38 60% 65%)' }}>
                          {match.name}{match.opponent ? ` vs ${match.opponent}` : ''}
                        </p>
                        {match.start_time && (
                          <p className="text-xs mt-0.5" style={{ color: 'hsl(38 40% 55%)' }}>
                            {new Date(match.start_time).toLocaleString('en-IN')}
                          </p>
                        )}
                        <p className="text-xs" style={{ color: 'hsl(38 40% 55%)' }}>{match.venue}</p>
                        <p className="text-xs font-semibold mt-1" style={{ color: 'hsl(38 80% 65%)' }}>
                          {order.seating_type.charAt(0).toUpperCase() + order.seating_type.slice(1)} Seating
                        </p>
                        {hasBalance && (
                          <div
                            className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                            style={{
                              background: 'hsl(38 80% 45% / 0.2)',
                              border: '1px solid hsl(38 80% 50% / 0.5)',
                              color: 'hsl(38 90% 72%)',
                            }}
                          >
                            ⚠ Balance Due: ₹{balanceDue}
                          </div>
                        )}
                      </div>

                      {/* Seat badge */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'hsl(38 50% 50%)' }}>SEAT</p>
                        <div
                          className="font-display text-5xl font-black leading-none"
                          style={{
                            background: 'linear-gradient(135deg, hsl(38 95% 65%), hsl(38 80% 50%))',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                          }}
                        >
                          {ticket.seat_index + 1}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'hsl(38 40% 50%)' }}>of {order.seats_count}</p>
                      </div>
                    </div>

                    {/* Dashed divider */}
                    <div
                      className="w-full h-px my-4"
                      style={{ background: 'repeating-linear-gradient(90deg, transparent, transparent 6px, hsl(38 30% 25%) 6px, hsl(38 30% 25%) 12px)' }}
                    />

                    {/* QR Code */}
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="rounded-xl overflow-hidden"
                        style={{
                          padding: '14px',
                          background: '#ffffff',
                          boxShadow: paidStatus
                            ? '0 0 24px hsl(142 60% 45% / 0.35), 0 4px 16px rgba(0,0,0,0.4)'
                            : '0 0 24px hsl(38 80% 50% / 0.3), 0 4px 16px rgba(0,0,0,0.4)',
                        }}
                      >
                        <QRCodeSVG value={ticket.qr_text} size={170} bgColor="#ffffff" fgColor="#111111" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold tracking-wider" style={{ color: 'hsl(38 70% 65%)' }}>
                          {order.purchaser_mobile}
                        </p>
                        <p className="text-xs font-mono mt-0.5" style={{ color: 'hsl(38 30% 42%)' }}>
                          {ticket.qr_text.slice(0, 26)}…
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-3 mt-5">
                      <button
                        onClick={() => downloadPassAsPng(shaped)}
                        className="flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all active:scale-95"
                        style={{ background: 'hsl(38 40% 12%)', border: '1px solid hsl(38 30% 22%)', color: 'hsl(38 70% 65%)' }}
                      >
                        <Download className="h-4 w-4" /> Save Pass
                      </button>
                      <button
                        onClick={handleWhatsAppShare}
                        className="flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all active:scale-95"
                        style={{ background: 'hsl(38 40% 12%)', border: '1px solid hsl(38 30% 22%)', color: 'hsl(38 70% 65%)' }}
                      >
                        <Share2 className="h-4 w-4" /> Share
                      </button>
                    </div>
                  </div>

                  {/* Footer */}
                  <div
                    className="flex items-center justify-between px-5 py-3"
                    style={{ borderTop: '1px solid hsl(38 25% 18%)', background: 'hsl(30 18% 6%)' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                        style={{ background: 'hsl(38 60% 10%)', border: '1px solid hsl(38 60% 30% / 0.6)', boxShadow: '0 0 10px hsl(38 75% 52% / 0.4)' }}
                      >
                        <img src={hotelLogo} alt="Hotel Logo" className="w-6 h-6 object-contain" />
                      </div>
                      <div>
                        <p className="text-xs font-bold leading-none" style={{ color: 'hsl(38 80% 65%)' }}>Hotel Drona Palace</p>
                        <p className="text-xs leading-tight mt-0.5" style={{ color: 'hsl(38 30% 42%)' }}>A Unit of SR Leisure Inn</p>
                      </div>
                    </div>
                    <p className="text-xs" style={{ color: 'hsl(38 30% 42%)' }}>
                      {new Date(ticket.issued_at ?? Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* WhatsApp confirmation — send to own number with full booking details */}
            <button
              onClick={() => window.open(buildConfirmationWALink(), '_blank')}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-display font-bold text-base text-white transition-all active:scale-[0.98] no-print"
              style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', boxShadow: '0 4px 20px rgba(37,211,102,0.35)' }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Send Booking Confirmation to WhatsApp
            </button>
            <p className="text-xs text-muted-foreground text-center -mt-2 no-print">
              Opens WhatsApp with your booking details pre-filled — tap Send to save it to yourself
            </p>

            {/* Share pass images via WhatsApp */}
            <button
              onClick={handleWhatsAppShare}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] no-print"
              style={{
                background: 'hsl(var(--muted) / 0.3)',
                border: '1px solid rgba(37,211,102,0.3)',
                color: '#25D366',
              }}
            >
              <Share2 className="h-4 w-4" /> Share Pass Images
            </button>

            <GlassButton variant="ghost" size="lg" className="w-full no-print" onClick={() => window.print()}>
              🖨️ Print Passes
            </GlassButton>

            {/* View Passes CTA — prominent recovery path */}
            <Link
              to={`/ticket?mobile=${mobile}`}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-display font-bold text-sm transition-all active:scale-[0.98] no-print"
              style={{
                background: 'hsl(var(--primary) / 0.12)',
                border: '1px solid hsl(var(--primary) / 0.35)',
                color: 'hsl(var(--primary))',
              }}
            >
              <ChevronRight className="h-4 w-4" />
              View / Retrieve Your Passes →
            </Link>

            {/* Support footer */}
            <div className="rounded-xl bg-muted/20 border border-border p-4 text-center space-y-2">
              <p className="text-xs font-semibold text-foreground">Need Help?</p>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <a href="tel:7217016170" className="flex items-center gap-1 hover:text-primary transition-colors"><Phone className="h-3 w-3" /> 7217016170</a>
                <a href="mailto:dronapalace@gmail.com" className="flex items-center gap-1 hover:text-primary transition-colors"><Mail className="h-3 w-3" /> dronapalace@gmail.com</a>
              </div>
              <p className="text-xs text-muted-foreground">
                <Link to="/terms" target="_blank" className="text-muted-foreground underline">Event Terms</Link>
                {' · '}
                <Link to="/ticket" className="text-primary underline">Retrieve passes anytime</Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
