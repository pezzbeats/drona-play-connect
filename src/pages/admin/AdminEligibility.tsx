import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  Download, Upload, Trash2, Loader2, CheckCircle2, AlertCircle,
  Users, Clock, FileText, RefreshCw
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface EligibilityRow {
  id: string;
  mobile: string;
  match_label: string | null;
  uploaded_at: string;
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

  // CSV preview state
  const [preview, setPreview] = useState<{ mobile: string; valid: boolean }[]>([]);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [matchLabel, setMatchLabel] = useState('Semi Final - Mar 2026');

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('semifinal_eligibility')
      .select('*')
      .order('uploaded_at', { ascending: false });
    if (error) toast({ variant: 'destructive', title: 'Failed to load', description: error.message });
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);

  // ── Download template ──────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const csv = [
      'mobile',
      '9876543210',
      '9123456789',
      '# Add one 10-digit mobile number per row (remove this comment line)',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'semifinal_eligibility_template.csv';
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
      const parsed: { mobile: string; valid: boolean }[] = [];
      for (const line of lines) {
        if (line.toLowerCase() === 'mobile' || line.startsWith('#')) continue;
        const mobile = line.replace(/\D/g, '').slice(0, 10);
        parsed.push({ mobile, valid: /^\d{10}$/.test(mobile) });
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
    const payload = valid.map(p => ({
      mobile: p.mobile,
      match_label: matchLabel || 'Semi Final',
      uploaded_by: user?.id || null,
    }));

    // Upsert in batches of 500
    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < payload.length; i += BATCH) {
      const { error } = await supabase
        .from('semifinal_eligibility')
        .upsert(payload.slice(i, i + BATCH), { onConflict: 'mobile' });
      if (error) {
        toast({ variant: 'destructive', title: 'Upload error', description: error.message });
        setUploading(false);
        return;
      }
      inserted += Math.min(BATCH, payload.length - i);
    }
    toast({ title: `✅ Uploaded ${inserted} numbers`, description: 'Eligibility list updated.' });
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

  const filtered = rows.filter(r => !search || r.mobile.includes(search));
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

      {/* Download template */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Step 1: Download Template</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Download the CSV template, fill in the 10-digit mobile numbers of previous semifinal attendees (one per row), then upload below.
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
        <div className="flex items-center gap-3 mb-3">
          <Upload className="h-5 w-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Step 2: Upload Numbers</h2>
        </div>

        <div className="space-y-3">
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
              <div className="max-h-52 overflow-y-auto">
                {preview.slice(0, 20).map((p, i) => (
                  <div key={i} className={`flex items-center justify-between px-4 py-1.5 text-sm border-b border-border/20 last:border-0 ${p.valid ? '' : 'bg-destructive/5'}`}>
                    <span className={`font-mono ${p.valid ? 'text-foreground' : 'text-destructive'}`}>{p.mobile || '(empty)'}</span>
                    {p.valid
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      : <AlertCircle className="h-3.5 w-3.5 text-destructive" />
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
              {uploading ? 'Uploading…' : `Upload ${validCount} numbers`}
            </button>
          )}
        </div>
      </GlassCard>

      {/* Current list */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-foreground">Eligibility List</h2>
          <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
        </div>

        <Input
          className="glass-input text-sm mb-3"
          placeholder="Search mobile number…"
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
            <div className="grid grid-cols-[1fr_1fr_auto] text-xs font-semibold text-muted-foreground bg-muted/30 px-4 py-2.5 border-b border-border/30">
              <span>Mobile</span>
              <span>Label / Date</span>
              <span></span>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-border/20">
              {filtered.map(row => (
                <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] items-center px-4 py-2.5 text-sm hover:bg-muted/20 transition-colors">
                  <span className="font-mono font-medium text-foreground">{row.mobile}</span>
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
      </GlassCard>
    </div>
  );
}
