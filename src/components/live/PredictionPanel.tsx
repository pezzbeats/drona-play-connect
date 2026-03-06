import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { useToast } from '@/hooks/use-toast';
import { Lock, Zap, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface PredictionWindow {
  id: string;
  match_id: string;
  question: string;
  options: Array<{ key: string; label: string }>;
  status: 'open' | 'locked' | 'resolved';
  correct_answer: any;
}

interface PredictionPanelProps {
  matchId: string;
  mobile: string;
  pin: string;
}

export function PredictionPanel({ matchId, mobile, pin }: PredictionPanelProps) {
  const [windows, setWindows] = useState<PredictionWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submittedWindows, setSubmittedWindows] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  // Track which window id triggered the last stagger so we only animate new windows
  const [animatingWindowId, setAnimatingWindowId] = useState<string | null>(null);
  const prevOpenWindowIdRef = useRef<string | null>(null);
  const { toast } = useToast();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    fetchWindows();
    subscribeRealtime();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [matchId]);

  const fetchWindows = async () => {
    const { data } = await supabase
      .from('prediction_windows')
      .select('*')
      .eq('match_id', matchId)
      .in('status', ['open', 'locked', 'resolved'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      setWindows(data as any);
      // Detect new open window → trigger stagger animation
      const newOpenId = (data as any[]).find(w => w.status === 'open')?.id ?? null;
      if (newOpenId && newOpenId !== prevOpenWindowIdRef.current) {
        setAnimatingWindowId(newOpenId);
        prevOpenWindowIdRef.current = newOpenId;
      }
    }

    if (data && data.length > 0) {
      const windowIds = data.map(w => w.id);
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
    setLoading(false);
  };

  const subscribeRealtime = () => {
    const channel = supabase
      .channel(`predictions-${matchId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'prediction_windows',
        filter: `match_id=eq.${matchId}`,
      }, () => {
        fetchWindows();
      })
      .subscribe();
    channelRef.current = channel;
  };

  const handleSubmit = async (windowId: string) => {
    const answer = selectedAnswers[windowId];
    if (!answer) return toast({ variant: 'destructive', title: 'Select an answer first' });

    setSubmitting(windowId);
    try {
      const { data, error } = await supabase.functions.invoke('submit-prediction', {
        body: { mobile, pin, window_id: windowId, prediction: { key: answer } },
      });

      if (error || data?.error) {
        toast({ variant: 'destructive', title: data?.error || 'Failed to submit' });
      } else {
        setSubmittedWindows(prev => ({ ...prev, [windowId]: answer }));
        toast({ title: '🎯 Guess locked in!' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Submission failed' });
    }
    setSubmitting(null);
  };

  const openWindows = windows.filter(w => w.status === 'open');
  const closedWindows = windows.filter(w => w.status !== 'open');

  /* ── Skeleton loading state ── */
  if (loading) {
    return (
      <div className="space-y-3">
        {/* Disclaimer always visible */}
        <div className="disclaimer-bar rounded-lg px-4 py-3 flex items-start gap-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Fun Guess Game for entertainment only.</strong> This is not betting, gambling, or wagering.
            No real money is staked. Participation is voluntary and purely for fun.
          </span>
        </div>
        {/* Active window skeleton */}
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
          <div className="h-11 skeleton rounded-xl" />
        </GlassCard>
        {/* Past windows skeleton */}
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
      {/* Persistent legal disclaimer — non-removable */}
      <div className="disclaimer-bar rounded-lg px-4 py-3 flex items-start gap-2 text-xs">
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Fun Guess Game for entertainment only.</strong> This is not betting, gambling, or wagering.
          No real money is staked. Participation is voluntary and purely for fun.
        </span>
      </div>

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
        const selected = selectedAnswers[window.id];

        return (
          <GlassCard key={window.id} className="p-4 border border-primary/30" glow>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold text-primary uppercase tracking-wide">🎯 Fun Guess Open!</span>
            </div>

            <p className="text-foreground font-semibold text-sm mb-3">
              {window.question || 'What will happen on the next ball?'}
            </p>

            <div className="grid grid-cols-2 gap-2.5 mb-3">
              {(window.options || []).map((opt: any, optIdx: number) => {
                const isSelected = (submitted || selected) === opt.key;
                const isSubmitted = submitted === opt.key;
                const shouldAnimate = animatingWindowId === window.id;
                return (
                  <button
                    key={opt.key}
                    disabled={!!submitted}
                    onClick={() => setSelectedAnswers(prev => ({ ...prev, [window.id]: opt.key }))}
                    className={`rounded-xl p-3.5 min-h-[52px] text-sm font-semibold transition-all border-2 active:scale-95 ${
                      shouldAnimate ? 'animate-slide-up' : ''
                    } ${
                      isSubmitted
                        ? 'border-primary bg-primary/20 text-primary'
                        : isSelected
                        ? 'border-primary/60 bg-primary/10 text-primary'
                        : 'border-border bg-card/50 text-foreground hover:border-primary/40'
                    }`}
                    style={shouldAnimate ? { animationDelay: `${optIdx * 60}ms`, animationFillMode: 'both' } as React.CSSProperties : undefined}
                  >
                    {isSubmitted && <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" />}
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {!submitted ? (
              <GlassButton
                variant="primary"
                size="md"
                className="w-full"
                loading={submitting === window.id}
                disabled={!selected}
                onClick={() => handleSubmit(window.id)}
              >
                <Zap className="h-4 w-4" /> Lock My Guess
              </GlassButton>
            ) : (
              <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Guess locked in!
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
