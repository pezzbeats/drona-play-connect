import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { useToast } from '@/hooks/use-toast';
import { Lock, Zap, CheckCircle2, Clock } from 'lucide-react';

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
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submittedWindows, setSubmittedWindows] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
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

    if (data) setWindows(data as any);

    // Check for existing submissions
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
        toast({ title: '🎯 Prediction locked in!' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Submission failed' });
    }
    setSubmitting(null);
  };

  const openWindows = windows.filter(w => w.status === 'open');
  const closedWindows = windows.filter(w => w.status !== 'open');

  if (windows.length === 0) {
    return (
      <GlassCard className="p-5 text-center">
        <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-foreground font-bold">No Active Prediction</p>
        <p className="text-muted-foreground text-sm">Predictions open when a window is active</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      {/* Open Windows */}
      {openWindows.map(window => {
        const submitted = submittedWindows[window.id];
        const selected = selectedAnswers[window.id];

        return (
          <GlassCard key={window.id} className="p-4 border border-primary/30" glow>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold text-primary uppercase tracking-wide">Prediction Open!</span>
            </div>

            <p className="text-foreground font-semibold text-sm mb-3">
              {window.question || 'What will happen on the next ball?'}
            </p>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {(window.options || []).map((opt: any) => {
                const isSelected = (submitted || selected) === opt.key;
                const isSubmitted = submitted === opt.key;
                return (
                  <button
                    key={opt.key}
                    disabled={!!submitted}
                    onClick={() => setSelectedAnswers(prev => ({ ...prev, [window.id]: opt.key }))}
                    className={`rounded-lg p-2.5 text-sm font-medium transition-all border ${
                      isSubmitted
                        ? 'border-primary bg-primary/20 text-primary'
                        : isSelected
                        ? 'border-primary/60 bg-primary/10 text-primary'
                        : 'border-border bg-card/50 text-foreground hover:border-primary/40'
                    }`}
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
                size="sm"
                className="w-full"
                loading={submitting === window.id}
                disabled={!selected}
                onClick={() => handleSubmit(window.id)}
              >
                <Zap className="h-4 w-4" /> Lock Prediction
              </GlassButton>
            ) : (
              <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Prediction locked in!
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
                Your answer: {(window.options as any[])?.find(o => o.key === submitted)?.label || submitted}
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
