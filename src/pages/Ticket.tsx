import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Loader2, Printer, Share2 } from 'lucide-react';
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
    match: {
      name: string;
      venue: string;
      start_time: string | null;
      opponent: string | null;
    };
  };
}

export default function TicketPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order_id');
  const mobile = params.get('mobile');
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            purchaser_full_name, purchaser_mobile, payment_status, seats_count, total_amount,
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

  return (
    <div className="min-h-screen relative">
      <BackgroundOrbs />

      <div className="disclaimer-bar text-center text-xs py-2 px-4 relative z-10 no-print">
        ⚽ This is a fun guess game for entertainment only. No betting, no wagering, no gambling.
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6 no-print">
          <h1 className="font-display text-3xl font-bold gradient-text">Your Tickets</h1>
          <p className="text-muted-foreground text-sm mt-1">{match?.name} · {match?.venue}</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <StatusBadge status={order?.payment_status as any} />
          </div>
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

        {/* Tickets */}
        <div className="space-y-4">
          {tickets.map((ticket, i) => (
            <div key={ticket.id} className="seat-pass rounded-xl p-5">
              {/* Ticket Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-display text-lg font-bold text-foreground">{order?.purchaser_full_name}</p>
                  <p className="text-sm text-muted-foreground">{match?.name}</p>
                  {match?.opponent && <p className="text-xs text-muted-foreground">vs {match.opponent}</p>}
                  {match?.start_time && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(match.start_time).toLocaleString('en-IN')}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{match?.venue}</p>
                </div>
                <div className="text-right">
                  <div className="font-display text-3xl font-bold gradient-text">#{ticket.seat_index + 1}</div>
                  <div className="text-xs text-muted-foreground">Seat</div>
                  <StatusBadge status={ticket.status as any} className="mt-1" />
                </div>
              </div>

              {/* QR Code */}
              <div className="flex items-center gap-4">
                <div className="qr-container flex-shrink-0">
                  <QRCodeSVG value={ticket.qr_text} size={110} />
                </div>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Mobile: </span>
                    <span className="text-foreground font-medium">{order?.purchaser_mobile}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Payment: </span>
                    <StatusBadge status={order?.payment_status as any} />
                  </div>
                  <div className="text-xs font-mono text-muted-foreground truncate max-w-[150px]">
                    {ticket.qr_text.slice(0, 20)}...
                  </div>
                </div>
              </div>

              {/* Bottom strip */}
              <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">T20 Fan Night · Hotel Drona Palace</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(ticket.issued_at).toLocaleDateString('en-IN')}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="mt-6 disclaimer-bar rounded-lg p-3 text-xs no-print">
          🎯 <strong>Fun Guess Game:</strong> This is a fun guess game for entertainment only. No betting, no wagering, no gambling. Participation is voluntary and for fun purposes only.
        </div>
      </div>
    </div>
  );
}
