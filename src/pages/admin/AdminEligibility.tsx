import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  Download, Upload, Trash2, Loader2, CheckCircle2, AlertCircle,
  Users, Clock, FileText, RefreshCw, ToggleLeft, ToggleRight,
  AlertTriangle, XCircle, Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface EligibilityRow {
  id: string;
  mobile: string;
  full_name: string | null;
  notes: string | null;
  match_label: string | null;
  uploaded_at: string;
  eligible_seats: number;
}

interface PreviewRow {
  mobile: string;
  full_name: string;
  eligible_seats: number;
  notes: string;
  valid: boolean;
}

export default function AdminEligibility() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<EligibilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [uploadMode, setUploadMode] = useState<'append' | 'replace'>('append');

  // Quick-check state
  const [checkInput, setCheckInput] = useState('');
  const [checkResult, setCheckResult] = useState<EligibilityRow | null | 'not_found' | 'idle'>('idle');

  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [matchLabel, setMatchLabel] = useState('Semi Final - Mar 2026');

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('semifinal_eligibility')
      .select('*')
      .order('uploaded_at', { ascending: false });
    if (error) toast({ variant: 'destructive', title: 'Failed to load', description: error.message });
    else setRows((data || []) as EligibilityRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);

  // ── Quick mobile check ─────────────────────────────────────────────────────
  const handleQuickCheck = () => {
    const normalized = checkInput.replace(/\D/g, '').slice(0, 10);
    if (!/^\d{10}$/.test(normalized)) return;
    const found = rows.find(r => r.mobile === normalized);
    setCheckResult(found ?? 'not_found');
  };

  // ── Download template ──────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const csv = [
      'mobile,full_name,eligible_seats,notes',
      '9876543210,Sample Name,4,Booked 4 seats for semifinal',
      '9123456789,Another Name,2,Booked 2 seats for semifinal',
      '# Add one row per number — eligible_seats = number of seats at ₹949 rate',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'semifinal_eligibility_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Export current list ────────────────────────────────────────────────────
  const handleExportList = () => {
    if (rows.length === 0) return;
    const header = 'mobile,full_name,notes,match_label,uploaded_at';
    const body = rows.map(r => [
      r.mobile,
      r.full_name ?? '',
      r.notes ?? '',
      r.match_label ?? '',
      r.uploaded_at,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eligibility_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Parse CSV file ─────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const parsed: PreviewRow[] = [];
      let hasHeader = false;

      for (const line of lines) {
        if (line.startsWith('#')) continue;
        // Detect header row
        if (!hasHeader && /^mobile/i.test(line)) { hasHeader = true; continue; }

        // Simple CSV parse (handles quoted fields)
        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        const mobile = cols[0]?.replace(/\D/g, '').slice(0, 10) ?? '';
        const full_name = cols[1] ?? '';
        const eligible_seats = parseInt(cols[2] ?? '0', 10) || 0;
        const notes = cols[3] ?? '';
        parsed.push({ mobile, full_name, eligible_seats, notes, valid: /^\d{10}$/.test(mobile) });
      }
      setPreview(parsed);
    };
    reader.readAsText(file);
  };

  // ── Upload bulk ────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    const valid = preview.filter(p => p.valid);
    if (valid.length === 0) {
      toast({ variant: 'destructive', title: 'No valid numbers', description: 'Fix errors before uploading.' });
      return;
    }
    setUploading(true);

    // Replace mode: clear existing first
    if (uploadMode === 'replace') {
      const { error: delErr } = await supabase.from('semifinal_eligibility').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (delErr) {
        toast({ variant: 'destructive', title: 'Clear failed', description: delErr.message });
        setUploading(false);
        return;
      }
    }

    const payload = valid.map(p => ({
      mobile: p.mobile,
      full_name: p.full_name || null,
      eligible_seats: p.eligible_seats,
      notes: p.notes || null,
      match_label: matchLabel || 'Semi Final',
      uploaded_by: user?.id ?? null,
    }));

    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < payload.length; i += BATCH) {
      const { error } = await supabase
        .from('semifinal_eligibility')
        .upsert(payload.slice(i, i + BATCH) as any, { onConflict: 'mobile' });
      if (error) {
        toast({ variant: 'destructive', title: 'Upload error', description: error.message });
        setUploading(false);
        return;
      }
      inserted += Math.min(BATCH, payload.length - i);
    }
    toast({ title: `✅ Uploaded ${inserted} numbers`, description: uploadMode === 'replace' ? 'List replaced.' : 'Appended to existing list.' });
    setPreview([]);
    setPreviewFile(null);
    if (fileRef.current) fileRef.current.value = '';
    fetchRows();
    setUploading(false);
  };

  // ── Delete single ──────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('semifinal_eligibility').delete().eq('id', id);
    if (error) toast({ variant: 'destructive', title: 'Delete failed', description: error.message });
    else {
      setRows(r => r.filter(x => x.id !== id));
      toast({ title: 'Removed from eligibility list' });
    }
    setDeleting(null);
  };

  // ── Clear all ──────────────────────────────────────────────────────────────
  const handleClearAll = async () => {
    const { error } = await supabase.from('semifinal_eligibility').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) toast({ variant: 'destructive', title: 'Clear failed', description: error.message });
    else {
      setRows([]);
      toast({ title: '🗑️ Eligibility list cleared' });
    }
  };

  const filtered = rows.filter(r => !search || r.mobile.includes(search) || (r.full_name ?? '').toLowerCase().includes(search.toLowerCase()));
  const validCount = preview.filter(p => p.valid).length;
  const invalidCount = preview.filter(p => !p.valid).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Semifinal Eligibility</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage ₹949 discounted pricing for previous attendees</p>
        </div>
        <button onClick={fetchRows} className="p-2 rounded-lg hover:bg-muted/30 text-muted-foreground transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-foreground">{rows.length}</p>
            <p className="text-xs text-muted-foreground">Eligible numbers</p>
          </div>
        </GlassCard>
        <GlassCard className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center">
            <Clock className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-sm font-display font-bold text-foreground">
              {rows[0] ? new Date(rows[0].uploaded_at).toLocaleDateString('en-IN') : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Last upload</p>
          </div>
        </GlassCard>
      </div>

      {/* Quick Check */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <Search className="h-5 w-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Quick Eligibility Check</h2>
        </div>
        <div className="flex gap-2">
          <Input
            className="glass-input text-sm flex-1"
            placeholder="Enter 10-digit mobile number…"
            value={checkInput}
            onChange={e => {
              setCheckInput(e.target.value);
              setCheckResult('idle');
            }}
            onKeyDown={e => e.key === 'Enter' && handleQuickCheck()}
            maxLength={15}
          />
          <button
            onClick={handleQuickCheck}
            disabled={checkInput.replace(/\D/g, '').length !== 10}
            className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-40"
          >
            Check
          </button>
        </div>

        {checkResult !== 'idle' && (
          <div className={`mt-3 flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
            checkResult === 'not_found'
              ? 'bg-muted/20 border-border/40'
              : 'bg-success/10 border-success/30'
          }`}>
            {checkResult === 'not_found' ? (
              <>
                <XCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Not eligible</p>
                  <p className="text-xs text-muted-foreground mt-0.5">This number is not on the semifinal eligibility list — standard ₹999 pricing applies.</p>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-success">⭐ Eligible — Special ₹949</p>
                  {(checkResult as EligibilityRow).full_name && (
                    <p className="text-xs text-foreground mt-0.5">{(checkResult as EligibilityRow).full_name}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Label: {(checkResult as EligibilityRow).match_label || '—'} · 
                    Uploaded {new Date((checkResult as EligibilityRow).uploaded_at).toLocaleDateString('en-IN')}
                  </p>
                  {(checkResult as EligibilityRow).notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">Notes: {(checkResult as EligibilityRow).notes}</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </GlassCard>

      {/* Download template */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Step 1: Download Template</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Download the CSV template with <code className="bg-muted/40 px-1 rounded text-xs">mobile,full_name,notes</code> columns.
          Fill in the 10-digit mobile numbers, then upload below.
        </p>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
        >
          <Download className="h-4 w-4" /> Download Template CSV
        </button>
      </GlassCard>

      {/* Upload CSV */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <Upload className="h-5 w-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Step 2: Upload Numbers</h2>
        </div>

        <div className="space-y-4">
          {/* Upload mode toggle */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/10">
            <button
              onClick={() => setUploadMode(m => m === 'append' ? 'replace' : 'append')}
              className="text-primary flex-shrink-0"
            >
              {uploadMode === 'append'
                ? <ToggleLeft className="h-6 w-6" />
                : <ToggleRight className="h-6 w-6 text-warning" />
              }
            </button>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {uploadMode === 'append' ? 'Append to existing list' : 'Replace entire list'}
              </p>
              <p className="text-xs text-muted-foreground">
                {uploadMode === 'append'
                  ? 'New numbers are added; duplicates are updated in place.'
                  : 'All existing records will be deleted before uploading.'}
              </p>
            </div>
          </div>
          {uploadMode === 'replace' && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning font-semibold">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>Replace mode will permanently delete all {rows.length} existing entries before uploading.</span>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Match Label (shown in records)</label>
            <Input
              className="glass-input text-sm"
              value={matchLabel}
              onChange={e => setMatchLabel(e.target.value)}
              placeholder="e.g. Semi Final - Mar 2026"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">CSV File</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-semibold hover:file:bg-primary/20 cursor-pointer"
            />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-muted/30">
                <span className="text-sm font-semibold text-foreground">Preview ({preview.length} rows)</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {validCount} valid</span>
                  {invalidCount > 0 && <span className="text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {invalidCount} invalid</span>}
                </div>
              </div>
              {/* Header row */}
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] text-xs font-semibold text-muted-foreground bg-muted/30 px-4 py-2 border-b border-border/20">
                <span>Mobile</span><span>Name</span><span>Notes</span><span></span>
              </div>
              <div className="max-h-52 overflow-y-auto">
                {preview.slice(0, 20).map((p, i) => (
                  <div key={i} className={`grid grid-cols-[1fr_1fr_1fr_auto] items-center px-4 py-1.5 text-xs border-b border-border/20 last:border-0 gap-2 ${p.valid ? '' : 'bg-destructive/5'}`}>
                    <span className={`font-mono ${p.valid ? 'text-foreground' : 'text-destructive'}`}>{p.mobile || '(empty)'}</span>
                    <span className="text-muted-foreground truncate">{p.full_name || '—'}</span>
                    <span className="text-muted-foreground truncate">{p.notes || '—'}</span>
                    {p.valid
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
                      : <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                    }
                  </div>
                ))}
                {preview.length > 20 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground">…and {preview.length - 20} more rows</div>
                )}
              </div>
            </div>
          )}

          {preview.length > 0 && (
            <button
              onClick={handleUpload}
              disabled={uploading || validCount === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-success/10 border border-success/30 text-success text-sm font-semibold hover:bg-success/20 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading…' : `${uploadMode === 'replace' ? 'Replace with' : 'Upload'} ${validCount} numbers`}
            </button>
          )}
        </div>
      </GlassCard>

      {/* Current list */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-foreground">Eligibility List</h2>
          <div className="flex items-center gap-2">
            {rows.length > 0 && (
              <button
                onClick={handleExportList}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            )}
            <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
          </div>
        </div>

        <Input
          className="glass-input text-sm mb-3"
          placeholder="Search mobile or name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {search ? 'No matching numbers' : 'No eligibility numbers uploaded yet'}
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] text-xs font-semibold text-muted-foreground bg-muted/30 px-4 py-2.5 border-b border-border/30">
              <span>Mobile</span>
              <span>Name</span>
              <span>Label / Date</span>
              <span></span>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-border/20">
              {filtered.map(row => (
                <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center px-4 py-2.5 text-sm hover:bg-muted/20 transition-colors gap-2">
                  <span className="font-mono font-medium text-foreground">{row.mobile}</span>
                  <span className="text-xs text-muted-foreground truncate">{row.full_name || '—'}</span>
                  <div>
                    <p className="text-xs text-foreground">{row.match_label || '—'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(row.uploaded_at).toLocaleDateString('en-IN')}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(row.id)}
                    disabled={deleting === row.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    {deleting === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clear all */}
        {rows.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/30">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors">
                  <XCircle className="h-4 w-4" /> Clear All ({rows.length} entries)
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear entire eligibility list?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {rows.length} entries from the eligibility list.
                    Users will no longer receive the ₹949 discount. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAll}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, clear all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
