import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminBottomNav } from './AdminBottomNav';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { MobileBreadcrumb, type BreadcrumbItem } from '@/components/ui/MobileBreadcrumb';
import { cn } from '@/lib/utils';

const ADMIN_ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  validate: 'Gate Validate',
  matches: 'Matches',
  teams: 'Teams & Players',
  orders: 'Bookings',
  'manual-booking': 'Manual Booking',
  control: 'Live Control',
  analytics: 'Analytics',
  health: 'Health',
  leaderboard: 'Leaderboard',
  activity: 'Activity Log',
  roles: 'Role Management',
  eligibility: 'Eligibility',
  'site-config': 'Site Content',
  payments: 'Payments',
  'trial-game': 'Trial Game',
  coupons: 'Victory Coupons',
  'coupon-scan': 'Coupon Scan',
};

function useAdminBreadcrumbs(): BreadcrumbItem[] {
  const { pathname } = useLocation();
  const segments = pathname.replace('/admin/', '').replace('/admin', '').split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: 'Admin', to: '/admin/dashboard' }];

  if (segments.length === 0 || segments[0] === 'dashboard') {
    items.push({ label: 'Dashboard' });
  } else {
    const first = segments[0];
    const label = ADMIN_ROUTE_LABELS[first] || first.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (segments.length > 1) {
      items.push({ label, to: `/admin/${first}` });
      items.push({ label: 'Detail' });
    } else {
      items.push({ label });
    }
  }
  return items;
}

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const breadcrumbs = useAdminBreadcrumbs();

  return (
    <div className="min-h-screen relative">
      <BackgroundOrbs variant="admin" />

      {/* Sidebar — desktop only */}
      <div className="hidden md:block">
        <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      </div>

      {/* Main content */}
      <main className={cn(
        'relative z-10 min-h-screen transition-all duration-300',
        collapsed ? 'md:ml-16' : 'md:ml-60',
        'pb-20 md:pb-0',
      )}>
        <MobileBreadcrumb items={breadcrumbs} />
        <Outlet />
      </main>

      {/* Bottom nav — mobile only */}
      <AdminBottomNav />
    </div>
  );
}
