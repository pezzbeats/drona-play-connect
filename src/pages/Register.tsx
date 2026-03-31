import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2, ChevronRight, Loader2, Gamepad2, ArrowLeft,
  Phone, MapPin, Calendar, Lock, Trophy,
} from 'lucide-react';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { MobileBreadcrumb } from '@/components/ui/MobileBreadcrumb';
import cskLogo from '@/assets/ipl-teams/csk.png';
import miLogo from '@/assets/ipl-teams/mi.png';
import rcbLogo from '@/assets/ipl-teams/rcb.png';
import kkrLogo from '@/assets/ipl-teams/kkr.png';
import srhLogo from '@/assets/ipl-teams/srh.png';
import dcLogo from '@/assets/ipl-teams/dc.png';
import pbksLogo from '@/assets/ipl-teams/pbks.png';
import rrLogo from '@/assets/ipl-teams/rr.png';
import gtLogo from '@/assets/ipl-teams/gt.png';
import lsgLogo from '@/assets/ipl-teams/lsg.png';

const IPL_TEAM_LOGOS: Record<string, string> = {
  CSK: cskLogo, MI: miLogo, RCB: rcbLogo, KKR: kkrLogo, SRH: srhLogo,
  DC: dcLogo, PBKS: pbksLogo, PBK: pbksLogo, RR: rrLogo, GT: gtLogo, LSG: lsgLogo,
};

interface Match {
  id: string; name: string; opponent: string | null;
  match_type: string; start_time: string | null; venue: string; status: string;
}

interface RosterTeam {
  side: string;
  teams: { name: string; short_code: string; color: string | null } | null;
}

export default function RegisterPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const matchIdParam = searchParams.get('match_id');

  const [step, setStep] = useState(0); // 0 = form, 1 = success
  const [loading, setLoading] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);
  const [roster, setRoster] = useState<RosterTeam[]>([]);
  const [matchLoading, setMatchLoading] = useState(true);

  const [fullName, setFullName] = useState(() => sessionStorage.getItem('reg_fullName') || '');
  const [mobile, setMobile] = useState(() => sessionStorage.getItem('reg_mobile') || '');
  const nameRef = useRef<HTMLInputElement>(null);
  const mobileValid = /^\d{10}$/.test(mobile);
  const mobileError = mobile.length > 0 && !mobileValid;
  const nameError = fullName.length > 0 && fullName.trim().length < 2;

  // Success state
  const [gamePin, setGamePin] = useState<string | null>(null);
  const [registeredMatchId, setRegisteredMatchId] = useState<string | null>(null);

  useEffect(() => {
    fetchMatch();
    setTimeout(() => nameRef.current?.focus(), 300);
  }, []);

  const fetchMatch = async () => {
    setMatchLoading(true);
    let data: any = null;

    if (matchIdParam) {
      const res = await supabase.from('matches').select('*').eq('id', matchIdParam).single();
      data = res.data;
    } else {
      // Fallback: find today's match or active match
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .or(`and(start_time.gte.${todayStart.toISOString()},start_time.lte.${todayEnd.toISOString()}),is_active_for_registration.eq.true`)
        .neq('status', 'draft')
        .order('start_time', { ascending: true })
        .limit(1);
      data = matches?.[0] || null;
    }

    if (data) {
      setMatch(data);
      // Fetch roster
      const { data: rosterData } = await supabase
        .from('match_roster')
        .select('side, teams(name, short_code, color)')
        .eq('match_id', data.id);
      setRoster((rosterData as any[]) || []);
    }
    setMatchLoading(false);
  };

  const handleRegister = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      return toast({ variant: 'destructive', title: 'Enter your full name (at least 2 characters)' });
    }
    if (!mobileValid) {
      return toast({ variant: 'destructive', title: 'Enter a valid 10-digit mobile number' });
    }
    if (!match) {
      return toast({ variant: 'destructive', title: 'No match available' });
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-order', {
        body: {
          match_id: match.id,
          purchaser_full_name: fullName.trim(),
          purchaser_mobile: mobile,
          purchaser_email: null,
          seating_type: 'regular',
          seats_count: 1,
          payment_method: 'free',
          pricing_snapshot: { total: 0, seats: [{ seat_index: 0, price: 0, reason: 'free' }] },
        },
      });

      if (error) throw new Error(error.message || 'Network error');
      if (!data?.success) {
        if (data?.code === 'DUPLICATE_ORDER') {
          toast({ title: 'Already registered!', description: 'Use your existing PIN to play.' });
          setStep(1);
          setGamePin(null); // They already have a PIN
          setRegisteredMatchId(match.id);
          setLoading(false);
          return;
        }
        throw new Error(data?.error || 'Registration failed');
      }

      // Success — show PIN
      setGamePin(data.game_pin);
      setRegisteredMatchId(match.id);
      sessionStorage.removeItem('reg_fullName');
      sessionStorage.removeItem('reg_mobile');
      toast({ title: '🎉 Registered successfully!' });
      setStep(1);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Registration failed', description: e.message });
    }
    setLoading(false);
  };

  const homeTeam = roster.find(r => r.side === 'home')?.teams;
  const awayTeam = roster.find(r => r.side === 'away')?.teams;

  if (matchLoading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <BackgroundOrbs />
        <div className="relative z-10 max-w-md mx-auto px-4 py-16 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading match details…</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <BackgroundOrbs />
        <div className="relative z-10 max-w-md mx-auto px-4 py-16 text-center">
          <GlassCard className="p-8">
            <div className="text-5xl mb-4">🏏</div>
            <h2 className="font-display text-xl font-bold text-foreground mb-2">No Match Available</h2>
            <p className="text-muted-foreground text-sm mb-4">
              There are no matches available for registration right now.
            </p>
            <Link to="/">
              <GlassButton variant="primary" size="md">
                <ArrowLeft className="h-4 w-4" /> Back to Home
              </GlassButton>
            </Link>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <BackgroundOrbs />

      <MobileBreadcrumb items={[
        { label: 'Home', to: '/' },
        { label: 'Register' },
      ]} />
      <div className="relative z-10 max-w-md mx-auto px-4 py-6">

        {/* Match header */}
        <GlassCard variant="elevated" className="p-5 mb-6" style={{ borderColor: 'hsl(355 80% 55% / 0.3)' } as React.CSSProperties}>
          {homeTeam && awayTeam ? (
            <div className="flex items-center justify-center gap-4 mb-3">
              <div className="text-center flex-1">
              {IPL_TEAM_LOGOS[homeTeam.short_code?.toUpperCase()] ? (
                  <img src={IPL_TEAM_LOGOS[homeTeam.short_code.toUpperCase()]} alt={homeTeam.name} className="w-12 h-12 mx-auto object-contain mb-1" loading="lazy" />
                ) : (
                  <div
                    className="w-12 h-12 mx-auto rounded-lg flex items-center justify-center text-xl font-display font-bold border mb-1"
                    style={{
                      backgroundColor: homeTeam.color ? `${homeTeam.color}22` : 'hsl(var(--primary) / 0.1)',
                      borderColor: homeTeam.color ? `${homeTeam.color}44` : 'hsl(var(--primary) / 0.3)',
                      color: homeTeam.color || 'hsl(var(--primary))',
                    }}
                  >
                    {homeTeam.short_code}
                  </div>
                )}
                <p className="text-xs text-foreground/80 font-medium truncate">{homeTeam.name}</p>
              </div>
              <span className="text-muted-foreground font-display font-bold">vs</span>
              <div className="text-center flex-1">
              {IPL_TEAM_LOGOS[awayTeam.short_code?.toUpperCase()] ? (
                  <img src={IPL_TEAM_LOGOS[awayTeam.short_code.toUpperCase()]} alt={awayTeam.name} className="w-12 h-12 mx-auto object-contain mb-1" loading="lazy" />
                ) : (
                  <div
                    className="w-12 h-12 mx-auto rounded-lg flex items-center justify-center text-xl font-display font-bold border mb-1"
                    style={{
                      backgroundColor: awayTeam.color ? `${awayTeam.color}22` : 'hsl(var(--secondary) / 0.1)',
                      borderColor: awayTeam.color ? `${awayTeam.color}44` : 'hsl(var(--secondary) / 0.3)',
                      color: awayTeam.color || 'hsl(var(--secondary))',
                    }}
                  >
                    {awayTeam.short_code}
                  </div>
                )}
                <p className="text-xs text-foreground/80 font-medium truncate">{awayTeam.name}</p>
              </div>
            </div>
          ) : (
            <h2 className="font-display text-lg font-bold text-foreground mb-2 text-center">{match.name}</h2>
          )}

          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
            {match.venue && (
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {match.venue}</span>
            )}
            {match.start_time && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(match.start_time).toLocaleString('en-IN', {
                  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            )}
          </div>

          {match.start_time && match.status !== 'ended' && (
            <div className="mt-3">
              <CountdownTimer targetTime={match.start_time} variant="compact" />
            </div>
          )}
        </GlassCard>

        {step === 0 ? (
          /* ─── REGISTRATION FORM ─── */
          <GlassCard variant="elevated" className="p-6 animate-slide-up">
            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-2 bg-success/10 border border-success/30 rounded-full px-4 py-1.5 mb-3">
                <Gamepad2 className="h-3.5 w-3.5 text-success" />
                <span className="text-xs font-semibold text-success">100% Free — No Payment Required</span>
              </div>
              <h3 className="font-display text-xl font-bold text-foreground">Join the Prediction Game</h3>
              <p className="text-xs text-muted-foreground mt-1">Enter your details to get your game PIN</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Full Name</Label>
                <Input
                  ref={nameRef}
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className={nameError ? 'border-destructive' : ''}
                />
                {nameError && <p className="text-xs text-destructive mt-1">Name must be at least 2 characters</p>}
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Mobile Number
                </Label>
                <Input
                  placeholder="10-digit mobile number"
                  type="tel"
                  inputMode="numeric"
                  value={mobile}
                  onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className={mobileError ? 'border-destructive' : ''}
                />
                {mobileError && <p className="text-xs text-destructive mt-1">Enter a valid 10-digit mobile number</p>}
              </div>

              <GlassButton
                variant="primary"
                size="lg"
                className="w-full font-display font-bold tracking-wide"
                loading={loading}
                onClick={handleRegister}
                disabled={!fullName.trim() || !mobileValid}
              >
                🎯 Register & Get PIN <ChevronRight className="h-5 w-5" />
              </GlassButton>

              <p className="text-xs text-muted-foreground text-center">
                By registering, you agree to our{' '}
                <Link to="/event-terms" className="text-primary underline underline-offset-2">Event Terms</Link>
                {' '}and{' '}
                <Link to="/privacy" className="text-primary underline underline-offset-2">Privacy Policy</Link>
              </p>
            </div>
          </GlassCard>
        ) : (
          /* ─── SUCCESS — SHOW PIN ─── */
          <GlassCard
            variant="elevated"
            className="p-6 animate-slide-up text-center"
            style={{ borderColor: 'hsl(142 70% 45% / 0.4)' } as React.CSSProperties}
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-success/15 border border-success/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>

            <h3 className="font-display text-2xl font-bold text-foreground mb-1">You're In! 🎉</h3>
            <p className="text-muted-foreground text-sm mb-5">
              {gamePin
                ? 'Your game PIN has been generated. Use it to play the prediction game!'
                : 'You are already registered for this match. Use your existing PIN to play.'}
            </p>

            {gamePin && (
              <div className="mb-5">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Your Game PIN</p>
                <div className="inline-flex items-center gap-1 bg-background/60 border-2 border-success/40 rounded-2xl px-8 py-4">
                  {gamePin.split('').map((digit, i) => (
                    <span
                      key={i}
                      className="font-display text-4xl font-bold text-success tabular-nums"
                      style={{ letterSpacing: '0.15em' }}
                    >
                      {digit}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                  <Lock className="h-3 w-3" /> Save this PIN — you'll need it to play
                </p>
              </div>
            )}

            <div className="space-y-3">
              <GlassButton
                variant="success"
                size="lg"
                className="w-full font-display font-bold"
                onClick={() => {
                  if (gamePin) {
                    localStorage.setItem('game_session', JSON.stringify({
                      mobile, pin: gamePin, match_id: registeredMatchId,
                    }));
                  }
                  navigate('/play');
                }}
              >
                <Gamepad2 className="h-5 w-5" /> Enter the Game <ChevronRight className="h-5 w-5" />
              </GlassButton>

              <Link to="/" className="block">
                <GlassButton variant="ghost" size="md" className="w-full">
                  ← Back to Home
                </GlassButton>
              </Link>
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
