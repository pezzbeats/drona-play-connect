import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface MobileBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function MobileBreadcrumb({ items, className }: MobileBreadcrumbProps) {
  const navigate = useNavigate();

  // Back target: second-to-last crumb with a `to`, or '/'
  const backTarget = [...items].reverse().find((item, i) => i > 0 && item.to)?.to || '/';

  // On mobile, if more than 3 items, show first + ellipsis + last
  const displayItems = items.length > 3
    ? [items[0], { label: '…' }, items[items.length - 1]]
    : items;

  return (
    <nav
      className={cn(
        'sticky top-0 z-30 flex items-center gap-1.5 px-3 py-2.5',
        'bg-background/70 backdrop-blur-xl border-b border-border/40',
        className,
      )}
      aria-label="breadcrumb"
    >
      <button
        onClick={() => navigate(backTarget)}
        className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="Go back"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <ol className="flex items-center gap-1 min-w-0 overflow-hidden text-xs">
        {displayItems.map((item, i) => {
          const isLast = i === displayItems.length - 1;
          return (
            <li key={i} className="flex items-center gap-1 min-w-0">
              {i > 0 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              )}
              {isLast || !item.to ? (
                <span
                  className={cn(
                    'truncate max-w-[140px]',
                    isLast
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="truncate max-w-[100px] text-muted-foreground hover:text-primary transition-colors"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
