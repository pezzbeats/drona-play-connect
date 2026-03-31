import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeChannel, type ChannelSubscription } from '@/hooks/useRealtimeChannel';
import { Plus, ToggleLeft, ToggleRight, Edit, Zap, Trophy, Clock, Calendar } from 'lucide-react';
import ApiSyncPanel from '@/components/admin/ApiSyncPanel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

function MatchCard({ match, settingActive, onActivate, onDeactivate }: {
  match: Match;
  settingActive: string | null;
  onActivate: (m: Match) => void;
  onDeactivate: (m: Match) => void;
}) {
  return (
    <GlassCard
      className={`p-4 ${match.is_active_for_registration ? 'border-primary/50 glass-card-glow' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-lg font-bold text-foreground">{match.name}</h3>
            {match.is_active_for_registration && (
              <span className="flex items-center gap-1 text-xs text-primary font-semibold">
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
          {/* Countdown for upcoming */}
          {match.start_time && !['ended', 'live'].includes(match.status) && new Date(match.start_time) > new Date() && (
            <div className="mt-2">
              <CountdownTimer targetTime={match.start_time} variant="compact" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link to={`/admin/matches/${match.id}`}>
            <GlassButton variant="ghost" size="sm"><Edit className="h-3.5 w-3.5" /></GlassButton>
          </Link>
          <GlassButton
            variant={match.is_active_for_registration ? 'success' : 'outline'}
            size="sm"
            loading={settingActive === match.id}
            onClick={() => {
              if (match.is_active_for_registration) {
                onDeactivate(match);
              } else {
                onActivate(match);
              }
            }}
          >
            {match.is_active_for_registration ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            {match.is_active_for_registration ? 'Active' : 'Activate'}
          </GlassButton>
        </div>
      </div>
    </GlassCard>
  );
}

export default function AdminMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [settingActive, setSettingActive] = useState<string | null>(null);
  const [confirmActivateMatch, setConfirmActivateMatch] = useState<Match | null>(null);
  const [confirmDeactivateMatch, setConfirmDeactivateMatch] = useState<Match | null>(null);
  const [activeEventId, setActiveEventId] = useState<string>('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  const { toast } = useToast();
  const { user } = useAuth();

  const [form, setForm] = useState({
    name: '', opponent: '', match_type: 'group', venue: 'Hotel Drona Palace',
    start_time: '', status: 'draft'
  });

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('matches').select('*').order('start_time', { ascending: false });
    setMatches(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMatches();
    supabase.from('events').select('id').eq('is_active', true).limit(1).maybeSingle()
      .then(({ data }) => { if (data?.id) setActiveEventId(data.id); });
  }, [fetchMatches]);

  // Realtime subscription for matches table
  const realtimeSubscriptions = useMemo<ChannelSubscription[]>(() => [
    { event: 'INSERT', schema: 'public', table: 'matches', callback: () => fetchMatches() },
    { event: 'UPDATE', schema: 'public', table: 'matches', callback: () => fetchMatches() },
  ], [fetchMatches]);

  useRealtimeChannel('admin-matches', realtimeSubscriptions, fetchMatches);

  // Group matches
  const liveMatches = matches.filter(m => m.status === 'live');
  const upcomingMatches = matches.filter(m => ['draft', 'registrations_open', 'registrations_closed'].includes(m.status));
  const endedMatches = matches.filter(m => m.status === 'ended');

  const handleCreate = async () => {
    if (!form.name.trim()) return toast({ variant: 'destructive', title: 'Match name required' });
    setCreating(true);
    try {
      const { error } = await supabase.from('matches').insert({
        event_id: activeEventId,
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
      const { error } = await supabase.functions.invoke('set-match-active', {
        body: { match_id: currentlyActive ? null : matchId }
      });
      if (error) throw error;
      toast({ title: currentlyActive ? 'Registration deactivated' : '✅ Match is now active for registration' });
      if (user) {
        await supabase.from('admin_activity').insert({ admin_id: user.id, action: 'set_match_active', entity_type: 'match', entity_id: matchId });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
    }
    setSettingActive(null);
  };

  const renderSection = (title: string, icon: React.ReactNode, items: Match[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
          <span className="text-xs text-muted-foreground bg-muted/30 rounded-full px-2 py-0.5">{items.length}</span>
        </div>
        {items.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            settingActive={settingActive}
            onActivate={m => setConfirmActivateMatch(m)}
            onDeactivate={m => setConfirmDeactivateMatch(m)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto md:max-w-none md:p-6">
      <ApiSyncPanel />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold gradient-text-accent">Matches</h1>
          <p className="text-muted-foreground text-sm">Manage Cricket Fan Night matches</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <GlassButton variant="primary" size="sm">
              <Plus className="h-4 w-4" /> New Match
            </GlassButton>
          </DialogTrigger>
          <DialogContent className="glass-card-elevated border-border max-w-md">
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
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} lines={2} showHeader />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <Trophy className="h-12 w-12 text-primary/30 mx-auto mb-3" />
          <p className="font-display text-lg font-bold text-foreground">No matches yet</p>
          <p className="text-muted-foreground text-sm mt-1">Create your first match to get started</p>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {renderSection('🔴 Live Now', <Zap className="h-5 w-5 text-success" />, liveMatches)}
          {renderSection('📅 Upcoming', <Clock className="h-5 w-5 text-primary" />, upcomingMatches)}
          {renderSection('🏆 Ended', <Trophy className="h-5 w-5 text-muted-foreground" />, endedMatches)}
        </div>
      )}

      {/* Confirm activation dialog */}
      <AlertDialog open={!!confirmActivateMatch} onOpenChange={open => !open && setConfirmActivateMatch(null)}>
        <AlertDialogContent className="glass-card-elevated border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-foreground">Activate Registration?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will deactivate any currently active match and open registration for{' '}
              <strong className="text-foreground">{confirmActivateMatch?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirmActivateMatch) { handleSetActive(confirmActivateMatch.id, false); setConfirmActivateMatch(null); }
            }}>Activate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm deactivation dialog */}
      <AlertDialog open={!!confirmDeactivateMatch} onOpenChange={open => !open && setConfirmDeactivateMatch(null)}>
        <AlertDialogContent className="glass-card-elevated border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-foreground">⚠️ Deactivate Registration?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will <strong>close registrations</strong> for{' '}
              <strong className="text-foreground">{confirmDeactivateMatch?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDeactivateMatch) { handleSetActive(confirmDeactivateMatch.id, true); setConfirmDeactivateMatch(null); }
              }}
            >Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
