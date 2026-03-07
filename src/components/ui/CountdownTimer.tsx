import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calcTimeLeft(targetISO: string): TimeLeft {
  const diff = new Date(targetISO).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  return {
    total: diff,
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

interface CountdownTimerProps {
  targetTime: string;
  /** 'full' (4 blocks) on landing, 'compact' (inline chips) on register */
  variant?: 'full' | 'compact';
  className?: string;
}

export function CountdownTimer({ targetTime, variant = 'full', className = '' }: CountdownTimerProps) {
  const [t, setT] = useState<TimeLeft>(() => calcTimeLeft(targetTime));

  useEffect(() => {
    const id = setInterval(() => setT(calcTimeLeft(targetTime)), 1000);
    return () => clearInterval(id);
  }, [targetTime]);

  if (t.total <= 0) {
    return (
      <div className={`flex items-center justify-center gap-1.5 text-success text-xs font-semibold ${className}`}>
        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
        Match is LIVE now
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center justify-center gap-2 flex-wrap ${className}`}>
        <Clock className="h-3 w-3 text-secondary flex-shrink-0" />
        <span className="text-xs text-muted-foreground">Starts in</span>
        {t.days > 0 && (
          <span className="text-xs font-bold text-secondary bg-secondary/10 border border-secondary/25 rounded-md px-2 py-0.5">
            {t.days}d
          </span>
        )}
        <span className="text-xs font-bold text-secondary bg-secondary/10 border border-secondary/25 rounded-md px-2 py-0.5">
          {String(t.hours).padStart(2, '0')}h
        </span>
        <span className="text-xs font-bold text-secondary bg-secondary/10 border border-secondary/25 rounded-md px-2 py-0.5">
          {String(t.minutes).padStart(2, '0')}m
        </span>
        <span className="text-xs font-mono text-muted-foreground tabular-nums">
          {String(t.seconds).padStart(2, '0')}s
        </span>
      </div>
    );
  }

  // full variant
  const units = [
    { label: 'Days', value: t.days },
    { label: 'Hours', value: t.hours },
    { label: 'Mins', value: t.minutes },
    { label: 'Secs', value: t.seconds },
  ];

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-center gap-1.5 mb-3">
        <Clock className="h-3.5 w-3.5 text-secondary" />
        <p className="section-title text-secondary">Match Starts In</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {units.map(({ label, value }) => (
          <div
            key={label}
            className="glass-card-sunken flex flex-col items-center justify-center py-3 rounded-xl relative overflow-hidden"
            style={{ borderColor: 'hsl(38 60% 55% / 0.3)' }}
          >
            {/* Subtle shimmer on seconds */}
            {label === 'Secs' && (
              <div className="absolute inset-0 shimmer pointer-events-none opacity-60" />
            )}
            <span
              className="font-display font-bold leading-none tabular-nums text-foreground relative z-10"
              style={{ fontSize: 'clamp(1.5rem, 6vw, 2rem)' }}
            >
              {String(value).padStart(2, '0')}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 relative z-10">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
