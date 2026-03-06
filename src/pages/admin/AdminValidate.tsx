import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScanLine, QrCode, CheckCircle2, Upload, Copy, RefreshCw, Loader2, User, Ticket, DollarSign } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function AdminValidate() {
  const [qrInput, setQrInput] = useState('');
  const [ticketData, setTicketData] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [gamePin, setGamePin] = useState<string | null>(null);
  const [collectForm, setCollectForm] = useState({ method: 'cash', amount: '', reference_no: '' });
  const [collecting, setCollecting] = useState(false);
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const lookupTicket = async (qrText: string) => {
    if (!qrText.trim()) return;
    setScanning(true);
    setTicketData(null); setGamePin(null); setVerifyResult(null);
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`*, order:orders!order_id(purchaser_full_name, purchaser_mobile, payment_status, seats_count, total_amount, match:matches!match_id(name, venue))`)
        .eq('qr_text', qrText.trim())
        .single();
      if (error || !data) { toast({ variant: 'destructive', title: 'Ticket not found' }); }
      else {
        setTicketData(data);
        setCollectForm(f => ({ ...f, amount: (data as any).order?.total_amount?.toString() || '' }));
      }
    } catch (e: any) { toast({ variant: 'destructive', title: 'Lookup failed', description: e.message }); }
    setScanning(false);
  };

  const handleCheckIn = async () => {
    if (!ticketData) return;
    setCheckingIn(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-checkin', { body: { ticket_id: ticketData.id, admin_id: user?.id } });
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
      const { data, error } = await supabase.functions.invoke('admin-checkin', { body: { ticket_id: ticketData.id, admin_id: user?.id, regenerate: true } });
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

  const order = ticketData?.order;
  const isPaid = ['paid_verified', 'paid_manual_verified'].includes(order?.payment_status);
  const isCheckedIn = ticketData?.status === 'used';

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
      </GlassCard>

      {/* Ticket Info */}
      {ticketData && order && (
        <>
          <GlassCard className={`p-5 ${isCheckedIn ? 'border-success/40' : isPaid ? 'border-primary/40' : 'border-destructive/40'}`}>
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
                <GlassButton variant="success" size="lg" className="w-full" loading={checkingIn} onClick={handleCheckIn}>
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

          {/* Collect Payment (if unpaid) */}
          {!isPaid && (
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
