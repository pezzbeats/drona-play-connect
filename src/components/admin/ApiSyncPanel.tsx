import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Satellite, Power, PowerOff, Loader2, Zap, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface SyncState {
  match_id: string;
  external_match_id: string;
  last_innings1_score: number;
  last_innings1_wickets: number;
  last_innings1_overs: number;
  last_innings2_score: number;
  last_innings2_wickets: number;
  last_innings2_overs: number;
  last_synced_at: string;
  sync_enabled: boolean;
  matches: { id: string; name: string; status: string; external_match_id: string } | null;
}

export default function ApiSyncPanel() {
  const [syncStates, setSyncStates] = useState<SyncState[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cricket-api-sync?action=status`,
        { headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` } }
      );
      const json = await res.json();
      setSyncStates(json.sync_states || []);
    } catch (e) {
      console.error('Failed to fetch sync status:', e);
    }
    setLoading(false);
  };

  const callAction = async (action: string, label: string, matchId?: string) => {
    setActionLoading(action);
    try {
      const params = new URLSearchParams({ action });
      if (matchId) params.set('match_id', matchId);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cricket-api-sync?${params}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const json = await res.json();
      toast({
        title: `✅ ${label}`,
        description: JSON.stringify(json).slice(0, 200),
      });
      fetchStatus();
    } catch (e: any) {
      toast({ variant: 'destructive', title: `${label} failed`, description: e.message });
    }
    setActionLoading(null);
  };

  const toggleSync = async (matchId: string, enabled: boolean) => {
    await supabase
      .from('api_sync_state' as any)
      .update({ sync_enabled: !enabled } as any)
      .eq('match_id', matchId);
    fetchStatus();
  };

  return (
    <GlassCard className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Satellite className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">
            Live API Sync
          </h2>
          <Badge variant="outline" className="text-xs">Roanuz v5</Badge>
          <Badge variant="secondary" className="text-xs">
            <Zap className="h-3 w-3 mr-1" />
            Auto every 1min
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <GlassButton
            variant="outline"
            size="sm"
            loading={actionLoading === 'discover'}
            onClick={() => callAction('discover', 'Discovery')}
          >
            <Satellite className="h-3.5 w-3.5" />
            Discover IPL
          </GlassButton>
          <GlassButton
            variant="outline"
            size="sm"
            loading={actionLoading === 'sync'}
            onClick={() => callAction('sync', 'Score Sync')}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync Now
          </GlassButton>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Matches, teams, lineups & ball-by-ball scores sync automatically. Prediction windows remain <strong>admin-controlled</strong> via Match Command Center.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : syncStates.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground">
            No synced matches yet. Click "Discover IPL" or wait for auto-discovery.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {syncStates.map((s) => (
            <div
              key={s.match_id}
              className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {s.matches?.name || s.external_match_id}
                  </p>
                  <Badge variant={s.matches?.status === 'live' ? 'default' : 'outline'} className="text-[10px] shrink-0">
                    {s.matches?.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>
                    Inn1: {s.last_innings1_score}/{s.last_innings1_wickets} ({s.last_innings1_overs}ov)
                  </span>
                  {(s.last_innings2_score > 0 || s.last_innings2_overs > 0) && (
                    <span>
                      Inn2: {s.last_innings2_score}/{s.last_innings2_wickets} ({s.last_innings2_overs}ov)
                    </span>
                  )}
                  <span>
                    Synced: {s.last_synced_at ? new Date(s.last_synced_at).toLocaleTimeString('en-IN') : 'never'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <GlassButton
                  variant="ghost"
                  size="sm"
                  loading={actionLoading === `lineup-${s.match_id}`}
                  onClick={() => callAction('lineup', 'Lineup Fetch', s.match_id)}
                  title="Fetch lineup"
                >
                  <Users className="h-3.5 w-3.5" />
                </GlassButton>
                <span className="text-xs text-muted-foreground">
                  {s.sync_enabled ? (
                    <Power className="h-3.5 w-3.5 text-primary inline" />
                  ) : (
                    <PowerOff className="h-3.5 w-3.5 text-muted-foreground inline" />
                  )}
                </span>
                <Switch
                  checked={s.sync_enabled}
                  onCheckedChange={() => toggleSync(s.match_id, s.sync_enabled)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
