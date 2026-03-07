import React from 'react';

interface BackgroundOrbsProps {
  variant?: 'default' | 'admin';
}

export const BackgroundOrbs = React.forwardRef<HTMLDivElement, BackgroundOrbsProps>(
  ({ variant = 'default' }, ref) => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {/* Crimson orb — scoreboard red glow, top-right */}
    <div
      className="bg-orb w-[28rem] h-[28rem]"
      style={{
        background: variant === 'admin'
          ? 'radial-gradient(circle, hsl(38 75% 52%) 0%, transparent 70%)'
          : 'radial-gradient(circle, hsl(355 85% 58%) 0%, transparent 70%)',
        opacity: 0.30,
        top: '-8%',
        right: '-6%',
        animationDelay: '0s',
      }}
    />
    {/* Deep green orb — outfield glow, bottom-left */}
    <div
      className="bg-orb w-80 h-80"
      style={{
        background: 'radial-gradient(circle, hsl(142 65% 30%) 0%, transparent 70%)',
        opacity: 0.22,
        bottom: '8%',
        left: '-6%',
        animationDelay: '3s',
      }}
    />
    {/* Gold/bronze orb — frame accent, mid-center */}
    <div
      className="bg-orb w-72 h-72"
      style={{
        background: 'radial-gradient(circle, hsl(38 80% 50%) 0%, transparent 70%)',
        opacity: 0.14,
        top: '45%',
        left: '38%',
        animationDelay: '6s',
      }}
    />
    {/* Subtle second crimson — lower-right depth */}
    <div
      className="bg-orb w-64 h-64"
      style={{
        background: 'radial-gradient(circle, hsl(355 70% 45%) 0%, transparent 70%)',
        opacity: 0.12,
        bottom: '15%',
        right: '5%',
        animationDelay: '9s',
      }}
    />
    {/* Fifth orb — very subtle deep-green outfield wash, top-left */}
    <div
      className="bg-orb w-[22rem] h-[22rem]"
      style={{
        background: 'radial-gradient(circle, hsl(140 55% 18%) 0%, transparent 70%)',
        opacity: 0.10,
        top: '20%',
        left: '-10%',
        animationDelay: '4.5s',
        animationDuration: '11s',
      }}
    />
  </div>
);
