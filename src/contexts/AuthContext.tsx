import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export type AdminRole = 'super_admin' | 'operator' | 'gate_staff' | null;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: AdminRole;
  isRole: (...roles: NonNullable<AdminRole>[]) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchRole(userId: string): Promise<AdminRole> {
  const { data } = await supabase.rpc('get_admin_role', { _user_id: userId });
  return (data as AdminRole) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AdminRole>(null);

  const loadRole = async (u: User | null) => {
    if (!u) { setRole(null); return; }
    const r = await fetchRole(u.id);
    setRole(r);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      loadRole(u).finally(() => setLoading(false));
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      loadRole(u).finally(() => setLoading(false));
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isRole = (...roles: NonNullable<AdminRole>[]): boolean => {
    return role !== null && roles.includes(role);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, role, isRole, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
