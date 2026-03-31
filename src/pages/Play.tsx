import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Gamepad2, Lock, ShieldCheck, ChevronRight, AlertTriangle,
  Trophy, Gift, Heart, Star, Gavel, Eye
} from 'lucide-react';
import { MobileBreadcrumb } from '@/components/ui/MobileBreadcrumb';

// ─── Consent clauses ───────────────────────────────────────────────────────────

const CONSENT_CLAUSES = [
  {
    icon: Heart,
    title: 'Entertainment-Only Activity',
    body: 'This prediction game is conducted purely for entertainment and audience engagement during the live cricket screening event. It is not a contest, competition, or skill-based activity.',
  },
  {
    icon: AlertTriangle,
    title: 'No Betting or Gambling',
    body: 'This activity does not involve any form of betting, wagering, or gambling. Participants are not staking money on uncertain outcomes. No financial risk is involved.',
  },
  {
    icon: Trophy,
    title: 'No Cash Prizes',
    body: 'No cash rewards are offered. Participants cannot win money through this activity. The activity is offered as a complimentary engagement feature for event attendees.',
  },
  {
    icon: Gift,
    title: 'Promotional Benefits Only',
    body: 'Points earned may be converted into promotional offers, discount coupons, or hospitality benefits redeemable only at Hotel Drona Palace. These benefits have no cash value and cannot be exchanged for money.',
  },
  {
    icon: Star,
    title: 'Voluntary Participation',
    body: 'Participation is entirely voluntary and is offered as an engagement activity for event attendees. You may choose not to participate without any consequence.',
  },
  {
    icon: ShieldCheck,
    title: 'Non-Transferable Benefits',
    body: 'Any offers, coupons, or benefits earned are non-transferable and subject to Hotel Drona Palace promotional policies. They cannot be assigned, sold, or transferred to another person.',
  },
  {
    icon: Gavel,
    title: 'Organiser Rights',
    body: 'Hotel Drona Palace (SR Leisure Inn) reserves the right to modify, suspend, or terminate the activity at any time for operational or compliance reasons without prior notice.',
  },
  {
    icon: Eye,
    title: 'Fair Play',
    body: 'Any misuse, manipulation, or attempt to exploit the system may result in immediate disqualification from the activity. All admin decisions are final.',
  },
];

// ─── ConsentScreen ─────────────────────────────────────────────────────────────

interface ConsentScreenProps {
  mobile: string;
  matchId: string | null;
  onAccept: () => void;
  onDecline: () => void;
}

function ConsentScreen({ mobile, matchId, onAccept, onDecline }: ConsentScreenProps) {
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleAccept = async () => {
    if (!agreed) return;
    setSaving(true);
    try {
      // Try to get IP (best-effort, non-blocking)
      let ip: string | null = null;
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ip = ipData.ip ?? null;
      } catch { /* ignore */ }

      const { error } = await supabase.from('game_consents' as any).insert({
        mobile,
        match_id: matchId,
        terms_version: '1.0',
        ip_address: ip,
        user_agent: navigator.userAgent,
      });

      if (error && !error.message?.includes('duplicate')) {
        // Duplicate = already consented for this match (race), still OK to proceed
        throw error;
      }
      onAccept();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not record consent', description: e.message });
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 relative"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <BackgroundOrbs />

      <div className="relative z-10 w-full max-w-sm flex flex-col" style={{ minHeight: '100dvh' }}>
        {/* Header */}
        <div className="text-center pt-6 pb-4 shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-3 shadow-glow-primary">
            <ShieldCheck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold gradient-text leading-tight">
            Prediction Game
          </h1>
          <p className="text-primary font-semibold text-sm mt-0.5">Participation Terms</p>
          <p className="text-muted-foreground text-xs mt-1.5 px-2">
            Please read and accept the terms below to enter the game.
          </p>
        </div>

        {/* Scrollable clauses */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pb-2">
          {CONSENT_CLAUSES.map((clause, i) => (
            <GlassCard key={i} className="p-3.5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <clause.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug">
                    {i + 1}. {clause.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {clause.body}
                  </p>
                </div>
              </div>
            </GlassCard>
          ))}

          {/* Legal footer note */}
          <div className="px-1 py-2">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Organised by <span className="text-foreground font-medium">SR Leisure Inn</span> (Hotel Drona Palace) ·
              GSTIN: ABOFS1823N1ZS · This activity is for entertainment only and is not subject to gaming or gambling regulations.
            </p>
          </div>
        </div>

        {/* Fixed consent controls */}
        <div className="shrink-0 pt-3 pb-2 space-y-3">
          <GlassCard className="p-3.5 border-primary/30">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={agreed}
                onCheckedChange={v => setAgreed(Boolean(v))}
                className="mt-0.5 shrink-0"
              />
              <span className="text-sm text-foreground leading-snug">
                I have read and understood the participation terms and{' '}
                <span className="text-primary font-semibold">agree to join the entertainment prediction activity.</span>
              </span>
            </label>
          </GlassCard>

          <GlassButton
            variant="primary"
            size="lg"
            className="w-full h-14 text-base font-semibold"
            loading={saving}
            disabled={!agreed}
            onClick={handleAccept}
          >
            <ChevronRight className="h-5 w-5" />
            Accept & Enter Game
          </GlassButton>

          <GlassButton
            variant="ghost"
            size="sm"
            className="w-full h-10 text-sm text-muted-foreground"
            onClick={onDecline}
          >
            Decline — Go Back to Home
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

// ─── PlayPage ──────────────────────────────────────────────────────────────────

export default function PlayPage() {
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [matchStatus, setMatchStatus] = useState<'unknown' | 'live' | 'upcoming' | 'ended'>('unknown');
  const [matchName, setMatchName] = useState<string | null>(null);

  // After successful PIN verify, hold verified session info here pending consent
  const [pendingSession, setPendingSession] = useState<{ mobile: string; pin: string; match_id: string | null } | null>(null);

  // 'form' = PIN form, 'consent' = consent screen
  const [view, setView] = useState<'form' | 'consent'>('form');

  const { toast } = useToast();
  const navigate = useNavigate();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch and track active match status in realtime
  const fetchMatchStatus = useCallback(async () => {
    const { data } = await supabase
      .from('matches')
      .select('id, name, status')
      .eq('is_active_for_registration', true)
      .maybeSingle();
    if (data) {
      setMatchName(data.name);
      if (data.status === 'live') setMatchStatus('live');
      else if (data.status === 'ended') setMatchStatus('ended');
      else setMatchStatus('upcoming');
    } else {
      setMatchStatus('unknown');
      setMatchName(null);
    }
  }, []);

  // Auto-redirect if a valid session already exists
  useEffect(() => {
    const raw = localStorage.getItem('game_session');
    if (raw) {
      try {
        const sess = JSON.parse(raw);
        if (sess?.mobile && sess?.pin) { navigate('/live'); return; }
      } catch { /* invalid JSON — fall through to show form */ }
    }
  }, [navigate]);

  useEffect(() => {
    fetchMatchStatus();

    // Realtime subscription: update status badge when match changes
    const ch = supabase
      .channel('play-page-match')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        fetchMatchStatus();
      })
      .subscribe();
    channelRef.current = ch;

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [fetchMatchStatus]);

  const handleLogin = async () => {
    if (!/^\d{10}$/.test(mobile)) {
      return toast({ variant: 'destructive', title: 'Invalid mobile number' });
    }
    if (pin.length !== 4) {
      return toast({ variant: 'destructive', title: 'PIN must be 4 digits' });
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-game-pin', {
        body: { mobile, pin }
      });
      if (error || !data?.valid) {
        toast({ variant: 'destructive', title: 'Invalid credentials', description: 'Check your mobile and PIN' });
        setLoading(false);
        return;
      }

      const matchId: string | null = data.match_id || null;

      // Check if consent already recorded for this match
      if (matchId) {
        const { data: consent } = await supabase
          .from('game_consents' as any)
          .select('id')
          .eq('mobile', mobile)
          .eq('match_id', matchId)
          .maybeSingle();

        if (consent) {
          // Already consented — go straight in
          localStorage.setItem('game_session', JSON.stringify({ mobile, pin, match_id: matchId }));
          toast({ title: '🎮 Welcome back to the game!' });
          navigate('/live');
          setLoading(false);
          return;
        }
      }

      // New consent required — show consent screen
      setPendingSession({ mobile, pin, match_id: matchId });
      setView('consent');
    } catch {
      toast({ variant: 'destructive', title: 'Login failed' });
    }
    setLoading(false);
  };

  // Called after user accepts consent
  const handleConsentAccepted = () => {
    if (!pendingSession) return;
    localStorage.setItem('game_session', JSON.stringify(pendingSession));
    toast({ title: '🎮 Welcome to the game!' });
    navigate('/live');
  };

  // Called when user declines
  const handleConsentDeclined = () => {
    setPendingSession(null);
    setView('form');
    navigate('/');
  };

  // Show consent screen after verification
  if (view === 'consent' && pendingSession) {
    return (
      <ConsentScreen
        mobile={pendingSession.mobile}
        matchId={pendingSession.match_id}
        onAccept={handleConsentAccepted}
        onDecline={handleConsentDeclined}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <BackgroundOrbs />

      <div className="disclaimer-bar w-full text-center text-xs py-2 px-4 z-10 rounded-lg mb-6">
        🎯 Fun guess game for entertainment only. No betting, no wagering.
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Back link */}
        <div className="mb-6 text-center">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Home
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow-primary">
            <Gamepad2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text">Fan Game Login</h1>
          <p className="text-muted-foreground text-sm mt-2">Enter your mobile and gameplay PIN</p>
          <p className="text-xs text-muted-foreground mt-1">PIN is given at the gate after check-in</p>

          {/* Realtime match status badge */}
          {matchStatus !== 'unknown' && (
            <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-semibold border ${
              matchStatus === 'live'
                ? 'bg-success/15 border-success/40 text-success'
                : matchStatus === 'ended'
                ? 'bg-muted/30 border-border text-muted-foreground'
                : 'bg-primary/10 border-primary/30 text-primary'
            }`}>
              {matchStatus === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
              {matchStatus === 'live' ? '● Match is LIVE' : matchStatus === 'ended' ? 'Match Ended' : '⏳ Match Coming Soon'}
              {matchName && <span className="opacity-70">· {matchName}</span>}
            </div>
          )}
        </div>

        <GlassCard className="p-5" glow>
          <div className="space-y-5">
            <div>
              <Label className="text-foreground mb-2 block text-sm font-medium">Mobile Number</Label>
              <Input
                className="glass-input h-14 text-lg"
                placeholder="10-digit mobile"
                type="tel"
                inputMode="numeric"
                value={mobile}
                onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              />
            </div>
            <div>
              <Label className="text-foreground mb-2 block text-sm font-medium flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> 4-Digit PIN
              </Label>
              <Input
                className="glass-input h-14 tracking-[0.8em] text-center text-2xl"
                placeholder="●●●●"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
            <GlassButton
              variant="primary" size="lg"
              className="w-full h-14 text-base font-semibold mt-1"
              loading={loading}
              onClick={handleLogin}
            >
              Enter the Game
            </GlassButton>
          </div>
        </GlassCard>

        <p className="text-center text-xs text-muted-foreground mt-6 px-4">
          Don't have a PIN? Check in at the gate with your QR ticket.
        </p>
        <p className="text-center text-xs text-muted-foreground mt-2 px-4">
          Forgot your PIN?{' '}
          <span className="text-foreground/70 font-medium">Contact the venue to reset it.</span>
        </p>
        <p className="text-center text-xs text-muted-foreground mt-2 px-4">
          Don't have a pass yet?{' '}
          <Link to="/register" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors font-semibold">
            Book your seats first →
          </Link>
        </p>
      </div>
    </div>
  );
}
