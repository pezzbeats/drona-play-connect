import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Upload, Loader2, Image, FileText, Flag, Map, Copy, Eye,
  ExternalLink, Zap, X,
} from 'lucide-react';

const assetTypes = [
  { value: 'banner_image', label: 'Banner Image', icon: Image },
  { value: 'poster_image', label: 'Poster Image', icon: Image },
  { value: 'team_flag_1', label: 'Team Flag 1', icon: Flag },
  { value: 'team_flag_2', label: 'Team Flag 2', icon: Flag },
  { value: 'terms_pdf', label: 'Terms PDF', icon: FileText },
  { value: 'seating_map_image', label: 'Seating Map', icon: Map },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'bg-muted text-muted-foreground' },
  { value: 'registrations_open', label: 'Open', color: 'bg-success/20 text-success border-success/40' },
  { value: 'registrations_closed', label: 'Closed', color: 'bg-warning/20 text-warning border-warning/40' },
  { value: 'live', label: 'Live', color: 'bg-destructive/20 text-destructive border-destructive/40' },
  { value: 'ended', label: 'Ended', color: 'bg-muted text-muted-foreground' },
];

export default function AdminMatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState<any[]>([]);
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null);
  const [removingAsset, setRemovingAsset] = useState<string | null>(null);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', opponent: '', match_type: 'group', venue: '', status: 'draft', start_time: '' });
  const [pricingForm, setPricingForm] = useState({ base_price_new: '', base_price_returning: '', rule_type: 'standard', loyalty_from_match_id: '' });
  const [savingPrice, setSavingPrice] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [settingActive, setSettingActive] = useState(false);
  const [showActiveConfirm, setShowActiveConfirm] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloning, setCloning] = useState<string | null>(null);

  useEffect(() => { if (id) fetchMatch(); }, [id]);

  const fetchMatch = async () => {
    setLoading(true);
    const [matchRes, assetsRes, pricingRes, allMatchesRes] = await Promise.all([
      supabase.from('matches').select('*').eq('id', id).single(),
      supabase.from('match_assets').select('*').eq('match_id', id),
      supabase.from('match_pricing_rules').select('*').eq('match_id', id),
      supabase.from('matches').select('id, name').neq('id', id).order('created_at', { ascending: false }),
    ]);
    if (matchRes.data) {
      setMatch(matchRes.data);
      const m = matchRes.data;
      setForm({ name: m.name, opponent: m.opponent || '', match_type: m.match_type, venue: m.venue, status: m.status, start_time: m.start_time ? m.start_time.slice(0, 16) : '' });
    }
    setAssets(assetsRes.data || []);
    setAllMatches(allMatchesRes.data || []);
    const pr = pricingRes.data?.[0];
    if (pr) setPricingForm({
      base_price_new: pr.base_price_new?.toString() || '',
      base_price_returning: pr.base_price_returning?.toString() || '',
      rule_type: pr.rule_type,
      loyalty_from_match_id: pr.loyalty_from_match_id || '',
    });
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('matches').update({
        ...form,
        opponent: form.opponent || null,
        start_time: form.start_time || null,
      } as any).eq('id', id!);
      if (error) throw error;
      toast({ title: '✅ Match updated' });
      setMatch((m: any) => ({ ...m, ...form }));
      if (user) await supabase.from('admin_activity').insert({ admin_id: user.id, action: 'update_match', entity_type: 'match', entity_id: id! });
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setSaving(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    setSavingStatus(true);
    try {
      const { error } = await supabase.from('matches').update({ status: newStatus as any }).eq('id', id!);
      if (error) throw error;
      setForm(f => ({ ...f, status: newStatus }));
      setMatch((m: any) => ({ ...m, status: newStatus }));
      toast({ title: `Status → ${newStatus.replace('_', ' ')}` });
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setSavingStatus(false);
  };

  const handleSetActive = async (activate: boolean) => {
    setSettingActive(true);
    try {
      const { error } = await supabase.functions.invoke('set-match-active', {
        body: { match_id: activate ? id : null }
      });
      if (error) throw error;
      setMatch((m: any) => ({ ...m, is_active_for_registration: activate }));
      toast({ title: activate ? '✅ Match is now active for registration' : 'Registration deactivated' });
      if (user) await supabase.from('admin_activity').insert({ admin_id: user.id, action: 'set_match_active', entity_type: 'match', entity_id: id! });
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setSettingActive(false);
    setShowActiveConfirm(false);
  };

  const handleAssetUpload = async (assetType: string, file: File) => {
    setUploadingAsset(assetType);
    try {
      const ext = file.name.split('.').pop();
      const path = `${id}/${assetType}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('match-assets').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      await supabase.from('match_assets').upsert(
        { match_id: id!, asset_type: assetType as any, file_path: path, uploaded_by_admin_id: user?.id },
        { onConflict: 'match_id,asset_type' } as any
      );
      toast({ title: `✅ ${assetType.replace(/_/g, ' ')} uploaded` });
      fetchMatch();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Upload failed', description: e.message }); }
    setUploadingAsset(null);
  };

  const handleRemoveAsset = async (assetType: string, assetId: string, filePath: string) => {
    setRemovingAsset(assetType);
    try {
      await Promise.all([
        supabase.storage.from('match-assets').remove([filePath]),
        supabase.from('match_assets').delete().eq('id', assetId),
      ]);
      toast({ title: `🗑 ${assetType.replace(/_/g, ' ')} removed` });
      setAssets(prev => prev.filter(a => a.id !== assetId));
    } catch (e: any) { toast({ variant: 'destructive', title: 'Remove failed', description: e.message }); }
    setRemovingAsset(null);
  };

  const handleSavePricing = async () => {
    setSavingPrice(true);
    try {
      const { data: existing } = await supabase.from('match_pricing_rules').select('id').eq('match_id', id!).single();
      const priceData = {
        match_id: id!,
        rule_type: pricingForm.rule_type as any,
        base_price_new: parseInt(pricingForm.base_price_new),
        base_price_returning: pricingForm.base_price_returning ? parseInt(pricingForm.base_price_returning) : null,
        loyalty_from_match_id: pricingForm.loyalty_from_match_id || null,
      };
      if (existing) {
        await supabase.from('match_pricing_rules').update(priceData).eq('id', existing.id);
      } else {
        await supabase.from('match_pricing_rules').insert(priceData);
      }
      toast({ title: '✅ Pricing saved' });
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setSavingPrice(false);
  };

  const handleCloneFrom = async (sourceMatchId: string) => {
    setCloning(sourceMatchId);
    try {
      const { data: pricingRes } = await supabase.from('match_pricing_rules').select('*').eq('match_id', sourceMatchId).single();
      if (pricingRes) {
        setPricingForm({
          base_price_new: pricingRes.base_price_new?.toString() || '',
          base_price_returning: pricingRes.base_price_returning?.toString() || '',
          rule_type: pricingRes.rule_type,
          loyalty_from_match_id: '',
        });
      }
      setCloneOpen(false);
      toast({ title: '✅ Settings cloned — review and save to apply', description: 'Assets are not cloned and must be re-uploaded.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Clone failed', description: e.message });
    }
    setCloning(null);
  };

  const newPrice = parseFloat(pricingForm.base_price_new) || 0;
  const returningPrice = parseFloat(pricingForm.base_price_returning) || 0;
  const savings = newPrice && returningPrice ? newPrice - returningPrice : 0;

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <GlassButton variant="ghost" size="sm" onClick={() => navigate('/admin/matches')}>
            <ArrowLeft className="h-4 w-4" />
          </GlassButton>
          <div>
            <h1 className="font-display text-2xl font-bold gradient-text-accent">Match Details</h1>
            <p className="text-muted-foreground text-sm">{match?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Clone from dialog */}
          <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
            <DialogTrigger asChild>
              <GlassButton variant="outline" size="sm">
                <Copy className="h-3.5 w-3.5 mr-1" /> Clone Settings
              </GlassButton>
            </DialogTrigger>
            <DialogContent className="glass-card-elevated border-border max-w-sm">
              <DialogHeader>
                <DialogTitle className="font-display text-lg gradient-text">Clone from Previous Match</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <p className="text-sm text-muted-foreground">Select a previous match to copy its pricing and scoring settings.</p>
                {allMatches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No other matches to clone from.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {allMatches.map(m => (
                      <GlassButton
                        key={m.id}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        loading={cloning === m.id}
                        onClick={() => handleCloneFrom(m.id)}
                      >
                        {m.name}
                      </GlassButton>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Preview */}
          <GlassButton variant="ghost" size="sm" onClick={() => window.open('/ticket', '_blank')}>
            <Eye className="h-3.5 w-3.5 mr-1" /> Preview
          </GlassButton>

          {/* Activate / Deactivate */}
          {match?.is_active_for_registration ? (
            <GlassButton variant="success" size="sm" loading={settingActive} onClick={() => handleSetActive(false)}>
              <Zap className="h-3.5 w-3.5 mr-1" /> Active
            </GlassButton>
          ) : (
            <GlassButton variant="primary" size="sm" loading={settingActive} onClick={() => setShowActiveConfirm(true)}>
              Activate
            </GlassButton>
          )}
        </div>
      </div>

      {/* Match form */}
      <GlassCard className="p-5 space-y-4">
        <h2 className="font-display text-sm font-bold text-muted-foreground uppercase tracking-widest">Match Info</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5 block">Match Name *</Label>
            <Input className="glass-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5 block">Opponent Team</Label>
            <Input className="glass-input" placeholder="Opposing team" value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5 block">Match Type</Label>
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
            <Label className="mb-1.5 block">Venue</Label>
            <Input className="glass-input" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5 block">Start Time</Label>
            <Input className="glass-input" type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
          </div>
        </div>
        <GlassButton variant="primary" size="sm" loading={saving} onClick={handleSave}>Save Changes</GlassButton>
      </GlassCard>

      {/* Status */}
      <GlassCard className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <h2 className="font-display text-sm font-bold text-muted-foreground uppercase tracking-widest">Match Status</h2>
          <span className="text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-lg px-2.5 py-1 leading-snug max-w-xs text-right">
            ⚡ This controls the <strong>Match Control</strong> phase (draft → live → ended). <br />
            It is <strong>separate</strong> from the "Active for Registration" toggle above, which controls landing page visibility.
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleStatusChange(opt.value)}
              disabled={savingStatus}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${form.status === opt.value ? opt.color + ' border-current' : 'border-border text-muted-foreground hover:border-primary/50'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {!match?.is_active_for_registration && (
          <p className="text-xs text-warning mt-3 flex items-center gap-1.5">
            ⚠️ <span>This match is <strong>not active for registration</strong> — it won't appear on the landing page. Use the <strong>Activate</strong> button in the header to make it visible.</span>
          </p>
        )}
      </GlassCard>

      {/* Pricing */}
      <GlassCard className="p-5 space-y-4">
        <h2 className="font-display text-sm font-bold text-muted-foreground uppercase tracking-widest">Pricing</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5 block">New Customer Price (₹) *</Label>
            <Input className="glass-input" type="number" placeholder="e.g. 299" value={pricingForm.base_price_new} onChange={e => setPricingForm(f => ({ ...f, base_price_new: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5 block">Returning Customer Price (₹)</Label>
            <Input className="glass-input" type="number" placeholder="e.g. 199" value={pricingForm.base_price_returning} onChange={e => setPricingForm(f => ({ ...f, base_price_returning: e.target.value }))} />
          </div>
        </div>
        {savings > 0 && (
          <p className="text-xs text-success">Returning customers save ₹{savings}</p>
        )}
        <div>
          <Label className="mb-1.5 block">Rule Type</Label>
          <Select value={pricingForm.rule_type} onValueChange={v => setPricingForm(f => ({ ...f, rule_type: v }))}>
            <SelectTrigger className="glass-input max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="loyalty">Loyalty</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <GlassButton variant="primary" size="sm" loading={savingPrice} onClick={handleSavePricing}>Save Pricing</GlassButton>
      </GlassCard>

      {/* Match Assets */}
      <GlassCard className="p-5 space-y-4">
        <h2 className="font-display text-sm font-bold text-muted-foreground uppercase tracking-widest">Match Assets</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {assetTypes.map(({ value, label, icon: Icon }) => {
            const existing = assets.find(a => a.asset_type === value);
            const isUploading = uploadingAsset === value;
            const isRemoving = removingAsset === value;
            return (
              <div key={value} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{label}</p>
                  {existing ? (
                    <p className="text-xs text-success">Uploaded</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not uploaded</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {existing && (
                    <>
                      <a href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/match-assets/${existing.file_path}`} target="_blank" rel="noopener noreferrer">
                        <GlassButton variant="ghost" size="sm"><ExternalLink className="h-3 w-3" /></GlassButton>
                      </a>
                      <GlassButton variant="ghost" size="sm" loading={isRemoving} onClick={() => handleRemoveAsset(value, existing.id, existing.file_path)}>
                        <X className="h-3 w-3 text-destructive" />
                      </GlassButton>
                    </>
                  )}
                  <label className="cursor-pointer">
                    {isUploading ? (
                      <GlassButton variant="outline" size="sm" loading={true}>
                        <Upload className="h-3 w-3" />
                      </GlassButton>
                    ) : (
                      <span className="inline-flex items-center justify-center h-8 px-2 rounded-lg border border-border bg-transparent hover:bg-muted/30 transition-colors cursor-pointer">
                        <Upload className="h-3 w-3 text-foreground" />
                      </span>
                    )}
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => { const f = e.target.files?.[0]; if (f) handleAssetUpload(value, f); e.target.value = ''; }} />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Match flags */}
      <GlassCard className="p-5 space-y-3">
        <h2 className="font-display text-sm font-bold text-muted-foreground uppercase tracking-widest">Match Flags</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Predictions Enabled</p>
            <p className="text-xs text-muted-foreground">Allow fans to make predictions</p>
          </div>
          <Switch
            checked={match?.predictions_enabled ?? false}
            onCheckedChange={async v => {
              await supabase.from('matches').update({ predictions_enabled: v }).eq('id', id!);
              setMatch((m: any) => ({ ...m, predictions_enabled: v }));
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Disclaimer Enabled</p>
            <p className="text-xs text-muted-foreground">Show game disclaimer to fans</p>
          </div>
          <Switch
            checked={match?.disclaimer_enabled ?? true}
            onCheckedChange={async v => {
              await supabase.from('matches').update({ disclaimer_enabled: v }).eq('id', id!);
              setMatch((m: any) => ({ ...m, disclaimer_enabled: v }));
            }}
          />
        </div>
      </GlassCard>

      {/* Activate confirmation */}
      <AlertDialog open={showActiveConfirm} onOpenChange={setShowActiveConfirm}>
        <AlertDialogContent className="glass-card-elevated border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-foreground">Activate Registration?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will deactivate any currently active match and open registration for <strong className="text-foreground">{match?.name}</strong>.
              Fans will see this match on the registration page immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowActiveConfirm(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleSetActive(true)} className="bg-primary text-primary-foreground">
              {settingActive ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
