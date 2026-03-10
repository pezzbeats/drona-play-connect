import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { Input } from '@/components/ui/input';
import {
  Loader2, Share2, ChevronLeft, ChevronRight,
  ArrowLeft, Download, MessageCircle, Search, Printer, RefreshCw
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
    advance_paid: number;
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

function validateMobile(raw: string): { valid: boolean; normalized: string; error: string } {
  const digits = raw.replace(/\D/g, '');
  const normalized = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (normalized.length !== 10) {
    return { valid: false, normalized, error: 'Please enter a valid 10-digit mobile number.' };
  }
  if (!/^[6-9]/.test(normalized)) {
    return { valid: false, normalized, error: 'Mobile number must start with 6, 7, 8, or 9.' };
  }
  return { valid: true, normalized, error: '' };
}

// ── Professional Pass Card ────────────────────────────────────────────────────

function buildReminderLink(ticket: TicketData): string {
  const order = ticket.order as any;
  const match = order?.match;
  const balanceDue = Math.max(0, (order?.total_amount ?? 0) - (order?.advance_paid ?? 0));
  const isPartiallyPaid = (order?.advance_paid ?? 0) > 0;
  const ticketUrl = `https://cricket.dronapalace.com/ticket?mobile=${order?.purchaser_mobile}`;

  const lines = [
    `Hi ${order?.purchaser_full_name}! 🙏 Your Cricket Fan Night Pass (Seat ${ticket.seat_index + 1} of ${order?.seats_count}) is confirmed with Hotel Drona Palace.`,
    ``,
    `💰 Balance Due: ₹${balanceDue}`,
    isPartiallyPaid ? `✅ Advance Paid: ₹${order?.advance_paid}` : null,
    ``,
    match?.name ? `🏏 Match: ${match.name}${match?.opponent ? ` vs ${match.opponent}` : ''}` : null,
    match?.venue ? `📍 Venue: ${match.venue}` : null,
    match?.start_time ? `🗓️ Date: ${new Date(match.start_time).toLocaleString('en-IN')}` : null,
    ``,
    `Please pay the remaining amount at the hotel on arrival.`,
    ``,
    `🎫 View your pass: ${ticketUrl}`,
    ``,
    `— Hotel Drona Palace`,
  ].filter(l => l !== null).join('\n');

  return `https://wa.me/91${order?.purchaser_mobile}?text=${encodeURIComponent(lines)}`;
}

function PassCard({
  ticket,
  order,
  match,
  paidStatus,
  onDownload,
  onShare,
  onRemind,
}: {
  ticket: TicketData;
  order: TicketData['order'];
  match: TicketData['order']['match'];
  paidStatus: boolean;
  onDownload: (t: TicketData) => void;
  onShare: (t: TicketData) => void;
  onRemind?: () => void;
}) {
  const balanceDue = Math.max(0, (order.total_amount ?? 0) - (order.advance_paid ?? 0));
  const hasBalance = !paidStatus && balanceDue > 0;
  const isPartiallyPaid = (order.advance_paid ?? 0) > 0 && !paidStatus;

  return (
    <div
      className="pass-card-wrap rounded-2xl overflow-hidden no-break"
      style={{
        background: 'linear-gradient(145deg, hsl(30 20% 9%), hsl(30 15% 7%))',
        border: '1px solid hsl(38 30% 20%)',
        boxShadow: paidStatus
          ? '0 8px 40px hsl(142 60% 35% / 0.25), 0 0 0 1px hsl(142 60% 35% / 0.15)'
          : '0 8px 40px hsl(38 80% 50% / 0.2), 0 0 0 1px hsl(38 80% 50% / 0.15)',
      }}
    >
      {/* ── Status Banner ── */}
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

      {/* ── Main Body ── */}
      <div className="p-5">
        {/* Name + Seat row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 pr-4">
            <p
              className="font-display text-xl font-bold leading-tight mb-0.5"
              style={{ color: 'hsl(38 90% 88%)' }}
            >
              {order.purchaser_full_name}
            </p>
            <p className="text-sm font-medium" style={{ color: 'hsl(38 60% 65%)' }}>
              {match?.name}
              {match?.opponent ? ` vs ${match.opponent}` : ''}
            </p>
            {match?.start_time && (
              <p className="text-xs mt-0.5" style={{ color: 'hsl(38 40% 55%)' }}>
                {new Date(match.start_time).toLocaleString('en-IN')}
              </p>
            )}
            <p className="text-xs" style={{ color: 'hsl(38 40% 55%)' }}>{match?.venue}</p>
            {order?.seating_type && (
              <p className="text-xs font-semibold mt-1" style={{ color: 'hsl(38 80% 65%)' }}>
                {order.seating_type.charAt(0).toUpperCase() + order.seating_type.slice(1)} Seating
              </p>
            )}
            {/* Balance due pill */}
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
                {isPartiallyPaid && <span style={{ color: 'hsl(38 60% 55%)' }}> (Adv: ₹{order.advance_paid})</span>}
              </div>
            )}
          </div>

          {/* Seat badge */}
          <div className="text-right flex-shrink-0">
            <p
              className="text-xs uppercase tracking-widest font-semibold mb-0.5"
              style={{ color: 'hsl(38 50% 50%)' }}
            >
              SEAT
            </p>
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
            <p className="text-xs mt-0.5" style={{ color: 'hsl(38 40% 50%)' }}>
              of {order?.seats_count}
            </p>
          </div>
        </div>

        {/* Divider dashes */}
        <div
          className="w-full h-px my-4"
          style={{
            background: 'repeating-linear-gradient(90deg, transparent, transparent 6px, hsl(38 30% 25%) 6px, hsl(38 30% 25%) 12px)',
          }}
        />

        {/* ── QR Code ── */}
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
            <QRCodeSVG
              value={ticket.qr_text}
              size={170}
              bgColor="#ffffff"
              fgColor="#111111"
            />
            {/* Hidden canvas for PNG download */}
            <QRCodeCanvas
              id={`qr-canvas-${ticket.id}`}
              value={ticket.qr_text}
              size={600}
              bgColor="#ffffff"
              fgColor="#111111"
              style={{ display: 'none' }}
            />
          </div>

          <div className="text-center">
            <p
              className="text-sm font-semibold tracking-wider"
              style={{ color: 'hsl(38 70% 65%)' }}
            >
              {order?.purchaser_mobile}
            </p>
            <p
              className="text-xs font-mono mt-0.5"
              style={{ color: 'hsl(38 30% 42%)' }}
            >
              {ticket.qr_text.slice(0, 26)}…
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-5 no-print">
          <button
            onClick={() => onDownload(ticket)}
            className="flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{
              background: 'hsl(38 40% 12%)',
              border: '1px solid hsl(38 30% 22%)',
              color: 'hsl(38 70% 65%)',
            }}
          >
            <Download className="h-4 w-4" /> Save Pass
          </button>
          <button
            onClick={() => onShare(ticket)}
            className="flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{
              background: 'hsl(38 40% 12%)',
              border: '1px solid hsl(38 30% 22%)',
              color: 'hsl(38 70% 65%)',
            }}
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>

        {/* WhatsApp Balance Reminder Button */}
        {hasBalance && onRemind && (
          <button
            onClick={onRemind}
            className="flex items-center justify-center gap-2 w-full h-11 rounded-xl text-sm font-semibold transition-all active:scale-95 mt-3 no-print"
            style={{
              background: 'linear-gradient(135deg, hsl(142 60% 20%), hsl(142 50% 25%))',
              border: '1px solid hsl(142 60% 35% / 0.6)',
              color: 'hsl(142 80% 78%)',
              boxShadow: '0 0 16px hsl(142 60% 35% / 0.25)',
            }}
          >
            <MessageCircle className="h-4 w-4" />
            Send Balance Reminder · ₹{balanceDue} due
          </button>
        )}
      </div>

      {/* ── Footer ── */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{
          borderTop: '1px solid hsl(38 25% 18%)',
          background: 'hsl(30 18% 6%)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{
              background: 'hsl(38 60% 10%)',
              border: '1px solid hsl(38 60% 30% / 0.6)',
              boxShadow: '0 0 10px hsl(38 75% 52% / 0.4)',
            }}
          >
            <img src={hotelLogo} alt="Hotel Logo" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <p className="text-xs font-bold leading-none" style={{ color: 'hsl(38 80% 65%)' }}>
              Hotel Drona Palace
            </p>
            <p className="text-xs leading-tight mt-0.5" style={{ color: 'hsl(38 30% 42%)' }}>
              A Unit of SR Leisure Inn
            </p>
          </div>
        </div>
        <p className="text-xs" style={{ color: 'hsl(38 30% 42%)' }}>
          {new Date(ticket.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TicketPage() {
  const { role } = useAuth();
  const isAdmin = role !== null;
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
            purchaser_full_name, purchaser_mobile, payment_status, seats_count,
            total_amount, seating_type, advance_paid,
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

  // Helper: load an image URL as HTMLImageElement
  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  // Helper: draw a rounded rectangle path
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

    // Calculate total height dynamically
    let contentH = 0;
    contentH += 20; // top pad after banner
    contentH += 30; // name
    contentH += 26; // match name
    contentH += 22; // date
    contentH += 22; // venue
    contentH += 22; // seating
    if (hasBalance) contentH += 36;
    contentH += 24; // gap before divider
    contentH += 1;  // divider
    contentH += 28; // gap after divider
    contentH += QR_SIZE + 28 + 2; // qr box with padding
    contentH += 30; // mobile
    contentH += 26; // qr snippet
    contentH += 32; // bottom pad
    const H = BANNER_H + contentH + FOOTER_H;

    const DPR = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(DPR, DPR);

    // ── Card outer rounded background ──
    roundRect(ctx, 0, 0, W, H, 20);
    ctx.fillStyle = '#17100a';
    ctx.fill();

    // Subtle border
    roundRect(ctx, 0.5, 0.5, W - 1, H - 1, 20);
    ctx.strokeStyle = paidStatus ? 'hsla(142,60%,35%,0.5)' : 'hsla(38,60%,35%,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── Status Banner ──
    const bannerGrad = ctx.createLinearGradient(0, 0, W, 0);
    if (paidStatus) {
      bannerGrad.addColorStop(0, 'hsl(142,60%,22%)');
      bannerGrad.addColorStop(1, 'hsl(142,50%,28%)');
    } else {
      bannerGrad.addColorStop(0, 'hsl(38,80%,28%)');
      bannerGrad.addColorStop(1, 'hsl(38,70%,34%)');
    }
    // Clip banner to top-rounded corners only
    ctx.save();
    roundRect(ctx, 0, 0, W, BANNER_H, 20);
    ctx.clip();
    ctx.fillStyle = bannerGrad as any;
    ctx.fillRect(0, 0, W, BANNER_H);
    ctx.restore();
    // Banner bottom border
    ctx.strokeStyle = paidStatus ? 'hsla(142,60%,40%,0.6)' : 'hsla(38,80%,45%,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, BANNER_H); ctx.lineTo(W, BANNER_H); ctx.stroke();

    // Banner text
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

    // ── Main body content ──
    let y = BODY_TOP + 28;
    const leftX = PAD;
    const rightX = W - PAD;
    const seatBadgeW = 120;
    const textRightBound = rightX - seatBadgeW - 16;

    // Purchaser name
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(38,90%,88%)';
    ctx.fillText(order?.purchaser_full_name ?? '', leftX, y, textRightBound - leftX);
    y += 36;

    // Match name
    ctx.font = '500 20px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(38,60%,65%)';
    const matchTitle = `${match?.name ?? ''}${match?.opponent ? ` vs ${match.opponent}` : ''}`;
    ctx.fillText(matchTitle, leftX, y, textRightBound - leftX);
    y += 26;

    // Date/time
    if (match?.start_time) {
      ctx.font = '400 17px system-ui, sans-serif';
      ctx.fillStyle = 'hsl(38,40%,55%)';
      ctx.fillText(new Date(match.start_time).toLocaleString('en-IN'), leftX, y);
      y += 24;
    }

    // Venue
    ctx.font = '400 17px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(38,40%,55%)';
    ctx.fillText(match?.venue ?? '', leftX, y);
    y += 24;

    // Seating type
    if (order?.seating_type) {
      const sType = order.seating_type.charAt(0).toUpperCase() + order.seating_type.slice(1);
      ctx.font = '600 17px system-ui, sans-serif';
      ctx.fillStyle = 'hsl(38,80%,65%)';
      ctx.fillText(`${sType} Seating`, leftX, y);
      y += 24;
    }

    // Balance Due pill
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

    // ── Seat Badge (right column) ──
    const seatTopY = BODY_TOP + 28;
    ctx.textAlign = 'center';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(38,50%,50%)';
    ctx.textBaseline = 'top';
    ctx.fillText('SEAT', rightX - seatBadgeW / 2, seatTopY);

    // Seat number gradient text — draw via fillText with gradient
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

    // ── Dashed Divider ──
    y += 8;
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'hsl(38,30%,25%)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
    ctx.restore();
    y += 28;

    // ── QR Code ──
    const qrCanvas = document.getElementById(`qr-canvas-${ticket.id}`) as HTMLCanvasElement | null;
    if (qrCanvas) {
      const qrBoxPad = 14;
      const qrBoxSize = QR_SIZE + qrBoxPad * 2;
      const qrBoxX = (W - qrBoxSize) / 2;
      const qrBoxY = y;
      // White rounded box with glow
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

    // Mobile number
    ctx.textAlign = 'center';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(38,70%,65%)';
    ctx.textBaseline = 'top';
    ctx.fillText(order?.purchaser_mobile ?? '', W / 2, y);
    y += 26;

    // QR text snippet
    ctx.font = '400 13px monospace, system-ui';
    ctx.fillStyle = 'hsl(38,30%,42%)';
    ctx.fillText(`${ticket.qr_text.slice(0, 28)}…`, W / 2, y);
    ctx.textAlign = 'left';

    // ── Footer ──
    const footerY = H - FOOTER_H;
    ctx.strokeStyle = 'hsl(38,25%,18%)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, footerY); ctx.lineTo(W, footerY); ctx.stroke();

    // Footer background
    ctx.fillStyle = 'hsl(30,18%,6%)';
    ctx.fillRect(0, footerY, W, FOOTER_H);
    // Clip bottom corners
    ctx.save();
    roundRect(ctx, 0, footerY, W, FOOTER_H, 0);
    ctx.restore();

    // Logo circle
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

    // Hotel name + legal
    const textX = PAD + logoCircleR * 2 + 14;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(38,80%,65%)';
    ctx.fillText('Hotel Drona Palace', textX, logoCircleY - 9);
    ctx.font = '400 13px system-ui, sans-serif';
    ctx.fillStyle = 'hsl(38,30%,42%)';
    ctx.fillText('A Unit of SR Leisure Inn', textX, logoCircleY + 10);

    // Issue date
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

  const whatsappShare = async (ticket: TicketData) => {
    const order = ticket.order as any;
    const match = order?.match;
    const ticketUrl = `https://cricket.dronapalace.com/ticket?mobile=${order?.purchaser_mobile}`;
    const text = `🎫 My Cricket Fan Night Pass${match?.name ? ` — ${match.name}` : ''} — Seat ${ticket.seat_index + 1}\nView tickets: ${ticketUrl}`;

    if (navigator.canShare) {
      try {
        const passCanvas = await buildPassCanvas(ticket);
        const blob = await new Promise<Blob | null>(res => passCanvas.toBlob(res));
        const files = blob ? [new File([blob], `pass-seat-${ticket.seat_index + 1}.png`, { type: 'image/png' })] : [];
        if (files.length > 0 && navigator.canShare({ files })) {
          await navigator.share({ files, title: 'My T20 Fan Night Pass', text });
          return;
        }
      } catch { /* fall through */ }
    }
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
          <div className="flex flex-col gap-3">
            <GlassButton variant="ghost" size="sm" onClick={() => { setPhase('input'); setFetchError(null); }}>
              <ArrowLeft className="h-4 w-4" /> Try Again
            </GlassButton>
            <Link
              to="/register"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                background: 'hsl(var(--primary) / 0.12)',
                border: '1px solid hsl(var(--primary) / 0.35)',
                color: 'hsl(var(--primary))',
              }}
            >
              Book Seats →
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ── FOUND PHASE ──────────────────────────────────────────────────────────
  const order = tickets[activeIdx]?.order as any ?? tickets[0]?.order as any;
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

      <div className="relative z-10 max-w-md mx-auto px-4 py-5">
        {/* Header */}
        <div className="text-center mb-5 no-print">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mb-3">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
          </Link>
          <h1 className="font-display text-2xl font-bold gradient-text">Your Passes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {match?.name}{match?.opponent ? ` vs ${match.opponent}` : ''} · {match?.venue}
          </p>
        </div>

        {/* Print + Refresh buttons */}
        <div className="flex gap-2 mb-4 no-print">
          <GlassButton variant="ghost" size="sm" className="flex-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => {
              const mob = currentTicket ? (currentTicket.order as any)?.purchaser_mobile : mobileInput;
              if (mob) fetchTickets(null, mob);
            }}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </GlassButton>
          <GlassButton variant="ghost" size="sm" className="flex-1" onClick={() => whatsappShare(currentTicket)}>
            <MessageCircle className="h-4 w-4" /> Share
          </GlassButton>
          {isAdmin && !paidTickets && Math.max(0, (currentTicket?.order as any)?.total_amount - (currentTicket?.order as any)?.advance_paid) > 0 && (
            <a
              href={buildReminderLink(currentTicket)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-semibold transition-all active:scale-95 px-3"
              style={{
                background: 'linear-gradient(135deg, hsl(142 60% 18%), hsl(142 50% 23%))',
                border: '1px solid hsl(142 60% 32% / 0.7)',
                color: 'hsl(142 80% 75%)',
              }}
            >
              <MessageCircle className="h-3.5 w-3.5" /> Remind
            </a>
          )}
        </div>

        {/* Multi-ticket navigation — single-pass display */}
        {tickets.length > 1 && (
          <div className="flex items-center justify-between mb-3 no-print">
            <GlassButton variant="ghost" size="sm" onClick={() => setActiveIdx(i => Math.max(0, i - 1))} disabled={activeIdx === 0}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </GlassButton>
            <p className="text-sm text-muted-foreground font-medium">
              Pass {activeIdx + 1} of {tickets.length}
            </p>
            <GlassButton variant="ghost" size="sm" onClick={() => setActiveIdx(i => Math.min(tickets.length - 1, i + 1))} disabled={activeIdx === tickets.length - 1}>
              Next <ChevronRight className="h-4 w-4" />
            </GlassButton>
          </div>
        )}

        {/* Single ticket card — only show active one */}
        <div className="space-y-6">
          {tickets.map((ticket, i) => (
            <div
              key={ticket.id}
              className={tickets.length > 1 && i !== activeIdx ? 'hidden print:block' : ''}
            >
              <PassCard
                ticket={ticket}
                order={ticket.order as any}
                match={(ticket.order as any)?.match}
                paidStatus={paidTickets}
                onDownload={downloadPassAsPng}
                onShare={whatsappShare}
                onRemind={
                  !paidTickets && Math.max(0, (ticket.order as any)?.total_amount - (ticket.order as any)?.advance_paid) > 0
                    ? () => window.open(buildReminderLink(ticket), '_blank')
                    : undefined
                }
              />
            </div>
          ))}
        </div>

        <p className="text-xs text-center text-muted-foreground mt-6 no-print">
          Questions?{' '}
          <a href="tel:7217016170" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
            Contact hotel reception
          </a>
          {' '}· +91 72170 16170
        </p>
      </div>
    </div>
  );
}
