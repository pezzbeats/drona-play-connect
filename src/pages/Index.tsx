import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { LandingFooter } from '@/components/ui/LandingFooter';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { useToast } from '@/hooks/use-toast';
import {
  MapPin, Calendar, Trophy, Star, ChevronRight,
  Clock, ShieldCheck, BadgeCheck, QrCode, Tv2, Utensils, Target,
  Phone, Mail, X, Gamepad2, Lock,
} from 'lucide-react';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import hotelLogo from '@/assets/hotel-logo.png';
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

// ─── Inline Fan Game Login Card ───────────────────────────────────────────────
function GameLoginCard() {
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

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
      } else {
        localStorage.setItem('game_session', JSON.stringify({ mobile, pin, match_id: data.match_id || null }));
        toast({ title: '🎮 Welcome to the game!' });
        navigate('/live');
      }
    } catch {
      toast({ variant: 'destructive', title: 'Login failed' });
    }
    setLoading(false);
  };

  return (
    <GlassCard
      variant="elevated"
      className="p-5 mb-6 animate-slide-up"
      style={{
        borderColor: 'hsl(142 70% 45% / 0.45)',
        boxShadow: '0 0 32px hsl(142 70% 45% / 0.12), 0 0 0 1px hsl(142 70% 45% / 0.2)',
        animationDelay: '0.10s',
      } as React.CSSProperties}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-success/15 border border-success/30 flex items-center justify-center flex-shrink-0">
          <Gamepad2 className="h-5 w-5 text-success" />
        </div>
        <div>
          <p className="font-display font-bold text-foreground text-base leading-tight">Already Registered?</p>
          <p className="text-xs text-muted-foreground">Enter your PIN to play the prediction game</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">Mobile Number</p>
            <input
              className="glass-input w-full h-11 px-3 rounded-lg text-sm bg-background/40 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-success/50 focus:ring-1 focus:ring-success/30 transition-colors"
              placeholder="10-digit mobile"
              type="tel"
              inputMode="numeric"
              value={mobile}
              onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 font-medium flex items-center gap-1">
              <Lock className="h-3 w-3" /> Game PIN
            </p>
            <input
              className="glass-input w-full h-11 px-3 rounded-lg text-sm text-center tracking-[0.6em] text-lg font-bold bg-background/40 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-success/50 focus:ring-1 focus:ring-success/30 transition-colors"
              placeholder="●●●●"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
            />
          </div>
        </div>

        <GlassButton
          variant="success"
          size="md"
          className="w-full font-semibold"
          loading={loading}
          onClick={handleLogin}
        >
          <Gamepad2 className="h-4 w-4" /> Enter the Game
        </GlassButton>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-3">
        PIN is sent after you register for a match ·{' '}
        <Link to="/play" className="text-success/80 hover:text-success underline-offset-2 hover:underline transition-colors">
          Full screen login →
        </Link>
      </p>
    </GlassCard>
  );
}

interface TodayMatch {
  id: string;
  name: string;
  opponent: string | null;
  venue: string;
  start_time: string | null;
  status: string;
  match_type: string;
}

interface RosterTeam {
  match_id: string;
  side: string;
  teams: { name: string; short_code: string; color: string | null; logo_path: string | null } | null;
}

// Well-known IPL team brand colors as fallback
const IPL_TEAM_COLORS: Record<string, { bg: string; accent: string }> = {
  CSK: { bg: '#f9cd05', accent: '#0058e0' },
  MI: { bg: '#004ba0', accent: '#d1ab3e' },
  RCB: { bg: '#d4213d', accent: '#2b2b2b' },
  KKR: { bg: '#3a225d', accent: '#f0c230' },
  SRH: { bg: '#ff822a', accent: '#000000' },
  DC:  { bg: '#0055a3', accent: '#ef1c25' },
  PBKS: { bg: '#dd1f2d', accent: '#a7a9ac' },
  RR:  { bg: '#ea1a85', accent: '#254aa5' },
  GT:  { bg: '#1c3c6b', accent: '#b09862' },
  LSG: { bg: '#a72056', accent: '#ffcc00' },
};

function getTeamColors(shortCode: string, dbColor: string | null) {
  const ipl = IPL_TEAM_COLORS[shortCode.toUpperCase()];
  if (ipl) return ipl;
  if (dbColor) return { bg: dbColor, accent: dbColor };
  return { bg: 'hsl(var(--primary))', accent: 'hsl(var(--secondary))' };
}

const FEATURE_ICONS = [
  <Tv2 className="h-8 w-8 text-primary" />,
  <Target className="h-8 w-8 text-secondary" />,
  <Utensils className="h-8 w-8 text-primary" />,
  <Trophy className="h-8 w-8 text-secondary" />,
];

const TRUST_ICONS = [ShieldCheck, BadgeCheck, QrCode, Star];

const MATCH_TYPE_LABELS: Record<string, string> = {
  group: 'Group Stage',
  semi_final: 'Semi Final',
  final: 'Grand Final',
  other: 'Special Match',
};

const MatchSectionSkeleton = () => (
  <div className="mb-6 animate-pulse space-y-4">
    <div className="glass-card p-6 space-y-4">
      <div className="h-8 w-3/4 skeleton rounded-lg mx-auto" />
      <div className="h-4 w-1/3 skeleton rounded mx-auto" />
      <div className="h-12 w-full skeleton rounded-xl" />
    </div>
  </div>
);

// ─── Today's Match Card ───────────────────────────────────────────────────────
function TodayMatchCard({
  match, roster, index,
}: {
  match: TodayMatch;
  roster: RosterTeam[];
  index: number;
}) {
  const navigate = useNavigate();
  const matchTeams = roster.filter(r => r.match_id === match.id);
  const homeTeam = matchTeams.find(r => r.side === 'home')?.teams;
  const awayTeam = matchTeams.find(r => r.side === 'away')?.teams;

  return (
    <GlassCard
      variant="elevated"
      glow
      className="p-5 mb-4 animate-slide-up"
      style={{ animationDelay: `${0.08 + index * 0.08}s`, borderColor: 'hsl(355 80% 55% / 0.35)' } as React.CSSProperties}
    >
      {/* Status + type badges */}
      <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
        {match.status === 'ended' ? (
          <div className="flex items-center gap-1.5 bg-secondary/15 border border-secondary/30 rounded-full px-3 py-1">
            <Trophy className="h-3 w-3 text-secondary" />
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">Match Ended</span>
          </div>
        ) : match.status === 'live' ? (
          <div className="flex items-center gap-1.5 bg-success/15 border border-success/30 rounded-full px-3 py-1">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-bold text-success uppercase tracking-wider">Live Now</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-success/15 border border-success/30 rounded-full px-3 py-1">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-bold text-success uppercase tracking-wider">Open</span>
          </div>
        )}
        <div className="bg-secondary/15 border border-secondary/30 rounded-full px-3 py-1">
          <span className="text-xs font-bold text-secondary uppercase tracking-wider">
            {MATCH_TYPE_LABELS[match.match_type] ?? match.match_type.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Team vs Team */}
      {homeTeam && awayTeam ? (
        <div className="flex items-center justify-center gap-3 mb-4">
          {/* Home team */}
          <div className="text-center flex-1 min-w-0">
            {(() => {
              const colors = getTeamColors(homeTeam.short_code, homeTeam.color);
              const logoUrl = homeTeam.logo_path
                ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${homeTeam.logo_path}`
                : null;
              return (
                <>
                  <div
                    className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center border-2 mb-1.5 shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${colors.bg}30, ${colors.bg}15)`,
                      borderColor: `${colors.bg}66`,
                      boxShadow: `0 4px 20px ${colors.bg}33, inset 0 1px 0 ${colors.bg}22`,
                    }}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt={homeTeam.name} className="w-10 h-10 object-contain" />
                    ) : IPL_TEAM_LOGOS[homeTeam.short_code.toUpperCase()] ? (
                      <img src={IPL_TEAM_LOGOS[homeTeam.short_code.toUpperCase()]} alt={homeTeam.name} className="w-10 h-10 object-contain" loading="lazy" />
                    ) : (
                      <span className="text-xl font-display font-bold" style={{ color: colors.bg }}>
                        {homeTeam.short_code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground font-semibold truncate">{homeTeam.short_code}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{homeTeam.name}</p>
                </>
              );
            })()}
          </div>

          {/* VS divider */}
          <div className="flex flex-col items-center gap-1 px-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted/30 border border-border/50">
              <span className="font-display font-bold text-sm text-muted-foreground">VS</span>
            </div>
          </div>

          {/* Away team */}
          <div className="text-center flex-1 min-w-0">
            {(() => {
              const colors = getTeamColors(awayTeam.short_code, awayTeam.color);
              const logoUrl = awayTeam.logo_path
                ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${awayTeam.logo_path}`
                : null;
              return (
                <>
                  <div
                    className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center border-2 mb-1.5 shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${colors.bg}30, ${colors.bg}15)`,
                      borderColor: `${colors.bg}66`,
                      boxShadow: `0 4px 20px ${colors.bg}33, inset 0 1px 0 ${colors.bg}22`,
                    }}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt={awayTeam.name} className="w-10 h-10 object-contain" />
                    ) : (
                      <span className="text-xl font-display font-bold" style={{ color: colors.bg }}>
                        {awayTeam.short_code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground font-semibold truncate">{awayTeam.short_code}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{awayTeam.name}</p>
                </>
              );
            })()}
          </div>
        </div>
      ) : (
        <h2 className="font-display text-xl font-bold text-foreground mb-2 text-center">
          {match.name}
        </h2>
      )}

      {/* Venue + Time */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span>{match.venue || 'TBD'}</span>
        </div>
        {match.start_time && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {new Date(match.start_time).toLocaleString('en-IN', {
                weekday: 'short', day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </div>

      {/* Countdown */}
      {match.start_time && match.status !== 'ended' && (
        <div className="mb-4">
          <CountdownTimer targetTime={match.start_time} variant="compact" />
        </div>
      )}

      {/* CTA */}
      {match.status !== 'ended' ? (
        <GlassButton
          variant="primary"
          size="lg"
          className="w-full font-display font-bold tracking-wide animate-glow-pulse"
          onClick={() => navigate(`/register?match_id=${match.id}`)}
        >
          🎯 Join Free — Play Now <ChevronRight className="h-5 w-5" />
        </GlassButton>
      ) : (
        <Link to="/live" className="block">
          <GlassButton variant="ghost" size="md" className="w-full">
            🏆 See Results
          </GlassButton>
        </Link>
      )}
    </GlassCard>
  );
}

// ─── New Match Notification Banner ────────────────────────────────────────────
function NewMatchBanner({ matchNames, onDismiss }: { matchNames: string[]; onDismiss: () => void }) {
  return (
    <div className="animate-slide-up mb-4">
      <div className="relative overflow-hidden rounded-xl border border-secondary/40 bg-secondary/10 px-4 py-3">
        {/* Shimmer overlay */}
        <div className="absolute inset-0 shimmer pointer-events-none" />
        <div className="relative flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-secondary/20 border border-secondary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Trophy className="h-4 w-4 text-secondary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-secondary text-sm leading-tight">
              🏏 New Match{matchNames.length > 1 ? 'es' : ''} Today!
            </p>
            <p className="text-xs text-secondary/80 mt-0.5 truncate">
              {matchNames.join(' · ')}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-secondary/60 hover:text-secondary hover:bg-secondary/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IndexPage() {
  const { get } = useSiteConfig();
  const [matches, setMatches] = useState<TodayMatch[]>([]);
  const [roster, setRoster] = useState<RosterTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [barDismissed, setBarDismissed] = useState(() => sessionStorage.getItem('barDismissed') === '1');
  const [newMatchNames, setNewMatchNames] = useState<string[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 10000);
    fetchData(0).then((count) => {
      clearTimeout(timeout);
      if (count === 0) {
        supabase.functions.invoke('cricket-api-sync', {
          body: null,
          method: 'GET',
        }).then(() => fetchData(0)).catch(() => {});
      }
    });
  }, []);

  // Realtime: listen for newly inserted matches and show banner
  useEffect(() => {
    const channel = supabase
      .channel('new-matches-landing')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'matches' },
        (payload) => {
          const newMatch = payload.new as TodayMatch;
          if (newMatch.status !== 'draft') {
            setNewMatchNames(prev => [...prev, newMatch.name]);
            setBannerDismissed(false);
            // Refresh data to include the new match
            fetchData(0);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async (attempt = 0): Promise<number> => {
    if (attempt === 0) setLoading(true);
    try {
      // Fetch today's matches: start_time within today (IST) OR is_active_for_registration
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('id, name, opponent, venue, start_time, status, match_type')
        .or(`and(start_time.gte.${todayStart.toISOString()},start_time.lte.${todayEnd.toISOString()}),is_active_for_registration.eq.true`)
        .neq('status', 'draft')
        .order('start_time', { ascending: true });

      if (matchError) throw matchError;
      setFetchError(false);

      const uniqueMatches = matchData?.filter(
        (m, i, arr) => arr.findIndex(x => x.id === m.id) === i
      ) || [];
      setMatches(uniqueMatches);

      // Fetch roster/teams for these matches
      if (uniqueMatches.length > 0) {
        const matchIds = uniqueMatches.map(m => m.id);
        const { data: rosterData } = await supabase
          .from('match_roster')
          .select('match_id, side, teams(name, short_code, color, logo_path)')
          .in('match_id', matchIds);
        setRoster((rosterData as any[]) || []);
      }
      return uniqueMatches.length;
    } catch (e) {
      console.error(`[Index] fetchData error (attempt ${attempt + 1}):`, e);
      if (attempt < 2) {
        setTimeout(() => fetchData(attempt + 1), 1500 * (attempt + 1));
        return 0;
      }
      setFetchError(true);
      return 0;
    } finally {
      setLoading(false);
    }
  };

  const features = [1, 2, 3, 4].map(n => ({
    icon: FEATURE_ICONS[n - 1],
    label: get(`feature_${n}_label`, ['Live Stadium Screening', 'Fun Prediction Game', 'Premium Food & Beverages', 'Live Leaderboard'][n - 1]),
    desc: get(`feature_${n}_desc`, ['Experience the electrifying atmosphere on the big screen', 'Make predictions for entertainment & exciting rewards', 'Premium food & beverage service throughout the event', 'Compete with fellow guests in friendly challenges'][n - 1]),
  }));

  const trustItems = [1, 2, 3, 4].map((n, i) => ({
    icon: TRUST_ICONS[i],
    label: get(`trust_${n}_label`, ['Safe & professionally managed', 'Organised hospitality experience', 'Secure entry & digital passes', 'Premium venue & arrangements'][i]),
  }));

  const hasActiveMatches = matches.some(m => m.status !== 'ended');

  return (
    <div className="min-h-screen relative overflow-hidden pb-24">
      <BackgroundOrbs />

      {/* Subtle grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.025]"
        style={{
          backgroundImage: `repeating-linear-gradient(90deg, hsl(140 60% 40%) 0px, hsl(140 60% 40%) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(0deg, hsl(140 60% 40%) 0px, hsl(140 60% 40%) 1px, transparent 1px, transparent 40px)`,
        }}
      />

      {/* Diagonal pitch stripes */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.035]"
        style={{
          backgroundImage: `repeating-linear-gradient(168deg, transparent 0px, transparent 70px, hsl(140 70% 30%) 70px, hsl(140 70% 30%) 140px)`,
        }}
      />

      {/* Radial vignette */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 40%, transparent 30%, hsl(140 60% 2% / 0.65) 100%)' }}
      />

      {/* Stadium-light corner glows */}
      <div className="fixed top-0 left-0 w-64 h-64 pointer-events-none z-0 opacity-20"
        style={{ background: 'radial-gradient(ellipse at top left, hsl(38 75% 52% / 0.5) 0%, transparent 65%)' }} />
      <div className="fixed top-0 right-0 w-64 h-64 pointer-events-none z-0 opacity-20"
        style={{ background: 'radial-gradient(ellipse at top right, hsl(355 80% 55% / 0.4) 0%, transparent 65%)' }} />

      {/* Top disclaimer bar */}
      <div className="disclaimer-bar text-center text-xs py-2.5 px-4 relative z-10 font-medium">
        {get('disclaimer_bar_text', '🎯 Free Prediction Game — for entertainment only. No betting, no wagering.')}
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-10">

        {/* ─── HERO SECTION ─── */}
        <div className="text-center mb-10 relative animate-slide-up">
          <div
            className="absolute inset-x-0 top-0 h-48 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, hsl(355 80% 55% / 0.12) 0%, transparent 70%)' }}
          />

          {/* Hotel Logo */}
          <div className="flex flex-col items-center mb-5 gap-2">
            <div className="w-24 h-24 flex items-center justify-center rounded-full bg-[hsl(38_60%_10%)] shadow-[0_0_36px_hsl(38_75%_52%/0.75),0_0_72px_hsl(38_75%_52%/0.3)]" style={{border:'2px solid hsl(38 75% 52% / 0.6)'}}>
              <img src={hotelLogo} alt="Hotel Drona Palace" className="w-16 h-16 object-contain drop-shadow-[0_0_10px_hsl(38_75%_52%/0.9)]" />
            </div>
            <div className="text-center">
              <p className="font-display text-base font-bold text-secondary leading-tight">Hotel Drona Palace</p>
              <p className="text-xs text-muted-foreground">A Unit of SR Leisure Inn</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mb-5">
            <div className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-transparent to-secondary/50" />
            <span
              className="text-6xl drop-shadow-[0_0_28px_hsl(355_80%_55%/0.7)]"
              style={{ animation: 'orb-float 3s ease-in-out infinite' }}
            >🏏</span>
            <div className="h-px flex-1 max-w-[80px] bg-gradient-to-l from-transparent to-secondary/50" />
          </div>

          <h1 className="font-display gradient-text mb-2 leading-none tracking-widest uppercase"
            style={{ fontSize: 'clamp(3.5rem, 14vw, 6rem)', letterSpacing: '0.08em', textShadow: '0 0 40px hsl(355 80% 55% / 0.4), 0 0 80px hsl(38 75% 52% / 0.2)' }}>
            {get('hero_title', 'Cricket Fan Night')}
          </h1>

          <p className="text-foreground/75 font-body text-sm md:text-base font-medium tracking-[0.2em] uppercase mb-5">
            {get('hero_subtitle', 'Free Prediction Game — Play & Win!')}
          </p>

          <a
            href="https://maps.google.com/?q=Hotel+Drona+Palace+Kashipur+Uttarakhand"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full border border-secondary/30 text-secondary text-sm font-semibold hover:border-secondary/60 hover:bg-secondary/10 transition-colors"
          >
            <MapPin className="h-3.5 w-3.5" />
            {get('hero_venue_badge', 'Hosted at Hotel Drona Palace, Kashipur')}
          </a>
        </div>

        {/* ─── TODAY'S MATCHES ─── */}
        {loading ? (
          <MatchSectionSkeleton />
        ) : matches.length > 0 ? (
          <>
            {/* New match notification banner */}
            {newMatchNames.length > 0 && !bannerDismissed && (
              <NewMatchBanner
                matchNames={newMatchNames}
                onDismiss={() => setBannerDismissed(true)}
              />
            )}
            <div className="text-center mb-5 animate-slide-up">
              <p className="section-title mb-1">Today's IPL Matches</p>
              <h3 className="font-display text-xl font-bold text-foreground">
                {matches.length === 1 ? "Today's Match" : `${matches.length} Matches Today`}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Register for free and play the prediction game!</p>
            </div>

            {matches.map((m, i) => (
              <TodayMatchCard key={m.id} match={m} roster={roster} index={i} />
            ))}

            {/* Game Login Card */}
            <GameLoginCard />

            {/* ─── EVENT EXPERIENCE ─── */}
            <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.3s' } as React.CSSProperties}>
              <div className="text-center mb-5">
                <p className="section-title mb-1">How It Works</p>
                <h3 className="font-display text-2xl font-bold text-foreground tracking-wide">
                  The Experience
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                {features.map((f, i) => (
                  <GlassCard
                    key={f.label}
                    className="p-4 cursor-default transition-transform duration-200 hover:scale-[1.03] hover:border-primary/30 animate-slide-up"
                    style={{ animationDelay: `${0.32 + i * 0.06}s` } as React.CSSProperties}
                  >
                    <div className="mb-3">{f.icon}</div>
                    <p className="font-display font-bold text-base text-foreground leading-tight">{f.label}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{f.desc}</p>
                  </GlassCard>
                ))}
              </div>
            </div>

            {/* ─── TRUST STRIP ─── */}
            <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.5s' } as React.CSSProperties}>
              <GlassCard className="p-5">
                <p className="section-title text-center mb-4">Why Join?</p>
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
                  {trustItems.map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2 text-sm text-foreground/75">
                      <Icon className="h-4 w-4 text-success flex-shrink-0" />
                      <span className="font-medium">{label}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </>
        ) : fetchError ? (
          <GlassCard className="p-8 text-center mb-6 animate-slide-up" style={{ borderColor: 'hsl(355 80% 55% / 0.3)' } as React.CSSProperties}>
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="font-display text-xl font-bold text-foreground mb-2">Couldn't Load Matches</h2>
            <p className="text-muted-foreground text-sm mb-5">
              There was a connection issue. Please try again.
            </p>
            <GlassButton variant="primary" size="md" onClick={() => fetchData(0)}>
              Retry Loading
            </GlassButton>
          </GlassCard>
        ) : (
          /* ─── NO MATCHES TODAY ─── */
          <GlassCard className="p-8 text-center mb-6 animate-slide-up" glow>
            <div className="text-6xl mb-4 drop-shadow-[0_0_24px_hsl(355_80%_55%/0.5)]">🏏</div>
            <h2 className="font-display text-2xl font-bold gradient-text mb-2">No Matches Today</h2>
            <p className="text-muted-foreground text-sm mb-6">
              There are no IPL matches scheduled for today. Check back tomorrow for the next match!
            </p>
            <GameLoginCard />
            <button
              onClick={() => fetchData(0)}
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-2 transition-colors mb-4 block mx-auto"
            >
              Refresh
            </button>
          </GlassCard>
        )}

        {/* ─── LEGAL DISCLAIMER ─── */}
        <div className="mb-6 disclaimer-bar rounded-xl p-5 text-xs animate-slide-up" style={{ animationDelay: '0.55s' } as React.CSSProperties}>
          <p className="font-bold text-sm mb-2">{get('legal_disclaimer_title', '🎯 Fun Prediction Game — Legal Disclaimer')}</p>
          <p className="leading-relaxed">
            {get('legal_disclaimer_body', 'This is a free recreational prediction activity for entertainment purposes only. It is not gambling, betting, or wagering. No money is staked or won. Participation is voluntary and free of charge.')}
          </p>
        </div>

        {/* ─── BUSINESS TRUST BLOCK ─── */}
        <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.58s' } as React.CSSProperties}>
          <GlassCard className="p-5">
            <p className="section-title text-center mb-4">Operated By</p>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <p className="font-display font-bold text-foreground text-base">SR LEISURE INN</p>
                <p className="text-xs text-muted-foreground">Hotel Drona Palace, Kashipur, Uttarakhand</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                <a
                  href="tel:7217016170"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
                >
                  <Phone className="h-3 w-3" /> +91 72170 16170
                </a>
                <a
                  href="mailto:dronapalace@gmail.com"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
                >
                  <Mail className="h-3 w-3" /> dronapalace@gmail.com
                </a>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground/60">
              {[
                { to: '/privacy', label: 'Privacy' },
                { to: '/terms', label: 'Terms' },
                { to: '/contact', label: 'Contact' },
                { to: '/disclaimer', label: 'Disclaimer' },
              ].map(({ to, label }) => (
                <Link key={to} to={to} className="hover:text-primary transition-colors">
                  {label}
                </Link>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* ─── ADMIN LINK ─── */}
        <p className="text-xs text-center text-muted-foreground/50 mb-2">
          <Link to="/admin/login" className="hover:text-muted-foreground transition-colors">Admin Login</Link>
        </p>
      </div>

      {/* ─── LEGAL PAGES STRIP ─── */}
      <div className="relative z-10 border-t border-border/30 bg-background/40 backdrop-blur-sm py-4 px-4">
        <p className="text-center text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-3 font-display">Legal &amp; Compliance</p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 max-w-2xl mx-auto">
          {[
            { to: '/privacy', label: 'Privacy Policy' },
            { to: '/terms', label: 'Terms & Conditions' },
            { to: '/contact', label: 'Contact Us' },
            { to: '/event-terms', label: 'Event Terms' },
            { to: '/disclaimer', label: 'Disclaimer' },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <LandingFooter />

      {/* ─── STICKY BOTTOM CTA BAR ─── */}
      {!barDismissed && hasActiveMatches && (
        <div
          className="fixed bottom-0 inset-x-0 z-[9000] pb-safe"
          style={{ animation: 'bar-slide-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both', animationDelay: '0.6s' }}
        >
          <style>{`
            @keyframes bar-slide-up {
              from { transform: translateY(100%); opacity: 0; }
              to   { transform: translateY(0);    opacity: 1; }
            }
          `}</style>
          <div className="backdrop-blur-md bg-background/80 border-t border-border/50 px-4 pt-2.5 pb-3">
            <div className="flex gap-2 max-w-2xl mx-auto items-center">
              <Link to={`/register${matches.length === 1 ? `?match_id=${matches[0].id}` : ''}`} className="flex-1">
                <button className="w-full h-12 btn-gradient rounded-xl font-display font-bold text-sm tracking-wide flex items-center justify-center gap-1.5 animate-glow-pulse">
                  🎯 Join Free <ChevronRight className="h-4 w-4" />
                </button>
              </Link>
              <Link to="/play" className="flex-1">
                <button className="w-full h-12 bg-success text-success-foreground rounded-xl font-display font-bold text-sm tracking-wide flex items-center justify-center gap-1.5 shadow-[0_0_16px_hsl(142_70%_45%/0.4)] hover:opacity-90 active:scale-[0.98] transition-all duration-200">
                  🎮 Play <ChevronRight className="h-4 w-4" />
                </button>
              </Link>
              <button
                onClick={() => { setBarDismissed(true); sessionStorage.setItem('barDismissed', '1'); }}
                aria-label="Dismiss"
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
