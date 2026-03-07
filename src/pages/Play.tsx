import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Gamepad2, Lock } from 'lucide-react';

export default function PlayPage() {
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!/^\d{10}$/.test(mobile)) {
      return toast({ variant: 'destructive', title: 'Invalid mobile number' });
    }
    if (pin.length !== 4) {
      return toast({ variant: 'destructive', title: 'PIN must be 4 digits' });
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-game-pin', {
        body: { mobile, pin }
      });
      if (error || !data?.valid) {
        toast({ variant: 'destructive', title: 'Invalid credentials', description: 'Check your mobile and PIN' });
      } else {
        localStorage.setItem('game_session', JSON.stringify({ mobile, pin, match_id: data.match_id || null }));
        toast({ title: '🎮 Welcome to the game!' });
        navigate('/live');
      }
    } catch {
      toast({ variant: 'destructive', title: 'Login failed' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <BackgroundOrbs />

      <div className="disclaimer-bar w-full text-center text-xs py-2 px-4 z-10 rounded-lg mb-6">
        🎯 Fun guess game for entertainment only. No betting, no wagering.
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Back link */}
        <div className="mb-6 text-center">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Home
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow-primary">
            <Gamepad2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text">Fan Game Login</h1>
          <p className="text-muted-foreground text-sm mt-2">Enter your mobile and gameplay PIN</p>
          <p className="text-xs text-muted-foreground mt-1">PIN is given at the gate after check-in</p>
        </div>

        <GlassCard className="p-5" glow>
          <div className="space-y-5">
            <div>
              <Label className="text-foreground mb-2 block text-sm font-medium">Mobile Number</Label>
              <Input
                className="glass-input h-14 text-lg"
                placeholder="10-digit mobile"
                type="tel"
                inputMode="numeric"
                value={mobile}
                onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              />
            </div>
            <div>
              <Label className="text-foreground mb-2 block text-sm font-medium flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> 4-Digit PIN
              </Label>
              <Input
                className="glass-input h-14 tracking-[0.8em] text-center text-2xl"
                placeholder="●●●●"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
            <GlassButton
              variant="primary" size="lg"
              className="w-full h-14 text-base font-semibold mt-1"
              loading={loading}
              onClick={handleLogin}
            >
              Enter the Game
            </GlassButton>
          </div>
        </GlassCard>

        <p className="text-center text-xs text-muted-foreground mt-6 px-4">
          Don't have a PIN? Check in at the gate with your QR ticket.
        </p>
      </div>
    </div>
  );
}
