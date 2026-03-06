import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Shield, Eye, EyeOff } from 'lucide-react';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = (location.state as any)?.from?.pathname || '/admin/dashboard';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast({ variant: 'destructive', title: 'Enter email and password' });
    setLoading(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Login failed', description: e.message });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <BackgroundOrbs variant="admin" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-accent flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text-accent">Admin Portal</h1>
          <p className="text-muted-foreground text-sm mt-2">T20 Fan Night Ops Suite</p>
          <p className="text-xs text-muted-foreground">Hotel Drona Palace</p>
        </div>

        <GlassCard className="p-6" glow>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">Email</Label>
              <Input
                className="glass-input"
                type="email"
                placeholder="admin@t20fannight.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Password</Label>
              <div className="relative">
                <Input
                  className="glass-input pr-10"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(s => !s)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <GlassButton variant="accent" size="lg" className="w-full mt-2" loading={loading} type="submit">
              Sign In
            </GlassButton>
          </form>

          <div className="mt-5 p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground text-center">Default Super Admin Credentials</p>
            <p className="text-xs text-center text-foreground mt-1">admin@t20fannight.com</p>
            <p className="text-xs text-center text-muted-foreground">See Cloud → Database for setup instructions</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
