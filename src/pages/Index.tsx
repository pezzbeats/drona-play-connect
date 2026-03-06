import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { LandingFooter } from '@/components/ui/LandingFooter';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import {
  MapPin, Calendar, Trophy, Star, ChevronRight,
  Clock, ShieldCheck, BadgeCheck, QrCode, Tv2, Utensils, Target,
  Phone, Mail, X,
} from 'lucide-react';
import hotelLogo from '@/assets/hotel-logo.png';

interface ActiveMatch {
  id: string;
  name: string;
  opponent: string | null;
  venue: string;
  start_time: string | null;
  status: string;
  match_type: string;
}

interface PricingRule {
  base_price_new: number;
  base_price_returning: number | null;
  rule_type: string;
}

const FEATURE_ICONS = [
  <Tv2 className="h-8 w-8 text-primary" />,
  <Target className="h-8 w-8 text-secondary" />,
  <Utensils className="h-8 w-8 text-primary" />,
  <Trophy className="h-8 w-8 text-secondary" />,
];

const FEATURE_EMOJIS = ['🏏', '🎯', '🍽️', '🏆'];

const TRUST_ICONS = [ShieldCheck, BadgeCheck, QrCode, Star];

const MATCH_TYPE_LABELS: Record<string, string> = {
  group: 'Group Stage',
  semi_final: 'Semi Final',
  final: 'Grand Final',
  other: 'Special Match',
};

/** Skeleton shown while match data is loading — mirrors real section height to prevent layout shift */
const MatchSectionSkeleton = () => (
  <div className="mb-6 animate-pulse space-y-4">
    {/* Banner placeholder */}
    <div className="h-52 rounded-2xl skeleton" />

    {/* Match card skeleton */}
    <div className="glass-card p-6 space-y-4">
      <div className="flex justify-center gap-2">
        <div className="h-5 w-36 skeleton rounded-full" />
        <div className="h-5 w-24 skeleton rounded-full" />
      </div>
      <div className="space-y-2 flex flex-col items-center">
        <div className="h-8 w-3/4 skeleton rounded-lg" />
        <div className="h-4 w-1/3 skeleton rounded" />
      </div>
      <div className="pt-3 border-t border-border/40 space-y-3">
        <div className="flex justify-center gap-3">
          <div className="w-8 h-8 skeleton rounded-lg flex-shrink-0" />
          <div className="h-4 w-48 skeleton rounded" />
        </div>
        <div className="flex justify-center gap-3">
          <div className="w-8 h-8 skeleton rounded-lg flex-shrink-0" />
          <div className="h-4 w-56 skeleton rounded" />
        </div>
      </div>
    </div>

    {/* Features grid skeleton (2×2) */}
    <div className="grid grid-cols-2 gap-3.5">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="glass-card p-4 space-y-2.5">
          <div className="w-8 h-8 skeleton rounded-lg" />
          <div className="h-4 w-3/4 skeleton rounded" />
          <div className="h-3 w-full skeleton rounded" />
          <div className="h-3 w-2/3 skeleton rounded" />
        </div>
      ))}
    </div>

    {/* Pricing card skeleton */}
    <div className="glass-card p-5 space-y-3">
      <div className="h-5 w-32 skeleton rounded" />
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-4 skeleton h-24" />
        <div className="rounded-xl p-4 skeleton h-24" />
      </div>
      <div className="h-3 w-48 skeleton rounded mx-auto" />
    </div>

    {/* Trust strip skeleton */}
    <div className="glass-card p-5 space-y-3">
      <div className="h-4 w-24 skeleton rounded mx-auto" />
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-4 w-40 skeleton rounded" />
        ))}
      </div>
    </div>
  </div>
);

export default function IndexPage() {
  const { get, loading: configLoading } = useSiteConfig();
  const [match, setMatch] = useState<ActiveMatch | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PricingRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [barDismissed, setBarDismissed] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 8000);
    fetchData().finally(() => clearTimeout(timeout));
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('id, name, opponent, venue, start_time, status, match_type')
        .eq('is_active_for_registration', true)
        .maybeSingle();

      if (matchError) console.error('[Index] Error fetching active match:', matchError);

      if (matchData) {
        setMatch(matchData);

        const [bannerRes, pricingRes] = await Promise.all([
          supabase.from('match_assets').select('file_path').eq('match_id', matchData.id).eq('asset_type', 'banner_image').maybeSingle(),
          supabase.from('match_pricing_rules').select('base_price_new, base_price_returning, rule_type').eq('match_id', matchData.id).limit(1).maybeSingle(),
        ]);

        if (bannerRes.data?.file_path) {
          const { data: url } = supabase.storage.from('match-assets').getPublicUrl(bannerRes.data.file_path);
          setBannerUrl(url?.publicUrl || null);
        }
        if (pricingRes.data) setPricing(pricingRes.data);
      }
    } catch (e) {
      console.error('[Index] fetchData error:', e);
    } finally {
      setLoading(false);
    }
  };

  const features = [1, 2, 3, 4].map(n => ({
    icon: FEATURE_ICONS[n - 1],
    emoji: FEATURE_EMOJIS[n - 1],
    label: get(`feature_${n}_label`, ['Live Stadium Screening', 'Fun Guess Game', 'Premium Food & Beverages', 'Live Leaderboard'][n - 1]),
    desc: get(`feature_${n}_desc`, ['Experience the electrifying atmosphere on the big screen', 'Make predictions for entertainment & exciting rewards', 'Premium food & beverage service throughout the event', 'Compete with fellow guests in friendly challenges'][n - 1]),
  }));

  const trustItems = [1, 2, 3, 4].map((n, i) => ({
    icon: TRUST_ICONS[i],
    label: get(`trust_${n}_label`, ['Safe & professionally managed', 'Organised hospitality experience', 'Secure entry & digital passes', 'Premium venue & arrangements'][i]),
  }));

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
        {get('disclaimer_bar_text', '🎯 Fun Guess Game only — for entertainment. No betting, no wagering. All event fees are strictly for hospitality services.')}
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-10">

        {/* ─── HERO SECTION ─── */}
        <div className="text-center mb-10 relative animate-slide-up">
          {/* Spotlight behind title */}
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
            {get('hero_title', 'T20 Fan Night')}
          </h1>

          <p className="text-foreground/75 font-body text-sm md:text-base font-medium tracking-[0.2em] uppercase mb-5">
            {get('hero_subtitle', 'An Exclusive Cricket Celebration Experience')}
          </p>

          {/* Venue badge chip */}
          <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full border border-secondary/30 text-secondary text-sm font-semibold">
            <MapPin className="h-3.5 w-3.5" />
            {get('hero_venue_badge', 'Hosted at Hotel Drona Palace, Kashipur')}
          </div>
        </div>

        {loading ? (
          <MatchSectionSkeleton />
        ) : match ? (
          <>
            {/* ─── BANNER ─── */}
            {bannerUrl && (
              <div className="mb-6 rounded-2xl overflow-hidden animate-slide-up"
                style={{ boxShadow: '0 0 40px hsl(355 80% 55% / 0.25), 0 0 80px hsl(140 60% 10% / 0.5)', animationDelay: '0.05s' }}>
                <img src={bannerUrl} alt={match.name} className="w-full h-52 object-cover" />
                <div className="h-1 bg-gradient-to-r from-primary via-secondary to-primary opacity-80" />
              </div>
            )}

            {/* ─── MATCH HIGHLIGHT CARD ─── */}
            <GlassCard
              variant="elevated"
              glow
              className="p-6 mb-6 animate-slide-up"
              style={{ animationDelay: '0.08s', borderColor: 'hsl(355 80% 55% / 0.35)' } as React.CSSProperties}
            >
              {/* Status + type badges */}
              <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
                <div className="flex items-center gap-1.5 bg-success/15 border border-success/30 rounded-full px-3 py-1">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs font-bold text-success uppercase tracking-wider">Registrations Open</span>
                </div>
                <div className="bg-secondary/15 border border-secondary/30 rounded-full px-3 py-1">
                  <span className="text-xs font-bold text-secondary uppercase tracking-wider">
                    {MATCH_TYPE_LABELS[match.match_type] ?? match.match_type.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-1 leading-tight text-center">
                {match.name}
              </h2>
              {match.opponent && (
                <p className="text-muted-foreground text-sm mb-4 font-medium text-center">vs {match.opponent}</p>
              )}

              <div className="space-y-3 pt-3 border-t border-border/40">
                <div className="flex items-center justify-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-foreground/80 font-medium">{match.venue}</span>
                </div>
                {match.start_time && (
                  <div className="flex items-center justify-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-foreground/80 font-medium">
                      {new Date(match.start_time).toLocaleString('en-IN', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* ─── EVENT EXPERIENCE ─── */}
            <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.12s' } as React.CSSProperties}>
              <div className="text-center mb-5">
                <p className="section-title mb-1">Highlights</p>
                <h3 className="font-display text-2xl font-bold text-foreground tracking-wide">
                  Event Experience Includes
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                {features.map((f, i) => (
                  <GlassCard
                    key={f.label}
                    className="p-4 cursor-default transition-transform duration-200 hover:scale-[1.03] hover:border-primary/30 animate-slide-up"
                    style={{ animationDelay: `${0.14 + i * 0.06}s` } as React.CSSProperties}
                  >
                    <div className="mb-3">{f.icon}</div>
                    <p className="font-display font-bold text-base text-foreground leading-tight">{f.label}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{f.desc}</p>
                  </GlassCard>
                ))}
              </div>
            </div>

            {/* ─── PRICING CARD ─── */}
            {pricing && (
              <GlassCard
                className="p-5 mb-6 border-secondary/25 animate-slide-up"
                gold
                style={{ animationDelay: '0.22s' } as React.CSSProperties}
              >
                <h3 className="font-display text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  🎫 <span>Ticket Pricing</span>
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">New Attendee</p>
                    <p className="font-display text-4xl font-bold gradient-text leading-none">₹{pricing.base_price_new}</p>
                    <p className="text-xs text-muted-foreground mt-1">per seat</p>
                  </div>
                  {pricing.base_price_returning ? (
                    <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Returning Guest</p>
                      <p className="font-display text-4xl font-bold text-secondary leading-none">₹{pricing.base_price_returning}</p>
                      <p className="text-xs text-muted-foreground mt-1">loyalty price</p>
                    </div>
                  ) : (
                    <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-4 text-center flex flex-col items-center justify-center">
                      <p className="text-xs text-secondary font-semibold">Group & Family</p>
                      <p className="text-xs text-muted-foreground mt-1">Special packages available</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Group & family discounts available · Pay at venue or via UPI
                </p>
              </GlassCard>
            )}

            {/* ─── TRUST STRIP ─── */}
            <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.3s' } as React.CSSProperties}>
              <GlassCard className="p-5">
                <p className="section-title text-center mb-4">Why Attend?</p>
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
        ) : (
          /* ─── NO ACTIVE MATCH — COMING SOON ─── */
          <GlassCard className="p-8 text-center mb-6 animate-slide-up" glow>
            <div className="text-6xl mb-4 drop-shadow-[0_0_24px_hsl(355_80%_55%/0.5)]">🏏</div>
            <h2 className="font-display text-2xl font-bold gradient-text mb-2">Next Event Coming Soon</h2>
            <p className="text-muted-foreground text-sm mb-6">
              The next T20 Fan Night is being planned. Stay tuned — registrations will open soon!
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {features.map((f, i) => (
                <div
                  key={f.label}
                  className="glass-card-sunken border border-border/30 rounded-xl p-3.5 animate-slide-up"
                  style={{ animationDelay: `${0.1 + i * 0.06}s` } as React.CSSProperties}
                >
                  <div className="mb-2">{f.icon}</div>
                  <p className="text-sm font-semibold text-foreground font-display">{f.label}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" />
              <span>Check back soon for the next event</span>
            </div>
          </GlassCard>
        )}

        {/* ─── PRIMARY CTA — always visible ─── */}
        <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.27s' } as React.CSSProperties}>
          <Link to="/register" className="block mb-3">
            <button className="w-full h-16 btn-gradient rounded-xl text-xl font-display font-bold tracking-wide flex items-center justify-center gap-2 animate-glow-pulse transition-transform hover:scale-[1.02] active:scale-[0.98]">
              Reserve Your Seats Now <ChevronRight className="h-6 w-6" />
            </button>
          </Link>
          <Link to="/ticket" className="block">
            <button className="w-full h-12 bg-success text-success-foreground rounded-xl text-base font-display font-bold tracking-wide flex items-center justify-center gap-2 shadow-[0_0_20px_hsl(142_70%_45%/0.45)] hover:shadow-[0_0_30px_hsl(142_70%_45%/0.65)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
              Already Booked? View Your Passes <ChevronRight className="h-5 w-5" />
            </button>
          </Link>
        </div>

        {/* ─── LEGAL DISCLAIMER ─── */}
        <div className="mb-6 disclaimer-bar rounded-xl p-5 text-xs animate-slide-up" style={{ animationDelay: '0.33s' } as React.CSSProperties}>
          <p className="font-bold text-sm mb-2">{get('legal_disclaimer_title', '🎯 Fun Guess Game — Legal Disclaimer')}</p>
          <p className="leading-relaxed">
            {get('legal_disclaimer_body', 'This event includes a recreational fun prediction activity. It is not gambling, betting, or wagering. No money is staked or won. All payments are strictly for hospitality services including venue access, food, and beverages. Participation in the fun game is voluntary and for entertainment purposes only.')}
          </p>
        </div>

        {/* ─── BUSINESS TRUST BLOCK ─── */}
        <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.36s' } as React.CSSProperties}>
          <GlassCard className="p-5">
            <p className="section-title text-center mb-4">Operated By</p>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Identity */}
              <div className="text-center sm:text-left">
                <p className="font-display font-bold text-foreground text-base">SR LEISURE INN</p>
                <p className="text-xs text-muted-foreground">Hotel Drona Palace, Kashipur, Uttarakhand</p>
                <p className="text-xs font-mono text-secondary/80 mt-0.5">GSTIN: ABOFS1823N1ZS</p>
              </div>
              {/* Contact chips */}
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
            {/* Payment methods */}
            <div className="mt-4 pt-4 border-t border-border/30">
              <p className="text-xs text-muted-foreground text-center mb-2 font-medium">Accepted Payment Methods</p>
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                {['Razorpay (Cards · UPI · Wallets)', 'UPI QR', 'Pay at Venue'].map(m => (
                  <span key={m} className="px-2.5 py-1 rounded-md bg-muted/60 border border-border/50 text-muted-foreground font-medium">
                    {m}
                  </span>
                ))}
              </div>
            </div>
            {/* Legal links */}
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground/60">
              {[
                { to: '/privacy', label: 'Privacy' },
                { to: '/terms', label: 'Terms' },
                { to: '/refund-policy', label: 'Refunds' },
                { to: '/shipping', label: 'Delivery' },
                { to: '/pricing', label: 'Pricing' },
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

      {/* ─── PREMIUM FOOTER ─── */}
      <LandingFooter />

      {/* ─── STICKY BOTTOM CTA BAR ─── */}
      <div className="fixed bottom-0 inset-x-0 z-[9000] pb-safe">
        <div className="backdrop-blur-md bg-background/80 border-t border-border/50 px-4 pt-2.5 pb-3">
          {/* pr-[84px] leaves room for the VoiceAgent mic button (w-14 + right-5 gap) */}
          <div className="flex gap-2.5 max-w-2xl mx-auto pr-[84px]">
            <Link to="/register" className="flex-1">
              <button className="w-full h-12 btn-gradient rounded-xl font-display font-bold text-sm tracking-wide flex items-center justify-center gap-1.5 animate-glow-pulse">
                Reserve Seats <ChevronRight className="h-4 w-4" />
              </button>
            </Link>
            <Link to="/ticket" className="flex-1">
              <button className="w-full h-12 bg-success text-success-foreground rounded-xl font-display font-bold text-sm tracking-wide flex items-center justify-center gap-1.5 shadow-[0_0_16px_hsl(142_70%_45%/0.4)] hover:opacity-90 active:scale-[0.98] transition-all duration-200">
                View Passes <ChevronRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
