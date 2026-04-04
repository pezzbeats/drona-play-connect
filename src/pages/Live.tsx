import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLiveMatchSync } from '@/hooks/useLiveMatchSync';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { Scoreboard } from '@/components/live/Scoreboard';
import { PredictionPanel } from '@/components/live/PredictionPanel';
import { Leaderboard } from '@/components/live/Leaderboard';
import { useRealtimeChannel, type ChannelSubscription } from '@/hooks/useRealtimeChannel';
import { Loader2, Trophy, Gamepad2, BarChart3, WifiOff, LogOut, Zap, X, Medal, Crown } from 'lucide-react';
import { OverallLeaderboard } from '@/components/live/OverallLeaderboard';
import { MobileBreadcrumb } from '@/components/ui/MobileBreadcrumb';

type Tab = 'score' | 'predict' | 'leaderboard' | 'season';

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
  matchEnded: initialMatchEnded = false,
  onMatchEnded,
}: {
  matchId: string;
  matchName: string;
  predictionsEnabled: boolean;
  session: GameSession;
  onLogout: () => void;
  initialTab?: Tab;
  matchEnded?: boolean;
  onMatchEnded?: () => void;
}) {
  const [matchName, setMatchName] = useState(initialMatchName);
  const [predictionsEnabled, setPredictionsEnabled] = useState(initialPredictionsEnabled);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [guessNudge, setGuessNudge] = useState(false);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Personal rank chip state
  const [myRank, setMyRank] = useState<{ rank_position: number | null; total_points: number } | null>(null);

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

  // Fetch initial personal rank
  useEffect(() => {
    supabase
      .from('leaderboard')
      .select('rank_position, total_points')
      .eq('match_id', matchId)
      .eq('mobile', session.mobile)
      .maybeSingle()
      .then(({ data }) => { if (data) setMyRank(data); });
  }, [matchId, session.mobile]);

  // ── Realtime: watch matches row + prediction windows + personal leaderboard ──
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
          // Reactive match-end detection — notify shell to re-render
          if (payload.new.status === 'ended') {
            onMatchEnded?.();
          }
        }
      },
    },
    {
      event: 'INSERT',
      schema: 'public',
      table: 'prediction_windows',
      filter: `match_id=eq.${matchId}`,
      callback: (payload) => {
        if (payload.new?.status === 'open') {
          setActiveTab(prev => {
            if (prev !== 'predict') setGuessNudge(true);
            return prev;
          });
        }
      },
    },
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'prediction_windows',
      filter: `match_id=eq.${matchId}`,
      callback: (payload) => {
        if (payload.new?.status === 'open' && payload.old?.status !== 'open') {
          setActiveTab(prev => {
            if (prev !== 'predict') setGuessNudge(true);
            return prev;
          });
        }
      },
    },
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'leaderboard',
      filter: `match_id=eq.${matchId}`,
      callback: (payload) => {
        if (payload.new?.mobile === session.mobile) {
          setMyRank({ rank_position: payload.new.rank_position, total_points: payload.new.total_points });
        }
      },
    },
  ], [matchId, session.mobile, onMatchEnded]);

  const refetchMatch = useCallback(async () => {
    const { data } = await supabase
      .from('matches')
      .select('name, predictions_enabled, status')
      .eq('id', matchId)
      .single();
    if (data) {
      setMatchName(data.name);
      setPredictionsEnabled(data.predictions_enabled);
      if (data.status === 'ended') onMatchEnded?.();
    }
  }, [matchId, onMatchEnded]);

  const { connected, reconnecting } = useRealtimeChannel(
    `live-match-${matchId}`,
    matchSubscriptions,
    refetchMatch,
  );

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'score',       label: 'Live Score',  icon: <BarChart3 className="h-5 w-5" /> },
    ...(predictionsEnabled ? [{ key: 'predict' as Tab, label: 'Guess', icon: <Gamepad2 className="h-5 w-5" /> }] : []),
    { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="h-5 w-5" /> },
    { key: 'season', label: 'Season', icon: <Crown className="h-5 w-5" /> },
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
      {initialMatchEnded && (
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
        <div className="flex items-center justify-between max-w-lg mx-auto gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base font-bold gradient-text leading-tight truncate">{matchName}</h1>
            <p className="text-xs text-muted-foreground">{session.mobile}</p>
          </div>
          {/* Personal rank chip — visible once the player has guessed */}
          {myRank && myRank.rank_position != null && (
            <button
              onClick={() => setActiveTab('leaderboard')}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-xs font-bold text-primary hover:bg-primary/25 transition-colors"
              title="View leaderboard"
            >
              <Medal className="h-3 w-3" />
              #{myRank.rank_position} · {myRank.total_points}pts
            </button>
          )}
          <GlassButton variant="ghost" size="sm" onClick={() => setShowExitConfirm(true)} className="shrink-0 gap-1.5">
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
          {activeTab === 'season' && (
            <OverallLeaderboard mobile={session.mobile} />
          )}

          {/* Bottom disclaimer */}
          <div className="mt-6 disclaimer-bar rounded-lg p-3 text-xs">
            🎯 <strong>Disclaimer:</strong> Fun entertainment game only. No real money, no gambling. All guesses are for fun.
          </div>
        </div>
      </div>

      {/* ── Guess nudge banner — slides up above tab bar ── */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-400 ease-out ${
          guessNudge && predictionsEnabled ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
        style={{ paddingBottom: 'calc(68px + env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-lg mx-auto px-3 pb-2">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-success/95 backdrop-blur-md border border-success/60 shadow-[0_4px_24px_hsl(142_70%_35%/0.45)] text-left active:scale-[0.98] transition-transform"
            onClick={() => {
              setActiveTab('predict');
              setGuessNudge(false);
              clearTimeout(nudgeTimerRef.current);
            }}
          >
            <Zap className="h-5 w-5 text-white shrink-0 animate-pulse" />
            <span className="flex-1 text-sm font-bold text-white leading-tight">
              New guess available! Tap to guess →
            </span>
            <button
              className="shrink-0 text-white/70 hover:text-white transition-colors p-0.5"
              onClick={e => {
                e.stopPropagation();
                setGuessNudge(false);
                clearTimeout(nudgeTimerRef.current);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </button>
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

// ── Match picker for multi-match access ──────────────────────────────────────
interface AccessibleMatch {
  id: string;
  name: string;
  status: string;
  start_time: string | null;
  opponent: string | null;
  predictions_enabled: boolean;
}

function MatchPicker({
  matches,
  session,
  onSelect,
  onLogout,
}: {
  matches: AccessibleMatch[];
  session: GameSession;
  onSelect: (m: AccessibleMatch) => void;
  onLogout: () => void;
}) {
  const liveMatches = matches.filter(m => m.status === 'live');
  const upcomingMatches = matches.filter(m => ['registrations_open', 'registrations_closed', 'draft'].includes(m.status));
  const endedMatches = matches.filter(m => m.status === 'ended');

  const renderSection = (title: string, icon: string, items: AccessibleMatch[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{icon} {title}</p>
        {items.map(m => (
          <button
            key={m.id}
            onClick={() => onSelect(m)}
            className="w-full text-left"
          >
            <GlassCard className={`p-4 hover:border-primary/40 cursor-pointer active:scale-[0.98] transition-all ${m.status === 'live' ? 'border-success/40 glass-card-glow' : ''}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-foreground text-sm truncate">{m.name}</p>
                  {m.opponent && <p className="text-xs text-muted-foreground">vs {m.opponent}</p>}
                  {m.start_time && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(m.start_time).toLocaleString('en-IN', {
                        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {m.status === 'live' ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-success bg-success/15 border border-success/30 rounded-full px-2.5 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Live
                    </span>
                  ) : m.status === 'ended' ? (
                    <span className="text-xs font-bold text-muted-foreground bg-muted/30 border border-border/50 rounded-full px-2.5 py-1">
                      Ended
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-primary bg-primary/15 border border-primary/30 rounded-full px-2.5 py-1">
                      Upcoming
                    </span>
                  )}
                </div>
              </div>
            </GlassCard>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen relative">
      <MobileBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Live' }]} />
      <BackgroundOrbs />
      <div className="relative z-10 max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-xl font-bold gradient-text">Your Matches</h1>
            <p className="text-xs text-muted-foreground">{session.mobile}</p>
          </div>
          <GlassButton variant="ghost" size="sm" onClick={onLogout} className="gap-1.5">
            <LogOut className="h-3.5 w-3.5" /> Exit
          </GlassButton>
        </div>

        <div className="space-y-5">
          {renderSection('Live Now', '🔴', liveMatches)}
          {renderSection('Upcoming', '📅', upcomingMatches)}
          {renderSection('Ended', '🏆', endedMatches)}
        </div>

        {matches.length === 0 && (
          <GlassCard className="p-8 text-center space-y-3">
            <div className="text-4xl">🏏</div>
            <p className="font-display font-bold text-foreground">No Matches Available</p>
            <p className="text-sm text-muted-foreground">Check back when a new match is scheduled.</p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

// ── Page shell — resolves session & matches before rendering ──────────────────
export default function LivePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<GameSession | null>(null);
  const [allMatches, setAllMatches] = useState<AccessibleMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<AccessibleMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchStatus, setMatchStatus] = useState<string>('');

  useEffect(() => { initSession(); }, []);

  const initSession = async () => {
    const raw = localStorage.getItem('game_session');
    if (!raw) { navigate('/play'); return; }
    try {
      const sess: GameSession = JSON.parse(raw);
      if (!sess.mobile || !sess.pin) { navigate('/play'); return; }
      setSession(sess);

      // Fetch all matches the user has access to
      const { data: accessRecords } = await supabase
        .from('game_access')
        .select('match_id')
        .eq('mobile', sess.mobile)
        .eq('is_active', true);

      const accessMatchIds = [...new Set((accessRecords || []).map(a => a.match_id))];

      // Fetch all active/live/ended matches
      const { data: activeMatches } = await supabase
        .from('matches')
        .select('id, name, status, start_time, opponent, predictions_enabled')
        .in('status', ['live', 'registrations_open', 'ended'])
        .order('start_time', { ascending: false });

      // Combine: user's accessed matches + all live/open matches
      const matchMap = new Map<string, AccessibleMatch>();
      for (const m of (activeMatches || [])) {
        matchMap.set(m.id, m);
      }
      // Also fetch matches the user has access to that may have other statuses
      if (accessMatchIds.length > 0) {
        const { data: userMatches } = await supabase
          .from('matches')
          .select('id, name, status, start_time, opponent, predictions_enabled')
          .in('id', accessMatchIds);
        for (const m of (userMatches || [])) {
          matchMap.set(m.id, m);
        }
      }

      const allM = Array.from(matchMap.values());
      // Sort: live first, then upcoming, then ended
      const statusOrder: Record<string, number> = { live: 0, registrations_open: 1, registrations_closed: 2, draft: 3, ended: 4 };
      allM.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));
      setAllMatches(allM);

      // Auto-select if only 1 match or if there's a live match
      const liveMatch = allM.find(m => m.status === 'live');
      if (allM.length === 1) {
        setSelectedMatch(allM[0]);
        setMatchStatus(allM[0].status);
      } else if (liveMatch) {
        setSelectedMatch(liveMatch);
        setMatchStatus(liveMatch.status);
      }
      // If match_id in session and it's in list, prefer it
      if (sess.match_id) {
        const sessionM = allM.find(m => m.id === sess.match_id);
        if (sessionM && sessionM.status === 'live') {
          setSelectedMatch(sessionM);
          setMatchStatus(sessionM.status);
        }
      }
    } catch { navigate('/play'); return; }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('game_session');
    navigate('/play');
  };

  const handleMatchEnded = useCallback(() => {
    setMatchStatus('ended');
  }, []);

  const handleSelectMatch = (m: AccessibleMatch) => {
    setSelectedMatch(m);
    setMatchStatus(m.status);
    if (session) {
      const updated = { ...session, match_id: m.id };
      localStorage.setItem('game_session', JSON.stringify(updated));
      setSession(updated);
    }
  };

  const handleBackToList = () => {
    setSelectedMatch(null);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <BackgroundOrbs />
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <BackgroundOrbs />
      <GlassCard className="p-8 text-center max-w-sm relative z-10 space-y-4">
        <div className="text-4xl">🏏</div>
        <h2 className="font-display text-xl font-bold text-foreground">Session Expired</h2>
        <GlassButton variant="primary" size="md" onClick={() => navigate('/play')}>Back to Login</GlassButton>
      </GlassCard>
    </div>
  );

  // If no match selected yet and multiple matches, show picker
  if (!selectedMatch && allMatches.length > 1) {
    return (
      <MatchPicker
        matches={allMatches}
        session={session}
        onSelect={handleSelectMatch}
        onLogout={handleLogout}
      />
    );
  }

  // No matches at all
  if (!selectedMatch && allMatches.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <BackgroundOrbs />
        <GlassCard className="p-8 text-center max-w-sm relative z-10 space-y-4">
          <div className="text-4xl">🏏</div>
          <h2 className="font-display text-xl font-bold text-foreground">No Active Match</h2>
          <p className="text-muted-foreground text-sm">No match is currently available.</p>
          <div className="flex flex-col gap-2">
            <GlassButton variant="primary" size="md" onClick={() => navigate('/play')}>Back to Login</GlassButton>
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
              Go to Home
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  const match = selectedMatch!;
  const showBackButton = allMatches.length > 1;

  if (matchStatus === 'ended') {
    return (
      <>
        {showBackButton && (
          <div className="fixed top-0 left-0 z-50 p-2">
            <GlassButton variant="ghost" size="sm" onClick={handleBackToList} className="gap-1 text-xs">
              ← All Matches
            </GlassButton>
          </div>
        )}
        <LiveContent
          matchId={match.id}
          matchName={match.name}
          predictionsEnabled={false}
          session={session}
          onLogout={handleLogout}
          initialTab="leaderboard"
          matchEnded
          onMatchEnded={handleMatchEnded}
        />
      </>
    );
  }

  return (
    <>
      {showBackButton && (
        <div className="fixed top-0 left-0 z-50 p-2">
          <GlassButton variant="ghost" size="sm" onClick={handleBackToList} className="gap-1 text-xs">
            ← All Matches
          </GlassButton>
        </div>
      )}
      <LiveContent
        matchId={match.id}
        matchName={match.name}
        predictionsEnabled={match.predictions_enabled}
        session={session}
        onLogout={handleLogout}
        onMatchEnded={handleMatchEnded}
      />
    </>
  );
}
