import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Trophy, Users, ScanLine, ShoppingBag,
  BookOpen, LogOut, ChevronLeft, ChevronRight, Zap, Radio
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/admin/dashboard' },
  { icon: Trophy, label: 'Matches', to: '/admin/matches' },
  { icon: Users, label: 'Teams & Players', to: '/admin/teams' },
  { icon: ShoppingBag, label: 'Orders', to: '/admin/orders' },
  { icon: ScanLine, label: 'Gate Validate', to: '/admin/validate' },
  { icon: BookOpen, label: 'Manual Booking', to: '/admin/manual-booking' },
  { icon: Radio, label: 'Live Control', to: '/admin/control' },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen z-40 flex flex-col transition-all duration-300',
        'border-r border-sidebar-border',
        'bg-[hsl(var(--sidebar-background))] backdrop-blur-xl',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-3 p-4 border-b border-sidebar-border', collapsed && 'justify-center')}>
        <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-display font-bold text-sidebar-foreground text-sm leading-tight">T20 Ops</p>
            <p className="text-xs text-muted-foreground">Hotel Drona Palace</p>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
              collapsed ? 'justify-center' : '',
              isActive
                ? 'bg-primary/15 text-sidebar-primary font-medium shadow-glow-primary'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <Icon className={cn('flex-shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User + Sign Out */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2">
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors',
            collapsed ? 'justify-center' : ''
          )}
        >
          <LogOut className={cn('flex-shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent transition-colors',
            collapsed ? 'justify-center' : 'justify-end'
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
