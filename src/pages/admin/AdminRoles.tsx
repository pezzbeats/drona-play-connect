import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Shield, UserPlus, Trash2, RefreshCw, Mail, Edit2, Check, X } from 'lucide-react';
import { format } from 'date-fns';

interface AdminRoleRow {
  id: string;
  user_id: string;
  role: string;
  created_at: string | null;
  email?: string; // enriched from auth users list
}

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
}

const ROLE_OPTIONS = [
  { value: 'gate_staff', label: 'Gate Staff', description: 'Ticket scanning only' },
  { value: 'operator',   label: 'Operator',   description: 'Most admin features' },
  { value: 'super_admin',label: 'Super Admin', description: 'Full access' },
];

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-primary/15 text-primary border-primary/30',
  operator:    'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  gate_staff:  'bg-green-500/15 text-green-400 border-green-500/30',
};

async function callAssignFn(payload: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assign-admin-role`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify(payload),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json;
}

export default function AdminRoles() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [roles, setRoles]         = useState<AdminRoleRow[]>([]);
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add form
  const [addEmail, setAddEmail]   = useState('');
  const [addRole, setAddRole]     = useState('gate_staff');
  const [adding, setAdding]       = useState(false);

  // Inline edit
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState('');
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    try {
      // Fetch admin_roles
      const { data: roleRows, error } = await supabase
        .from('admin_roles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch auth users list to enrich with emails
      let users: AuthUser[] = [];
      try {
        const res = await callAssignFn({ action: 'list_users' });
        users = res.users ?? [];
        setAuthUsers(users);
      } catch { /* silent — emails are optional enrichment */ }

      const userMap = new Map(users.map((u) => [u.id, u.email]));
      const enriched = (roleRows ?? []).map((r) => ({
        ...r,
        email: userMap.get(r.user_id) ?? undefined,
      }));
      setRoles(enriched);
    } catch (err: unknown) {
      toast({ title: 'Failed to load roles', description: String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setAdding(true);
    try {
      await callAssignFn({ action: 'assign', email: addEmail.trim(), role: addRole });
      toast({ title: 'Role assigned', description: `${addEmail} → ${addRole}` });
      setAddEmail('');
      setAddRole('gate_staff');
      await load(true);
    } catch (err: unknown) {
      toast({ title: 'Failed to assign role', description: String(err), variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const handleSaveEdit = async (targetUserId: string) => {
    setSaving(true);
    try {
      await callAssignFn({ action: 'assign', user_id: targetUserId, role: editingRole });
      toast({ title: 'Role updated' });
      setEditingId(null);
      await load(true);
    } catch (err: unknown) {
      toast({ title: 'Failed to update role', description: String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (targetUserId: string) => {
    try {
      await callAssignFn({ action: 'remove', user_id: targetUserId });
      toast({ title: 'Role removed' });
      await load(true);
    } catch (err: unknown) {
      toast({ title: 'Failed to remove role', description: String(err), variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Role Management</h1>
            <p className="text-sm text-muted-foreground">Assign and manage admin access levels</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Role Legend */}
      <GlassCard className="p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Access Levels</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ROLE_OPTIONS.map((r) => (
            <div key={r.value} className={`rounded-lg border px-3 py-2 ${ROLE_COLORS[r.value]}`}>
              <p className="font-semibold text-sm">{r.label}</p>
              <p className="text-xs opacity-80">{r.description}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Add New Admin */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground">Add Admin</h2>
        </div>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="admin@example.com"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              className="pl-9"
              required
            />
          </div>
          <Select value={addRole} onValueChange={setAddRole}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={adding || !addEmail.trim()}>
            {adding ? 'Assigning…' : 'Assign Role'}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          The user must already have an account. Their role will be created or updated immediately.
        </p>
      </GlassCard>

      {/* Current Admins Table */}
      <GlassCard className="p-5">
        <h2 className="font-semibold text-foreground mb-4">
          Current Admins
          <span className="ml-2 text-sm font-normal text-muted-foreground">({roles.length})</span>
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No admins assigned yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {roles.map((row) => {
              const isEditing = editingId === row.id;
              const isSelf    = row.user_id === user?.id;
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/30 border border-border/40 hover:border-border/70 transition-colors"
                >
                  {/* Avatar initial */}
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {(row.email ?? row.user_id).charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Email / user_id */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {row.email ?? '—'}
                      {isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{row.user_id}</p>
                  </div>

                  {/* Role badge or edit dropdown */}
                  {isEditing ? (
                    <Select value={editingRole} onValueChange={setEditingRole}>
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge
                      variant="outline"
                      className={`text-xs ${ROLE_COLORS[row.role] ?? ''}`}
                    >
                      {row.role.replace('_', ' ')}
                    </Badge>
                  )}

                  {/* Timestamp */}
                  {row.created_at && !isEditing && (
                    <span className="text-xs text-muted-foreground hidden md:block whitespace-nowrap">
                      {format(new Date(row.created_at), 'dd MMM yyyy')}
                    </span>
                  )}

                  {/* Actions */}
                  {isEditing ? (
                    <div className="flex gap-1">
                      <Button
                        size="icon" variant="ghost"
                        className="h-7 w-7 text-green-500 hover:text-green-400"
                        onClick={() => handleSaveEdit(row.user_id)}
                        disabled={saving}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => setEditingId(null)}
                        disabled={saving}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        size="icon" variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditingId(row.id); setEditingRole(row.role); }}
                        title="Change role"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      {!isSelf && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon" variant="ghost"
                              className="h-7 w-7 text-destructive/70 hover:text-destructive"
                              title="Remove admin access"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove admin access?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove <strong>{row.email ?? row.user_id}</strong>'s admin role.
                                They will no longer be able to access the admin panel.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={() => handleRemove(row.user_id)}
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
