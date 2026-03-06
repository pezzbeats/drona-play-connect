import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonCardProps {
  lines?: number;
  showAvatar?: boolean;
  showHeader?: boolean;
  className?: string;
}

export const SkeletonCard = ({ lines = 3, showAvatar = false, showHeader = false, className }: SkeletonCardProps) => (
  <div className={cn('glass-card p-4 space-y-3 animate-pulse', className)}>
    {showHeader && (
      <div className="flex items-center gap-3 pb-1">
        <div className="h-5 w-24 skeleton rounded" />
        <div className="h-4 w-16 skeleton rounded ml-auto" />
      </div>
    )}
    {showAvatar && <div className="w-10 h-10 rounded-xl skeleton" />}
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className={cn('h-4 rounded skeleton', {
          'w-full': i < lines - 1,
          'w-2/3': i === lines - 1,
        })}
      />
    ))}
  </div>
);

export const SkeletonStatCard = () => (
  <div className="glass-card p-4 animate-pulse space-y-2.5">
    <div className="w-9 h-9 rounded-lg skeleton" />
    <div className="h-8 w-16 skeleton rounded" />
    <div className="h-3 w-20 skeleton rounded" />
  </div>
);
