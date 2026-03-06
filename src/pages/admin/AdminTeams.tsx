import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Users, CheckCircle2, Upload, AlertCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Team = {
  id: string;
  name: string;
  short_code: string;
  color: string | null;
  created_at: string;
};

type Player = {
  id: string;
  name: string;
  role: 'batsman' | 'bowler' | 'all_rounder' | 'wicketkeeper';
  jersey_number: number | null;
  team_id: string | null;
  teams?: { name: string } | null;
};

type Match = {
  id: string;
  name: string;
};

type RosterEntry = {
  id: string;
  match_id: string;
  team_id: string;
  side: 'home' | 'away';
  is_batting_first: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  batsman: 'Batsman',
  bowler: 'Bowler',
  all_rounder: 'All-Rounder',
  wicketkeeper: 'Wicketkeeper',
};

// ─── Teams Tab ────────────────────────────────────────────────────────────────

function TeamsTab() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [form, setForm] = useState({ name: '', short_code: '', color: '#3b82f6' });
  const [saving, setSaving] = useState(false);

  const fetchTeams = async () => {
    setLoading(true);
    const { data: teamsData } = await supabase.from('teams').select('*').order('created_at');
    const { data: playersData } = await supabase.from('players').select('team_id');
    if (teamsData) setTeams(teamsData);
    if (playersData) {
      const counts: Record<string, number> = {};
      playersData.forEach(p => { if (p.team_id) counts[p.team_id] = (counts[p.team_id] || 0) + 1; });
      setPlayerCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTeams(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', short_code: '', color: '#3b82f6' });
    setDialogOpen(true);
  };

  const openEdit = (team: Team) => {
    setEditing(team);
    setForm({ name: team.name, short_code: team.short_code, color: team.color || '#3b82f6' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.short_code.trim()) {
      toast({ title: 'Name and short code are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = { name: form.name.trim(), short_code: form.short_code.trim().toUpperCase(), color: form.color };
    let error;
    if (editing) {
      ({ error } = await supabase.from('teams').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('teams').insert(payload));
    }
    setSaving(false);
    if (error) { toast({ title: 'Error saving team', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Team updated' : 'Team created' });
    setDialogOpen(false);
    fetchTeams();
  };

  const handleDelete = async (team: Team) => {
    if (!confirm(`Delete team "${team.name}"? Players assigned to this team will be unassigned.`)) return;
    const { error } = await supabase.from('teams').delete().eq('id', team.id);
    if (error) { toast({ title: 'Error deleting team', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Team deleted' });
    fetchTeams();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{teams.length} team{teams.length !== 1 ? 's' : ''}</p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Add Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Team' : 'New Team'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Team Name</Label>
                <Input placeholder="e.g. Hotel Drona XI" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Short Code <span className="text-muted-foreground">(3–4 chars)</span></Label>
                <Input placeholder="e.g. HDX" maxLength={4} value={form.short_code} onChange={e => setForm(f => ({ ...f, short_code: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Team Colour</Label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="h-10 w-16 rounded cursor-pointer border border-input bg-background" />
                  <span className="text-sm font-mono text-muted-foreground">{form.color}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : teams.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="mx-auto h-10 w-10 mb-3 opacity-40" />
          <p>No teams yet. Add your first team.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Players</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map(team => (
                <TableRow key={team.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.color || '#888' }} />
                      <span className="font-medium">{team.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">{team.short_code}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{playerCounts[team.id] || 0} players</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(team)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(team)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Bulk Import Dialog ───────────────────────────────────────────────────────

type ParsedRow = {
  raw: string;
  name: string;
  role: Player['role'];
  jersey_number: number | null;
  valid: boolean;
  error?: string;
};

function parseRole(token: string): Player['role'] {
  const t = token.toLowerCase().trim();
  if (t.includes('bowl')) return 'bowler';
  if (t.includes('all') || t.includes('rounder')) return 'all_rounder';
  if (t.includes('keep') || t.includes('wk') || t.includes('wicket')) return 'wicketkeeper';
  return 'batsman';
}

function parseBulkText(text: string): ParsedRow[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(raw => {
      const parts = raw.split(/[,\t|]/).map(p => p.trim());
      const name = parts[0];
      if (!name) return { raw, name: '', role: 'batsman' as Player['role'], jersey_number: null, valid: false, error: 'Name is empty' };
      const role: Player['role'] = parts[1] ? parseRole(parts[1]) : 'batsman';
      const jerseyRaw = parts[2] || parts[1];
      const jerseyNum = jerseyRaw ? parseInt(jerseyRaw) : NaN;
      // Only use as jersey if it's a clean number field (field 3, or field 2 that's a pure number)
      const jersey_number = parts[2] && !isNaN(parseInt(parts[2])) ? parseInt(parts[2]) :
                            parts[1] && /^\d+$/.test(parts[1].trim()) ? parseInt(parts[1]) :
                            null;
      return { raw, name, role, jersey_number, valid: true };
    });
}

function BulkImportDialog({ teams, onImported }: { teams: Team[]; onImported: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [bulkTeamId, setBulkTeamId] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [previewed, setPreviewed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const reset = () => {
    setBulkText('');
    setParsedRows([]);
    setPreviewed(false);
    setImportedCount(null);
    setBulkTeamId(teams[0]?.id || '');
  };

  const handleOpen = (o: boolean) => {
    setOpen(o);
    if (o) reset();
  };

  const handlePreview = () => {
    const rows = parseBulkText(bulkText);
    setParsedRows(rows);
    setPreviewed(true);
  };

  const validRows = parsedRows.filter(r => r.valid);

  const handleImport = async () => {
    if (!bulkTeamId) { toast({ title: 'Select a team first', variant: 'destructive' }); return; }
    setImporting(true);
    const payload = validRows.map(r => ({
      name: r.name,
      role: r.role,
      jersey_number: r.jersey_number,
      team_id: bulkTeamId || null,
    }));
    const { error } = await supabase.from('players').insert(payload);
    setImporting(false);
    if (error) { toast({ title: 'Import failed', description: error.message, variant: 'destructive' }); return; }
    setImportedCount(validRows.length);
    toast({ title: `${validRows.length} player${validRows.length !== 1 ? 's' : ''} imported!` });
    onImported();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4 mr-1" /> Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Players</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Team selector */}
          <div className="space-y-1.5">
            <Label>Assign all players to team <span className="text-destructive">*</span></Label>
            <Select value={bulkTeamId || 'none'} onValueChange={v => setBulkTeamId(v === 'none' ? '' : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select team —</SelectItem>
                {teams.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: t.color || '#888' }} />
                      {t.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Paste area */}
          {importedCount === null && (
            <>
              <div className="space-y-1.5">
                <Label>Paste player list</Label>
                <Textarea
                  className="font-mono text-sm h-40 resize-none"
                  placeholder={`Rohit Sharma, batsman, 45\nJasprit Bumrah, bowler, 93\nHardik Pandya, all_rounder, 33\nMS Dhoni, wicketkeeper, 7\nVirat Kohli`}
                  value={bulkText}
                  onChange={e => { setBulkText(e.target.value); setPreviewed(false); setParsedRows([]); }}
                />
                <p className="text-xs text-muted-foreground">
                  One player per line · Fields: <code className="bg-muted px-1 rounded">Name, Role, Jersey#</code> · Separator: comma, tab or pipe
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={handlePreview}
                disabled={!bulkText.trim()}
              >
                Preview
              </Button>
            </>
          )}

          {/* Preview table */}
          {previewed && importedCount === null && parsedRows.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-2 bg-muted/40 text-xs text-muted-foreground flex items-center justify-between">
                <span>{validRows.length} valid · {parsedRows.length - validRows.length} skipped</span>
              </div>
              <div className="max-h-56 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-6" />
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Jersey</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, i) => (
                      <TableRow key={i} className={!row.valid ? 'opacity-50' : ''}>
                        <TableCell className="py-1.5">
                          {row.valid
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            : <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                        </TableCell>
                        <TableCell className="py-1.5 font-medium text-sm">{row.name || <span className="italic text-muted-foreground">{row.raw}</span>}</TableCell>
                        <TableCell className="py-1.5">
                          {row.valid && <Badge variant="outline" className="text-xs">{ROLE_LABELS[row.role]}</Badge>}
                        </TableCell>
                        <TableCell className="py-1.5 font-mono text-xs text-muted-foreground">
                          {row.jersey_number ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Success state */}
          {importedCount !== null && (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-6 flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="font-semibold">{importedCount} player{importedCount !== 1 ? 's' : ''} imported successfully</p>
              <p className="text-xs text-muted-foreground">The Players tab has been refreshed.</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {importedCount !== null ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={handleImport}
                disabled={!previewed || validRows.length === 0 || importing || !bulkTeamId}
              >
                {importing ? 'Importing…' : `Import ${validRows.length > 0 ? validRows.length : ''} player${validRows.length !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Players Tab ──────────────────────────────────────────────────────────────

function PlayersTab() {
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [form, setForm] = useState({ name: '', role: 'batsman' as Player['role'], jersey_number: '', team_id: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: playersData }, { data: teamsData }] = await Promise.all([
      supabase.from('players').select('*, teams(name)').order('name'),
      supabase.from('teams').select('*').order('name'),
    ]);
    if (playersData) setPlayers(playersData as Player[]);
    if (teamsData) setTeams(teamsData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', role: 'batsman', jersey_number: '', team_id: teams[0]?.id || '' });
    setDialogOpen(true);
  };

  const openEdit = (player: Player) => {
    setEditing(player);
    setForm({
      name: player.name,
      role: player.role,
      jersey_number: player.jersey_number?.toString() || '',
      team_id: player.team_id || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: 'Player name is required', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      role: form.role,
      jersey_number: form.jersey_number ? parseInt(form.jersey_number) : null,
      team_id: form.team_id || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('players').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('players').insert(payload));
    }
    setSaving(false);
    if (error) { toast({ title: 'Error saving player', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Player updated' : 'Player added' });
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (player: Player) => {
    if (!confirm(`Remove player "${player.name}"?`)) return;
    const { error } = await supabase.from('players').delete().eq('id', player.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Player removed' });
    fetchData();
  };

  const filtered = filterTeam === 'all' ? players : players.filter(p => p.team_id === filterTeam);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Select value={filterTeam} onValueChange={setFilterTeam}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <BulkImportDialog teams={teams} onImported={fetchData} />

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Add Player
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Player' : 'New Player'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input placeholder="e.g. Rohit Sharma" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as Player['role'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Jersey #</Label>
                  <Input type="number" placeholder="e.g. 45" value={form.jersey_number} onChange={e => setForm(f => ({ ...f, jersey_number: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Team</Label>
                <Select value={form.team_id || 'none'} onValueChange={v => setForm(f => ({ ...f, team_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="mx-auto h-10 w-10 mb-3 opacity-40" />
          <p>No players found. Add your first player.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(player => (
                <TableRow key={player.id}>
                  <TableCell className="text-muted-foreground font-mono text-xs">{player.jersey_number ?? '—'}</TableCell>
                  <TableCell className="font-medium">{player.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{ROLE_LABELS[player.role]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{player.teams?.name ?? <span className="italic opacity-50">Unassigned</span>}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(player)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(player)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Match Roster Tab ─────────────────────────────────────────────────────────

function MatchRosterTab() {
  const { toast } = useToast();
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [battingFirst, setBattingFirst] = useState<'home' | 'away'>('home');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: matchData }, { data: teamsData }] = await Promise.all([
        supabase.from('matches').select('id, name').eq('is_active_for_registration', true).maybeSingle(),
        supabase.from('teams').select('*').order('name'),
      ]);
      if (teamsData) setTeams(teamsData);
      if (matchData) {
        setActiveMatch(matchData);
        const { data: rosterData } = await supabase.from('match_roster').select('*').eq('match_id', matchData.id);
        if (rosterData && rosterData.length > 0) {
          setRoster(rosterData as RosterEntry[]);
          const homeRow = rosterData.find(r => r.side === 'home');
          const awayRow = rosterData.find(r => r.side === 'away');
          if (homeRow) setHomeTeamId(homeRow.team_id);
          if (awayRow) setAwayTeamId(awayRow.team_id);
          const battingFirstRow = rosterData.find(r => r.is_batting_first);
          if (battingFirstRow) setBattingFirst(battingFirstRow.side as 'home' | 'away');
        }
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!activeMatch) return;
    if (!homeTeamId || !awayTeamId) { toast({ title: 'Select both home and away teams', variant: 'destructive' }); return; }
    if (homeTeamId === awayTeamId) { toast({ title: 'Home and Away must be different teams', variant: 'destructive' }); return; }
    setSaving(true);
    setSaved(false);

    // Delete existing roster rows for this match, then re-insert
    await supabase.from('match_roster').delete().eq('match_id', activeMatch.id);

    const rows = [
      { match_id: activeMatch.id, team_id: homeTeamId, side: 'home' as const, is_batting_first: battingFirst === 'home' },
      { match_id: activeMatch.id, team_id: awayTeamId, side: 'away' as const, is_batting_first: battingFirst === 'away' },
    ];
    const { error } = await supabase.from('match_roster').insert(rows);
    setSaving(false);
    if (error) { toast({ title: 'Error saving roster', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Roster saved! Live Control dropdowns will now show these players.' });
    setSaved(true);
  };

  if (loading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>;

  if (!activeMatch) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="font-medium">No active match</p>
        <p className="text-sm mt-1">Activate a match for registration first, then assign its roster here.</p>
      </div>
    );
  }

  const homeTeam = teams.find(t => t.id === homeTeamId);
  const awayTeam = teams.find(t => t.id === awayTeamId);

  return (
    <div className="space-y-6 max-w-lg">
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <div>
          <p className="text-xs text-muted-foreground">Active Match</p>
          <p className="font-semibold text-sm">{activeMatch.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>🏠 Home Team</Label>
          <Select value={homeTeamId || 'none'} onValueChange={v => setHomeTeamId(v === 'none' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select —</SelectItem>
              {teams.map(t => (
                <SelectItem key={t.id} value={t.id} disabled={t.id === awayTeamId}>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color || '#888' }} />
                    {t.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>✈️ Away Team</Label>
          <Select value={awayTeamId || 'none'} onValueChange={v => setAwayTeamId(v === 'none' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select —</SelectItem>
              {teams.map(t => (
                <SelectItem key={t.id} value={t.id} disabled={t.id === homeTeamId}>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color || '#888' }} />
                    {t.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {homeTeamId && awayTeamId && homeTeamId !== awayTeamId && (
        <div className="space-y-2">
          <Label>🏏 Who bats first?</Label>
          <RadioGroup value={battingFirst} onValueChange={v => setBattingFirst(v as 'home' | 'away')} className="flex gap-4">
            <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${battingFirst === 'home' ? 'border-primary bg-primary/10' : 'border-border'}`}>
              <RadioGroupItem value="home" id="bat-home" />
              <span className="text-sm font-medium">{homeTeam?.name}</span>
              <span className="text-xs text-muted-foreground">({homeTeam?.short_code})</span>
            </label>
            <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${battingFirst === 'away' ? 'border-primary bg-primary/10' : 'border-border'}`}>
              <RadioGroupItem value="away" id="bat-away" />
              <span className="text-sm font-medium">{awayTeam?.name}</span>
              <span className="text-xs text-muted-foreground">({awayTeam?.short_code})</span>
            </label>
          </RadioGroup>
        </div>
      )}

      <Button onClick={handleSave} disabled={saving || !homeTeamId || !awayTeamId} className="w-full sm:w-auto">
        {saving ? 'Saving…' : 'Save Roster'}
      </Button>

      {saved && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-700 dark:text-green-400">Roster saved successfully</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              The Live Control delivery form will now show players from <strong>{homeTeam?.name}</strong> and <strong>{awayTeam?.name}</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminTeams() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Teams &amp; Players</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage teams, players, and assign match rosters for Live Control.</p>
      </div>

      <Tabs defaultValue="teams">
        <TabsList className="mb-4">
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          <TabsTrigger value="roster">Match Roster</TabsTrigger>
        </TabsList>

        <TabsContent value="teams"><TeamsTab /></TabsContent>
        <TabsContent value="players"><PlayersTab /></TabsContent>
        <TabsContent value="roster"><MatchRosterTab /></TabsContent>
      </Tabs>
    </div>
  );
}
