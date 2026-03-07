import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Download, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ActivityRow {
  id: string;
  created_at: string;
  admin_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  ip_address: string | null;
}

const PAGE_SIZE = 25;

const ACTION_COLORS: Record<string, string> = {
  freeze_predictions: 'bg-destructive/15 text-destructive',
  unfreeze_predictions: 'bg-success/15 text-success',
  freeze_scanning: 'bg-destructive/15 text-destructive',
  unfreeze_scanning: 'bg-success/15 text-success',
  lock_all_windows: 'bg-warning/15 text-warning',
  set_match_active: 'bg-primary/15 text-primary',
  verify_payment: 'bg-success/15 text-success',
  reject_payment: 'bg-destructive/15 text-destructive',
  checkin: 'bg-accent/15 text-accent-foreground',
  leaderboard_adjust: 'bg-secondary/60 text-secondary-foreground',
  leaderboard_freeze: 'bg-destructive/15 text-destructive',
  scoring_config_save: 'bg-primary/15 text-primary',
};

function actionBadge(action: string) {
  const cls = ACTION_COLORS[action] || 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-block text-xs font-mono px-2 py-0.5 rounded-full ${cls}`}>
      {action}
    </span>
  );
}

export default function AdminActivity() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [uniqueActions, setUniqueActions] = useState<string[]>([]);
  const [uniqueEntities, setUniqueEntities] = useState<string[]>([]);
  // Map of userId → email for display
  const [adminEmailMap, setAdminEmailMap] = useState<Record<string, string>>({});

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('admin_activity')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterAction !== 'all') q = q.eq('action', filterAction);
    if (filterEntity !== 'all') q = q.eq('entity_type', filterEntity);
    if (search.trim()) q = q.ilike('action', `%${search}%`);

    const { data, count } = await q;
    if (data) setRows(data as ActivityRow[]);
    if (count !== null) setTotal(count);
    setLoading(false);
  }, [page, filterAction, filterEntity, search]);

  // Fetch filter options + admin email map once
  useEffect(() => {
    supabase.from('admin_activity').select('action, entity_type').then(({ data }) => {
      if (!data) return;
      setUniqueActions([...new Set(data.map(d => d.action).filter(Boolean))].sort());
      setUniqueEntities([...new Set(data.map(d => d.entity_type).filter(Boolean) as string[])].sort());
    });
    // Build userId→email map from admin_roles joined with auth info stored in meta or profiles
    supabase.from('admin_roles').select('user_id, role').then(({ data: roles }) => {
      if (!roles) return;
      // We can only display partial UUID — we don't have access to auth.users emails client-side
      // Store what we have for display, will enhance if profile table added later
      const map: Record<string, string> = {};
      roles.forEach(r => { map[r.user_id] = `${r.role} (${r.user_id.slice(0, 8)}…)`; });
      setAdminEmailMap(map);
    });
  }, []);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const handleExport = async () => {
    const { data } = await supabase
      .from('admin_activity')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (!data) return;
    const header = 'Timestamp,Admin ID,Action,Entity Type,Entity ID,IP,Meta';
    const csvRows = (data as ActivityRow[]).map(r =>
      [
        format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss'),
        r.admin_id || '',
        r.action,
        r.entity_type || '',
        r.entity_id || '',
        r.ip_address || '',
        JSON.stringify(r.meta || {}).replace(/,/g, ';'),
      ].join(',')
    );
    const blob = new Blob([[header, ...csvRows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-activity-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4 p-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
          <Activity className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold gradient-text-accent">Activity Log</h1>
          <p className="text-muted-foreground text-sm">{total.toLocaleString()} entries</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchActivity}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <GlassCard className="p-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[180px]">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input
              placeholder="Search actions…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="h-8 text-xs"
            />
          </div>
          <Select value={filterAction} onValueChange={v => { setFilterAction(v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {uniqueActions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterEntity} onValueChange={v => { setFilterEntity(v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="All entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {uniqueEntities.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      {/* Table */}
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Entity</th>
                <th className="px-3 py-2 text-left">Admin</th>
                <th className="px-3 py-2 text-left">Meta</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="px-3 py-2" colSpan={5}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                : rows.length === 0
                ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                      No activity found.
                    </td>
                  </tr>
                )
                : rows.map(row => (
                    <tr key={row.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        <span title={format(new Date(row.created_at), 'PPpp')}>
                          {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {actionBadge(row.action)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.entity_type && (
                          <span className="text-muted-foreground">
                            {row.entity_type}
                            {row.entity_id && (
                              <span className="font-mono text-[10px] ml-1 opacity-60">
                                {row.entity_id.slice(0, 8)}…
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground max-w-[140px]">
                        {row.admin_id
                          ? <span title={row.admin_id}>{adminEmailMap[row.admin_id] ?? row.admin_id.slice(0, 10) + '…'}</span>
                          : <span className="italic">system</span>}
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate text-muted-foreground font-mono">
                        {row.meta ? JSON.stringify(row.meta) : '—'}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages} · {total} total
            </span>
            <div className="flex gap-1">
              <Button
                size="sm" variant="outline"
                className="h-7 w-7 p-0"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-7 w-7 p-0"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
