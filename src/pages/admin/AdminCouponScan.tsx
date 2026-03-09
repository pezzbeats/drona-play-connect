import React, { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import {
  ScanLine, Camera, X, QrCode, CheckCircle2, XCircle, Clock, User,
  Smartphone, Gift, Loader2, Zap, ZapOff, RotateCcw, AlertTriangle, History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── audio / vibration helpers ─────────────────────────────────────────────────
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
  } catch { /* blocked before user interaction */ }
}
function vibrate(pattern: number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

// ── types ─────────────────────────────────────────────────────────────────────
interface CouponRecord {
  id: string;
  code: string;
  customer_name: string;
  customer_mobile: string;
  discount_text: string;
  expiry_date: string | null;
  status: 'active' | 'redeemed' | 'expired';
  redeemed_at: string | null;
  created_at: string;
}

interface RedemptionHistoryEntry {
  id: string;
  code: string;
  customer_name: string;
  customer_mobile: string;
  discount_text: string;
  redeemed_at: string;
}

type LookupState = 'idle' | 'loading' | 'found_active' | 'found_redeemed' | 'found_expired' | 'not_found' | 'redeeming' | 'redeemed_success';

// ── component ─────────────────────────────────────────────────────────────────
export default function AdminCouponScan() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [codeInput, setCodeInput] = useState('');
  const [lookupState, setLookupState] = useState<LookupState>('idle');
  const [coupon, setCoupon] = useState<CouponRecord | null>(null);
  const [sessionHistory, setSessionHistory] = useState<RedemptionHistoryEntry[]>([]);

  // Camera state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [pendingStream, setPendingStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const scanningRef = useRef(false);
  const detectingRef = useRef(false);
  const detectorRef = useRef<any>(null);
  const torchSupportedRef = useRef(false);
  const handleResultRef = useRef<(code: string) => void>(() => {});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Attach camera stream to video element after React has painted it
  useEffect(() => {
    if (!pendingStream || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = pendingStream;
    video.onloadedmetadata = async () => {
      try {
        await video.play();
        setCameraReady(true);
        // Check torch support
        const track = pendingStream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() as any;
        if (caps?.torch) torchSupportedRef.current = true;
        startScanLoop();
      } catch { setCameraError('Could not start camera stream.'); }
    };
    setPendingStream(null);
  }, [pendingStream]);

  const closeCamera = useCallback(async () => {
    scanningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    const track = streamRef.current?.getVideoTracks()[0];
    if (track && torchSupportedRef.current && torchOn) {
      try { await track.applyConstraints({ advanced: [{ torch: false } as any] }); } catch {}
    }
    setTorchOn(false);
    torchSupportedRef.current = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPendingStream(null);
    setCameraOpen(false);
    setCameraError(null);
    setCameraReady(false);
  }, [torchOn]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchSupportedRef.current) return;
    const newVal = !torchOn;
    try { await track.applyConstraints({ advanced: [{ torch: newVal } as any] }); setTorchOn(newVal); } catch {}
  }, [torchOn]);

  const startScanLoop = useCallback(() => {
    scanningRef.current = true;
    detectingRef.current = false;
    if ('BarcodeDetector' in window) {
      try { detectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] }); }
      catch { detectorRef.current = null; }
    } else { detectorRef.current = null; }

    const SCAN_RES = 480;
    const tick = async () => {
      if (!scanningRef.current) return;
      if (detectingRef.current) { rafRef.current = requestAnimationFrame(tick); return; }
      const video = videoRef.current;
      if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(tick); return; }
      detectingRef.current = true;
      try {
        if (detectorRef.current) {
          const codes = await detectorRef.current.detect(video);
          if (codes.length > 0) { handleResultRef.current(codes[0].rawValue); return; }
        } else {
          const canvas = canvasRef.current;
          if (!canvas) { detectingRef.current = false; rafRef.current = requestAnimationFrame(tick); return; }
          const w = video.videoWidth; const h = video.videoHeight;
          if (!w || !h) { detectingRef.current = false; rafRef.current = requestAnimationFrame(tick); return; }
          const scale = Math.min(1, SCAN_RES / w);
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) { detectingRef.current = false; rafRef.current = requestAnimationFrame(tick); return; }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
          if (code?.data) { handleResultRef.current(code.data); return; }
        }
      } catch { /* non-fatal */ }
      detectingRef.current = false;
      if (scanningRef.current) rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const lookupCoupon = useCallback(async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLookupState('loading');
    setCoupon(null);
    try {
      const { data, error } = await supabase
        .from('coupons' as any)
        .select('*')
        .eq('code', trimmed)
        .maybeSingle();

      if (error || !data) {
        setLookupState('not_found');
        playBeep('error');
        vibrate([100, 60, 100, 60, 200]);
        return;
      }

      const c = data as unknown as CouponRecord;
      // Auto-check expiry
      if (c.status === 'active' && c.expiry_date) {
        const expiry = new Date(c.expiry_date);
        expiry.setHours(23, 59, 59);
        if (expiry < new Date()) {
          // Mark as expired in DB (best-effort)
          await supabase.from('coupons' as any).update({ status: 'expired' }).eq('id', c.id);
          c.status = 'expired';
          toast({
            variant: 'destructive',
            title: '⏰ Coupon auto-expired',
            description: `Expired on ${format(new Date(c.expiry_date), 'dd MMM yyyy')} — marked in database.`,
          });
        }
      }

      setCoupon(c);
      if (c.status === 'active') {
        setLookupState('found_active');
        playBeep('success');
        vibrate([120]);
      } else if (c.status === 'redeemed') {
        setLookupState('found_redeemed');
        playBeep('error');
        vibrate([100, 60, 100, 60, 200]);
      } else {
        setLookupState('found_expired');
        playBeep('error');
        vibrate([100, 60, 200]);
      }
    } catch (e: any) {
      setLookupState('not_found');
      toast({ variant: 'destructive', title: 'Lookup failed', description: e.message });
    }
  }, [toast]);

  const handleCameraResult = useCallback((scannedCode: string) => {
    if (!scanningRef.current) return;
    scanningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    closeCamera();
    setCodeInput(scannedCode.trim().toUpperCase());
    lookupCoupon(scannedCode);
  }, [closeCamera, lookupCoupon]);

  handleResultRef.current = handleCameraResult;

  const openCamera = () => {
    setCameraError(null);
    setCameraReady(false);
    setCameraOpen(true);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera not supported in this browser.');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(stream => { streamRef.current = stream; setPendingStream(stream); })
      .catch((err: any) => {
        if (err.name === 'NotAllowedError') setCameraError('Camera permission denied.');
        else if (err.name === 'NotFoundError') setCameraError('No camera found.');
        else setCameraError('Could not open camera: ' + (err.message || err.name));
      });
  };

  // Cleanup on unmount
  useEffect(() => () => { closeCamera(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (codeInput.trim()) lookupCoupon(codeInput);
  };

  const redeemCoupon = useCallback(async () => {
    if (!coupon || coupon.status !== 'active') return;
    setLookupState('redeeming');
    try {
      const { error } = await supabase
        .from('coupons' as any)
        .update({
          status: 'redeemed',
          redeemed_at: new Date().toISOString(),
          redeemed_by_admin_id: user?.id ?? null,
        })
        .eq('id', coupon.id)
        .eq('status', 'active'); // optimistic lock — only update if still active

      if (error) throw error;

      setCoupon(prev => prev ? { ...prev, status: 'redeemed', redeemed_at: new Date().toISOString() } : prev);
      setLookupState('redeemed_success');
      playBeep('success');
      vibrate([80, 40, 80, 40, 160]);
      toast({ title: '✅ Coupon redeemed!', description: `${coupon.customer_name} — ${coupon.discount_text}` });
    } catch (e: any) {
      setLookupState('found_active');
      toast({ variant: 'destructive', title: 'Redemption failed', description: e.message });
    }
  }, [coupon, user?.id, toast]);

  const reset = () => {
    setCodeInput('');
    setLookupState('idle');
    setCoupon(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const isLoading = lookupState === 'loading' || lookupState === 'redeeming';

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
          <QrCode className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Coupon Redemption Scanner</h1>
          <p className="text-sm text-muted-foreground">Scan or enter a victory coupon code to redeem</p>
        </div>
      </div>

      {/* Scan zone */}
      <GlassCard className="p-5 space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            placeholder="WC25-XXXX-XXXX"
            className="font-mono tracking-wider text-sm flex-1"
            disabled={isLoading}
            autoComplete="off"
            autoCapitalize="characters"
          />
          <Button type="submit" disabled={isLoading || !codeInput.trim()} className="shrink-0">
            {lookupState === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            <span className="hidden sm:inline ml-2">Look Up</span>
          </Button>
        </form>

        {/* Camera button */}
        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center gap-2"
          onClick={openCamera}
          disabled={cameraOpen || isLoading}
        >
          <Camera className="h-4 w-4" />
          Scan QR with Camera
        </Button>
      </GlassCard>

      {/* Camera viewfinder */}
      {cameraOpen && (
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              {cameraReady ? 'Scanning…' : 'Opening camera…'}
            </span>
            <div className="flex items-center gap-2">
              {torchSupportedRef.current && (
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={toggleTorch}>
                  {torchOn ? <ZapOff className="h-4 w-4 text-amber-400" /> : <Zap className="h-4 w-4" />}
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={closeCamera}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {cameraError ? (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive text-center">
              {cameraError}
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                className="w-full h-full object-cover"
              />
              {/* Scan frame overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-lg" />
                  {cameraReady && (
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-primary/70 animate-[scan_2s_ease-in-out_infinite]" />
                  )}
                </div>
              </div>
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              )}
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
          <p className="text-center text-xs text-muted-foreground">
            Point the camera at the QR code on the coupon
          </p>
        </GlassCard>
      )}

      {/* Result card */}
      {lookupState !== 'idle' && lookupState !== 'loading' && (
        <GlassCard className={cn(
          'p-5 space-y-4 border-2 transition-colors',
          lookupState === 'found_active' || lookupState === 'redeemed_success'
            ? 'border-green-500/40 bg-green-500/5'
            : lookupState === 'found_redeemed'
            ? 'border-amber-500/40 bg-amber-500/5'
            : 'border-destructive/40 bg-destructive/5'
        )}>
          {/* Status header */}
          {lookupState === 'not_found' && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-semibold text-destructive">Coupon Not Found</p>
                <p className="text-xs text-muted-foreground">No coupon matches code <span className="font-mono text-foreground">{codeInput}</span></p>
              </div>
            </div>
          )}

          {lookupState === 'found_active' && coupon && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-green-400">Valid Coupon</p>
                  <Badge variant="outline" className="text-green-400 border-green-400/30 bg-green-400/5 text-xs">ACTIVE</Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{coupon.code}</p>
              </div>
            </div>
          )}

          {lookupState === 'redeemed_success' && coupon && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-green-400">Redeemed Successfully!</p>
                <p className="text-xs text-muted-foreground">Coupon has been marked as used</p>
              </div>
            </div>
          )}

          {lookupState === 'found_redeemed' && coupon && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-amber-400">Already Redeemed</p>
                  <Badge variant="outline" className="text-amber-400 border-amber-400/30 bg-amber-400/5 text-xs">USED</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Redeemed on {coupon.redeemed_at ? format(new Date(coupon.redeemed_at), 'dd MMM yyyy, h:mm a') : '—'}
                </p>
              </div>
            </div>
          )}

          {lookupState === 'found_expired' && coupon && (
            <div className="space-y-3">
              {/* Bold expired banner */}
              <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-destructive/60 bg-destructive/10 py-5 px-4 text-center">
                <div className="w-14 h-14 rounded-full bg-destructive/20 flex items-center justify-center">
                  <AlertTriangle className="h-7 w-7 text-destructive" />
                </div>
                <p className="text-2xl font-extrabold tracking-widest text-destructive uppercase">Expired</p>
                <p className="text-sm text-destructive/80 font-medium">
                  This coupon expired on{' '}
                  <span className="font-bold text-destructive">
                    {coupon.expiry_date ? format(new Date(coupon.expiry_date), 'dd MMM yyyy') : '—'}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">Redemption is blocked. This coupon cannot be used.</p>
              </div>
            </div>
          )}

          {/* Coupon details */}
          {coupon && lookupState !== 'not_found' && (
            <div className="rounded-xl bg-muted/20 border border-border/50 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{coupon.customer_name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Smartphone className="h-3 w-3" /> +91 {coupon.customer_mobile}
                  </p>
                </div>
              </div>

              <div className="h-px bg-border/50" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-bold text-amber-400">{coupon.discount_text}</span>
                </div>
                {coupon.expiry_date && (
                  <span className="text-xs text-muted-foreground">
                    Valid until {format(new Date(coupon.expiry_date), 'dd MMM yyyy')}
                  </span>
                )}
              </div>

              <div className="text-xs font-mono text-muted-foreground text-center py-1 px-3 rounded-lg bg-muted/30">
                {coupon.code}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {lookupState === 'found_active' && (
              <Button
                onClick={redeemCoupon}
                disabled={lookupState !== 'found_active'}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirm Redemption
              </Button>
            )}
            <Button variant="outline" onClick={reset} className="flex items-center gap-2" size={lookupState === 'found_active' ? 'icon' : 'default'}>
              <RotateCcw className="h-4 w-4" />
              {lookupState !== 'found_active' && <span>Scan Next</span>}
            </Button>
          </div>
        </GlassCard>
      )}

      {/* Loading state */}
      {lookupState === 'loading' && (
        <GlassCard className="p-8 flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Looking up coupon…</span>
        </GlassCard>
      )}

      {lookupState === 'redeeming' && (
        <GlassCard className="p-8 flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 text-green-400 animate-spin" />
          <span className="text-sm text-muted-foreground">Marking as redeemed…</span>
        </GlassCard>
      )}
    </div>
  );
}
