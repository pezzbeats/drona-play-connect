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
        toast({ title: '🎮 Welcome to the game!' });
        navigate('/live');
      }
    } catch {
      toast({ variant: 'destructive', title: 'Login failed' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <BackgroundOrbs />

      <div className="disclaimer-bar fixed top-0 left-0 right-0 text-center text-xs py-2 px-4 z-10">
        ⚽ This is a fun guess game for entertainment only. No betting, no wagering, no gambling.
      </div>

      <div className="relative z-10 w-full max-w-sm mt-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow-primary">
            <Gamepad2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text">Fan Game Login</h1>
          <p className="text-muted-foreground text-sm mt-2">Enter your mobile and gameplay PIN</p>
          <p className="text-xs text-muted-foreground mt-1">PIN is given at the gate after check-in</p>
        </div>

        <GlassCard className="p-6" glow>
          <div className="space-y-4">
            <div>
              <Label className="text-foreground mb-1.5 block">Mobile Number</Label>
              <Input
                className="glass-input"
                placeholder="10-digit mobile"
                type="tel"
                value={mobile}
                onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> 4-Digit PIN
              </Label>
              <Input
                className="glass-input tracking-[0.5em] text-center text-xl"
                placeholder="●●●●"
                type="password"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
            <GlassButton variant="primary" size="lg" className="w-full mt-2" loading={loading} onClick={handleLogin}>
              Enter the Game
            </GlassButton>
          </div>
        </GlassCard>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Don't have a PIN? Check in at the gate with your QR ticket.
        </p>
      </div>
    </div>
  );
}
