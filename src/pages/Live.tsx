import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    initSession();
  }, []);

  const initSession = async () => {
    // Read session from localStorage
    const raw = localStorage.getItem('game_session');
    if (!raw) {
      navigate('/play');
      return;
    }

    try {
      const sess: GameSession = JSON.parse(raw);
      if (!sess.mobile || !sess.pin) {
        navigate('/play');
        return;
      }
      setSession(sess);

      // Get active match
      const { data: match } = await supabase
        .from('matches')
        .select('id, name, predictions_enabled, disclaimer_enabled')
        .eq('is_active_for_registration', true)
        .single();

      if (!match) {
        // Try to get match from session
        if (sess.match_id) {
          const { data: sessionMatch } = await supabase
            .from('matches')
            .select('id, name, predictions_enabled')
            .eq('id', sess.match_id)
            .single();
          if (sessionMatch) {
            setMatchId(sessionMatch.id);
            setMatchName(sessionMatch.name);
            setPredictionsEnabled(sessionMatch.predictions_enabled);
          }
        }
      } else {
        setMatchId(match.id);
        setMatchName(match.name);
        setPredictionsEnabled(match.predictions_enabled);
        // Update session with match_id
        const updatedSession = { ...sess, match_id: match.id };
        localStorage.setItem('game_session', JSON.stringify(updatedSession));
        setSession(updatedSession);
      }
    } catch {
      navigate('/play');
      return;
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('game_session');
    navigate('/play');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BackgroundOrbs />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!matchId) {
    return (
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
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'score', label: 'Live Score', icon: <BarChart3 className="h-4 w-4" /> },
    ...(predictionsEnabled ? [{ key: 'predict' as Tab, label: 'Predict', icon: <Gamepad2 className="h-4 w-4" /> }] : []),
    { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen relative">
      <BackgroundOrbs />

      {/* Disclaimer bar */}
      <div className="disclaimer-bar text-center text-xs py-2 px-4 relative z-10">
        🎯 <strong>Fun Guess Game only.</strong> No betting, no wagering, no gambling. Entertainment purposes only.
      </div>

      {/* Header */}
      <div className="relative z-10 max-w-lg mx-auto px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-display text-xl font-bold gradient-text">{matchName}</h1>
            <p className="text-xs text-muted-foreground">{session?.mobile}</p>
          </div>
          <GlassButton variant="ghost" size="sm" onClick={handleLogout}>
            Exit
          </GlassButton>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-card/50 rounded-lg p-1 mb-4">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'score' && (
          <Scoreboard matchId={matchId} />
        )}

        {activeTab === 'predict' && session && (
          <PredictionPanel matchId={matchId} mobile={session.mobile} pin={session.pin} />
        )}

        {activeTab === 'leaderboard' && (
          <Leaderboard matchId={matchId} mobile={session?.mobile} />
        )}

        {/* Bottom disclaimer */}
        <div className="mt-6 disclaimer-bar rounded-lg p-3 text-xs">
          🎯 <strong>Disclaimer:</strong> This is a fun entertainment game only. No real money, no gambling, no wagering. All predictions are purely for fun.
        </div>
      </div>
    </div>
  );
}
