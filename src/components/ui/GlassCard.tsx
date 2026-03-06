import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  children: React.ReactNode;
}

export const GlassCard = ({ className, glow = false, children, ...props }: GlassCardProps) => (
  <div
    className={cn(
      'glass-card',
      glow && 'glass-card-glow',
      className
    )}
    {...props}
  >
    {children}
  </div>
);
