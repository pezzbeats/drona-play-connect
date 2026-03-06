import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { Loader2, MapPin, Calendar, Trophy, Gamepad2, Utensils, Star, ChevronRight, Clock } from 'lucide-react';

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

const FEATURES = [
  { icon: '🏟️', label: 'Live T20 Match', desc: 'Watch the full match live at the venue' },
  { icon: '🎯', label: 'Fun Guess Game', desc: 'Predict ball-by-ball outcomes for fun' },
  { icon: '🍽️', label: 'Food & Beverages', desc: 'Full F&B service included at the event' },
  { icon: '🏆', label: 'Leaderboard', desc: 'Compete on the fun participation leaderboard' },
];

export default function IndexPage() {
  const [match, setMatch] = useState<ActiveMatch | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PricingRule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch active match
      const { data: matchData } = await supabase
        .from('matches')
        .select('id, name, opponent, venue, start_time, status, match_type')
        .eq('is_active_for_registration', true)
        .single();

      if (matchData) {
        setMatch(matchData);

        // Fetch banner + pricing in parallel
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
    } catch {
      // No active match — will show coming soon
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <BackgroundOrbs />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <BackgroundOrbs />

      {/* Disclaimer bar */}
      <div className="disclaimer-bar text-center text-xs py-2 px-4 relative z-10">
        🎯 Fun Guess Game only — for entertainment. No betting, no wagering. All event fees are for hospitality only.
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-8">

        {/* Hero Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="text-5xl">🏏</span>
          </div>
          <h1 className="font-display text-5xl font-bold gradient-text mb-2 leading-tight">
            T20 Fan Night
          </h1>
          <p className="text-muted-foreground text-base">Hotel Drona Palace</p>
          <p className="text-muted-foreground text-sm mt-1">The ultimate cricket fan experience</p>
        </div>

        {match ? (
          <>
            {/* Match Banner */}
            {bannerUrl && (
              <div className="mb-5 rounded-2xl overflow-hidden shadow-[0_0_40px_hsl(210_100%_56%/0.2)]">
                <img src={bannerUrl} alt={match.name} className="w-full h-48 object-cover" />
              </div>
            )}

            {/* Active Match Card */}
            <GlassCard className="p-5 mb-5 border border-primary/30" glow>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-bold text-success uppercase tracking-wide">Registrations Open</span>
              </div>

              <h2 className="font-display text-2xl font-bold text-foreground mb-1">{match.name}</h2>
              {match.opponent && (
                <p className="text-muted-foreground text-sm mb-3">vs {match.opponent}</p>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{match.venue}</span>
                </div>
                {match.start_time && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>{new Date(match.start_time).toLocaleString('en-IN', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 text-warning flex-shrink-0" />
                  <span className="capitalize">{match.match_type.replace('_', ' ')} Match</span>
                </div>
              </div>
            </GlassCard>

            {/* What's Included */}
            <div className="mb-5">
              <h3 className="font-display text-lg font-bold text-foreground mb-3 text-center">What's Included</h3>
              <div className="grid grid-cols-2 gap-3">
                {FEATURES.map((f) => (
                  <GlassCard key={f.label} className="p-3">
                    <div className="text-2xl mb-1">{f.icon}</div>
                    <p className="font-display font-bold text-sm text-foreground">{f.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{f.desc}</p>
                  </GlassCard>
                ))}
              </div>
            </div>

            {/* Pricing Card */}
            {pricing && (
              <GlassCard className="p-5 mb-5">
                <h3 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                  🎫 Ticket Pricing
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">New Attendee</p>
                    <p className="font-display text-3xl font-bold gradient-text">₹{pricing.base_price_new}</p>
                    <p className="text-xs text-muted-foreground">per seat</p>
                  </div>
                  {pricing.base_price_returning && (
                    <div className="bg-success/10 border border-success/20 rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Returning Guest</p>
                      <p className="font-display text-3xl font-bold text-success">₹{pricing.base_price_returning}</p>
                      <p className="text-xs text-muted-foreground">loyalty price</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Group & family pricing available · Pay at venue or via UPI
                </p>
              </GlassCard>
            )}

            {/* Big CTA */}
            <Link to="/register" className="block">
              <GlassButton variant="primary" size="lg" className="w-full text-lg py-4 animate-pulse-glow">
                Register Now — Book Your Seat <ChevronRight className="h-5 w-5" />
              </GlassButton>
            </Link>

            <p className="text-xs text-center text-muted-foreground mt-3">
              Already registered?{' '}
              <Link to="/ticket" className="text-primary underline">View your tickets</Link>
            </p>
          </>
        ) : (
          /* No active match — Coming Soon */
          <GlassCard className="p-8 text-center" glow>
            <div className="text-5xl mb-4">🏏</div>
            <h2 className="font-display text-2xl font-bold gradient-text mb-2">Next Event Coming Soon</h2>
            <p className="text-muted-foreground text-sm mb-6">
              The next T20 Fan Night is being planned. Stay tuned — registrations will open soon!
            </p>

            {/* Feature preview */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {FEATURES.map((f) => (
                <div key={f.label} className="bg-muted/20 border border-border rounded-lg p-3">
                  <div className="text-xl mb-1">{f.icon}</div>
                  <p className="text-xs font-medium text-foreground">{f.label}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" />
              <span>Check back soon</span>
            </div>
          </GlassCard>
        )}

        {/* Fun Guess Disclaimer Footer */}
        <div className="mt-6 disclaimer-bar rounded-lg p-4 text-xs">
          <p className="font-bold mb-1">🎯 Fun Guess Game — Legal Disclaimer</p>
          <p className="leading-relaxed">
            The Fun Guess Game is a free entertainment feature for registered attendees only. It is
            <strong> not gambling, betting, or wagering</strong>. No real money is staked or won.
            All event entry fees are exclusively for hospitality services (venue, food & beverage, event access).
            Participation in the guess game is entirely voluntary and purely for entertainment.
          </p>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-4">
          <Link to="/terms" target="_blank" className="text-primary underline">Event Terms & Conditions</Link>
          {' · '}
          <Link to="/admin/login" className="text-muted-foreground underline">Admin Login</Link>
        </p>
      </div>
    </div>
  );
}
