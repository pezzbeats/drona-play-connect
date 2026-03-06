import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { Loader2, Printer, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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

export default function TicketPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order_id');
  const mobile = params.get('mobile');
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!orderId && !mobile) {
      setError('No ticket reference provided');
      setLoading(false);
      return;
    }
    fetchTickets();
  }, [orderId, mobile]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('tickets')
        .select(`
          id, seat_index, qr_text, status, issued_at,
          order:orders!order_id(
            purchaser_full_name, purchaser_mobile, payment_status, seats_count, total_amount, seating_type,
            match:matches!match_id(name, venue, start_time, opponent)
          )
        `);

      if (orderId) {
        query = query.eq('order_id', orderId);
      } else if (mobile) {
        query = query.eq('order.purchaser_mobile', mobile);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTickets((data as any) || []);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BackgroundOrbs />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || tickets.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <BackgroundOrbs />
        <GlassCard className="p-8 text-center max-w-sm relative z-10">
          <div className="text-4xl mb-4">🎫</div>
          <h2 className="font-display text-xl font-bold text-foreground mb-2">No Tickets Found</h2>
          <p className="text-muted-foreground text-sm">{error || 'No tickets found for this reference.'}</p>
        </GlassCard>
      </div>
    );
  }

  const order = tickets[0]?.order as any;
  const match = order?.match;
  const paymentStatus = order?.payment_status;
  const paidTickets = isPaid(paymentStatus);

  const currentTicket = tickets[activeIdx];

  return (
    <div className="min-h-screen relative">
      <BackgroundOrbs />

      <div className="disclaimer-bar text-center text-xs py-2 px-4 relative z-10 no-print">
        🎯 Fun Guess Game only — entertainment purposes. No betting, no wagering.
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6 no-print">
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
          <GlassButton variant="ghost" size="md" className="flex-1" onClick={() => {
            if (navigator.share) {
              navigator.share({ title: 'My T20 Fan Night Tickets', url: window.location.href });
            } else {
              navigator.clipboard.writeText(window.location.href);
            }
          }}>
            <Share2 className="h-4 w-4" /> Share
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

        {/* Tickets — all shown for print, single card in browser */}
        <div className="space-y-6">
          {tickets.map((ticket, i) => {
            // In browser: only show active; in print: show all
            const isVisible = true;
            if (!isVisible) return null;

            return (
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
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">{order?.purchaser_mobile}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">
                        {ticket.qr_text.slice(0, 24)}...
                      </p>
                    </div>
                  </div>

                  {/* Bottom strip */}
                  <div className="pt-3 border-t border-border/30 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">T20 Fan Night · Hotel Drona Palace</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ticket.issued_at).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
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
