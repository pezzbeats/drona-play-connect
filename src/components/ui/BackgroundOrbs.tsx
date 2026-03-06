import React from 'react';

interface BackgroundOrbsProps {
  variant?: 'default' | 'admin';
}

export const BackgroundOrbs = ({ variant = 'default' }: BackgroundOrbsProps) => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    <div
      className="bg-orb w-96 h-96 opacity-25"
      style={{
        background: variant === 'admin'
          ? 'radial-gradient(circle, hsl(38 75% 52%) 0%, transparent 70%)'
          : 'radial-gradient(circle, hsl(355 80% 55%) 0%, transparent 70%)',
        top: '-10%',
        right: '-5%',
        animationDelay: '0s',
      }}
    />
    <div
      className="bg-orb w-80 h-80 opacity-15"
      style={{
        background: 'radial-gradient(circle, hsl(142 70% 35%) 0%, transparent 70%)',
        bottom: '10%',
        left: '-5%',
        animationDelay: '3s',
      }}
    />
    <div
      className="bg-orb w-64 h-64 opacity-10"
      style={{
        background: 'radial-gradient(circle, hsl(38 75% 52%) 0%, transparent 70%)',
        top: '50%',
        left: '40%',
        animationDelay: '6s',
      }}
    />
  </div>
);
