import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Upload, Loader2, Image, FileText, Flag, Map } from 'lucide-react';

const assetTypes = [
  { value: 'banner_image', label: 'Banner Image', icon: Image },
  { value: 'poster_image', label: 'Poster Image', icon: Image },
  { value: 'team_flag_1', label: 'Team Flag 1', icon: Flag },
  { value: 'team_flag_2', label: 'Team Flag 2', icon: Flag },
  { value: 'terms_pdf', label: 'Terms PDF', icon: FileText },
  { value: 'seating_map_image', label: 'Seating Map', icon: Map },
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
  const [pricing, setPricing] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', opponent: '', match_type: 'group', venue: '', status: 'draft', start_time: '' });
  const [pricingForm, setPricingForm] = useState({ base_price_new: '', base_price_returning: '', rule_type: 'standard' });
  const [savingPrice, setSavingPrice] = useState(false);

  useEffect(() => { if (id) fetchMatch(); }, [id]);

  const fetchMatch = async () => {
    setLoading(true);
    const [matchRes, assetsRes, pricingRes] = await Promise.all([
      supabase.from('matches').select('*').eq('id', id).single(),
      supabase.from('match_assets').select('*').eq('match_id', id),
      supabase.from('match_pricing_rules').select('*').eq('match_id', id),
    ]);
    if (matchRes.data) {
      setMatch(matchRes.data);
      const m = matchRes.data;
      setForm({ name: m.name, opponent: m.opponent || '', match_type: m.match_type, venue: m.venue, status: m.status, start_time: m.start_time ? m.start_time.slice(0, 16) : '' });
    }
    setAssets(assetsRes.data || []);
    const pr = pricingRes.data?.[0];
    if (pr) setPricingForm({ base_price_new: pr.base_price_new?.toString(), base_price_returning: pr.base_price_returning?.toString() || '', rule_type: pr.rule_type });
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('matches').update({ ...form, opponent: form.opponent || null, start_time: form.start_time || null } as any).eq('id', id!);
      if (error) throw error;
      toast({ title: '✅ Match updated' });
      if (user) await supabase.from('admin_activity').insert({ admin_id: user.id, action: 'update_match', entity_type: 'match', entity_id: id! });
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setSaving(false);
  };

  const handleAssetUpload = async (assetType: string, file: File) => {
    setUploadingAsset(assetType);
    try {
      const ext = file.name.split('.').pop();
      const path = `${id}/${assetType}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('match-assets').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      // Upsert asset record
      await supabase.from('match_assets').upsert({ match_id: id!, asset_type: assetType as any, file_path: path, uploaded_by_admin_id: user?.id }, { onConflict: 'match_id,asset_type' } as any);
      toast({ title: `✅ ${assetType.replace('_', ' ')} uploaded` });
      fetchMatch();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Upload failed', description: e.message }); }
    setUploadingAsset(null);
  };

  const handleSavePricing = async () => {
    setSavingPrice(true);
    try {
      const { data: existing } = await supabase.from('match_pricing_rules').select('id').eq('match_id', id!).single();
      const priceData = { match_id: id!, rule_type: pricingForm.rule_type as any, base_price_new: parseInt(pricingForm.base_price_new), base_price_returning: pricingForm.base_price_returning ? parseInt(pricingForm.base_price_returning) : null };
      if (existing) {
        await supabase.from('match_pricing_rules').update(priceData).eq('id', existing.id);
      } else {
        await supabase.from('match_pricing_rules').insert(priceData);
      }
      toast({ title: '✅ Pricing saved' });
    } catch (e: any) { toast({ variant: 'destructive', title: 'Failed', description: e.message }); }
    setSavingPrice(false);
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <GlassButton variant="ghost" size="sm" onClick={() => navigate('/admin/matches')}>
          <ArrowLeft className="h-4 w-4" />
        </GlassButton>
        <div>
          <h1 className="font-display text-2xl font-bold gradient-text-accent">Match Details</h1>
          <p className="text-muted-foreground text-sm">{match?.name}</p>
        </div>
      </div>

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
            <Label className="text-foreground mb-1.5 block">Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="registrations_open">Registrations Open</SelectItem>
                <SelectItem value="registrations_closed">Registrations Closed</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="ended">Ended</SelectItem>
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

      {/* Pricing Rules */}
      <GlassCard className="p-5">
        <h2 className="font-display text-lg font-bold text-foreground mb-4">Pricing Rules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-foreground mb-1.5 block">Rule Type</Label>
            <Select value={pricingForm.rule_type} onValueChange={v => setPricingForm(f => ({ ...f, rule_type: v }))}>
              <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="loyalty">Loyalty</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-foreground mb-1.5 block">New Customer Price (₹)</Label>
            <Input className="glass-input" type="number" placeholder="e.g. 500" value={pricingForm.base_price_new} onChange={e => setPricingForm(f => ({ ...f, base_price_new: e.target.value }))} />
          </div>
          <div>
            <Label className="text-foreground mb-1.5 block">Returning Customer Price (₹)</Label>
            <Input className="glass-input" type="number" placeholder="e.g. 400" value={pricingForm.base_price_returning} onChange={e => setPricingForm(f => ({ ...f, base_price_returning: e.target.value }))} />
          </div>
        </div>
        <GlassButton variant="primary" size="md" className="mt-4" loading={savingPrice} onClick={handleSavePricing}>Save Pricing</GlassButton>
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
            return (
              <label key={value} className={`relative cursor-pointer rounded-lg border p-3 transition-all ${uploaded ? 'border-success/50 bg-success/5' : 'border-dashed border-border hover:border-primary/50'}`}>
                <input type="file" className="hidden" accept={value === 'terms_pdf' ? '.pdf' : 'image/*'}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleAssetUpload(value, f); }} />
                {uploadingAsset === value ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Uploading...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-2">
                    {previewUrl && value !== 'terms_pdf' ? (
                      <img src={previewUrl} alt={label} className="w-12 h-12 object-cover rounded" />
                    ) : (
                      <Icon className={`h-6 w-6 ${uploaded ? 'text-success' : 'text-muted-foreground'}`} />
                    )}
                    <span className="text-xs text-center text-muted-foreground">{label}</span>
                    {uploaded && <span className="text-xs text-success">✓ Uploaded</span>}
                  </div>
                )}
              </label>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
