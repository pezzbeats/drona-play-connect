import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AdminRole } from '@/contexts/AuthContext';
import { Loader2, ShieldOff } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

// Role hierarchy: super_admin > operator > gate_staff
const ROLE_LEVEL: Record<NonNullable<AdminRole>, number> = {
  gate_staff: 1,
  operator: 2,
  super_admin: 3,
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: NonNullable<AdminRole>;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (requiredRole && role !== null) {
    const userLevel = ROLE_LEVEL[role] ?? 0;
    const requiredLevel = ROLE_LEVEL[requiredRole] ?? 0;
    if (userLevel < requiredLevel) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <GlassCard className="p-8 text-center max-w-sm">
            <ShieldOff className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h2 className="font-display text-xl font-bold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground text-sm">
              Your role (<strong>{role}</strong>) doesn't have permission to access this page.
            </p>
          </GlassCard>
        </div>
      );
    }
  }

  return <>{children}</>;
}
