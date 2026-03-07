import React, { useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { useToast } from '@/hooks/use-toast';
import { Lock, CheckCircle2, Clock, AlertTriangle, PauseCircle, Loader2 } from 'lucide-react';
import { useRealtimeChannel, type ChannelSubscription } from '@/hooks/useRealtimeChannel';

interface PredictionWindow {
  id: string;
  match_id: string;
  question: string;
  options: Array<{ key: string; label: string }>;
  status: 'open' | 'locked' | 'resolved';
  correct_answer: any;
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

export function PredictionPanel({ matchId, mobile, pin }: PredictionPanelProps) {
  const [windows, setWindows] = useState<PredictionWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchFlags, setMatchFlags] = useState<MatchFlags | null>(null);
  const [submittedWindows, setSubmittedWindows] = useState<Record<string, string>>({});
  // submittingKey tracks the exact button being submitted: { windowId, optKey }
  const [submittingKey, setSubmittingKey] = useState<{ windowId: string; optKey: string } | null>(null);
  const [animatingWindowId, setAnimatingWindowId] = useState<string | null>(null);
  const prevOpenWindowIdRef = useRef<string | null>(null);
  const { toast } = useToast();

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

    if (flagsRes.data) {
      setMatchFlags(flagsRes.data as MatchFlags);
    }

    if (windowsRes.data) {
      setWindows(windowsRes.data as any);

      // Detect new open window → trigger stagger animation
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
          for (const p of myPreds) {
            submitted[p.window_id] = (p.prediction as any)?.key || '';
          }
          setSubmittedWindows(submitted);
        }
      }
    }
    setLoading(false);
  }, [matchId, mobile]);

  const subscriptions = useMemo<ChannelSubscription[]>(() => [
    {
      event: '*',
      schema: 'public',
      table: 'prediction_windows',
      filter: `match_id=eq.${matchId}`,
      callback: () => { fetchWindows(); },
    },
    {
      event: '*',
      schema: 'public',
      table: 'match_flags',
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
  ], [matchId, fetchWindows]);

  useRealtimeChannel(
    `predictions-panel-${matchId}`,
    subscriptions,
    fetchWindows,
  );

  // One-tap submit: called immediately when user taps an option
  const handleOptionTap = async (windowId: string, optKey: string) => {
    if (submittedWindows[windowId]) return; // already submitted, ignore
    if (submittingKey?.windowId === windowId) return; // submission in flight
    if (matchFlags?.predictions_frozen) {
      toast({ variant: 'destructive', title: 'Guesses are paused by admin' });
      return;
    }

    setSubmittingKey({ windowId, optKey });
    try {
      const { data, error } = await supabase.functions.invoke('submit-prediction', {
        body: { mobile, pin, window_id: windowId, prediction: { key: optKey } },
      });

      if (error || data?.error) {
        const code = data?.code;
        if (code === 'ALREADY_SUBMITTED') {
          // Treat as success — sync local state
          setSubmittedWindows(prev => ({ ...prev, [windowId]: optKey }));
          toast({ title: '🎯 Guess already locked in!' });
        } else {
          toast({ variant: 'destructive', title: data?.error || 'Failed to submit' });
        }
      } else {
        setSubmittedWindows(prev => ({ ...prev, [windowId]: optKey }));
        toast({ title: '🎯 Guess locked in!' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Submission failed' });
    }
    setSubmittingKey(null);
  };

  const frozen = matchFlags?.predictions_frozen === true;
  const openWindows = windows.filter(w => w.status === 'open');
  const closedWindows = windows.filter(w => w.status !== 'open');

  /* ── Skeleton loading state ── */
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
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[52px] skeleton rounded-xl" />
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
            <div className="h-3 w-2/3 skeleton rounded mt-1.5" />
          </GlassCard>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Persistent legal disclaimer */}
      <div className="disclaimer-bar rounded-lg px-4 py-3 flex items-start gap-2 text-xs">
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Fun Guess Game for entertainment only.</strong> This is not betting, gambling, or wagering.
          No real money is staked. Participation is voluntary and purely for fun.
        </span>
      </div>

      {/* Admin freeze banner */}
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
          <p className="text-muted-foreground text-sm">Guesses open when an active window appears</p>
        </GlassCard>
      )}

      {/* Open Windows */}
      {openWindows.map(window => {
        const submitted = submittedWindows[window.id];
        const isThisWindowSubmitting = submittingKey?.windowId === window.id;

        return (
          <GlassCard key={window.id} className={`p-4 border ${frozen ? 'border-warning/30 opacity-75' : 'border-primary/30'}`} glow={!frozen}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${frozen ? 'bg-warning' : 'bg-primary animate-pulse'}`} />
              <span className={`text-xs font-bold uppercase tracking-wide ${frozen ? 'text-warning' : 'text-primary'}`}>
                {frozen ? '⏸ Guesses Paused' : submitted ? '✓ Guess Locked' : '🎯 Tap to Lock Your Guess!'}
              </span>
            </div>

            <p className="text-foreground font-semibold text-sm mb-3">
              {window.question || 'What will happen on the next ball?'}
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {(window.options || []).map((opt: any, optIdx: number) => {
                const isSubmitted = submitted === opt.key;
                const isThisSpinning = isThisWindowSubmitting && submittingKey?.optKey === opt.key;
                const isDisabled = !!submitted || frozen || isThisWindowSubmitting;
                const shouldAnimate = animatingWindowId === window.id;

                return (
                  <button
                    key={opt.key}
                    disabled={isDisabled}
                    onClick={() => handleOptionTap(window.id, opt.key)}
                    className={`rounded-xl p-3.5 min-h-[52px] text-sm font-semibold transition-all border-2 active:scale-95 ${
                      shouldAnimate ? 'animate-slide-up' : ''
                    } ${
                      frozen
                        ? 'border-border/30 bg-muted/20 text-muted-foreground cursor-not-allowed'
                        : isSubmitted
                        ? 'border-primary bg-primary/20 text-primary'
                        : isThisWindowSubmitting && !isThisSpinning
                        ? 'border-border/30 bg-card/30 text-muted-foreground cursor-not-allowed opacity-50'
                        : isThisSpinning
                        ? 'border-primary/60 bg-primary/10 text-primary cursor-wait'
                        : 'border-border bg-card/50 text-foreground hover:border-primary/40'
                    }`}
                    style={shouldAnimate ? { animationDelay: `${optIdx * 60}ms`, animationFillMode: 'both' } as React.CSSProperties : undefined}
                  >
                    {isThisSpinning ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : isSubmitted ? (
                      <><CheckCircle2 className="h-3.5 w-3.5 inline mr-1" />{opt.label}</>
                    ) : (
                      opt.label
                    )}
                  </button>
                );
              })}
            </div>

            {submitted && (
              <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium mt-3">
                <CheckCircle2 className="h-4 w-4" />
                Guess locked in — cannot be changed
              </div>
            )}
          </GlassCard>
        );
      })}

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
            {submitted && (
              <p className="text-xs text-muted-foreground mt-1">
                Your guess: {(window.options as any[])?.find(o => o.key === submitted)?.label || submitted}
                {isResolved && correctKey && (
                  <> · Correct: {(window.options as any[])?.find(o => o.key === correctKey)?.label || correctKey}</>
                )}
              </p>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}
