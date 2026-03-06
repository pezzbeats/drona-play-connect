import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { Input } from '@/components/ui/input';
import {
  Loader2, Printer, Share2, ChevronLeft, ChevronRight,
  ArrowLeft, Download, MessageCircle, Search
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import hotelLogo from '@/assets/hotel-logo.png';

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
    match: {
      name: string;
      venue: string;
      start_time: string | null;
      opponent: string | null;
    };
  };
}

type Phase = 'input' | 'loading' | 'found' | 'empty';

function isPaid(status: string) {
  return ['paid_verified', 'paid_manual_verified'].includes(status);
}

function PaymentBanner({ status }: { status: string }) {
  const paid = isPaid(status);
  return (
    <div className={`flex items-center justify-center gap-2 py-3 px-4 font-display text-lg font-bold tracking-wide ${
      paid
        ? 'bg-success/25 text-success border-b-2 border-success/40'
        : 'bg-warning/25 text-warning border-b-2 border-warning/40'
    }`}>
      {paid ? '✅ PAID — Entry Confirmed' : '⚠️ UNPAID — Pay at Hotel on Arrival'}
    </div>
  );
}

function validateMobile(raw: string): { valid: boolean; normalized: string; error: string } {
  const digits = raw.replace(/\D/g, '');
  // Strip leading 91 if 12 digits
  const normalized = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (normalized.length !== 10) {
    return { valid: false, normalized, error: 'Please enter a valid 10-digit mobile number.' };
  }
  if (!/^[6-9]/.test(normalized)) {
    return { valid: false, normalized, error: 'Mobile number must start with 6, 7, 8, or 9.' };
  }
  return { valid: true, normalized, error: '' };
}

export default function TicketPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order_id');
  const mobileParam = params.get('mobile');

  const [phase, setPhase] = useState<Phase>(() =>
    orderId || mobileParam ? 'loading' : 'input'
  );
  const [mobileInput, setMobileInput] = useState(mobileParam || '');
  const [mobileError, setMobileError] = useState('');
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (orderId || mobileParam) {
      fetchTickets(orderId || null, mobileParam || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTickets = async (byOrderId: string | null, byMobile: string | null) => {
    setPhase('loading');
    setFetchError(null);
    try {
      let orderIds: string[] = [];

      if (byOrderId) {
        orderIds = [byOrderId];
      } else if (byMobile) {
        // Two-step: get order IDs first
        const { data: orders, error: ordersErr } = await supabase
          .from('orders')
          .select('id')
          .eq('purchaser_mobile', byMobile);
        if (ordersErr) throw ordersErr;
        orderIds = (orders || []).map((o: { id: string }) => o.id);
      }

      if (orderIds.length === 0) {
        setTickets([]);
        setPhase('empty');
        return;
      }

      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id, seat_index, qr_text, status, issued_at,
          order:orders!order_id(
            purchaser_full_name, purchaser_mobile, payment_status, seats_count, total_amount, seating_type,
            match:matches!match_id(name, venue, start_time, opponent)
          )
        `)
        .in('order_id', orderIds)
        .order('seat_index', { ascending: true });

      if (error) throw error;
      const result = (data as any) || [];
      setTickets(result);
      setPhase(result.length > 0 ? 'found' : 'empty');
    } catch (e: any) {
      setFetchError(e.message);
      setPhase('empty');
    }
  };

  const handleMobileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { valid, normalized, error } = validateMobile(mobileInput);
    if (!valid) {
      setMobileError(error);
      return;
    }
    setMobileError('');
    fetchTickets(null, normalized);
  };

  const downloadQr = (ticket: TicketData) => {
    const canvas = document.getElementById(`qr-canvas-${ticket.id}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticket-seat-${ticket.seat_index + 1}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  };

  const whatsappShare = async (ticket: TicketData) => {
    const order = ticket.order as any;
    const match = order?.match;
    const ticketUrl = `https://drona-play-connect.lovable.app/ticket?mobile=${order?.purchaser_mobile}`;
    const text = `🎫 My T20 Fan Night Pass${match?.name ? ` — ${match.name}` : ''} — Seat ${ticket.seat_index + 1}\nView tickets: ${ticketUrl}`;

    // Try native share with PNG on mobile
    if (navigator.canShare) {
      try {
        const canvas = document.getElementById(`qr-canvas-${ticket.id}`) as HTMLCanvasElement | null;
        const blob = canvas ? await new Promise<Blob | null>(res => canvas.toBlob(res)) : null;
        const files = blob ? [new File([blob], `ticket-seat-${ticket.seat_index + 1}.png`, { type: 'image/png' })] : [];
        if (files.length > 0 && navigator.canShare({ files })) {
          await navigator.share({ files, title: 'My T20 Fan Night Ticket', text });
          return;
        }
      } catch {
        // fall through
      }
    }
    // Desktop / fallback: wa.me deep-link
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // ── INPUT PHASE ──────────────────────────────────────────────────────────
  if (phase === 'input') {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4">
        <BackgroundOrbs />
        <div className="relative z-10 w-full max-w-sm">
          <div className="text-center mb-6">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mb-4">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
            </Link>
            <div className="text-5xl mb-3">🎫</div>
            <h1 className="font-display text-3xl font-bold gradient-text mb-1">View Your Passes</h1>
            <p className="text-muted-foreground text-sm">Enter your registered mobile number</p>
          </div>

          <GlassCard className="p-6">
            <form onSubmit={handleMobileSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                  Mobile Number
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center justify-center px-3 rounded-md border border-border bg-muted/40 text-sm text-muted-foreground font-medium select-none">
                    +91
                  </div>
                  <Input
                    type="tel"
                    placeholder="98765 43210"
                    value={mobileInput}
                    onChange={e => {
                      setMobileInput(e.target.value);
                      if (mobileError) setMobileError('');
                    }}
                    maxLength={15}
                    className="flex-1 font-mono tracking-wider"
                    autoFocus
                    inputMode="numeric"
                  />
                </div>
                {mobileError && (
                  <p className="text-xs text-destructive mt-1.5">{mobileError}</p>
                )}
              </div>

              <GlassButton type="submit" variant="primary" size="md" className="w-full">
                <Search className="h-4 w-4" />
                Find My Tickets
              </GlassButton>
            </form>
          </GlassCard>

          <p className="text-xs text-center text-muted-foreground mt-4">
            Use the same number you registered with at{' '}
            <Link to="/register" className="text-primary underline underline-offset-2">Book Passes</Link>
          </p>
        </div>
      </div>
    );
  }

  // ── LOADING PHASE ────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BackgroundOrbs />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── EMPTY PHASE ──────────────────────────────────────────────────────────
  if (phase === 'empty') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <BackgroundOrbs />
        <GlassCard className="p-8 text-center max-w-sm relative z-10">
          <div className="text-4xl mb-4">🎫</div>
          <h2 className="font-display text-xl font-bold text-foreground mb-2">No Tickets Found</h2>
          <p className="text-muted-foreground text-sm mb-5">
            {fetchError || 'No passes found for that number. Double-check and try again.'}
          </p>
          <GlassButton variant="ghost" size="sm" onClick={() => { setPhase('input'); setFetchError(null); }}>
            <ArrowLeft className="h-4 w-4" /> Try Again
          </GlassButton>
        </GlassCard>
      </div>
    );
  }

  // ── FOUND PHASE ──────────────────────────────────────────────────────────
  const order = tickets[0]?.order as any;
  const match = order?.match;
  const paymentStatus = order?.payment_status;
  const paidTickets = isPaid(paymentStatus);
  const currentTicket = tickets[activeIdx];

  return (
    <div className="min-h-screen relative" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <BackgroundOrbs />

      <div className="disclaimer-bar text-center text-xs py-2 px-4 relative z-10 no-print">
        🎯 Fun Guess Game only — entertainment. No betting, no wagering.
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-5">
        {/* Header */}
        <div className="text-center mb-6 no-print">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mb-3">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
          </Link>
          <h1 className="font-display text-3xl font-bold gradient-text">Your Tickets</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {match?.name}{match?.opponent ? ` vs ${match.opponent}` : ''} · {match?.venue}
          </p>
          {match?.start_time && (
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(match.start_time).toLocaleString('en-IN')}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6 no-print">
          <GlassButton variant="primary" size="md" className="flex-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print All
          </GlassButton>
          <GlassButton variant="ghost" size="md" className="flex-1" onClick={() => whatsappShare(currentTicket)}>
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </GlassButton>
        </div>

        {/* Multi-ticket carousel indicator */}
        {tickets.length > 1 && (
          <div className="flex items-center justify-between mb-3 no-print">
            <GlassButton variant="ghost" size="sm" onClick={() => setActiveIdx(i => Math.max(0, i - 1))} disabled={activeIdx === 0}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </GlassButton>
            <p className="text-sm text-muted-foreground font-medium">
              Ticket {activeIdx + 1} of {tickets.length}
            </p>
            <GlassButton variant="ghost" size="sm" onClick={() => setActiveIdx(i => Math.min(tickets.length - 1, i + 1))} disabled={activeIdx === tickets.length - 1}>
              Next <ChevronRight className="h-4 w-4" />
            </GlassButton>
          </div>
        )}
        {tickets.length > 1 && (
          <p className="text-xs text-muted-foreground text-center mb-4 no-print">
            ← Swipe or use arrows to view all passes →
          </p>
        )}

        {/* Tickets */}
        <div className="space-y-6">
          {tickets.map((ticket, i) => (
            <div
              key={ticket.id}
              className={`seat-pass rounded-xl overflow-hidden no-break ${
                tickets.length > 1 && i !== activeIdx ? 'hidden print:block' : ''
              }`}
            >
              {/* Color-coded top gradient strip & payment banner */}
              <div className={`h-1.5 w-full ${paidTickets ? 'bg-gradient-success' : 'bg-gradient-warning'}`} />
              <PaymentBanner status={paymentStatus} />

              <div className="p-5">
                {/* Seat indicator */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-display text-xl font-bold text-foreground">{order?.purchaser_full_name}</p>
                    <p className="text-sm text-muted-foreground">{match?.name}</p>
                    {match?.opponent && <p className="text-xs text-muted-foreground">vs {match.opponent}</p>}
                    {match?.start_time && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(match.start_time).toLocaleString('en-IN')}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">{match?.venue}</p>
                    {order?.seating_type && (
                      <p className="text-xs text-primary font-medium mt-0.5 capitalize">{order.seating_type} seating</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Seat</div>
                    <div className="font-display text-4xl font-bold gradient-text leading-none">
                      {ticket.seat_index + 1}
                    </div>
                    <div className="text-xs text-muted-foreground">of {order?.seats_count}</div>
                  </div>
                </div>

                {/* Large QR */}
                <div className="flex flex-col items-center gap-3 mb-4">
                  <div
                    className={`qr-container ${paidTickets ? 'shadow-glow-success' : 'shadow-glow-warning'}`}
                    style={{ padding: 16 }}
                  >
                    <QRCodeSVG value={ticket.qr_text} size={150} />
                    {/* Hidden canvas for PNG download */}
                    <QRCodeCanvas
                      id={`qr-canvas-${ticket.id}`}
                      value={ticket.qr_text}
                      size={400}
                      style={{ display: 'none' }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">{order?.purchaser_mobile}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                      {ticket.qr_text.slice(0, 24)}...
                    </p>
                  </div>
                </div>

                {/* Per-ticket action buttons */}
                <div className="flex gap-2 mb-4 no-print">
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => downloadQr(ticket)}
                  >
                    <Download className="h-3.5 w-3.5" /> Save QR
                  </GlassButton>
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => whatsappShare(ticket)}
                  >
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </GlassButton>
                </div>

                {/* Bottom strip */}
                <div className="pt-3 border-t border-border/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-[hsl(38_60%_10%)] shadow-[0_0_10px_hsl(38_75%_52%/0.6)]" style={{ border: '1px solid hsl(38 75% 52% / 0.5)' }}>
                      <img src={hotelLogo} alt="Hotel Drona Palace" className="w-5 h-5 object-contain drop-shadow-[0_0_4px_hsl(38_75%_52%/0.8)]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-secondary leading-tight">Hotel Drona Palace</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">A Unit of SR Leisure Inn</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(ticket.issued_at).toLocaleDateString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Disclaimer + Terms */}
        <div className="mt-6 space-y-3 no-print">
          <div className="disclaimer-bar rounded-lg p-3 text-xs">
            🎯 <strong>Fun Guess Game:</strong> This is a fun guess game for entertainment only. No betting, no wagering, no gambling. Participation is voluntary and for fun purposes only.
          </div>
          <p className="text-xs text-center text-muted-foreground">
            <Link to="/terms" target="_blank" className="text-primary underline underline-offset-2">
              View Event Terms & Conditions
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
