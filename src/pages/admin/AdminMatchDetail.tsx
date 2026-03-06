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
  ExternalLink, Zap, RefreshCw, X, Users, UserCheck,
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
  const [pricing, setPricing] = useState<any[]>([]);
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
    setPricing(pricingRes.data || []);
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
      const [pricingRes, configRes] = await Promise.all([
        supabase.from('match_pricing_rules').select('*').eq('match_id', sourceMatchId).single(),
        supabase.from('match_scoring_config').select('*').eq('match_id', sourceMatchId).maybeSingle(),
      ]);
      if (pricingRes.data) {
        setPricingForm({
          base_price_new: pricingRes.data.base_price_new?.toString() || '',
          base_price_returning: pricingRes.data.base_price_returning?.toString() || '',
          rule_type: pricingRes.data.rule_type,
          loyalty_from_match_id: '', // don't carry over loyalty link
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
            <DialogContent className="glass-card border-border max-w-sm">
              <DialogHeader>
                <DialogTitle className="font-display text-lg gradient-text">Clone from Previous Match</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground mb-3">Copies pricing rules. Assets must be re-uploaded.</p>
              {allMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No other matches available.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {allMatches.map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleCloneFrom(m.id)}
                      disabled={cloning === m.id}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 bg-muted/20 hover:bg-primary/5 transition-all text-sm text-left"
                    >
                      <span className="text-foreground truncate">{m.name}</span>
                      {cloning === m.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
          {/* Preview button */}
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => window.open(`/register?preview=${id}`, '_blank')}
          >
            <Eye className="h-3.5 w-3.5 mr-1" /> Preview
          </GlassButton>
        </div>
      </div>

      {/* Registration Controls */}
      <GlassCard className={`p-5 ${match?.is_active_for_registration ? 'border-primary/40 shadow-glow-primary' : ''}`}>
        <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Registration Controls
        </h2>

        {/* Status quick-select */}
        <div className="mb-5">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-2 block">Match Status</Label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                disabled={savingStatus}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  form.status === opt.value
                    ? `${opt.color} border-current shadow-sm ring-1 ring-current/30`
                    : 'bg-muted/20 text-muted-foreground border-border hover:border-primary/30'
                }`}
              >
                {form.status === opt.value && <span className="mr-1">✓</span>}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active for registration switch */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border">
          <div>
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              Active for Registration
              {match?.is_active_for_registration && (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <Zap className="h-3 w-3" /> Live
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Only one match can be active at a time</p>
          </div>
          <Switch
            checked={match?.is_active_for_registration ?? false}
            disabled={settingActive}
            onCheckedChange={(checked) => {
              if (checked) {
                setShowActiveConfirm(true);
              } else {
                handleSetActive(false);
              }
            }}
          />
        </div>

        {/* Preview link */}
        <div className="mt-4">
          <GlassButton
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => window.open(`/register?preview=${id}`, '_blank')}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-2" />
            Preview Registration Page
          </GlassButton>
        </div>
      </GlassCard>

      {/* Edit Form */}
      <GlassCard className="p-5">
        <h2 className="font-display text-lg font-bold text-foreground mb-4">Match Info</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label className="text-foreground mb-1.5 block">Match Name</Label>
            <Input className="glass-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label className="text-foreground mb-1.5 block">Opponent</Label>
            <Input className="glass-input" value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} />
          </div>
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
            <Label className="text-foreground mb-1.5 block">Start Time</Label>
            <Input className="glass-input" type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-foreground mb-1.5 block">Venue</Label>
            <Input className="glass-input" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} />
          </div>
        </div>
        <GlassButton variant="primary" size="md" className="mt-4" loading={saving} onClick={handleSave}>Save Changes</GlassButton>
      </GlassCard>

      {/* Pricing Rules — Visual cards */}
      <GlassCard className="p-5">
        <h2 className="font-display text-lg font-bold text-foreground mb-1">Pricing Tiers</h2>
        <p className="text-xs text-muted-foreground mb-4">Set pricing for new and returning fans</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* New Customer card */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Users className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">New Customer</p>
                <p className="text-xs text-muted-foreground">First-time attendee price</p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1 block">Price (₹)</Label>
              <Input
                className="glass-input text-xl font-display font-bold"
                type="number"
                placeholder="e.g. 999"
                value={pricingForm.base_price_new}
                onChange={e => setPricingForm(f => ({ ...f, base_price_new: e.target.value }))}
              />
            </div>
            {newPrice > 0 && (
              <div className="text-xs text-blue-400 font-medium">₹{newPrice} per seat</div>
            )}
          </div>

          {/* Returning / Loyal card */}
          <div className="rounded-xl border border-success/20 bg-success/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-success/20 flex items-center justify-center">
                <UserCheck className="h-3.5 w-3.5 text-success" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Returning / Loyal</p>
                <p className="text-xs text-muted-foreground">Discounted returning fan price</p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1 block">Price (₹)</Label>
              <Input
                className="glass-input text-xl font-display font-bold"
                type="number"
                placeholder="e.g. 749"
                value={pricingForm.base_price_returning}
                onChange={e => setPricingForm(f => ({ ...f, base_price_returning: e.target.value }))}
              />
            </div>
            {returningPrice > 0 && savings > 0 && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/20 text-success text-xs font-semibold">
                🎉 ₹{savings} off for returning fans
              </div>
            )}
          </div>
        </div>

        {/* Rule type + loyalty link */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="text-foreground mb-1.5 block text-sm">Rule Type</Label>
            <Select value={pricingForm.rule_type} onValueChange={v => setPricingForm(f => ({ ...f, rule_type: v }))}>
              <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="loyalty">Loyalty</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-foreground mb-1.5 block text-sm">Loyalty From Match</Label>
            <Select
              value={pricingForm.loyalty_from_match_id || 'none'}
              onValueChange={v => setPricingForm(f => ({ ...f, loyalty_from_match_id: v === 'none' ? '' : v }))}
            >
              <SelectTrigger className="glass-input"><SelectValue placeholder="Select match" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (standard returning)</SelectItem>
                {allMatches.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Loyalty discount applies to seats bought at this linked match</p>
          </div>
        </div>

        <GlassButton variant="primary" size="md" loading={savingPrice} onClick={handleSavePricing}>Save Pricing</GlassButton>
      </GlassCard>

      {/* Asset Uploads */}
      <GlassCard className="p-5">
        <h2 className="font-display text-lg font-bold text-foreground mb-4">Match Assets</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {assetTypes.map(({ value, label, icon: Icon }) => {
            const uploaded = assets.find(a => a.asset_type === value);
            let previewUrl: string | null = null;
            if (uploaded) {
              const { data: urlData } = supabase.storage.from('match-assets').getPublicUrl(uploaded.file_path);
              previewUrl = urlData?.publicUrl;
            }
            const isUploading = uploadingAsset === value;
            const isRemoving = removingAsset === value;

            return (
              <div key={value} className={`relative group rounded-xl border overflow-hidden transition-all ${uploaded ? 'border-success/40 bg-success/5' : 'border-dashed border-border hover:border-primary/50'}`}>
                {/* Preview area */}
                <div className="relative w-full h-24">
                  {isUploading || isRemoving ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">{isUploading ? 'Uploading...' : 'Removing...'}</span>
                    </div>
                  ) : previewUrl && value !== 'terms_pdf' ? (
                    <>
                      <img src={previewUrl} alt={label} className="w-full h-24 object-cover" />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <label className="cursor-pointer">
                          <input type="file" className="hidden" accept="image/*"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleAssetUpload(value, f); }} />
                          <span className="flex items-center gap-1 px-2 py-1 bg-primary/20 rounded text-xs text-primary border border-primary/30 hover:bg-primary/30 transition-colors">
                            <RefreshCw className="h-3 w-3" /> Replace
                          </span>
                        </label>
                        <button
                          onClick={() => handleRemoveAsset(value, uploaded.id, uploaded.file_path)}
                          className="flex items-center gap-1 px-2 py-1 bg-destructive/20 rounded text-xs text-destructive border border-destructive/30 hover:bg-destructive/30 transition-colors"
                        >
                          <X className="h-3 w-3" /> Remove
                        </button>
                      </div>
                    </>
                  ) : uploaded && value === 'terms_pdf' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 relative">
                      <Icon className="h-8 w-8 text-success" />
                      <span className="text-xs text-success font-medium">PDF Uploaded</span>
                      <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <label className="cursor-pointer">
                          <input type="file" className="hidden" accept=".pdf"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleAssetUpload(value, f); }} />
                          <span className="flex items-center gap-1 px-2 py-1 bg-primary/20 rounded text-xs text-primary border border-primary/30 hover:bg-primary/30 transition-colors">
                            <RefreshCw className="h-3 w-3" /> Replace
                          </span>
                        </label>
                        <button
                          onClick={() => handleRemoveAsset(value, uploaded.id, uploaded.file_path)}
                          className="flex items-center gap-1 px-2 py-1 bg-destructive/20 rounded text-xs text-destructive border border-destructive/30 hover:bg-destructive/30 transition-colors"
                        >
                          <X className="h-3 w-3" /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center gap-1 cursor-pointer">
                      <input type="file" className="hidden" accept={value === 'terms_pdf' ? '.pdf' : 'image/*'}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleAssetUpload(value, f); }} />
                      <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                      <Upload className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </label>
                  )}
                </div>
                {/* Label */}
                <div className="px-2 py-1.5 text-center">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  {uploaded && !isRemoving && <div className="text-xs text-success mt-0.5">✓ Uploaded</div>}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Active confirm dialog */}
      <AlertDialog open={showActiveConfirm} onOpenChange={setShowActiveConfirm}>
        <AlertDialogContent className="glass-card border-border">
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
