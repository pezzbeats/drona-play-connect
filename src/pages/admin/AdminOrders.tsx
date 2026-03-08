import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfDay, endOfDay } from 'date-fns';
import {
  Search, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp,
  ExternalLink, AlertTriangle, Shield, Banknote, RefreshCw, Download,
  MessageCircle, KeyRound, QrCode, User, CreditCard, CheckSquare2,
  Copy, Clock, Ticket, Zap, X, Users, ShieldCheck, CalendarIcon, CalendarX,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import hotelLogo from '@/assets/hotel-logo.png';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type OverrideTarget = { orderId: string; verdict: 'paid_manual_verified' | 'paid_rejected' } | null;
type AdvanceFormState = { orderId: string; amount: string; method: string } | null;
type DetailTab = 'overview' | 'passes' | 'gamepin' | 'whatsapp' | 'consent';

interface TicketRow {
  id: string;
  seat_index: number;
  qr_text: string;
  status: string;
  issued_at: string;
  checked_in_at: string | null;
  checked_in_by_admin_id: string | null;
}

interface GameAccessRow {
  id: string;
  ticket_id: string;
  match_id: string;
  mobile: string;
  is_active: boolean;
  pin_created_at: string;
  pin_expires_at: string | null;
  last_regenerated_by_admin_id: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas helpers (identical to Ticket.tsx for pass design consistency)
// ─────────────────────────────────────────────────────────────────────────────

function isPaid(status: string) {
  return ['paid_verified', 'paid_manual_verified', 'razorpay_paid'].includes(status);
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = 'anonymous';
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

async function buildPassCanvas(ticket: TicketRow, order: any, match: any): Promise<HTMLCanvasElement> {
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

  // Banner
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

  // Seat badge (right column)
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

  // Dashed divider
  y += 8;
  ctx.save();
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = 'hsl(38,30%,25%)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
  ctx.restore();
  y += 28;

  // QR
  const qrCanvas = document.getElementById(`qr-canvas-admin-${ticket.id}`) as HTMLCanvasElement | null;
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

  // Footer
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
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp message builders
// ─────────────────────────────────────────────────────────────────────────────

function buildReminderMessage(order: any): string {
  const balance = Math.max(0, (order.total_amount ?? 0) - (order.advance_paid ?? 0));
  const passUrl = `https://cricket.dronapalace.com/ticket?mobile=${order.purchaser_mobile}`;
  const match = order.match;
  return [
    `🏏 T20 Fan Night — Payment Reminder`,
    ``,
    `Hi ${order.purchaser_full_name}!`,
    balance > 0
      ? `You have a balance of ₹${balance} pending for your booking.`
      : `Your booking payment is pending. Please complete it to confirm your seat(s).`,
    ``,
    match?.name ? `Match: ${match.name}${match.opponent ? ` vs ${match.opponent}` : ''}` : null,
    match?.start_time ? `Date: ${new Date(match.start_time).toLocaleString('en-IN')}` : null,
    `Seats: ${order.seats_count}`,
    ``,
    `Pay & view passes: ${passUrl}`,
    ``,
    `— Hotel Drona Palace`,
  ].filter(Boolean).join('\n');
}

function buildWhatsAppMessage(order: any, match: any, tickets: TicketRow[]): string {
  const passUrl = `https://cricket.dronapalace.com/ticket?mobile=${order.purchaser_mobile}`;
  const seatNos = tickets.map(t => `Seat ${t.seat_index + 1}`).join(', ');
  const statusLine = ['paid_verified', 'paid_manual_verified'].includes(order.payment_status)
    ? '✅ Fully Paid'
    : order.advance_paid > 0
      ? `⚠ Advance ₹${order.advance_paid} — Balance ₹${Math.max(0, order.total_amount - order.advance_paid)} due`
      : `⚠ Payment Pending`;

  const lines = [
    `🎟️ Booking Confirmed — Hotel Drona Palace`,
    ``,
    `Hi ${order.purchaser_full_name}! Your T20 Fan Night pass(es) are ready.`,
    ``,
    match?.name ? `🏏 Match: ${match.name}${match?.opponent ? ` vs ${match.opponent}` : ''}` : null,
    match?.venue ? `📍 Venue: ${match.venue}` : null,
    match?.start_time ? `🗓️ Date: ${new Date(match.start_time).toLocaleString('en-IN')}` : null,
    `🪑 ${seatNos}`,
    `💳 Payment: ${statusLine}`,
    `📋 Booking ID: #${order.id.slice(-8).toUpperCase()}`,
    ``,
    `🎫 View your passes: ${passUrl}`,
    ``,
    `— Hotel Drona Palace`,
  ].filter(l => l !== null).join('\n');

  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<OverrideTarget>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [viewingProof, setViewingProof] = useState<string | null>(null);
  const [advanceForm, setAdvanceForm] = useState<AdvanceFormState>(null);
  const [savingAdvance, setSavingAdvance] = useState(false);

  // New state for extended features
  const [activeTab, setActiveTab] = useState<Record<string, DetailTab>>({});
  const [orderTickets, setOrderTickets] = useState<Record<string, TicketRow[]>>({});
  const [ticketsLoading, setTicketsLoading] = useState<Record<string, boolean>>({});
  const [gameAccess, setGameAccess] = useState<Record<string, GameAccessRow | null>>({});
  const [downloadingPassId, setDownloadingPassId] = useState<string | null>(null);
  const [downloadingAllId, setDownloadingAllId] = useState<string | null>(null);
  const [regeneratingPin, setRegeneratingPin] = useState<string | null>(null);
  const [freshPin, setFreshPin] = useState<Record<string, string>>({});
  const [checkingInTicket, setCheckingInTicket] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Broadcast selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Date range filter
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Deep-link filter support: /admin/orders?filter=pending_verification
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam) setStatusFilter(filterParam);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        match:matches!match_id(id, name, venue, start_time, opponent),
        proofs:payment_proofs(
          id, ai_verdict, ai_reason, extracted_amount, extracted_txn_id,
          file_path, created_at, ai_confidence, fraud_flags,
          override_reason, overridden_at, overridden_by_admin_id
        )
      `)
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  // ── Expand / collapse with lazy ticket load ──
  const handleExpand = useCallback(async (orderId: string) => {
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(orderId);
    if (!activeTab[orderId]) {
      setActiveTab(t => ({ ...t, [orderId]: 'overview' }));
    }
    if (!orderTickets[orderId]) {
      setTicketsLoading(l => ({ ...l, [orderId]: true }));
      const { data: ticketData } = await supabase
        .from('tickets')
        .select('id, seat_index, qr_text, status, issued_at, checked_in_at, checked_in_by_admin_id')
        .eq('order_id', orderId)
        .order('seat_index', { ascending: true });
      const tickets = (ticketData || []) as TicketRow[];
      setOrderTickets(t => ({ ...t, [orderId]: tickets }));

      // Fetch game_access for each ticket
      for (const t of tickets) {
        const { data: ga } = await supabase
          .from('game_access')
          .select('*')
          .eq('ticket_id', t.id)
          .maybeSingle();
        setGameAccess(prev => ({ ...prev, [t.id]: ga as GameAccessRow | null }));
      }
      setTicketsLoading(l => ({ ...l, [orderId]: false }));
    }
  }, [expandedId, activeTab, orderTickets]);

  // ── Reload tickets/game_access for an order ──
  const reloadOrderTickets = useCallback(async (orderId: string) => {
    const { data: ticketData } = await supabase
      .from('tickets')
      .select('id, seat_index, qr_text, status, issued_at, checked_in_at, checked_in_by_admin_id')
      .eq('order_id', orderId)
      .order('seat_index', { ascending: true });
    const tickets = (ticketData || []) as TicketRow[];
    setOrderTickets(t => ({ ...t, [orderId]: tickets }));
    for (const t of tickets) {
      const { data: ga } = await supabase
        .from('game_access')
        .select('*')
        .eq('ticket_id', t.id)
        .maybeSingle();
      setGameAccess(prev => ({ ...prev, [t.id]: ga as GameAccessRow | null }));
    }
  }, []);

  // ── Pass download ──
  const downloadSinglePass = useCallback(async (ticket: TicketRow, order: any, match: any) => {
    setDownloadingPassId(ticket.id);
    try {
      const canvas = await buildPassCanvas(ticket, order, match);
      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pass-${order.purchaser_full_name.replace(/\s+/g, '-')}-seat-${ticket.seat_index + 1}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Download failed', description: e.message });
    }
    setDownloadingPassId(null);
  }, [toast]);

  const downloadAllPasses = useCallback(async (orderId: string, order: any, match: any) => {
    const tickets = orderTickets[orderId] || [];
    if (!tickets.length) return;
    setDownloadingAllId(orderId);
    for (let i = 0; i < tickets.length; i++) {
      await new Promise(res => setTimeout(res, i === 0 ? 0 : 400));
      try {
        const canvas = await buildPassCanvas(tickets[i], order, match);
        canvas.toBlob(blob => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `pass-${order.purchaser_full_name.replace(/\s+/g, '-')}-seat-${tickets[i].seat_index + 1}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
      } catch { /* skip failed */ }
    }
    setDownloadingAllId(null);
    toast({ title: '✅ Passes downloaded', description: `${tickets.length} pass(es) saved.` });
  }, [orderTickets, toast]);

  // ── PIN regeneration ──
  const handleRegeneratePin = useCallback(async (ticket: TicketRow, order: any) => {
    setRegeneratingPin(ticket.id);
    try {
      const { data, error } = await supabase.functions.invoke('admin-checkin', {
        body: {
          ticket_id: ticket.id,
          admin_id: user?.id,
          regenerate: true,
          qr_text: ticket.qr_text,
        },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Failed');
      setFreshPin(p => ({ ...p, [ticket.id]: data.pin }));
      // Refresh game_access
      const { data: ga } = await supabase.from('game_access').select('*').eq('ticket_id', ticket.id).maybeSingle();
      setGameAccess(prev => ({ ...prev, [ticket.id]: ga as GameAccessRow | null }));
      toast({ title: '🔑 New PIN generated', description: `New PIN: ${data.pin} — note it down now.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'PIN regen failed', description: e.message });
    }
    setRegeneratingPin(null);
  }, [user, toast]);

  // ── Check-in ──
  const handleCheckIn = useCallback(async (ticket: TicketRow, order: any, orderId: string) => {
    setCheckingInTicket(ticket.id);
    try {
      const { data, error } = await supabase.functions.invoke('admin-checkin', {
        body: {
          ticket_id: ticket.id,
          admin_id: user?.id,
          regenerate: false,
          qr_text: ticket.qr_text,
        },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Failed');
      toast({ title: '✅ Checked In', description: `PIN issued: ${data.pin}` });
      setFreshPin(p => ({ ...p, [ticket.id]: data.pin }));
      await reloadOrderTickets(orderId);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Check-in failed', description: e.message });
    }
    setCheckingInTicket(null);
  }, [user, toast, reloadOrderTickets]);

  // ── Override ──
  const handleOverrideSubmit = async () => {
    if (!overrideTarget) return;
    if (overrideReason.trim().length < 5) {
      toast({ variant: 'destructive', title: 'Reason too short', description: 'Please enter at least 5 characters.' });
      return;
    }
    const { orderId, verdict } = overrideTarget;
    setUpdatingId(orderId);
    try {
      await supabase.from('orders').update({
        payment_status: verdict,
        payment_verified_at: new Date().toISOString(),
        payment_verified_by_admin_id: user?.id,
      } as any).eq('id', orderId);

      const order = orders.find(o => o.id === orderId);
      const latestProof = order?.proofs?.slice(-1)?.[0];
      if (latestProof) {
        await supabase.from('payment_proofs').update({
          override_reason: overrideReason.trim(),
          overridden_by_admin_id: user?.id,
          overridden_at: new Date().toISOString(),
        } as any).eq('id', latestProof.id);
      }
      await supabase.from('admin_activity').insert({
        admin_id: user?.id, action: verdict, entity_type: 'order', entity_id: orderId,
        meta: { reason: overrideReason.trim() },
      });
      if (verdict === 'paid_manual_verified') {
        const { count: ticketCount } = await supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('order_id', orderId);
        if ((ticketCount ?? 0) === 0 && order) {
          for (let i = 0; i < order.seats_count; i++) {
            const { data: issuedTicket } = await supabase.functions.invoke('reissue-qr', {
              body: { ticket_id: '__new__', admin_id: user?.id, _generate_new: true, match_id: order.match_id, mobile: order.purchaser_mobile, seat_index: i, order_id: orderId, event_id: order.event_id }
            });
            if (!issuedTicket?.success) {
              const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
              const qrText = `T20FN-${order.match_id.slice(0, 8)}-${order.purchaser_mobile}-S${i + 1}-${Date.now()}-${rand}`;
              await supabase.from('tickets').insert({ match_id: order.match_id, event_id: order.event_id, order_id: orderId, seat_index: i, qr_text: qrText, status: 'active' });
            }
          }
        }
      }
      toast({ title: verdict === 'paid_manual_verified' ? '✅ Manually Verified' : '❌ Rejected', description: `Reason: ${overrideReason.trim()}` });
      setOverrideTarget(null); setOverrideReason('');
      fetchOrders();
      if (orderId === expandedId) {
        setOrderTickets(t => { const n = { ...t }; delete n[orderId]; return n; });
      }
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setUpdatingId(null);
  };

  const handleViewProof = async (filePath: string) => {
    setViewingProof(filePath);
    try {
      const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(filePath, 300);
      if (error || !data?.signedUrl) throw new Error('Could not generate proof URL');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) { toast({ variant: 'destructive', title: 'Cannot open proof', description: e.message }); }
    setViewingProof(null);
  };

  const handleSaveAdvance = async () => {
    if (!advanceForm) return;
    const { orderId, amount, method } = advanceForm;
    const numAmount = parseInt(amount, 10);
    const order = orders.find(o => o.id === orderId);
    if (!numAmount || numAmount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid amount' });
      return;
    }
    if (order && numAmount > order.total_amount) {
      toast({ variant: 'destructive', title: 'Amount too high' });
      return;
    }
    setSavingAdvance(true);
    try {
      await supabase.from('orders').update({ advance_paid: numAmount, advance_payment_method: method } as any).eq('id', orderId);
      await supabase.from('payment_collections').insert({
        order_id: orderId, collected_by_admin_id: user?.id, method: method as any,
        amount: numAmount, note: `Advance ₹${numAmount} via ${method.toUpperCase()} — balance ₹${(order?.total_amount ?? 0) - numAmount} due`,
      });
      await supabase.from('admin_activity').insert({
        admin_id: user?.id, action: 'record_advance', entity_type: 'order', entity_id: orderId,
        meta: { amount: numAmount, method },
      });
      toast({ title: '✅ Advance recorded', description: `₹${numAmount} via ${method.toUpperCase()} saved.` });
      setAdvanceForm(null);
      fetchOrders();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setSavingAdvance(false);
  };

  const copyOrderId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedOrderId(id);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.purchaser_full_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.purchaser_mobile?.includes(search);
    const isPaidFully = ['paid_verified', 'paid_manual_verified'].includes(o.payment_status);
    const hasBalanceDue = (o.advance_paid ?? 0) > 0 && !isPaidFully;
    if (statusFilter === 'balance_due' && !(!isPaidFully && (o.advance_paid ?? 0) > 0)) return false;
    if (statusFilter !== 'balance_due') {
      const matchStatus = statusFilter === 'all' || o.payment_status === statusFilter;
      if (!matchStatus) return false;
    }
    if (dateFrom) {
      const created = new Date(o.created_at);
      if (created < startOfDay(dateFrom)) return false;
    }
    if (dateTo) {
      const created = new Date(o.created_at);
      if (created > endOfDay(dateTo)) return false;
    }
    return matchSearch;
  });

  const selectedOrders = filtered.filter(o => selectedIds.has(o.id));

  const copyAllLinks = () => {
    const text = selectedOrders
      .map(o => `${o.purchaser_full_name} (+91${o.purchaser_mobile}): https://wa.me/91${o.purchaser_mobile}?text=${encodeURIComponent(buildReminderMessage(o))}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
    toast({ title: '✅ Copied!', description: `${selectedOrders.length} WhatsApp links copied to clipboard.` });
  };

  const paymentMethodBadge = (method: string) => {
    const styles: Record<string, string> = {
      razorpay: 'bg-primary/20 text-primary border-primary/30',
      upi_qr: 'bg-success/15 text-success border-success/30',
      pay_at_hotel: 'bg-warning/15 text-warning border-warning/40',
      cash: 'bg-secondary/15 text-secondary border-secondary/30',
    };
    const s = styles[method] || 'bg-muted text-muted-foreground border-border/30';
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${s}`}>
        {method?.replace(/_/g, ' ')}
      </span>
    );
  };

  const confidenceClass = (c: string) =>
    c === 'high' ? 'bg-success/20 text-success' :
    c === 'medium' ? 'bg-warning/20 text-warning' :
    'bg-destructive/20 text-destructive';

  const ticketStatusColor = (s: string) =>
    s === 'used' ? 'text-success bg-success/15 border-success/30' :
    s === 'blocked' ? 'text-destructive bg-destructive/15 border-destructive/30' :
    'text-primary bg-primary/15 border-primary/30';

  // ─────────────────────────────────────────────────────────────────────────
  // Tab content renderers
  // ─────────────────────────────────────────────────────────────────────────

  const renderOverviewTab = (order: any) => {
    const balanceDue = Math.max(0, (order.total_amount ?? 0) - (order.advance_paid ?? 0));
    const hasAdvance = (order.advance_paid ?? 0) > 0;
    const isPaidFully = ['paid_verified', 'paid_manual_verified'].includes(order.payment_status);
    const isRazorpay = order.payment_method === 'razorpay';
    const snapshot = order.pricing_model_snapshot;
    const seats: any[] = Array.isArray(snapshot?.seats) ? snapshot.seats : [];
    const pricingReason = seats[0]?.reason || 'standard';

    return (
      <div className="space-y-3">
        {/* Customer + booking info */}
        <div className="glass-card-sunken p-3 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Customer & Booking</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {[
              { label: 'Full Name', value: order.purchaser_full_name },
              { label: 'Mobile', value: order.purchaser_mobile },
              { label: 'Email', value: order.purchaser_email || '—' },
              { label: 'Seating Type', value: order.seating_type },
              { label: 'Seats', value: `${order.seats_count} seat${order.seats_count > 1 ? 's' : ''}` },
              { label: 'Source', value: order.created_source?.replace(/_/g, ' ') || '—' },
              { label: 'Match', value: order.match?.name || '—' },
              { label: 'Booked At', value: new Date(order.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-foreground capitalize truncate">{value}</p>
              </div>
            ))}
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Booking ID</p>
              <button
                className="flex items-center gap-1.5 text-xs font-mono text-primary hover:text-primary/80 transition-colors"
                onClick={() => copyOrderId(order.id)}
              >
                {order.id}
                {copiedOrderId === order.id ? <CheckCircle2 className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="glass-card-sunken p-3 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Payment & Pricing</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Total Amount</p>
              <p className="font-bold text-primary text-base">₹{order.total_amount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pricing Type</p>
              {seats.some((s: any) => s.reason === 'loyal_base' || s.reason === 'semifinal_attendee')
                ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">⭐ Special ₹949</span>
                : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground border border-border/30">Standard ₹{Math.round(order.total_amount / (order.seats_count || 1))}</span>
              }
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payment Method</p>
              {paymentMethodBadge(order.payment_method)}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payment Status</p>
              <StatusBadge status={order.payment_status} />
            </div>
            {hasAdvance && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Advance Paid</p>
                  <p className="text-success font-bold">₹{order.advance_paid}
                    {order.advance_payment_method && <span className="text-muted-foreground font-normal ml-1 capitalize">({order.advance_payment_method})</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Balance Due</p>
                  <p className={`font-bold ${balanceDue > 0 ? 'text-warning' : 'text-success'}`}>
                    {balanceDue > 0 ? `₹${balanceDue}` : '✅ Cleared'}
                  </p>
                </div>
              </>
            )}
            {order.payment_verified_at && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Verified At</p>
                <p className="text-foreground text-xs">{new Date(order.payment_verified_at).toLocaleString('en-IN')}</p>
              </div>
            )}
            {order.razorpay_payment_id && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Razorpay Payment ID</p>
                <p className="font-mono text-xs text-foreground truncate">{order.razorpay_payment_id}</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment proof */}
        {order.proofs?.length > 0 && (
          <div className="glass-card-sunken p-3 rounded-xl space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Latest Payment Proof</p>
            {order.proofs.slice(-1).map((proof: any) => (
              <div key={proof.id} className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={proof.ai_verdict} />
                  {proof.ai_confidence && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${confidenceClass(proof.ai_confidence)}`}>
                      {proof.ai_confidence} confidence
                    </span>
                  )}
                </div>
                {proof.ai_reason && <p className="text-muted-foreground">{proof.ai_reason}</p>}
                {Array.isArray(proof.fraud_flags) && proof.fraud_flags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    {proof.fraud_flags.map((flag: string) => (
                      <span key={flag} className="px-1.5 py-0.5 rounded bg-destructive/20 text-destructive text-xs font-medium">
                        {flag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
                {proof.extracted_amount && <p className="text-muted-foreground">Amount: ₹{proof.extracted_amount}</p>}
                {proof.extracted_txn_id && <p className="text-muted-foreground">TXN: {proof.extracted_txn_id}</p>}
                {proof.override_reason && (
                  <div className="flex items-start gap-1.5 pt-1 border-t border-border/30">
                    <Shield className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <span className="text-primary font-medium">Override: </span>
                      <span className="text-muted-foreground">{proof.override_reason}</span>
                    </div>
                  </div>
                )}
                {proof.file_path && (
                  <button
                    onClick={() => handleViewProof(proof.file_path)}
                    disabled={viewingProof === proof.file_path}
                    className="flex items-center gap-1.5 text-primary hover:text-primary/80 font-medium mt-1"
                  >
                    {viewingProof === proof.file_path ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                    View Proof
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Override form */}
        {overrideTarget?.orderId === order.id ? (
          <div className="glass-card-sunken p-3 space-y-2 border border-border/50 rounded-xl">
            <p className="text-sm font-medium text-foreground">
              {overrideTarget.verdict === 'paid_manual_verified' ? '✅ Manual Verify' : '❌ Reject'} — enter reason
            </p>
            <Textarea
              className="glass-input text-sm resize-none"
              placeholder="Reason (min 5 chars)..."
              rows={2}
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <GlassButton
                variant={overrideTarget.verdict === 'paid_manual_verified' ? 'success' : 'danger'}
                size="sm" loading={updatingId === order.id}
                onClick={handleOverrideSubmit}
                disabled={overrideReason.trim().length < 5}
              >Confirm</GlassButton>
              <GlassButton variant="ghost" size="sm" onClick={() => { setOverrideTarget(null); setOverrideReason(''); }}>Cancel</GlassButton>
            </div>
          </div>
        ) : (
          ['pending_verification', 'paid_rejected', 'unpaid'].includes(order.payment_status) && (
            <div className="flex gap-2 flex-wrap">
              {order.payment_method !== 'razorpay' && (
                <GlassButton variant="success" size="sm" className="flex-1 h-11"
                  onClick={() => setOverrideTarget({ orderId: order.id, verdict: 'paid_manual_verified' })}>
                  <CheckCircle2 className="h-4 w-4" /> Verify
                </GlassButton>
              )}
              <GlassButton variant="danger" size="sm" className="flex-1 h-11"
                onClick={() => setOverrideTarget({ orderId: order.id, verdict: 'paid_rejected' })}>
                <XCircle className="h-4 w-4" /> Reject
              </GlassButton>
              <GlassButton variant="ghost" size="sm" className="flex-1 h-11"
                onClick={() => setAdvanceForm({ orderId: order.id, amount: '', method: 'upi' })}>
                <Banknote className="h-4 w-4" /> Advance
              </GlassButton>
            </div>
          )
        )}

        {/* Advance form */}
        {advanceForm?.orderId === order.id && (
          <div className="glass-card-sunken p-3 space-y-2 border border-border/50 rounded-xl mt-2">
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Banknote className="h-4 w-4 text-primary" /> Record Advance Payment
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Amount (₹)</p>
                <Input
                  type="number"
                  className="glass-input h-10 text-sm"
                  placeholder={`max ₹${order.total_amount}`}
                  min={1} max={order.total_amount}
                  value={advanceForm.amount}
                  onChange={e => setAdvanceForm(f => f ? { ...f, amount: e.target.value } : f)}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Method</p>
                <Select value={advanceForm.method} onValueChange={v => setAdvanceForm(f => f ? { ...f, method: v } : f)}>
                  <SelectTrigger className="glass-input h-10 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {advanceForm.amount && parseInt(advanceForm.amount) > 0 && (
              <p className="text-xs text-muted-foreground">
                Balance after advance: <span className="text-warning font-bold">₹{Math.max(0, order.total_amount - parseInt(advanceForm.amount))}</span>
              </p>
            )}
            <div className="flex gap-2">
              <GlassButton variant="primary" size="sm" loading={savingAdvance}
                onClick={handleSaveAdvance}
                disabled={!advanceForm.amount || parseInt(advanceForm.amount) <= 0}
              >Save</GlassButton>
              <GlassButton variant="ghost" size="sm" onClick={() => setAdvanceForm(null)}>Cancel</GlassButton>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPassesTab = (order: any, orderId: string) => {
    const tickets = orderTickets[orderId] || [];
    const match = order.match;
    if (ticketsLoading[orderId]) {
      return (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading tickets...
        </div>
      );
    }
    if (!tickets.length) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Ticket className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No tickets generated yet.</p>
          <p className="text-xs mt-1">Tickets are created after payment verification.</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {/* Hidden QR canvases for pass generation */}
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
          {tickets.map(t => (
            <QRCodeCanvas
              key={t.id}
              id={`qr-canvas-admin-${t.id}`}
              value={t.qr_text}
              size={600}
              bgColor="#ffffff"
              fgColor="#111111"
            />
          ))}
        </div>

        {/* Download all */}
        {tickets.length > 1 && (
          <GlassButton
            variant="primary"
            size="sm"
            className="w-full h-11"
            loading={downloadingAllId === orderId}
            onClick={() => downloadAllPasses(orderId, order, match)}
          >
            <Download className="h-4 w-4" />
            Download All {tickets.length} Passes
          </GlassButton>
        )}

        {/* Individual pass cards */}
        {tickets.map(ticket => (
          <div key={ticket.id} className="glass-card-sunken p-3 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center font-display font-bold text-primary text-base">
                  {ticket.seat_index + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Seat {ticket.seat_index + 1}</p>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded border capitalize ${ticketStatusColor(ticket.status)}`}>
                    {ticket.status}
                  </span>
                </div>
              </div>
              <GlassButton
                variant="ghost"
                size="sm"
                loading={downloadingPassId === ticket.id}
                onClick={() => downloadSinglePass(ticket, order, match)}
                className="h-9 gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download</span>
              </GlassButton>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <QrCode className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono truncate">{ticket.qr_text.slice(0, 32)}…</span>
            </div>
            {ticket.checked_in_at && (
              <div className="flex items-center gap-1.5 text-xs text-success">
                <CheckSquare2 className="h-3.5 w-3.5" />
                Checked in {new Date(ticket.checked_in_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderGamePinTab = (order: any, orderId: string) => {
    const tickets = orderTickets[orderId] || [];
    const match = order.match;

    if (ticketsLoading[orderId]) {
      return (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading...
        </div>
      );
    }
    if (!tickets.length) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <KeyRound className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No tickets — no game access entries.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {tickets.map(ticket => {
          const ga = gameAccess[ticket.id];
          const pin = freshPin[ticket.id];
          const isCheckedIn = ticket.status === 'used';

          return (
            <div key={ticket.id} className="glass-card-sunken p-3 rounded-xl space-y-3">
              {/* Ticket header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center font-display font-bold text-primary text-base">
                    {ticket.seat_index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Seat {ticket.seat_index + 1}</p>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded border capitalize ${ticketStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Check-in status */}
              <div className="text-xs space-y-1">
                {isCheckedIn ? (
                  <div className="flex items-center gap-1.5 text-success">
                    <CheckSquare2 className="h-4 w-4" />
                    <span className="font-semibold">Gate Check-in Complete</span>
                    {ticket.checked_in_at && (
                      <span className="text-muted-foreground ml-1">
                        {new Date(ticket.checked_in_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Not yet checked in at gate</span>
                  </div>
                )}
              </div>

              {/* Game access / PIN section */}
              {ga ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ga.is_active ? 'text-success bg-success/15 border-success/30' : 'text-muted-foreground bg-muted/20 border-border/30'}`}>
                      {ga.is_active ? '● Active' : '○ Inactive'}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      PIN set {new Date(ga.pin_created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    {ga.last_regenerated_by_admin_id && (
                      <span className="text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded border border-warning/30">
                        🔄 Regenerated
                      </span>
                    )}
                  </div>

                  {/* Fresh PIN display */}
                  {pin && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30">
                      <Zap className="h-5 w-5 text-primary shrink-0" />
                      <div>
                        <p className="text-xs text-primary/70 font-medium">New PIN (shown once)</p>
                        <p className="font-display text-3xl font-black text-primary tracking-[0.3em] leading-none mt-0.5">{pin}</p>
                      </div>
                    </div>
                  )}

                  <GlassButton
                    variant="primary"
                    size="sm"
                    className="w-full h-10"
                    loading={regeneratingPin === ticket.id}
                    onClick={() => handleRegeneratePin(ticket, order)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate PIN
                  </GlassButton>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    No game PIN generated yet. Check in at gate to generate a PIN.
                  </p>
                  {/* Fresh PIN display after check-in */}
                  {pin && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30">
                      <Zap className="h-5 w-5 text-primary shrink-0" />
                      <div>
                        <p className="text-xs text-primary/70 font-medium">New PIN (shown once)</p>
                        <p className="font-display text-3xl font-black text-primary tracking-[0.3em] leading-none mt-0.5">{pin}</p>
                      </div>
                    </div>
                  )}
                  {!isCheckedIn && (
                    <GlassButton
                      variant="success"
                      size="sm"
                      className="w-full h-10"
                      loading={checkingInTicket === ticket.id}
                      onClick={() => handleCheckIn(ticket, order, orderId)}
                    >
                      <CheckSquare2 className="h-3.5 w-3.5" />
                      Check In & Generate PIN
                    </GlassButton>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderConsentTab = (order: any) => {
    const [consentData, setConsentData] = React.useState<any>(null);
    const [consentLoading, setConsentLoading] = React.useState(true);

    React.useEffect(() => {
      (async () => {
        setConsentLoading(true);
        const { data } = await supabase
          .from('game_consents' as any)
          .select('*')
          .eq('mobile', order.purchaser_mobile)
          .eq('match_id', order.match_id)
          .maybeSingle();
        setConsentData(data ?? null);
        setConsentLoading(false);
      })();
    }, [order.purchaser_mobile, order.match_id]);

    if (consentLoading) {
      return (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading consent...
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Status chip */}
        <div className="glass-card-sunken p-3 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Game Consent Status</p>
          </div>
          {consentData ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-success/15 text-success border border-success/30">
                  ✅ Accepted
                </span>
                <span className="text-xs text-muted-foreground">Terms v{consentData.terms_version}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-2">
                <div>
                  <p className="text-muted-foreground">Accepted At</p>
                  <p className="text-foreground font-medium">{new Date(consentData.accepted_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Terms Version</p>
                  <p className="text-foreground font-medium">{consentData.terms_version}</p>
                </div>
                {consentData.ip_address && (
                  <div>
                    <p className="text-muted-foreground">IP Address</p>
                    <p className="text-foreground font-mono">{consentData.ip_address}</p>
                  </div>
                )}
                {consentData.user_agent && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Device / Browser</p>
                    <p className="text-foreground truncate text-xs opacity-80">{consentData.user_agent.slice(0, 80)}{consentData.user_agent.length > 80 ? '…' : ''}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted/30 text-muted-foreground border border-border/40">
                ○ Not Yet Accepted
              </span>
              <p className="text-xs text-muted-foreground">User has not completed the consent step for this match.</p>
            </div>
          )}
        </div>

        {/* Legal context note */}
        <div className="glass-card-sunken p-3 rounded-xl">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Legal Note</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Consent is recorded once per match per mobile number. It confirms that the user has read and agreed to the entertainment-only participation terms before accessing the prediction game.
          </p>
        </div>
      </div>
    );
  };

  const renderWhatsAppTab = (order: any, orderId: string) => {
    const tickets = orderTickets[orderId] || [];
    const match = order.match;
    const mobile = order.purchaser_mobile;
    const passUrl = `https://cricket.dronapalace.com/ticket?mobile=${mobile}`;
    const message = buildWhatsAppMessage(order, match, tickets);
    const waLink = `https://wa.me/91${mobile}?text=${encodeURIComponent(message)}`;
    const waLinkNoNum = `https://wa.me/?text=${encodeURIComponent(message)}`;

    return (
      <div className="space-y-3">
        {/* Message preview */}
        <div className="glass-card-sunken p-3 rounded-xl">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Message Preview</p>
          <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
            {message}
          </pre>
        </div>

        {/* Pass link */}
        <div className="glass-card-sunken p-3 rounded-xl space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pass Link</p>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono text-primary truncate flex-1">{passUrl}</p>
            <button
              className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
              onClick={() => { navigator.clipboard.writeText(passUrl); toast({ title: 'Copied!', description: 'Pass link copied.' }); }}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Send buttons */}
        <div className="space-y-2">
          <GlassButton
            variant="success"
            size="sm"
            className="w-full h-12 text-sm font-semibold"
            onClick={() => window.open(waLink, '_blank', 'noopener,noreferrer')}
          >
            <MessageCircle className="h-4 w-4" />
            Send to {mobile} via WhatsApp
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            className="w-full h-10 text-sm"
            onClick={() => window.open(waLinkNoNum, '_blank', 'noopener,noreferrer')}
          >
            <MessageCircle className="h-4 w-4" />
            Open WhatsApp (choose contact manually)
          </GlassButton>
        </div>

        {/* Copy message */}
        <GlassButton
          variant="ghost"
          size="sm"
          className="w-full h-10 text-sm"
          onClick={() => { navigator.clipboard.writeText(message); toast({ title: 'Copied!', description: 'Message copied to clipboard.' }); }}
        >
          <Copy className="h-4 w-4" />
          Copy Message Text
        </GlassButton>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 py-5 space-y-4 max-w-2xl mx-auto md:max-w-none md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold gradient-text-accent">Bookings</h1>
          <p className="text-muted-foreground text-sm">Complete booking management & controls</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!loading && (
            <span className="text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-full font-medium border border-border/50">
              {filtered.length} booking{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
          <GlassButton variant="ghost" size="sm" loading={loading} onClick={fetchOrders}>
            <RefreshCw className="h-3.5 w-3.5" />
          </GlassButton>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="glass-input pl-9 h-12 text-base"
              placeholder="Search name or mobile..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="glass-input h-12 sm:w-52">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="pending_verification">Pending</SelectItem>
              <SelectItem value="paid_verified">Paid Verified</SelectItem>
              <SelectItem value="paid_rejected">Rejected</SelectItem>
              <SelectItem value="paid_manual_verified">Manual Verified</SelectItem>
              <SelectItem value="balance_due">⚠ Balance Due</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date range row */}
        <div className="flex items-center gap-2 flex-wrap">
          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 px-3 text-xs font-medium glass-input border-border/50">
                {dateFrom ? format(dateFrom, 'dd MMM yyyy') : 'From date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
                initialFocus
                className="p-3 pointer-events-auto"
                disabled={(d) => dateTo ? d > dateTo : false}
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground text-xs">—</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 px-3 text-xs font-medium glass-input border-border/50">
                {dateTo ? format(dateTo, 'dd MMM yyyy') : 'To date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
                initialFocus
                className="p-3 pointer-events-auto"
                disabled={(d) => dateFrom ? d < dateFrom : false}
              />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}
            >
              <CalendarX className="h-3.5 w-3.5 mr-1" />
              Clear dates
            </Button>
          )}
        </div>
      </div>

      {/* Broadcast action bar — appears when items are selected */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-4 py-3 rounded-xl border border-success/40 bg-success/8 backdrop-blur-sm sticky top-2 z-10">
          <span className="text-sm font-semibold text-success flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          <GlassButton
            variant="success"
            size="sm"
            className="h-9 text-xs font-semibold"
            onClick={() => setBroadcastOpen(true)}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Send Reminders
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            className="h-9 text-xs"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </GlassButton>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} lines={3} showAvatar />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <GlassCard className="p-10 text-center">
              <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-display text-lg font-bold text-foreground">No bookings found</p>
              <p className="text-muted-foreground text-sm mt-1">Try adjusting your search or filter</p>
            </GlassCard>
          )}
          {filtered.map(order => {
            const balanceDue = Math.max(0, (order.total_amount ?? 0) - (order.advance_paid ?? 0));
            const hasAdvance = (order.advance_paid ?? 0) > 0;
            const isPaidFully = ['paid_verified', 'paid_manual_verified'].includes(order.payment_status);
            const isExpanded = expandedId === order.id;
            const isSelected = selectedIds.has(order.id);
            const currentTab: DetailTab = activeTab[order.id] || 'overview';

            return (
              <GlassCard key={order.id} className={`overflow-hidden transition-all duration-150 ${isSelected ? 'ring-1 ring-success/50' : ''}`}>
                {/* Summary row */}
                <div className="flex items-stretch">
                  {/* Checkbox column */}
                  <div
                    className="flex items-center justify-center px-3 shrink-0 cursor-pointer"
                    onClick={(e) => toggleSelect(order.id, e)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => setSelectedIds(prev => {
                        const next = new Set(prev);
                        next.has(order.id) ? next.delete(order.id) : next.add(order.id);
                        return next;
                      })}
                      className="h-4 w-4"
                    />
                  </div>
                  {/* Main expand button */}
                  <button
                    className="flex-1 p-4 pl-0 text-left active:bg-muted/10"
                    onClick={() => handleExpand(order.id)}
                  >
                    <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground leading-snug">{order.purchaser_full_name}</p>
                          <p className="text-sm text-muted-foreground">{order.purchaser_mobile}</p>
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground/70">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>{new Date(order.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <StatusBadge status={order.payment_status} />
                            {paymentMethodBadge(order.payment_method)}
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{order.match?.name}</span>
                          </div>
                          {hasAdvance && !isPaidFully && (
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success/15 text-success border border-success/30">
                                Adv ₹{order.advance_paid}
                              </span>
                              {balanceDue > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-warning/15 text-warning border border-warning/40">
                                  ⚠ Due ₹{balanceDue}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-display font-bold text-primary text-base">₹{order.total_amount}</span>
                        <span className="text-xs text-muted-foreground">{order.seats_count} seat{order.seats_count > 1 ? 's' : ''}</span>
                        {(() => {
                          const snapshot = order.pricing_model_snapshot;
                          const seats: any[] = Array.isArray(snapshot?.seats) ? snapshot.seats : [];
                          const hasSpecial = seats.some((s: any) => s.reason === 'semifinal_attendee' || s.reason === 'loyal_base');
                          return hasSpecial
                            ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success/15 text-success border border-success/30">⭐ Special</span>
                            : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted/40 text-muted-foreground border border-border/30">Standard</span>;
                        })()}
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground mt-1" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground mt-1" />}
                      </div>
                    </div>
                  </button>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-border/50">
                    {/* Tab bar */}
                    <div className="flex gap-1 p-3 pb-0 overflow-x-auto">
                      {(
                        [
                          { id: 'overview', label: 'Overview', icon: User },
                          { id: 'passes', label: 'Passes', icon: Ticket },
                          { id: 'gamepin', label: 'Game PIN', icon: KeyRound },
                          { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                          { id: 'consent', label: 'Consent', icon: ShieldCheck },
                        ] as { id: DetailTab; label: string; icon: React.ElementType }[]
                      ).map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(t => ({ ...t, [order.id]: tab.id }))}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                            currentTab === tab.id
                              ? 'bg-primary/15 text-primary border-b-2 border-primary'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                          }`}
                        >
                          <tab.icon className="h-3.5 w-3.5" />
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Tab content */}
                    <div className="p-3 pt-3">
                      {currentTab === 'overview' && renderOverviewTab(order)}
                      {currentTab === 'passes' && renderPassesTab(order, order.id)}
                      {currentTab === 'gamepin' && renderGamePinTab(order, order.id)}
                      {currentTab === 'whatsapp' && renderWhatsAppTab(order, order.id)}
                      {currentTab === 'consent' && renderConsentTab(order)}
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* ── Broadcast Modal ── */}
      {broadcastOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-sm"
          onClick={() => setBroadcastOpen(false)}
        >
          <div
            className="w-full sm:max-w-lg bg-card border border-border/60 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85dvh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-success" />
                <h2 className="font-display font-bold text-foreground text-base">
                  Send Reminders — {selectedOrders.length} booking{selectedOrders.length !== 1 ? 's' : ''}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <GlassButton
                  variant={copiedAll ? 'success' : 'ghost'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={copyAllLinks}
                >
                  {copiedAll ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedAll ? 'Copied!' : 'Copy All'}
                </GlassButton>
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  onClick={() => setBroadcastOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal body — scrollable list */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {selectedOrders.map(order => {
                const balance = Math.max(0, (order.total_amount ?? 0) - (order.advance_paid ?? 0));
                const message = buildReminderMessage(order);
                const waLink = `https://wa.me/91${order.purchaser_mobile}?text=${encodeURIComponent(message)}`;
                const isCopied = copiedLinkId === order.id;

                return (
                  <div key={order.id} className="glass-card-sunken p-3 rounded-xl space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-sm leading-snug truncate">{order.purchaser_full_name}</p>
                        <p className="text-xs text-muted-foreground">+91{order.purchaser_mobile}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge status={order.payment_status} />
                        {balance > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-warning/15 text-warning border border-warning/40">
                            ₹{balance} due
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <GlassButton
                        variant="success"
                        size="sm"
                        className="flex-1 h-9 text-xs font-semibold"
                        onClick={() => window.open(waLink, '_blank', 'noopener,noreferrer')}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Open WhatsApp
                      </GlassButton>
                      <GlassButton
                        variant={isCopied ? 'success' : 'ghost'}
                        size="sm"
                        className="h-9 text-xs px-3"
                        onClick={() => {
                          navigator.clipboard.writeText(waLink);
                          setCopiedLinkId(order.id);
                          setTimeout(() => setCopiedLinkId(null), 2000);
                        }}
                      >
                        {isCopied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </GlassButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
