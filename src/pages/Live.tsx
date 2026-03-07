import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { Scoreboard } from '@/components/live/Scoreboard';
import { PredictionPanel } from '@/components/live/PredictionPanel';
import { Leaderboard } from '@/components/live/Leaderboard';
import { Loader2, Trophy, Gamepad2, BarChart3 } from 'lucide-react';

type Tab = 'score' | 'predict' | 'leaderboard';

interface GameSession {
  mobile: string;
  pin: string;
  match_id: string;
}

export default function LivePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<GameSession | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchName, setMatchName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('score');
  const [predictionsEnabled, setPredictionsEnabled] = useState(false);

  // Realtime subscription for match row changes (predictions_enabled toggled by admin)
  const matchChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const subscribeToMatch = useCallback((id: string) => {
    if (matchChannelRef.current) {
      supabase.removeChannel(matchChannelRef.current);
    }
    const ch = supabase
      .channel(`live-match-${id}`)
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` },
        (payload: any) => {
          if (payload.new) {
            setPredictionsEnabled(!!payload.new.predictions_enabled);
            if (payload.new.name) setMatchName(payload.new.name);
          }
        },
      )
      .subscribe();
    matchChannelRef.current = ch;
  }, []);

  useEffect(() => {
    initSession();
    return () => {
      if (matchChannelRef.current) supabase.removeChannel(matchChannelRef.current);
    };
  }, []);

  const initSession = async () => {
    const raw = localStorage.getItem('game_session');
    if (!raw) { navigate('/play'); return; }
    try {
      const sess: GameSession = JSON.parse(raw);
      if (!sess.mobile || !sess.pin) { navigate('/play'); return; }
      setSession(sess);

      const { data: match } = await supabase
        .from('matches')
        .select('id, name, predictions_enabled, disclaimer_enabled')
        .eq('is_active_for_registration', true)
        .single();

      if (!match) {
        if (sess.match_id) {
          const { data: sessionMatch } = await supabase
            .from('matches').select('id, name, predictions_enabled')
            .eq('id', sess.match_id).single();
          if (sessionMatch) {
            setMatchId(sessionMatch.id);
            setMatchName(sessionMatch.name);
            setPredictionsEnabled(sessionMatch.predictions_enabled);
            subscribeToMatch(sessionMatch.id);
          }
        }
      } else {
        setMatchId(match.id);
        setMatchName(match.name);
        setPredictionsEnabled(match.predictions_enabled);
        const updatedSession = { ...sess, match_id: match.id };
        localStorage.setItem('game_session', JSON.stringify(updatedSession));
        setSession(updatedSession);
        subscribeToMatch(match.id);
      }
    } catch { navigate('/play'); return; }
    setLoading(false);
  };

  // If activeTab is predict but predictions got disabled reactively, switch to score
  useEffect(() => {
    if (!predictionsEnabled && activeTab === 'predict') {
      setActiveTab('score');
    }
  }, [predictionsEnabled, activeTab]);

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

  if (!matchId) return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <BackgroundOrbs />
      <GlassCard className="p-8 text-center max-w-sm relative z-10">
        <div className="text-4xl mb-4">🏏</div>
        <h2 className="font-display text-xl font-bold text-foreground mb-2">No Active Match</h2>
        <p className="text-muted-foreground text-sm mb-4">No match is currently live.</p>
        <GlassButton variant="primary" size="md" onClick={() => navigate('/play')}>Back to Login</GlassButton>
      </GlassCard>
    </div>
  );

  const tabs: { key: Tab; label: string; icon: React.ReactNode; emoji: string }[] = [
    { key: 'score',       label: 'Live Score',  icon: <BarChart3 className="h-5 w-5" />,  emoji: '📊' },
    ...(predictionsEnabled ? [{ key: 'predict' as Tab, label: 'Guess', icon: <Gamepad2 className="h-5 w-5" />, emoji: '🎯' }] : []),
    { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="h-5 w-5" />, emoji: '🏆' },
  ];

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

      {/* Compact sticky header */}
      <div className="sticky top-0 z-20 bg-[hsl(var(--background)/0.85)] backdrop-blur-md border-b border-border/40 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="min-w-0">
            <h1 className="font-display text-base font-bold gradient-text leading-tight truncate">{matchName}</h1>
            <p className="text-xs text-muted-foreground">{session?.mobile}</p>
          </div>
          <GlassButton variant="ghost" size="sm" onClick={handleLogout} className="shrink-0 ml-2">
            Exit
          </GlassButton>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 relative z-10 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-4">
          {activeTab === 'score' && <Scoreboard matchId={matchId} />}
          {activeTab === 'predict' && session && (
            <PredictionPanel matchId={matchId} mobile={session.mobile} pin={session.pin} />
          )}
          {activeTab === 'leaderboard' && (
            <Leaderboard matchId={matchId} mobile={session?.mobile} />
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
              {/* iOS-style top border indicator */}
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
