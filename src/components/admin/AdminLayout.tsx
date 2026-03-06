import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminBottomNav } from './AdminBottomNav';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { cn } from '@/lib/utils';

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

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
        // Desktop: shift right for sidebar
        collapsed ? 'md:ml-16' : 'md:ml-60',
        // Mobile: full width + bottom padding for nav bar
        'pb-20 md:pb-0',
      )}>
        <Outlet />
      </main>

      {/* Bottom nav — mobile only */}
      <AdminBottomNav />
    </div>
  );
}
