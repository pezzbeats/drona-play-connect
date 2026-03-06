import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, ToggleLeft, ToggleRight, Loader2, Edit, Zap, Trophy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

interface Match {
  id: string;
  name: string;
  opponent: string | null;
  match_type: string;
  status: string;
  is_active_for_registration: boolean;
  start_time: string | null;
  venue: string;
  created_at: string;
}

export default function AdminMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [settingActive, setSettingActive] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const [form, setForm] = useState({
    name: '', opponent: '', match_type: 'group', venue: 'Hotel Drona Palace',
    start_time: '', status: 'draft'
  });

  useEffect(() => { fetchMatches(); }, []);

  const fetchMatches = async () => {
    setLoading(true);
    const { data } = await supabase.from('matches').select('*').order('created_at', { ascending: false });
    setMatches(data || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return toast({ variant: 'destructive', title: 'Match name required' });
    setCreating(true);
    try {
      const { error } = await supabase.from('matches').insert({
        event_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: form.name,
        opponent: form.opponent || null,
        match_type: form.match_type as any,
        venue: form.venue,
        start_time: form.start_time || null,
        status: form.status as any,
      });
      if (error) throw error;
      toast({ title: '✅ Match created' });
      setCreateOpen(false);
      setForm({ name: '', opponent: '', match_type: 'group', venue: 'Hotel Drona Palace', start_time: '', status: 'draft' });
      fetchMatches();
      // Audit log
      if (user) {
        await supabase.from('admin_activity').insert({ admin_id: user.id, action: 'create_match', entity_type: 'match', meta: { name: form.name } });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
    }
    setCreating(false);
  };

  const handleSetActive = async (matchId: string, currentlyActive: boolean) => {
    setSettingActive(matchId);
    try {
      const { data, error } = await supabase.functions.invoke('set-match-active', {
        body: { match_id: currentlyActive ? null : matchId }
      });
      if (error) throw error;
      toast({ title: currentlyActive ? 'Registration deactivated' : '✅ Match is now active for registration' });
      fetchMatches();
      if (user) {
        await supabase.from('admin_activity').insert({ admin_id: user.id, action: 'set_match_active', entity_type: 'match', entity_id: matchId });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
    }
    setSettingActive(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold gradient-text-accent">Matches</h1>
          <p className="text-muted-foreground text-sm">Manage T20 Fan Night matches</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <GlassButton variant="primary" size="md">
              <Plus className="h-4 w-4" /> New Match
            </GlassButton>
          </DialogTrigger>
          <DialogContent className="glass-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-xl gradient-text">Create Match</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-foreground mb-1.5 block">Match Name *</Label>
                <Input className="glass-input" placeholder="e.g., MI vs CSK Fan Night" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-foreground mb-1.5 block">Opponent Team</Label>
                <Input className="glass-input" placeholder="Opposing team name" value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-foreground mb-1.5 block">Type</Label>
                  <Select value={form.match_type} onValueChange={v => setForm(f => ({ ...f, match_type: v }))}>
                    <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="group">Group</SelectItem>
                      <SelectItem value="semi_final">Semi Final</SelectItem>
                      <SelectItem value="final">Final</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-foreground mb-1.5 block">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="registrations_open">Open</SelectItem>
                      <SelectItem value="registrations_closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-foreground mb-1.5 block">Venue</Label>
                <Input className="glass-input" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} />
              </div>
              <div>
                <Label className="text-foreground mb-1.5 block">Start Time</Label>
                <Input className="glass-input" type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <GlassButton variant="primary" size="md" className="w-full" loading={creating} onClick={handleCreate}>
                Create Match
              </GlassButton>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : matches.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">No matches yet</p>
          <p className="text-muted-foreground text-sm">Create your first match to get started</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {matches.map(match => (
            <GlassCard key={match.id} className={`p-4 ${match.is_active_for_registration ? 'border-primary/40 shadow-glow-primary' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-lg font-bold text-foreground">{match.name}</h3>
                    {match.is_active_for_registration && (
                      <span className="flex items-center gap-1 text-xs text-primary">
                        <Zap className="h-3 w-3" /> Active
                      </span>
                    )}
                  </div>
                  {match.opponent && <p className="text-sm text-muted-foreground">vs {match.opponent}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <StatusBadge status={match.status as any} />
                    <span className="text-xs text-muted-foreground capitalize">{match.match_type.replace('_', ' ')}</span>
                    {match.start_time && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(match.start_time).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link to={`/admin/matches/${match.id}`}>
                    <GlassButton variant="ghost" size="sm"><Edit className="h-3.5 w-3.5" /></GlassButton>
                  </Link>
                  <GlassButton
                    variant={match.is_active_for_registration ? 'success' : 'outline'}
                    size="sm"
                    loading={settingActive === match.id}
                    onClick={() => handleSetActive(match.id, match.is_active_for_registration)}
                  >
                    {match.is_active_for_registration ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    {match.is_active_for_registration ? 'Active' : 'Activate'}
                  </GlassButton>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

