import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { useToast } from '@/hooks/use-toast';
import { Lock, CheckCircle2, Clock, AlertTriangle, PauseCircle, Loader2, Target } from 'lucide-react';
import { useRealtimeChannel, type ChannelSubscription } from '@/hooks/useRealtimeChannel';

// ── Standardised ball outcome set (mirrors AdminControl.BALL_OUTCOMES) ────────
const BALL_OUTCOMES = [
  { key: 'dot_ball',   label: 'Dot',      emoji: '•'  },
  { key: 'runs_1',     label: '1',        emoji: '1'  },
  { key: 'runs_2',     label: '2',        emoji: '2'  },
  { key: 'runs_3',     label: '3',        emoji: '3'  },
  { key: 'boundary_4', label: '4',        emoji: '4'  },
  { key: 'six_6',      label: '6',        emoji: '6'  },
  { key: 'wide',       label: 'Wide',     emoji: 'WD' },
  { key: 'no_ball',    label: 'No Ball',  emoji: 'NB' },
  { key: 'byes',       label: 'Byes',     emoji: 'B'  },
  { key: 'leg_byes',   label: 'Leg Byes', emoji: 'LB' },
  { key: 'wicket',     label: 'Wicket',   emoji: 'W'  },
] as const;

type BallKey = typeof BALL_OUTCOMES[number]['key'];

// Per-key color classes (selected / resolved states)
const KEY_COLORS: Record<string, { selected: string; correct: string; wrong: string; emoji: string }> = {
  dot_ball:   { selected: 'border-muted-foreground/70 bg-muted/30 text-foreground',           correct: 'border-success bg-success/20 text-success',                         wrong: 'border-destructive/50 bg-destructive/10 text-destructive/80',  emoji: 'text-muted-foreground' },
  runs_1:     { selected: 'border-foreground/60 bg-card/60 text-foreground',                  correct: 'border-success bg-success/20 text-success',                         wrong: 'border-destructive/50 bg-destructive/10 text-destructive/80',  emoji: 'text-foreground' },
  runs_2:     { selected: 'border-foreground/60 bg-card/60 text-foreground',                  correct: 'border-success bg-success/20 text-success',                         wrong: 'border-destructive/50 bg-destructive/10 text-destructive/80',  emoji: 'text-foreground' },
  runs_3:     { selected: 'border-foreground/60 bg-card/60 text-foreground',                  correct: 'border-success bg-success/20 text-success',                         wrong: 'border-destructive/50 bg-destructive/10 text-destructive/80',  emoji: 'text-foreground' },
  boundary_4: { selected: 'border-warning/80 bg-warning/15 text-warning',                     correct: 'border-success bg-success/20 text-success',                         wrong: 'border-destructive/50 bg-destructive/10 text-destructive/80',  emoji: 'text-warning' },
  six_6:      { selected: 'border-primary/80 bg-primary/20 text-primary shadow-glow-primary', correct: 'border-success bg-success/20 text-success',                         wrong: 'border-destructive/50 bg-destructive/10 text-destructive/80',  emoji: 'text-primary' },
  wide:       { selected: 'border-warning/70 bg-warning/10 text-warning',                     correct: 'border-success bg-success/20 text-success',                         wrong: 'border-destructive/50 bg-destructive/10 text-destructive/80',  emoji: 'text-warning' },
  no_ball:    { selected: 'border-warning/70 bg-warning/10 text-warning',                     correct: 'border-success bg-success/20 text-success',                         wrong: 'border-destructive/50 bg-destructive/10 text-destructive/80',  emoji: 'text-warning' },
  byes:       { selected: 'border-muted-foreground/60 bg-muted/20 text-muted-foreground',     correct: 'border-success bg-success/20 text-success',                         wrong: 'border-destructive/50 bg-destructive/10 text-destructive/80',  emoji: 'text-muted-foreground' },
  leg_byes:   { selected: 'border-muted-foreground/60 bg-muted/20 text-muted-foreground',     correct: 'border-success bg-success/20 text-success',                         wrong: 'border-destructive/50 bg-destructive/10 text-destructive/80',  emoji: 'text-muted-foreground' },
  wicket:     { selected: 'border-destructive/80 bg-destructive/20 text-destructive',          correct: 'border-success bg-success/20 text-success',                         wrong: 'border-destructive/50 bg-destructive/10 text-destructive/80',  emoji: 'text-destructive' },
};

// Fallback for legacy windows that may have non-standard keys
const fallbackColor = { selected: 'border-primary/70 bg-primary/20 text-primary', correct: 'border-success bg-success/20 text-success', wrong: 'border-destructive/50 bg-destructive/10 text-destructive/80', emoji: 'text-primary' };

interface PredictionWindow {
  id: string;
  match_id: string;
  question: string;
  options: Array<{ key: string; label: string }>;
  status: 'open' | 'locked' | 'resolved';
  correct_answer: any;
  locks_at: string | null;
}

interface MatchFlags {
  predictions_frozen: boolean;
  freeze_reason: string | null;
}

interface PredictionPanelProps {
  matchId: string;
  mobile: string;
  pin: string;
}

// ── Countdown hook for locks_at ──────────────────────────────────────
function useCountdown(locksAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    if (!locksAt) return null;
    const diff = Math.ceil((new Date(locksAt).getTime() - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  });

  useEffect(() => {
    if (!locksAt) { setSecondsLeft(null); return; }
    const update = () => {
      const diff = Math.ceil((new Date(locksAt).getTime() - Date.now()) / 1000);
      setSecondsLeft(diff > 0 ? diff : 0);
    };
    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [locksAt]);

  return secondsLeft;
}

// ── Open Window Card with countdown ─────────────────────────────────
function OpenWindowCard({
  window: w,
  frozen,
  submitted,
  submittingKey,
  shouldAnimate,
  onOptionTap,
  onExpired,
}: {
  window: PredictionWindow;
  frozen: boolean;
  submitted: string | undefined;
  submittingKey: { windowId: string; optKey: string } | null;
  shouldAnimate: boolean;
  onOptionTap: (windowId: string, optKey: string) => void;
  onExpired: () => void;
}) {
  const secondsLeft = useCountdown(w.locks_at);
  const expired = secondsLeft !== null && secondsLeft <= 0;
  const expiredRef = useRef(false);

  useEffect(() => {
    if (expired && !expiredRef.current) {
      expiredRef.current = true;
      onExpired();
    }
  }, [expired, onExpired]);

  const isThisWindowSubmitting = submittingKey?.windowId === w.id;
  const isDisabled = !!submitted || frozen || isThisWindowSubmitting || expired;

  return (
    <GlassCard className={`p-4 border ${frozen ? 'border-warning/30 opacity-75' : 'border-primary/30'}`} glow={!frozen && !expired}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${frozen ? 'bg-warning' : expired ? 'bg-muted-foreground' : 'bg-primary animate-pulse'}`} />
        <span className={`text-xs font-bold uppercase tracking-wide ${frozen ? 'text-warning' : expired ? 'text-muted-foreground' : 'text-primary'}`}>
          {frozen ? '⏸ Guesses Paused' : expired ? '⏱ Time Up' : submitted ? '✓ Guess Locked' : '🎯 Tap to Lock Your Guess!'}
        </span>
        {secondsLeft !== null && !expired && (
          <span className={`ml-auto text-xs font-black tabular-nums px-2 py-0.5 rounded-full border ${
            secondsLeft <= 3
              ? 'text-destructive bg-destructive/15 border-destructive/40 animate-pulse'
              : secondsLeft <= 6
                ? 'text-warning bg-warning/15 border-warning/40'
                : 'text-primary bg-primary/15 border-primary/40'
          }`}>
            ⏱ {secondsLeft}s
          </span>
        )}
      </div>

      <p className="text-foreground font-semibold text-sm mb-4">
        {w.question || 'What will happen on the next ball?'}
      </p>

      {/* Option cards — 4-column grid */}
      <div className="grid grid-cols-4 gap-2">
        {(w.options || []).map((opt: any, optIdx: number) => {
          const isSubmitted = submitted === opt.key;
          const isThisSpinning = isThisWindowSubmitting && submittingKey?.optKey === opt.key;
          const colors = KEY_COLORS[opt.key] || fallbackColor;
          const outcomeData = BALL_OUTCOMES.find(o => o.key === opt.key);
          const emoji = outcomeData?.emoji ?? opt.label.slice(0, 2);

          let cardCls = '';
          if (expired && !isSubmitted) {
            cardCls = 'border-border/20 bg-muted/10 text-muted-foreground/40 cursor-not-allowed opacity-50';
          } else if (frozen && !isSubmitted) {
            cardCls = 'border-border/20 bg-muted/10 text-muted-foreground/40 cursor-not-allowed';
          } else if (isThisSpinning) {
            cardCls = 'border-primary/60 bg-primary/10 text-primary cursor-wait';
          } else if (isSubmitted) {
            cardCls = `${colors.selected} ring-2 ring-primary/40`;
          } else if (isDisabled) {
            cardCls = 'border-border/20 bg-muted/10 text-muted-foreground/40 cursor-not-allowed opacity-50';
          } else {
            cardCls = 'border-border/40 bg-card/50 text-foreground hover:border-primary/50 hover:bg-primary/8 hover:scale-105 active:scale-95';
          }

          return (
            <button
              key={opt.key}
              disabled={isDisabled && !isSubmitted}
              onClick={() => onOptionTap(w.id, opt.key)}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 h-[72px] transition-all touch-manipulation select-none ${cardCls} ${
                shouldAnimate ? 'animate-slide-up' : ''
              }`}
              style={shouldAnimate ? { animationDelay: `${optIdx * 50}ms`, animationFillMode: 'both' } as React.CSSProperties : undefined}
            >
              {isThisSpinning ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span className={`text-xl font-black leading-none ${isSubmitted ? '' : (KEY_COLORS[opt.key] || fallbackColor).emoji}`}>
                    {isSubmitted ? <CheckCircle2 className="h-5 w-5" /> : emoji}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide leading-none opacity-80">
                    {opt.label}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {submitted && (
        <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium mt-3 pt-3 border-t border-primary/20">
          <CheckCircle2 className="h-4 w-4" />
          Guess locked in — cannot be changed
        </div>
      )}
    </GlassCard>
  );
}

export function PredictionPanel({ matchId, mobile, pin }: PredictionPanelProps) {
  const [windows, setWindows] = useState<PredictionWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchFlags, setMatchFlags] = useState<MatchFlags | null>(null);
  const [submittedWindows, setSubmittedWindows] = useState<Record<string, string>>({});
  const [submittingKey, setSubmittingKey] = useState<{ windowId: string; optKey: string } | null>(null);
  const [animatingWindowId, setAnimatingWindowId] = useState<string | null>(null);
  const prevOpenWindowIdRef = useRef<string | null>(null);
  const { toast } = useToast();

  // Running score from leaderboard
  const [myScore, setMyScore] = useState<{ total_points: number; correct_predictions: number; total_predictions: number } | null>(null);
  const [displayPoints, setDisplayPoints] = useState(0);
  const [scoreDelta, setScoreDelta] = useState<number | null>(null);
  const [scoreFlash, setScoreFlash] = useState(false);
  const prevPointsRef = useRef<number>(0);

  const fetchMyScore = useCallback(async () => {
    const { data } = await supabase
      .from('leaderboard')
      .select('total_points, correct_predictions, total_predictions')
      .eq('match_id', matchId)
      .eq('mobile', mobile)
      .maybeSingle();
    if (data) setMyScore(data);
  }, [matchId, mobile]);

  useEffect(() => { fetchMyScore(); }, [fetchMyScore]);



  // Animate score increment when points increase
  useEffect(() => {
    if (!myScore) return;
    const prev = prevPointsRef.current;
    const next = myScore.total_points;
    if (next > prev && prev !== 0) {
      const delta = next - prev;
      setScoreDelta(delta);
      setScoreFlash(true);
      const steps = Math.min(delta, 10);
      const intervalMs = 600 / steps;
      let current = prev;
      const timer = setInterval(() => {
        current += Math.ceil(delta / steps);
        if (current >= next) { current = next; clearInterval(timer); }
        setDisplayPoints(current);
      }, intervalMs);
      const flashTimer = setTimeout(() => { setScoreFlash(false); setScoreDelta(null); }, 1500);
      prevPointsRef.current = next;
      return () => { clearInterval(timer); clearTimeout(flashTimer); };
    } else {
      setDisplayPoints(next);
      prevPointsRef.current = next;
    }
  }, [myScore?.total_points]);

  const fetchWindows = useCallback(async () => {
    const [windowsRes, flagsRes] = await Promise.all([
      supabase
        .from('prediction_windows')
        .select('*')
        .eq('match_id', matchId)
        .in('status', ['open', 'locked', 'resolved'])
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('match_flags')
        .select('predictions_frozen, freeze_reason')
        .eq('match_id', matchId)
        .maybeSingle(),
    ]);

    if (flagsRes.data) setMatchFlags(flagsRes.data as MatchFlags);

    if (windowsRes.data) {
      setWindows(windowsRes.data as any);

      const newOpenId = (windowsRes.data as any[]).find(w => w.status === 'open')?.id ?? null;
      if (newOpenId && newOpenId !== prevOpenWindowIdRef.current) {
        setAnimatingWindowId(newOpenId);
        prevOpenWindowIdRef.current = newOpenId;
      }

      if (windowsRes.data.length > 0) {
        const windowIds = windowsRes.data.map(w => w.id);
        const { data: myPreds } = await supabase
          .from('predictions')
          .select('window_id, prediction')
          .eq('mobile', mobile)
          .in('window_id', windowIds);

        if (myPreds) {
          const submitted: Record<string, string> = {};
          for (const p of myPreds) submitted[p.window_id] = (p.prediction as any)?.key || '';
          setSubmittedWindows(submitted);
        }
      }
    }
    setLoading(false);
  }, [matchId, mobile]);

  const subscriptions = useMemo<ChannelSubscription[]>(() => [
    {
      event: '*', schema: 'public', table: 'prediction_windows',
      filter: `match_id=eq.${matchId}`,
      callback: (payload) => {
        if (payload.new) {
          setWindows(prev => {
            const updated = prev.map(w => w.id === (payload.new as any).id ? { ...w, ...(payload.new as any) } : w);
            const exists = prev.some(w => w.id === (payload.new as any).id);
            if (!exists && (payload.new as any).status === 'open') return [payload.new as any, ...updated];
            return updated;
          });
        }
        fetchWindows();
      },
    },
    {
      event: '*', schema: 'public', table: 'match_flags',
      filter: `match_id=eq.${matchId}`,
      callback: (payload) => {
        if (payload.new) {
          setMatchFlags({
            predictions_frozen: (payload.new as any).predictions_frozen,
            freeze_reason: (payload.new as any).freeze_reason,
          });
        }
      },
    },
    // Merged: leaderboard personal score updates (was separate score-panel channel)
    {
      event: 'UPDATE', schema: 'public', table: 'leaderboard',
      filter: `match_id=eq.${matchId}`,
      callback: (payload) => {
        if (payload.new && (payload.new as any).mobile === mobile) {
          const { total_points, correct_predictions, total_predictions } = payload.new as any;
          setMyScore({ total_points, correct_predictions, total_predictions });
        }
      },
    },
    {
      event: 'INSERT', schema: 'public', table: 'leaderboard',
      filter: `match_id=eq.${matchId}`,
      callback: (payload) => {
        if (payload.new && (payload.new as any).mobile === mobile) {
          const { total_points, correct_predictions, total_predictions } = payload.new as any;
          setMyScore({ total_points, correct_predictions, total_predictions });
        }
      },
    },
  ], [matchId, mobile, fetchWindows]);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchWindows(), fetchMyScore()]);
  }, [fetchWindows, fetchMyScore]);

  const { connected, reconnecting } = useRealtimeChannel(`predictions-panel-${matchId}`, subscriptions, fetchAll);

  // ── Fallback polling: self-heal when realtime is degraded or no open windows ──
  useEffect(() => {
    // Poll every 5s when disconnected/reconnecting, or every 8s when connected but no open window
    const hasOpenWindow = windows.some(w => w.status === 'open');
    const needsPoll = !connected || reconnecting || (!hasOpenWindow && windows.length >= 0);
    if (!needsPoll) return;

    const interval = (!connected || reconnecting) ? 5000 : 8000;
    const timer = setInterval(() => {
      fetchWindows();
      fetchMyScore();
    }, interval);

    return () => clearInterval(timer);
  }, [connected, reconnecting, windows, fetchWindows, fetchMyScore]);

  const handleOptionTap = async (windowId: string, optKey: string) => {
    if (submittedWindows[windowId]) return;
    if (submittingKey?.windowId === windowId) return;
    if (matchFlags?.predictions_frozen) {
      toast({ variant: 'destructive', title: 'Guesses are paused by admin' });
      return;
    }

    // Optimistic update — immediately show as submitted
    setSubmittedWindows(prev => ({ ...prev, [windowId]: optKey }));
    setSubmittingKey({ windowId, optKey });

    try {
      const { data, error } = await supabase.functions.invoke('submit-prediction', {
        body: { mobile, pin, window_id: windowId, prediction: { key: optKey } },
      });

      if (error || data?.error) {
        const code = data?.code;
        if (code === 'ALREADY_SUBMITTED') {
          // Keep the optimistic state — it's correct
          toast({ title: '🎯 Guess already locked in!' });
        } else {
          // Revert optimistic update on real errors
          setSubmittedWindows(prev => {
            const next = { ...prev };
            delete next[windowId];
            return next;
          });
          toast({ variant: 'destructive', title: data?.error || 'Failed to submit' });
        }
      } else {
        toast({ title: '🎯 Guess locked in!' });
      }
    } catch {
      // Revert optimistic update on network failure
      setSubmittedWindows(prev => {
        const next = { ...prev };
        delete next[windowId];
        return next;
      });
      toast({ variant: 'destructive', title: 'Submission failed — try again' });
    }
    setSubmittingKey(null);
  };

  const frozen = matchFlags?.predictions_frozen === true;
  const openWindows = windows.filter(w => w.status === 'open');
  const closedWindows = windows.filter(w => w.status !== 'open');

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="disclaimer-bar rounded-lg px-4 py-3 flex items-start gap-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Fun Guess Game for entertainment only.</strong> This is not betting, gambling, or wagering.
            No real money is staked. Participation is voluntary and purely for fun.
          </span>
        </div>
        <GlassCard className="p-4 border border-primary/20 animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full skeleton" />
            <div className="h-3 w-28 skeleton rounded" />
          </div>
          <div className="h-4 w-3/4 skeleton rounded mb-4" />
          <div className="grid grid-cols-4 gap-2 mb-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[68px] skeleton rounded-2xl" />
            ))}
          </div>
        </GlassCard>
        {Array.from({ length: 2 }).map((_, i) => (
          <GlassCard key={i} className="p-3 opacity-60 animate-pulse">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-3 w-16 skeleton rounded" />
              <div className="h-3 w-10 skeleton rounded ml-auto" />
            </div>
            <div className="h-3 w-full skeleton rounded" />
          </GlassCard>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Running score banner */}
      {myScore !== null && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-500 ${
          scoreFlash
            ? 'bg-success/20 border-success/50 shadow-[0_0_16px_hsl(var(--success)/0.35)]'
            : 'bg-primary/10 border-primary/25'
        }`}>
          <Target className={`h-4 w-4 flex-shrink-0 transition-colors duration-300 ${scoreFlash ? 'text-success' : 'text-primary'}`} />
          <span className={`text-sm font-bold transition-colors duration-300 ${scoreFlash ? 'text-success' : 'text-primary'}`}>
            Your Score: {displayPoints} pts
          </span>
          {scoreDelta !== null && (
            <span className="text-xs font-black text-success bg-success/15 border border-success/40 rounded-full px-2 py-0.5 animate-fade-in">
              +{scoreDelta}
            </span>
          )}
          <span className="text-muted-foreground font-medium text-xs ml-auto">
            · {myScore.correct_predictions}/{myScore.total_predictions} correct
          </span>
        </div>
      )}

      {/* Persistent legal disclaimer */}
      <div className="disclaimer-bar rounded-lg px-4 py-3 flex items-start gap-2 text-xs">
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Fun Guess Game for entertainment only.</strong> This is not betting, gambling, or wagering.
          No real money is staked. Participation is voluntary and purely for fun.
        </span>
      </div>

      {/* Freeze banner */}
      {frozen && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-warning/40 bg-warning/10 text-warning text-sm font-medium">
          <PauseCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            ⚠️ Guesses are temporarily paused by the admin.
            {matchFlags?.freeze_reason ? ` Reason: ${matchFlags.freeze_reason}` : ''}
          </span>
        </div>
      )}

      {windows.length === 0 && (
        <GlassCard className="p-5 text-center">
          <Clock className="h-8 w-8 text-primary/30 mx-auto mb-2" />
          <p className="text-foreground font-bold">No Active Fun Guess</p>
          <p className="text-muted-foreground text-sm">Admin will open the next guess window shortly — stay tuned!</p>
        </GlassCard>
      )}

      {/* Open Windows */}
      {openWindows.map(window => (
        <OpenWindowCard
          key={window.id}
          window={window}
          frozen={frozen}
          submitted={submittedWindows[window.id]}
          submittingKey={submittingKey}
          shouldAnimate={animatingWindowId === window.id}
          onOptionTap={handleOptionTap}
          onExpired={() => {
            setWindows(prev => prev.map(w => w.id === window.id ? { ...w, status: 'locked' as const } : w));
          }}
        />
      ))}
      {/* Closed/Resolved Windows */}
      {closedWindows.slice(0, 3).map(window => {
        const submitted = submittedWindows[window.id];
        const correctKey = (window.correct_answer as any)?.key;
        const isResolved = window.status === 'resolved';
        const isCorrect = isResolved && submitted && correctKey && submitted === correctKey;

        return (
          <GlassCard key={window.id} className="p-3 opacity-70">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                {window.status === 'resolved' ? 'Resolved' : 'Locked'}
              </span>
              {isResolved && submitted && (
                <span className={`ml-auto text-xs font-bold ${isCorrect ? 'text-success' : 'text-destructive'}`}>
                  {isCorrect ? '+10 pts ✓' : '0 pts ✗'}
                </span>
              )}
            </div>
            <p className="text-xs text-foreground">{window.question}</p>

            {/* Compact resolved option chips */}
            {isResolved && (window.options || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(window.options as any[]).map((opt: any) => {
                  const isMyPick = submitted === opt.key;
                  const isCorrectOpt = opt.key === correctKey;
                  let chipCls = 'border-border/30 text-muted-foreground/50';
                  if (isCorrectOpt) chipCls = 'border-success/60 bg-success/15 text-success font-bold';
                  else if (isMyPick) chipCls = 'border-destructive/50 bg-destructive/10 text-destructive/80';
                  return (
                    <span key={opt.key} className={`text-[10px] px-2 py-0.5 rounded-full border ${chipCls}`}>
                      {opt.label}
                      {isMyPick && !isCorrectOpt && ' ✗'}
                      {isCorrectOpt && ' ✓'}
                    </span>
                  );
                })}
              </div>
            )}

            {submitted && !isResolved && (
              <p className="text-xs text-muted-foreground mt-1">
                Your guess: {(window.options as any[])?.find((o: any) => o.key === submitted)?.label || submitted}
              </p>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}
