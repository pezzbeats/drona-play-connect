import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Satellite, Power, PowerOff, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

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
  const [discovering, setDiscovering] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('cricket-api-sync', {
        body: null,
        method: 'GET',
      });
      // Use query param approach instead
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

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cricket-api-sync?action=discover`,
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
        title: `🏏 Discovery complete`,
        description: `Found ${json.discovered || 0} IPL matches. Created: ${json.created || 0}, Skipped: ${json.skipped || 0}`,
      });
      fetchStatus();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Discovery failed', description: e.message });
    }
    setDiscovering(false);
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cricket-api-sync?action=sync`,
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
        title: `⚡ Sync complete`,
        description: `Processed ${json.synced || 0} matches`,
      });
      fetchStatus();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Sync failed', description: e.message });
    }
    setSyncing(false);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Satellite className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">
            Live API Sync
          </h2>
          <span className="text-xs text-muted-foreground">Roanuz CricketAPI v5</span>
        </div>
        <div className="flex items-center gap-2">
          <GlassButton
            variant="outline"
            size="sm"
            loading={discovering}
            onClick={handleDiscover}
          >
            <Satellite className="h-3.5 w-3.5" />
            Discover IPL
          </GlassButton>
          <GlassButton
            variant="primary"
            size="sm"
            loading={syncing}
            onClick={handleSyncNow}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync Now
          </GlassButton>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : syncStates.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground">
            No synced matches yet. Click "Discover IPL" to import today's matches.
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
                <p className="text-sm font-medium text-foreground truncate">
                  {s.matches?.name || s.external_match_id}
                </p>
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
                    Last sync: {new Date(s.last_synced_at).toLocaleTimeString('en-IN')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
