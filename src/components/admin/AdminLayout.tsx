import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { cn } from '@/lib/utils';

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen relative">
      <BackgroundOrbs variant="admin" />
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main className={cn(
        'relative z-10 min-h-screen transition-all duration-300',
        collapsed ? 'ml-16' : 'ml-60'
      )}>
        <Outlet />
      </main>
    </div>
  );
}
