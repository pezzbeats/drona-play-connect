import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  ...props
}, ref) => {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-display font-semibold tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'btn-gradient text-primary-foreground shadow-glow-primary hover:shadow-[0_0_30px_hsl(210_100%_56%/0.6)]',
    accent: 'bg-gradient-accent text-primary-foreground hover:shadow-[0_0_20px_hsl(265_80%_65%/0.5)]',
    success: 'bg-gradient-success text-success-foreground shadow-glow-success',
    warning: 'bg-gradient-warning text-warning-foreground shadow-glow-warning',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    ghost: 'bg-transparent text-foreground hover:bg-muted/50 border border-border',
    outline: 'bg-transparent border border-primary/40 text-primary hover:bg-primary/10 hover:border-primary/60',
  };

  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-5 text-base',
    lg: 'h-12 px-7 text-lg',
  };

  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

GlassButton.displayName = 'GlassButton';
