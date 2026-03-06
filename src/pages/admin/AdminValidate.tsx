import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScanLine, QrCode, CheckCircle2, Upload, Copy, RefreshCw, Loader2, User, DollarSign, ShieldAlert, ShieldCheck, ShieldOff, QrCode as QrCodeIcon, AlertTriangle } from 'lucide-react';

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function AdminValidate() {
  const [qrInput, setQrInput] = useState('');
  const [ticketData, setTicketData] = useState<any>(null);
  const [activeMatch, setActiveMatch] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [gamePin, setGamePin] = useState<string | null>(null);
  const [collectForm, setCollectForm] = useState({ method: 'cash', amount: '', reference_no: '' });
  const [collecting, setCollecting] = useState(false);
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  // Admin control states
  const [blockReason, setBlockReason] = useState('');
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockingTicket, setBlockingTicket] = useState(false);
  const [unblockingTicket, setUnblockingTicket] = useState(false);
  const [reissuingQr, setReissuingQr] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch active match once on mount
  React.useEffect(() => {
    supabase
      .from('matches')
      .select('id, name')
      .eq('is_active_for_registration', true)
      .maybeSingle()
      .then(({ data }) => setActiveMatch(data));
  }, []);

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
    if (!qrText.trim()) return;
    setScanning(true);
    setTicketData(null); setGamePin(null); setVerifyResult(null);
    setShowBlockForm(false); setBlockReason('');
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`*, order:orders!order_id(purchaser_full_name, purchaser_mobile, payment_status, seats_count, total_amount, match_id, match:matches!match_id(name, venue))`)
        .eq('qr_text', qrText.trim())
        .single();

      if (error || !data) {
        await logScanAttempt(qrText, 'not_found');
        toast({ variant: 'destructive', title: 'Ticket not found' });
      } else {
        const order = (data as any).order;
        const ticketMatchId = data.match_id;
        const paymentStatus = order?.payment_status;

        // Determine outcome for logging
        let outcome = 'ok';
        if (data.status === 'blocked') outcome = 'blocked_ticket';
        else if (data.status === 'used') outcome = 'reuse_blocked';
        else if (!['paid_verified', 'paid_manual_verified'].includes(paymentStatus)) outcome = 'unpaid';
        else if (activeMatch && ticketMatchId !== activeMatch.id) outcome = 'match_mismatch';

        await logScanAttempt(qrText, outcome, data.id, ticketMatchId);
        setTicketData(data);
        setCollectForm(f => ({ ...f, amount: order?.total_amount?.toString() || '' }));
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Lookup failed', description: e.message });
    }
    setScanning(false);
  };

  const handleCheckIn = async () => {
    if (!ticketData) return;
    setCheckingIn(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-checkin', {
        body: { ticket_id: ticketData.id, admin_id: user?.id, qr_text: qrInput }
      });
      if (error) throw error;
      setGamePin(data.pin);
      toast({ title: '✅ Checked in!', description: `Gameplay PIN: ${data.pin}` });
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
    const order = ticketData.order;
    const msg = `🏏 T20 Fan Night - Hotel Drona Palace\nHello ${order?.purchaser_full_name}!\n✅ Check-in confirmed for ${order?.match?.name}\n🎮 Your Gameplay PIN: *${gamePin}*\nEnjoy the fun!`;
    navigator.clipboard.writeText(msg);
    toast({ title: '📋 Copied!', description: 'WhatsApp message copied to clipboard' });
  };

  const handleCollect = async () => {
    if (!ticketData || !collectForm.amount) return;
    setCollecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-gate-collect', {
        body: { order_id: ticketData.order_id, admin_id: user?.id, method: collectForm.method, amount: parseInt(collectForm.amount), reference_no: collectForm.reference_no || null }
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
      if (data.verdict === 'verified') { await lookupTicket(qrInput); }
    } catch (e: any) { toast({ variant: 'destructive', title: 'Verify failed', description: e.message }); }
    setVerifying(false);
  };

  const handleBlockTicket = async () => {
    if (!ticketData || blockReason.trim().length < 5) return;
    setBlockingTicket(true);
    try {
      await supabase.from('tickets').update({ status: 'blocked', blocked_reason: blockReason.trim() } as any).eq('id', ticketData.id);
      await supabase.from('admin_activity').insert({
        admin_id: user?.id,
        action: 'block_ticket',
        entity_type: 'ticket',
        entity_id: ticketData.id,
        meta: { reason: blockReason.trim() },
      });
      toast({ title: '🚫 Ticket blocked', description: blockReason.trim() });
      setShowBlockForm(false);
      setBlockReason('');
      await lookupTicket(qrInput);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setBlockingTicket(false);
  };

  const handleUnblockTicket = async () => {
    if (!ticketData) return;
    setUnblockingTicket(true);
    try {
      await supabase.from('tickets').update({ status: 'active', blocked_reason: null } as any).eq('id', ticketData.id);
      await supabase.from('admin_activity').insert({
        admin_id: user?.id,
        action: 'unblock_ticket',
        entity_type: 'ticket',
        entity_id: ticketData.id,
        meta: {},
      });
      toast({ title: '✅ Ticket unblocked' });
      await lookupTicket(qrInput);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setUnblockingTicket(false);
  };

  const handleReissueQr = async () => {
    if (!ticketData) return;
    setReissuingQr(true);
    try {
      const { data, error } = await supabase.functions.invoke('reissue-qr', {
        body: { ticket_id: ticketData.id, admin_id: user?.id }
      });
      if (error) throw error;
      toast({ title: '🔄 QR Reissued', description: 'Old QR is now invalid. New QR generated.' });
      // Update the input box with the new QR so re-lookup works
      setQrInput(data.new_qr_text);
      await lookupTicket(data.new_qr_text);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Reissue failed', description: e.message }); }
    setReissuingQr(false);
  };

  const order = ticketData?.order;
  const isPaid = ['paid_verified', 'paid_manual_verified'].includes(order?.payment_status);
  const isCheckedIn = ticketData?.status === 'used';
  const isBlocked = ticketData?.status === 'blocked';
  const ticketMatchId = ticketData?.match_id;
  const isMatchMismatch = activeMatch && ticketData && ticketMatchId !== activeMatch.id;

  // Check-in is only allowed if paid, not checked-in, not blocked, and no match mismatch
  const canCheckIn = isPaid && !isCheckedIn && !isBlocked && !isMatchMismatch;

  return (
    <div className="p-6 space-y-6 max-w-lg">
      <div>
        <h1 className="font-display text-3xl font-bold gradient-text-accent">Gate Validate</h1>
        <p className="text-muted-foreground text-sm">Scan QR or enter ticket code</p>
      </div>

      {/* QR Lookup */}
      <GlassCard className="p-5" glow>
        <div className="flex items-center gap-2 mb-4">
          <QrCode className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">Scan / Enter QR</h2>
        </div>
        <div className="flex gap-2">
          <Input className="glass-input flex-1 font-mono text-sm" placeholder="Paste QR code here..." value={qrInput} onChange={e => setQrInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookupTicket(qrInput)} />
          <GlassButton variant="primary" size="md" loading={scanning} onClick={() => lookupTicket(qrInput)}>
            <ScanLine className="h-4 w-4" />
          </GlassButton>
        </div>
        {activeMatch && (
          <p className="text-xs text-muted-foreground mt-2">Active match: <span className="text-foreground font-medium">{activeMatch.name}</span></p>
        )}
      </GlassCard>

      {/* Ticket Info */}
      {ticketData && order && (
        <>
          {/* Match mismatch warning */}
          {isMatchMismatch && (
            <GlassCard className="p-4 border-warning/50 bg-warning/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning text-sm">Wrong Match</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This ticket is for <strong className="text-foreground">{order?.match?.name}</strong>, not the active match. Check-in is blocked.
                  </p>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Blocked ticket warning */}
          {isBlocked && (
            <GlassCard className="p-4 border-destructive/50 bg-destructive/5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive text-sm">Ticket Blocked</p>
                  {ticketData.blocked_reason && (
                    <p className="text-xs text-muted-foreground mt-0.5">Reason: <span className="text-foreground">{ticketData.blocked_reason}</span></p>
                  )}
                </div>
              </div>
            </GlassCard>
          )}

          <GlassCard className={`p-5 ${isCheckedIn ? 'border-success/40' : isBlocked ? 'border-destructive/40' : isPaid ? 'border-primary/40' : 'border-destructive/40'}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-display text-lg font-bold text-foreground">{order.purchaser_full_name}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{order.purchaser_mobile}</p>
                <p className="text-sm text-muted-foreground">{order?.match?.name}</p>
              </div>
              <div className="text-right space-y-1">
                <StatusBadge status={order.payment_status} />
                <br />
                <StatusBadge status={ticketData.status} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center border-t border-border pt-4">
              <div><p className="text-xs text-muted-foreground">Seats</p><p className="font-display font-bold text-foreground">{order.seats_count}</p></div>
              <div><p className="text-xs text-muted-foreground">Total</p><p className="font-display font-bold gradient-text">₹{order.total_amount}</p></div>
              <div><p className="text-xs text-muted-foreground">Seat #</p><p className="font-display font-bold text-foreground">{ticketData.seat_index + 1}</p></div>
            </div>
          </GlassCard>

          {/* Check-In + PIN */}
          {isPaid && (
            <GlassCard className="p-5">
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Check-In & PIN</h2>
              {!isCheckedIn ? (
                <GlassButton
                  variant="success"
                  size="lg"
                  className="w-full"
                  loading={checkingIn}
                  onClick={handleCheckIn}
                  disabled={!canCheckIn}
                >
                  <CheckCircle2 className="h-5 w-5" /> Check In & Generate PIN
                </GlassButton>
              ) : (
                <div className="space-y-3">
                  {gamePin && (
                    <div className="text-center p-4 bg-success/10 border border-success/30 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Gameplay PIN</p>
                      <p className="font-display text-4xl font-bold text-success tracking-[0.3em]">{gamePin}</p>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <GlassButton variant="ghost" size="md" className="flex-1" loading={checkingIn} onClick={handleRegenPin}>
                      <RefreshCw className="h-4 w-4" /> Regenerate PIN
                    </GlassButton>
                    {gamePin && (
                      <GlassButton variant="success" size="md" className="flex-1" onClick={copyWhatsApp}>
                        <Copy className="h-4 w-4" /> Copy WhatsApp Msg
                      </GlassButton>
                    )}
                  </div>
                </div>
              )}
            </GlassCard>
          )}

          {/* Admin Controls — Block / Unblock / Reissue QR */}
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
                    <GlassButton variant="ghost" size="sm" loading={reissuingQr} onClick={handleReissueQr}>
                      <QrCodeIcon className="h-4 w-4" /> Reissue QR
                    </GlassButton>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">🚫 Block Ticket — enter reason</p>
                  <Textarea
                    className="glass-input text-sm resize-none"
                    placeholder="Enter reason for blocking (min 5 characters)..."
                    rows={2}
                    value={blockReason}
                    onChange={e => setBlockReason(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <GlassButton
                      variant="danger"
                      size="sm"
                      loading={blockingTicket}
                      onClick={handleBlockTicket}
                      disabled={blockReason.trim().length < 5}
                    >
                      Confirm Block
                    </GlassButton>
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      onClick={() => { setShowBlockForm(false); setBlockReason(''); }}
                    >
                      Cancel
                    </GlassButton>
                  </div>
                </div>
              )}
            </GlassCard>
          )}

          {/* Collect Payment (if unpaid) */}
          {!isPaid && !isBlocked && (
            <GlassCard className="p-5">
              <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-warning" /> Collect Payment
              </h2>
              <div className="space-y-3">
                <Select value={collectForm.method} onValueChange={v => setCollectForm(f => ({ ...f, method: v }))}>
                  <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
                <Input className="glass-input" type="number" placeholder="Amount (₹)" value={collectForm.amount} onChange={e => setCollectForm(f => ({ ...f, amount: e.target.value }))} />
                {collectForm.method !== 'cash' && (
                  <Input className="glass-input" placeholder="Reference / UTR number" value={collectForm.reference_no} onChange={e => setCollectForm(f => ({ ...f, reference_no: e.target.value }))} />
                )}

                {/* Optional proof upload */}
                <div>
                  <Label className="text-foreground mb-1.5 block text-sm">Upload Proof (optional)</Label>
                  {verifying ? (
                    <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /><span className="text-sm text-muted-foreground">Verifying...</span></div>
                  ) : verifyResult ? (
                    <div className={`text-sm rounded p-2 ${verifyResult.verdict === 'verified' ? 'text-success' : 'text-destructive'}`}>
                      {verifyResult.verdict === 'verified' ? '✅ Verified' : `⚠️ ${verifyResult.reason}`}
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      <Upload className="h-4 w-4" /> Upload screenshot
                      <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf" onChange={handleProofUpload} />
                    </label>
                  )}
                </div>

                <GlassButton variant="warning" size="md" className="w-full" loading={collecting} onClick={handleCollect}>
                  Record Payment Collection
                </GlassButton>
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
