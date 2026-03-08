import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth, AdminRole } from '@/contexts/AuthContext';
import {
  LayoutDashboard, ScanLine, ShoppingBag, Radio, MoreHorizontal,
  Trophy, Users, BookOpen, BarChart2, Activity, HeartPulse,
  ShieldCheck, LogOut, X, Zap, FileText, CreditCard, ListChecks,
  FlaskConical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type NavItem = {
  icon: React.ElementType;
  label: string;
  to: string;
  minRole?: NonNullable<AdminRole>;
};

const ROLE_LEVEL: Record<NonNullable<AdminRole>, number> = {
  gate_staff: 1,
  operator: 2,
  super_admin: 3,
};

const allNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',      to: '/admin/dashboard' },
  { icon: ScanLine,        label: 'Gate Validate',  to: '/admin/validate' },
  { icon: ShoppingBag,     label: 'Bookings',        to: '/admin/orders',        minRole: 'operator' },
  { icon: Radio,           label: 'Live Control',   to: '/admin/control',       minRole: 'operator' },
  { icon: Trophy,          label: 'Matches',        to: '/admin/matches',       minRole: 'operator' },
  { icon: Users,           label: 'Teams',          to: '/admin/teams',         minRole: 'operator' },
  { icon: BookOpen,        label: 'Manual Booking', to: '/admin/manual-booking',minRole: 'operator' },
  { icon: BarChart2,       label: 'Analytics',      to: '/admin/analytics',     minRole: 'operator' },
  { icon: HeartPulse,      label: 'Health',         to: '/admin/health',        minRole: 'operator' },
  { icon: Trophy,          label: 'Leaderboard',    to: '/admin/leaderboard',   minRole: 'super_admin' },
  { icon: Activity,        label: 'Activity Log',   to: '/admin/activity',      minRole: 'super_admin' },
  { icon: ShieldCheck,     label: 'Roles',          to: '/admin/roles',         minRole: 'super_admin' },
  { icon: ListChecks,      label: 'Eligibility',    to: '/admin/eligibility',   minRole: 'super_admin' },
  { icon: FileText,        label: 'Site Content',   to: '/admin/site-config',   minRole: 'operator' },
  { icon: CreditCard,      label: 'Payments',       to: '/admin/payments',      minRole: 'operator' },
  { icon: FlaskConical,    label: 'Trial Game',     to: '/admin/trial-game',    minRole: 'operator' },
];

// Primary 4 bottom nav slots (always visible if role permits)
const primaryRoutes = ['/admin/dashboard', '/admin/validate', '/admin/orders', '/admin/control'];

export function AdminBottomNav() {
  const { role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const visibleItems = allNavItems.filter(item => {
    if (!item.minRole) return true;
    if (!role) return false;
    return ROLE_LEVEL[role] >= ROLE_LEVEL[item.minRole];
  });

  const primaryItems = visibleItems.filter(i => primaryRoutes.includes(i.to));
  const overflowItems = visibleItems.filter(i => !primaryRoutes.includes(i.to));

  const handleSignOut = async () => {
    setMoreOpen(false);
    await signOut();
    navigate('/admin/login');
  };

  return (
    <>
      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch border-t border-sidebar-border bg-[hsl(var(--sidebar-background))] backdrop-blur-xl">
          {primaryItems.map(({ icon: Icon, label, to }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors min-h-[56px]',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    'w-8 h-8 flex items-center justify-center rounded-lg transition-all',
                    isActive && 'bg-primary/15'
                  )}>
                    <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                  </div>
                  <span className="leading-none">{label.split(' ')[0]}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium text-muted-foreground min-h-[56px]"
          >
            <div className="w-8 h-8 flex items-center justify-center rounded-lg">
              <MoreHorizontal className="h-5 w-5" />
            </div>
            <span className="leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* More drawer */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="bg-[hsl(var(--sidebar-background))] border-sidebar-border rounded-t-2xl pb-safe">
          <SheetHeader className="mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <SheetTitle className="text-sidebar-foreground font-display">T20 Ops</SheetTitle>
            </div>
          </SheetHeader>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {overflowItems.map(({ icon: Icon, label, to }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) => cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted/30 text-sidebar-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-center leading-tight">{label}</span>
              </NavLink>
            ))}
          </div>

          {/* User info + sign out */}
          <div className="border-t border-sidebar-border pt-3 space-y-1">
            {user && (
              <p className="text-xs text-muted-foreground px-1 truncate">{user.email}</p>
            )}
            {role && (
              <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary ml-1">
                {role.replace('_', ' ')}
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors font-medium"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
