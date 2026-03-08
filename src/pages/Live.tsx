import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { Scoreboard } from '@/components/live/Scoreboard';
import { PredictionPanel } from '@/components/live/PredictionPanel';
import { Leaderboard } from '@/components/live/Leaderboard';
import { useRealtimeChannel, type ChannelSubscription } from '@/hooks/useRealtimeChannel';
import { Loader2, Trophy, Gamepad2, BarChart3, WifiOff, LogOut, Zap, X } from 'lucide-react';

type Tab = 'score' | 'predict' | 'leaderboard';

interface GameSession {
  mobile: string;
  pin: string;
  match_id: string;
}

// ── Inner component that receives a resolved matchId ──────────────────────────
function LiveContent({
  matchId,
  matchName: initialMatchName,
  predictionsEnabled: initialPredictionsEnabled,
  session,
  onLogout,
  initialTab = 'score',
  matchEnded = false,
}: {
  matchId: string;
  matchName: string;
  predictionsEnabled: boolean;
  session: GameSession;
  onLogout: () => void;
  initialTab?: Tab;
  matchEnded?: boolean;
}) {
  const [matchName, setMatchName] = useState(initialMatchName);
  const [predictionsEnabled, setPredictionsEnabled] = useState(initialPredictionsEnabled);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [guessNudge, setGuessNudge] = useState(false);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-dismiss nudge after 5 s
  useEffect(() => {
    if (guessNudge) {
      clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = setTimeout(() => setGuessNudge(false), 5000);
    }
    return () => clearTimeout(nudgeTimerRef.current);
  }, [guessNudge]);

  // Auto-switch away from Guess tab if admin disables predictions
  useEffect(() => {
    if (!predictionsEnabled && activeTab === 'predict') {
      setActiveTab('score');
    }
  }, [predictionsEnabled, activeTab]);

  // ── Realtime: watch matches row for admin toggles ────────────────────────
  const matchSubscriptions = useMemo<ChannelSubscription[]>(() => [
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'matches',
      filter: `id=eq.${matchId}`,
      callback: (payload) => {
        if (payload.new) {
          setPredictionsEnabled(!!payload.new.predictions_enabled);
          if (payload.new.name) setMatchName(payload.new.name);
        }
      },
    },
  ], [matchId]);

  const refetchMatch = useCallback(async () => {
    const { data } = await supabase
      .from('matches')
      .select('name, predictions_enabled')
      .eq('id', matchId)
      .single();
    if (data) {
      setMatchName(data.name);
      setPredictionsEnabled(data.predictions_enabled);
    }
  }, [matchId]);

  const { connected, reconnecting } = useRealtimeChannel(
    `live-match-${matchId}`,
    matchSubscriptions,
    refetchMatch,
  );

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'score',       label: 'Live Score',  icon: <BarChart3 className="h-5 w-5" /> },
    ...(predictionsEnabled ? [{ key: 'predict' as Tab, label: 'Guess', icon: <Gamepad2 className="h-5 w-5" /> }] : []),
    { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="h-5 w-5" /> },
  ];

  const showBanner = !connected || reconnecting;

  return (
    <div
      className="min-h-screen relative flex flex-col"
      style={{ paddingBottom: 'calc(68px + env(safe-area-inset-bottom))' }}
    >
      <BackgroundOrbs />

      {/* Disclaimer bar */}
      <div className="disclaimer-bar text-center text-xs py-1.5 px-4 relative z-10 shrink-0">
        🎯 <strong>Fun Game only.</strong> No betting, no wagering. Entertainment only.
      </div>

      {/* ── Match ended banner ── */}
      {matchEnded && (
        <div className="relative z-20 shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-muted/30 border-b border-border/40 text-muted-foreground">
          🏆 This match has ended — view the final leaderboard below
        </div>
      )}

      {/* ── Reconnecting / offline banner ── */}
      <div
        className={`relative z-20 shrink-0 overflow-hidden transition-all duration-500 ease-in-out ${
          showBanner ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold ${
          reconnecting
            ? 'bg-warning/15 border-b border-warning/30 text-warning'
            : 'bg-destructive/15 border-b border-destructive/30 text-destructive'
        }`}>
          {reconnecting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              Reconnecting to live updates… your data is safe
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 shrink-0" />
              Connecting to live updates…
            </>
          )}
        </div>
      </div>

      {/* Compact sticky header */}
      <div className="sticky top-0 z-20 bg-[hsl(var(--background)/0.85)] backdrop-blur-md border-b border-border/40 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="min-w-0">
            <h1 className="font-display text-base font-bold gradient-text leading-tight truncate">{matchName}</h1>
            <p className="text-xs text-muted-foreground">{session.mobile}</p>
          </div>
          <GlassButton variant="ghost" size="sm" onClick={() => setShowExitConfirm(true)} className="shrink-0 ml-2 gap-1.5">
            <LogOut className="h-3.5 w-3.5" /> Exit
          </GlassButton>
        </div>
      </div>

      {/* Exit confirmation dialog */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="glass-card-elevated p-6 max-w-sm w-full text-center space-y-4">
            <div className="text-3xl">🚪</div>
            <p className="font-display text-lg font-bold text-foreground">Leave the game?</p>
            <p className="text-sm text-muted-foreground">You'll be taken back to the login screen. Your score is saved.</p>
            <div className="flex gap-3">
              <GlassButton variant="ghost" size="md" className="flex-1" onClick={() => setShowExitConfirm(false)}>
                Stay
              </GlassButton>
              <GlassButton variant="primary" size="md" className="flex-1" onClick={onLogout}>
                Exit
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 relative z-10 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-4">
          {activeTab === 'score' && <Scoreboard matchId={matchId} />}
          {activeTab === 'predict' && (
            <PredictionPanel matchId={matchId} mobile={session.mobile} pin={session.pin} />
          )}
          {activeTab === 'leaderboard' && (
            <Leaderboard matchId={matchId} mobile={session.mobile} />
          )}

          {/* Bottom disclaimer */}
          <div className="mt-6 disclaimer-bar rounded-lg p-3 text-xs">
            🎯 <strong>Disclaimer:</strong> Fun entertainment game only. No real money, no gambling. All guesses are for fun.
          </div>
        </div>
      </div>

      {/* Fixed bottom tab bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/50 bg-[hsl(var(--background)/0.92)] backdrop-blur-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex max-w-lg mx-auto relative">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 pt-1 pb-3 text-xs font-semibold transition-colors relative ${
                activeTab === tab.key
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-b-full transition-all duration-300"
                style={{
                  width: activeTab === tab.key ? '40%' : '0%',
                  background: 'linear-gradient(90deg, hsl(355 80% 55%), hsl(38 75% 52%))',
                  opacity: activeTab === tab.key ? 1 : 0,
                }}
              />
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${
                activeTab === tab.key ? 'bg-primary/15 scale-110' : 'scale-100'
              }`}>
                {tab.icon}
              </div>
              <span className={`transition-all duration-200 ${activeTab === tab.key ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page shell — resolves session & match before rendering LiveContent ────────
export default function LivePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<GameSession | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchName, setMatchName] = useState('');
  const [predictionsEnabled, setPredictionsEnabled] = useState(false);
  const [matchStatus, setMatchStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { initSession(); }, []);

  const initSession = async () => {
    const raw = localStorage.getItem('game_session');
    if (!raw) { navigate('/play'); return; }
    try {
      const sess: GameSession = JSON.parse(raw);
      if (!sess.mobile || !sess.pin) { navigate('/play'); return; }
      setSession(sess);

      const { data: match } = await supabase
        .from('matches')
        .select('id, name, predictions_enabled, status')
        .eq('is_active_for_registration', true)
        .single();

      if (!match) {
        if (sess.match_id) {
          const { data: sessionMatch } = await supabase
            .from('matches').select('id, name, predictions_enabled, status')
            .eq('id', sess.match_id).single();
          if (sessionMatch) {
            setMatchId(sessionMatch.id);
            setMatchName(sessionMatch.name);
            setPredictionsEnabled(sessionMatch.predictions_enabled);
            setMatchStatus(sessionMatch.status);
          }
        }
      } else {
        setMatchId(match.id);
        setMatchName(match.name);
        setPredictionsEnabled(match.predictions_enabled);
        setMatchStatus(match.status);
        const updated = { ...sess, match_id: match.id };
        localStorage.setItem('game_session', JSON.stringify(updated));
        setSession(updated);
      }
    } catch { navigate('/play'); return; }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('game_session');
    navigate('/play');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <BackgroundOrbs />
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  // Match ended — render LiveContent defaulted to leaderboard tab
  if (matchId && session && matchStatus === 'ended') {
    return (
      <LiveContent
        matchId={matchId}
        matchName={matchName}
        predictionsEnabled={false}
        session={session}
        onLogout={handleLogout}
        initialTab="leaderboard"
        matchEnded
      />
    );
  }

  if (!matchId || !session) return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <BackgroundOrbs />
      <GlassCard className="p-8 text-center max-w-sm relative z-10 space-y-4">
        <div className="text-4xl">🏏</div>
        <h2 className="font-display text-xl font-bold text-foreground">No Active Match</h2>
        <p className="text-muted-foreground text-sm">No match is currently live. The match may have ended or not started yet.</p>
        <div className="flex flex-col gap-2">
          <GlassButton variant="primary" size="md" onClick={() => navigate('/play')}>Back to Login</GlassButton>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
            Go to Home
          </Link>
        </div>
      </GlassCard>
    </div>
  );

  return (
    <LiveContent
      matchId={matchId}
      matchName={matchName}
      predictionsEnabled={predictionsEnabled}
      session={session}
      onLogout={handleLogout}
    />
  );
}
