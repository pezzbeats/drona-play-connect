import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ScanLine, QrCode, CheckCircle2, Upload, Copy, RefreshCw, Loader2,
  User, DollarSign, ShieldAlert, ShieldCheck, ShieldOff, AlertTriangle,
  WifiOff, Banknote, Smartphone, CreditCard, XCircle,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function playBeep(type: 'success' | 'error') {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = type === 'success' ? 880 : 220;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (type === 'success' ? 0.2 : 0.4));
    osc.start();
    osc.stop(ctx.currentTime + (type === 'success' ? 0.2 : 0.4));
  } catch { /* AudioContext may be blocked before user interaction */ }
}

function vibrate(pattern: number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

type ScanFeedback = 'idle' | 'loading' | 'success' | 'error' | 'mismatch' | 'blocked';

interface OfflineAction {
  action: 'checkin';
  ticket_id: string;
  admin_id: string;
  qr_text: string;
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = 'gate_offline_queue';

function loadOfflineQueue(): OfflineAction[] {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); }
  catch { return []; }
}
function saveOfflineQueue(q: OfflineAction[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
}

// ── component ─────────────────────────────────────────────────────────────────

export default function AdminValidate() {
  const [qrInput, setQrInput] = useState('');
  const [ticketData, setTicketData] = useState<any>(null);
  const [activeMatch, setActiveMatch] = useState<any>(null);
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback>('idle');
  const [checkingIn, setCheckingIn] = useState(false);
  const [gamePin, setGamePin] = useState<string | null>(null);
  const [collectMethod, setCollectMethod] = useState<'cash' | 'upi_qr' | 'card' | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectRef, setCollectRef] = useState('');
  const [collecting, setCollecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockingTicket, setBlockingTicket] = useState(false);
  const [unblockingTicket, setUnblockingTicket] = useState(false);
  const [reissuingQr, setReissuingQr] = useState(false);
  const [showReissueDialog, setShowReissueDialog] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>(loadOfflineQueue);
  const [matchFlags, setMatchFlags] = useState<any>(null);
  // For inline error card
  const [notFoundError, setNotFoundError] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    supabase.from('matches').select('id, name').eq('is_active_for_registration', true).maybeSingle()
      .then(({ data }) => {
        setActiveMatch(data);
        if (data?.id) {
          supabase.from('match_flags').select('*').eq('match_id', data.id).maybeSingle()
            .then(({ data: flags }) => setMatchFlags(flags));
        }
      });
  }, []);

  useEffect(() => {
    if (scanFeedback === 'idle' || scanFeedback === 'loading') return;
    const isGood = scanFeedback === 'success';
    playBeep(isGood ? 'success' : 'error');
    vibrate(isGood ? [120] : [100, 60, 100, 60, 200]);
    clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setScanFeedback('idle'), 1400);
    return () => clearTimeout(feedbackTimerRef.current);
  }, [scanFeedback]);

  const processOfflineQueue = useCallback(async () => {
    const queue = loadOfflineQueue();
    if (!queue.length) return;
    let synced = 0;
    const remaining: OfflineAction[] = [];
    for (const action of queue) {
      if (action.action === 'checkin') {
        try {
          const { error } = await supabase.functions.invoke('admin-checkin', {
            body: { ticket_id: action.ticket_id, admin_id: action.admin_id, qr_text: action.qr_text }
          });
          if (!error) { synced++; continue; }
        } catch { /* keep in queue */ }
      }
      remaining.push(action);
    }
    saveOfflineQueue(remaining);
    setOfflineQueue(remaining);
    if (synced > 0) toast({ title: `🔄 Synced ${synced} queued action${synced > 1 ? 's' : ''}` });
  }, [toast]);

  useEffect(() => {
    const onOnline = () => { setIsOnline(true); processOfflineQueue(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [processOfflineQueue]);

  useEffect(() => {
    if (!activeMatch?.id) return;
    const channel = supabase
      .channel(`validate-flags-${activeMatch.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'match_flags',
        filter: `match_id=eq.${activeMatch.id}`,
      }, (payload) => { if (payload.new) setMatchFlags(payload.new); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeMatch?.id]);

  const logScanAttempt = async (qrText: string, outcome: string, ticketId?: string, matchId?: string) => {
    try {
      const qrHash = await sha256Hex(qrText);
      await supabase.from('ticket_scan_log').insert({
        qr_text_hash: qrHash,
        ticket_id: ticketId || null,
        match_id: matchId || null,
        scanned_by_admin_id: user?.id || null,
        outcome,
      } as any);
    } catch { /* non-blocking */ }
  };

  const lookupTicket = async (qrText: string) => {
    const trimmed = qrText.trim();
    if (!trimmed) return;
    setScanFeedback('loading');
    setTicketData(null); setGamePin(null); setVerifyResult(null);
    setShowBlockForm(false); setBlockReason('');
    setCollectMethod(null); setCollectAmount(''); setCollectRef('');
    setNotFoundError(false);
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, order:orders!order_id(purchaser_full_name, purchaser_mobile, payment_status, seats_count, total_amount, advance_paid, advance_payment_method, match_id, match:matches!match_id(name, venue))')
        .eq('qr_text', trimmed)
        .single();

      if (error || !data) {
        await logScanAttempt(trimmed, 'not_found');
        setScanFeedback('error');
        setNotFoundError(true);
        toast({ variant: 'destructive', title: '❌ Ticket not found' });
        return;
      }

      const ord = (data as any).order;
      const ticketMatchId = data.match_id;
      const paymentStatus = ord?.payment_status;
      const isPaidNow = ['paid_verified', 'paid_manual_verified'].includes(paymentStatus);

      let outcome = 'ok';
      let feedback: ScanFeedback = 'success';
      if (data.status === 'blocked') { outcome = 'blocked_ticket'; feedback = 'blocked'; }
      else if (data.status === 'used') { outcome = 'reuse_blocked'; feedback = 'error'; }
      else if (!isPaidNow) { outcome = 'unpaid'; feedback = 'error'; }
      else if (activeMatch && ticketMatchId !== activeMatch.id) { outcome = 'match_mismatch'; feedback = 'mismatch'; }

      await logScanAttempt(trimmed, outcome, data.id, ticketMatchId);
      setTicketData(data);

      // Pre-fill collect amount with balance due (total - advance already paid)
      const totalAmt = ord?.total_amount ?? 0;
      const advancePd = ord?.advance_paid ?? 0;
      const balanceDue = Math.max(0, totalAmt - advancePd);
      setCollectAmount(balanceDue > 0 ? balanceDue.toString() : totalAmt.toString());

      setScanFeedback(feedback);
    } catch (e: any) {
      setScanFeedback('error');
      setNotFoundError(true);
      toast({ variant: 'destructive', title: 'Lookup failed', description: e.message });
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (pasted) {
      setQrInput(pasted);
      setTimeout(() => lookupTicket(pasted), 50);
    }
  };

  const handleCheckIn = async () => {
    if (!ticketData) return;
    if (!isOnline) {
      const action: OfflineAction = { action: 'checkin', ticket_id: ticketData.id, admin_id: user?.id || '', qr_text: qrInput, timestamp: Date.now() };
      const newQueue = [...offlineQueue, action];
      setOfflineQueue(newQueue);
      saveOfflineQueue(newQueue);
      toast({ title: '📥 Queued — will sync when online', description: 'Check-in saved locally.' });
      return;
    }
    setCheckingIn(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-checkin', {
        body: { ticket_id: ticketData.id, admin_id: user?.id, qr_text: qrInput }
      });
      if (error) throw error;
      setGamePin(data.pin);
      toast({ title: '✅ Checked in!', description: `PIN: ${data.pin}` });
      await lookupTicket(qrInput);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Check-in failed', description: e.message }); }
    setCheckingIn(false);
  };

  const handleRegenPin = async () => {
    if (!ticketData) return;
    setCheckingIn(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-checkin', {
        body: { ticket_id: ticketData.id, admin_id: user?.id, regenerate: true }
      });
      if (error) throw error;
      setGamePin(data.pin);
      toast({ title: '🔄 PIN Regenerated', description: `New PIN: ${data.pin}` });
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setCheckingIn(false);
  };

  const copyWhatsApp = () => {
    if (!ticketData || !gamePin) return;
    const ord = ticketData.order;
    const msg = `🏏 T20 Fan Night - Hotel Drona Palace\nHello ${ord?.purchaser_full_name}!\n✅ Check-in confirmed for ${ord?.match?.name}\n🎮 Your Gameplay PIN: *${gamePin}*\nEnjoy the fun!`;
    navigator.clipboard.writeText(msg);
    toast({ title: '📋 Copied!', description: 'WhatsApp message copied' });
  };

  const handleCollect = async () => {
    if (!ticketData || !collectAmount || !collectMethod) return;
    if (collectMethod !== 'cash' && !collectRef.trim()) {
      toast({ variant: 'destructive', title: 'Reference required for UPI/Card' });
      return;
    }
    setCollecting(true);
    try {
      const { error } = await supabase.functions.invoke('admin-gate-collect', {
        body: { order_id: ticketData.order_id, admin_id: user?.id, method: collectMethod, amount: parseInt(collectAmount), reference_no: collectRef || null }
      });
      if (error) throw error;
      toast({ title: '✅ Payment collected' });
      await lookupTicket(qrInput);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setCollecting(false);
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !ticketData) return;
    setVerifying(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('order_id', ticketData.order_id);
      formData.append('uploaded_by', 'admin');
      const { data, error } = await supabase.functions.invoke('verify-payment-proof', { body: formData });
      if (error) throw error;
      setVerifyResult(data);
      if (data.verdict === 'verified') await lookupTicket(qrInput);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Verify failed', description: e.message }); }
    setVerifying(false);
  };

  const handleBlockTicket = async () => {
    if (!ticketData || blockReason.trim().length < 5) return;
    setBlockingTicket(true);
    try {
      await supabase.from('tickets').update({ status: 'blocked', blocked_reason: blockReason.trim() } as any).eq('id', ticketData.id);
      await supabase.from('admin_activity').insert({ admin_id: user?.id, action: 'block_ticket', entity_type: 'ticket', entity_id: ticketData.id, meta: { reason: blockReason.trim() } });
      toast({ title: '🚫 Ticket blocked' });
      setShowBlockForm(false); setBlockReason('');
      await lookupTicket(qrInput);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setBlockingTicket(false);
  };

  const handleUnblockTicket = async () => {
    if (!ticketData) return;
    setUnblockingTicket(true);
    try {
      await supabase.from('tickets').update({ status: 'active', blocked_reason: null } as any).eq('id', ticketData.id);
      await supabase.from('admin_activity').insert({ admin_id: user?.id, action: 'unblock_ticket', entity_type: 'ticket', entity_id: ticketData.id, meta: {} });
      toast({ title: '✅ Ticket unblocked' });
      await lookupTicket(qrInput);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setUnblockingTicket(false);
  };

  const handleReissueQrConfirmed = async () => {
    if (!ticketData) return;
    setReissuingQr(true);
    try {
      const { data, error } = await supabase.functions.invoke('reissue-qr', { body: { ticket_id: ticketData.id, admin_id: user?.id } });
      if (error) throw error;
      toast({ title: '🔄 QR Reissued', description: 'Old QR is now invalid.' });
      setQrInput(data.new_qr_text);
      await lookupTicket(data.new_qr_text);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Reissue failed', description: e.message }); }
    setReissuingQr(false);
    setShowReissueDialog(false);
  };

  // ── derived state ──────────────────────────────────────────────────────────

  const order = ticketData?.order;
  const isPaid = ['paid_verified', 'paid_manual_verified'].includes(order?.payment_status);
  const isCheckedIn = ticketData?.status === 'used';
  const isBlocked = ticketData?.status === 'blocked';
  const isMatchMismatch = activeMatch && ticketData && ticketData.match_id !== activeMatch.id;
  const isScanningFrozen = !!matchFlags?.scanning_frozen;
  const canCheckIn = isPaid && !isCheckedIn && !isBlocked && !isMatchMismatch && !isScanningFrozen;

  const feedbackBorder: Record<ScanFeedback, string> = {
    idle: 'border-border',
    loading: 'border-primary/40',
    success: 'border-success/70',
    error: 'border-destructive/70',
    mismatch: 'border-warning/70',
    blocked: 'border-destructive/70',
  };
  const feedbackGlow: Record<ScanFeedback, string> = {
    idle: '',
    loading: '',
    success: 'shadow-[0_0_30px_hsl(142_70%_45%/0.35)]',
    error: 'shadow-[0_0_30px_hsl(0_75%_55%/0.35)]',
    mismatch: 'shadow-[0_0_30px_hsl(38_95%_55%/0.35)]',
    blocked: 'shadow-[0_0_30px_hsl(0_75%_55%/0.35)]',
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 py-4 space-y-4 w-full max-w-xl mx-auto md:mx-0">

      {/* Reissue QR Confirmation Dialog */}
      <AlertDialog open={showReissueDialog} onOpenChange={setShowReissueDialog}>
        <AlertDialogContent className="glass-card-elevated border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Reissue QR Code?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>permanently invalidate</strong> the current QR code for this ticket.
              The attendee will need the new QR code to enter. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReissueQrConfirmed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Reissue QR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sticky check-in success bar */}
      {isCheckedIn && order && (
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 rounded-lg bg-success/20 border border-success/50 text-success font-bold text-sm shadow-glow-success">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>✅ CHECKED IN — {order.purchaser_full_name}</span>
          {gamePin && (
            <span className="ml-auto font-display text-lg tracking-widest">{gamePin}</span>
          )}
        </div>
      )}

      {/* Scanning frozen banner */}
      {matchFlags?.scanning_frozen && (
        <div className="sticky top-0 z-20 flex items-center gap-2 px-4 py-3 rounded-lg bg-destructive/15 border border-destructive/50 text-destructive text-sm font-bold">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span>⛔ Gate scanning frozen by admin — check-in disabled until unfrozen</span>
        </div>
      )}

      {/* Offline banner */}
      {!isOnline && (
        <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-warning/15 border border-warning/40 text-warning text-sm font-medium">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Offline — {offlineQueue.length} action{offlineQueue.length !== 1 ? 's' : ''} queued</span>
        </div>
      )}

      <div>
        <h1 className="font-display text-3xl font-bold gradient-text-accent">Gate Validate</h1>
        <p className="text-muted-foreground text-sm">Scan QR or paste ticket code</p>
      </div>

      {/* ── Large scan zone ── */}
      <GlassCard
        className={`p-6 transition-all duration-300 border-2 ${feedbackBorder[scanFeedback]} ${feedbackGlow[scanFeedback]}`}
      >
        <div className="flex items-center gap-2 mb-4">
          <QrCode className="h-6 w-6 text-primary" />
          <h2 className="font-display text-xl font-bold text-foreground">Scan Zone</h2>
          {activeMatch && (
            <span className="ml-auto text-xs text-muted-foreground">
              Active: <span className="text-foreground font-medium">{activeMatch.name}</span>
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 h-14 px-4 rounded-lg font-mono bg-muted/40 border border-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
            style={{ fontSize: '16px' }}
            placeholder="Paste / scan QR code here…"
            value={qrInput}
            onChange={e => setQrInput(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={e => { if (e.key === 'Enter') lookupTicket(e.currentTarget.value); }}
            autoComplete="off"
            spellCheck={false}
          />
          <GlassButton
            variant="primary"
            size="lg"
            loading={scanFeedback === 'loading'}
            onClick={() => lookupTicket(inputRef.current?.value ?? qrInput)}
            className="shrink-0 h-14"
          >
            <ScanLine className="h-5 w-5" />
          </GlassButton>
        </div>

        <div className="mt-3 h-5 text-sm font-medium">
          {scanFeedback === 'success' && <span className="text-success">✓ Ticket found</span>}
          {scanFeedback === 'error' && <span className="text-destructive">✗ Not found or already used</span>}
          {scanFeedback === 'mismatch' && <span className="text-warning">⚠ Wrong match</span>}
          {scanFeedback === 'blocked' && <span className="text-destructive">🚫 Ticket blocked</span>}
        </div>
      </GlassCard>

      {/* Inline error card — ticket not found */}
      {notFoundError && !ticketData && (
        <GlassCard className="p-4 border border-destructive/50 bg-destructive/5">
          <div className="flex items-start gap-3">
            <XCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-bold text-destructive text-lg">❌ Ticket Not Found</p>
              <p className="text-sm text-muted-foreground mt-1">
                No ticket matches this QR code. Try scanning again or check that the QR is for the correct event.
              </p>
              <GlassButton
                variant="ghost" size="sm" className="mt-3"
                onClick={() => { setNotFoundError(false); setQrInput(''); inputRef.current?.focus(); }}
              >
                Try Again
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ── Ticket result ── */}
      {ticketData && order && (
        <>
          {/* Match mismatch */}
          {isMatchMismatch && (
            <GlassCard className="p-4 border border-warning/50 bg-warning/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-warning">Wrong Match — check-in blocked</p>
                  <p className="text-xs text-muted-foreground mt-0.5">This ticket is for <strong className="text-foreground">{order?.match?.name}</strong></p>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Blocked */}
          {isBlocked && (
            <GlassCard className="p-4 border border-destructive/50 bg-destructive/5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-destructive">Ticket Blocked</p>
                  {ticketData.blocked_reason && <p className="text-xs text-muted-foreground mt-0.5">Reason: <span className="text-foreground">{ticketData.blocked_reason}</span></p>}
                </div>
              </div>
            </GlassCard>
          )}

          {/* Critical info card */}
          <GlassCard className={`p-5 border ${isCheckedIn ? 'border-success/40' : isBlocked ? 'border-destructive/40' : isPaid ? 'border-primary/40' : 'border-destructive/40'}`}>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-display text-2xl font-bold text-foreground leading-tight">{order.purchaser_full_name}</h3>
              </div>
              <p className="text-muted-foreground text-sm ml-7">{order.purchaser_mobile}</p>
            </div>

            {/* Balance due banner — shown if advance partially paid and not yet fully settled */}
            {(() => {
              const totalAmt = order?.total_amount ?? 0;
              const advancePd = order?.advance_paid ?? 0;
              const balanceDue = Math.max(0, totalAmt - advancePd);
              if (advancePd > 0 && balanceDue > 0 && !isPaid) {
                return (
                  <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 bg-warning/10 border-warning/50 text-warning">
                    <div>
                      <p className="font-bold text-base">⚠ BALANCE DUE: ₹{balanceDue}</p>
                      <p className="text-xs text-warning/80 mt-0.5">Advance paid: ₹{advancePd} via {order.advance_payment_method || 'cash'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-display font-bold text-foreground text-lg">₹{totalAmt}</p>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Quick summary chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold border-2 ${
                isPaid ? 'bg-success/15 border-success/50 text-success' : 'bg-destructive/15 border-destructive/50 text-destructive'
              }`}>
                {isPaid ? '✅ PAID' : '❌ UNPAID'}
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold border-2 ${
                isCheckedIn ? 'bg-success/15 border-success/50 text-success' : 'bg-muted/40 border-border text-muted-foreground'
              }`}>
                {isCheckedIn ? '✅ CHECKED IN' : '⏳ NOT YET IN'}
              </div>
              {isBlocked && (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold border-2 bg-destructive/15 border-destructive/50 text-destructive">
                  🚫 BLOCKED
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center border-t border-border pt-3">
              <div className="col-span-2 text-left">
                <p className="text-xs text-muted-foreground">Match</p>
                <p className="text-sm font-medium text-foreground leading-snug">{order?.match?.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const bal = Math.max(0, (order.total_amount ?? 0) - (order.advance_paid ?? 0));
                    return bal > 0 && !isPaid ? 'Balance Due' : 'Amount';
                  })()}
                </p>
                <p className="font-display font-bold gradient-text text-lg">
                  {(() => {
                    const bal = Math.max(0, (order.total_amount ?? 0) - (order.advance_paid ?? 0));
                    return bal > 0 && !isPaid ? `₹${bal}` : `₹${order.total_amount}`;
                  })()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <StatusBadge status={ticketData.status} />
              <span className="text-xs text-muted-foreground">Seat #{ticketData.seat_index + 1}</span>
              <span className="text-xs text-muted-foreground ml-auto">{order.seats_count} seat{order.seats_count !== 1 ? 's' : ''}</span>
            </div>
          </GlassCard>

          {/* ── Check-in + PIN ── */}
          {isPaid && (
            <GlassCard className={`p-5 ${isCheckedIn && gamePin ? 'border-success/50 shadow-[0_0_30px_hsl(142_70%_45%/0.2)]' : ''}`}>
              <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" /> Check-In & PIN
              </h2>

              {!isCheckedIn ? (
                <>
                  {!isOnline && (
                    <div className="mb-3 flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg px-3 py-2">
                      <WifiOff className="h-3.5 w-3.5 shrink-0" />
                      Offline — check-in will be queued and synced when reconnected
                    </div>
                  )}
                  {/* Larger check-in button */}
                  <GlassButton
                    variant="success"
                    size="lg"
                    className="w-full h-14 text-lg"
                    loading={checkingIn}
                    onClick={handleCheckIn}
                    disabled={!canCheckIn && isOnline}
                  >
                    <CheckCircle2 className="h-6 w-6" /> Check In & Generate PIN
                  </GlassButton>
                </>
              ) : (
                <div className="space-y-4">
                  {gamePin && (
                    <div className="text-center py-6 px-4 bg-success/10 border-2 border-success/40 rounded-xl">
                      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Gameplay PIN</p>
                      <p className="font-display font-bold text-success tracking-[0.5em] text-7xl leading-none">{gamePin}</p>
                    </div>
                  )}
                  <GlassButton variant="success" size="lg" className="w-full h-14" onClick={copyWhatsApp} disabled={!gamePin}>
                    <Copy className="h-5 w-5" /> Copy WhatsApp Message
                  </GlassButton>
                  <GlassButton variant="ghost" size="md" className="w-full" loading={checkingIn} onClick={handleRegenPin}>
                    <RefreshCw className="h-4 w-4" /> Regenerate PIN
                  </GlassButton>
                </div>
              )}
            </GlassCard>
          )}

          {/* ── Quick payment collection ── */}
          {!isPaid && !isBlocked && (
            <GlassCard className="p-5">
              <h2 className="font-display text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-warning" /> Collect Payment
              </h2>
              {(() => {
                const totalAmt = order?.total_amount ?? 0;
                const advancePd = order?.advance_paid ?? 0;
                const balanceDue = Math.max(0, totalAmt - advancePd);
                if (advancePd > 0 && balanceDue > 0) {
                  return (
                    <p className="text-xs text-warning mb-4">
                      Advance ₹{advancePd} already collected · Collecting balance <span className="font-bold">₹{balanceDue}</span>
                    </p>
                  );
                }
                return <div className="mb-4" />;
              })()}

              {/* Quick method buttons — large min-height */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {([
                  { id: 'cash', label: 'Cash', icon: Banknote },
                  { id: 'upi', label: 'UPI', icon: Smartphone },
                  { id: 'card', label: 'Card', icon: CreditCard },
                ] as const).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setCollectMethod(id)}
                    className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 font-semibold text-sm transition-all duration-150 min-h-[76px] active:scale-95 ${
                      collectMethod === id
                        ? 'bg-warning/20 border-warning text-warning shadow-glow-warning'
                        : 'bg-muted/30 border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                    {label}
                  </button>
                ))}
              </div>

              {collectMethod && (
                <div className="space-y-3">
                  <Input
                    className="glass-input h-14 text-lg font-semibold"
                    type="number"
                    placeholder={(() => {
                      const totalAmt = order?.total_amount ?? 0;
                      const advancePd = order?.advance_paid ?? 0;
                      const bal = Math.max(0, totalAmt - advancePd);
                      return bal > 0 ? `Balance ₹${bal} (total ₹${totalAmt})` : `Amount ₹ (total: ₹${totalAmt})`;
                    })()}
                    value={collectAmount}
                    onChange={e => setCollectAmount(e.target.value)}
                  />
                  {collectMethod !== 'cash' && (
                    <Input
                      className="glass-input h-12 text-base"
                      placeholder={collectMethod === 'upi' ? 'UTR / Transaction ID *' : 'Card ref / last 4 digits *'}
                      value={collectRef}
                      onChange={e => setCollectRef(e.target.value)}
                    />
                  )}

                  <div>
                    <Label className="text-muted-foreground text-xs mb-1.5 block">Upload proof (optional)</Label>
                    {verifying ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Verifying…</div>
                    ) : verifyResult ? (
                      <p className={`text-sm ${verifyResult.verdict === 'verified' ? 'text-success' : 'text-destructive'}`}>
                        {verifyResult.verdict === 'verified' ? '✅ Verified' : `⚠️ ${verifyResult.reason}`}
                      </p>
                    ) : (
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <Upload className="h-4 w-4" /> Upload screenshot
                        <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf" onChange={handleProofUpload} />
                      </label>
                    )}
                  </div>

                  <GlassButton variant="warning" size="lg" className="w-full h-14" loading={collecting} onClick={handleCollect} disabled={!collectAmount}>
                    Record {collectMethod.toUpperCase()} Payment
                  </GlassButton>
                </div>
              )}
            </GlassCard>
          )}

          {/* ── Admin controls ── */}
          {(isPaid || isBlocked) && (
            <GlassCard className="p-5">
              <h2 className="font-display text-base font-bold text-foreground mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Admin Controls
              </h2>

              {!showBlockForm ? (
                <div className="flex flex-wrap gap-2">
                  {!isBlocked && (
                    <GlassButton variant="danger" size="sm" onClick={() => setShowBlockForm(true)}>
                      <ShieldAlert className="h-4 w-4" /> Block Ticket
                    </GlassButton>
                  )}
                  {isBlocked && (
                    <GlassButton variant="success" size="sm" loading={unblockingTicket} onClick={handleUnblockTicket}>
                      <ShieldOff className="h-4 w-4" /> Unblock Ticket
                    </GlassButton>
                  )}
                  {!isCheckedIn && (
                    <GlassButton variant="ghost" size="sm" loading={reissuingQr} onClick={() => setShowReissueDialog(true)}>
                      <QrCode className="h-4 w-4" /> Reissue QR
                    </GlassButton>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">🚫 Block Ticket — enter reason</p>
                  <Textarea
                    className="glass-input text-sm resize-none"
                    placeholder="Reason for blocking (min 5 chars)…"
                    rows={2}
                    value={blockReason}
                    onChange={e => setBlockReason(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <GlassButton variant="danger" size="sm" loading={blockingTicket} onClick={handleBlockTicket} disabled={blockReason.trim().length < 5}>
                      Confirm Block
                    </GlassButton>
                    <GlassButton variant="ghost" size="sm" onClick={() => { setShowBlockForm(false); setBlockReason(''); }}>
                      Cancel
                    </GlassButton>
                  </div>
                </div>
              )}
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
