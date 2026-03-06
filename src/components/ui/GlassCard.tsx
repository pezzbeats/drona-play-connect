import React from 'react';
import { cn } from '@/lib/utils';

type GlassCardVariant = 'default' | 'elevated' | 'sunken';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  gold?: boolean;
  variant?: GlassCardVariant;
  animate?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<GlassCardVariant, string> = {
  default: 'glass-card',
  elevated: 'glass-card-elevated',
  sunken: 'glass-card-sunken',
};

export const GlassCard = ({
  className,
  glow = false,
  gold = false,
  variant = 'default',
  animate = false,
  children,
  ...props
}: GlassCardProps) => (
  <div
    className={cn(
      variantClasses[variant],
      glow && 'glass-card-glow',
      gold && 'glass-card-gold',
      animate && 'animate-slide-up',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);
