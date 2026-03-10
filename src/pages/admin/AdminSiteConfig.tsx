import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GlassButton } from '@/components/ui/GlassButton';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, Globe, Star, Shield, BookOpen, Building2, Save, Lock } from 'lucide-react';

type ConfigMap = Record<string, string>;

interface SectionField {
  key: string;
  label: string;
  multiline?: boolean;
  placeholder?: string;
}

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  fields: SectionField[];
}

const SECTIONS: Section[] = [
  {
    id: 'landing',
    title: 'Landing Page — Hero',
    icon: Globe,
    fields: [
      { key: 'hero_title', label: 'Hero Title', placeholder: 'Cricket Fan Night' },
      { key: 'hero_subtitle', label: 'Hero Subtitle', placeholder: 'An Exclusive Cricket Celebration Experience' },
      { key: 'hero_venue_badge', label: 'Venue Badge Text', placeholder: 'Hosted at Hotel Drona Palace, Kashipur' },
    ],
  },
  {
    id: 'features',
    title: 'Event Feature Cards',
    icon: Star,
    fields: [
      { key: 'feature_1_label', label: 'Feature 1 — Label' },
      { key: 'feature_1_desc', label: 'Feature 1 — Description', multiline: true },
      { key: 'feature_2_label', label: 'Feature 2 — Label' },
      { key: 'feature_2_desc', label: 'Feature 2 — Description', multiline: true },
      { key: 'feature_3_label', label: 'Feature 3 — Label' },
      { key: 'feature_3_desc', label: 'Feature 3 — Description', multiline: true },
      { key: 'feature_4_label', label: 'Feature 4 — Label' },
      { key: 'feature_4_desc', label: 'Feature 4 — Description', multiline: true },
    ],
  },
  {
    id: 'trust',
    title: 'Trust Strip ("Why Attend?")',
    icon: Shield,
    fields: [
      { key: 'trust_1_label', label: 'Trust Item 1' },
      { key: 'trust_2_label', label: 'Trust Item 2' },
      { key: 'trust_3_label', label: 'Trust Item 3' },
      { key: 'trust_4_label', label: 'Trust Item 4' },
    ],
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers',
    icon: Shield,
    fields: [
      { key: 'disclaimer_bar_text', label: 'Top Disclaimer Bar Text', multiline: true },
      { key: 'legal_disclaimer_title', label: 'Legal Disclaimer Title' },
      { key: 'legal_disclaimer_body', label: 'Legal Disclaimer Body', multiline: true },
    ],
  },
  {
    id: 'registration',
    title: 'Registration Page',
    icon: BookOpen,
    fields: [
      { key: 'register_header_title', label: 'Header Title', placeholder: 'Cricket Fan Night' },
      { key: 'register_header_venue', label: 'Header Venue Line', placeholder: 'Hotel Drona Palace' },
      { key: 'payment_payee_name', label: 'UPI Payee Name', placeholder: 'Hotel Name' },
    ],
  },
  {
    id: 'footer',
    title: 'Footer & Legal Info',
    icon: Building2,
    fields: [
      { key: 'footer_about_text', label: 'About Blurb', multiline: true },
      { key: 'footer_company_name', label: 'Company / Legal Name' },
      { key: 'footer_gstin', label: 'GSTIN' },
      { key: 'footer_address', label: 'Address', multiline: true },
      { key: 'footer_phone', label: 'Phone Number' },
      { key: 'footer_email', label: 'Email Address' },
      { key: 'footer_copyright', label: 'Copyright Line' },
    ],
  },
  {
    id: 'coupons',
    title: 'Victory Coupons',
    icon: Star,
    fields: [
      { key: 'coupon_win_headline', label: 'Win Headline', placeholder: 'INDIA WON!' },
      { key: 'coupon_event_subtitle', label: 'Coupon Subtitle Line', placeholder: 'T20 World Cup Final  ·  India vs New Zealand' },
      { key: 'coupon_event_night_label', label: 'Footer \u201cattended the ___\u201d label', placeholder: 'T20 World Cup Final Night' },
    ],
  },
];

export default function AdminSiteConfig() {
  const { toast } = useToast();
  const [config, setConfig] = useState<ConfigMap>({});
  const [loadingInit, setLoadingInit] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoadingInit(true);
    const { data } = await supabase.from('site_config').select('key, value');
    if (data) {
      const map: ConfigMap = {};
      data.forEach(r => { map[r.key] = r.value; });
      setConfig(map);
    }
    setLoadingInit(false);
  };

  const handleChange = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const saveSection = async (section: Section) => {
    setSavingSection(section.id);
    const upserts = section.fields.map(f => ({
      key: f.key,
      value: config[f.key] ?? '',
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('site_config')
      .upsert(upserts, { onConflict: 'key' });
    if (error) {
      toast({ variant: 'destructive', title: 'Save failed', description: error.message });
    } else {
      toast({ title: `✅ "${section.title}" saved`, description: 'Changes are live immediately.' });
    }
    setSavingSection(null);
  };

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Site Content</h1>
          <p className="text-sm text-muted-foreground">Edit all customer-visible text from one place</p>
        </div>
      </div>

      {SECTIONS.map(section => {
        const Icon = section.icon;
        const isSaving = savingSection === section.id;
        return (
          <GlassCard key={section.id} className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-secondary/15 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-secondary" />
                </div>
                <h2 className="font-display font-bold text-base text-foreground">{section.title}</h2>
              </div>
              <GlassButton
                variant="primary"
                size="sm"
                onClick={() => saveSection(section)}
                loading={isSaving}
                disabled={isSaving}
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save
              </GlassButton>
            </div>

            <div className="space-y-4">
              {/* Locked VPA field shown only in the registration section */}
              {section.id === 'registration' && (
                <div>
                  <Label className="text-foreground mb-1.5 block text-sm">
                    UPI VPA (Payment Address)
                  </Label>
                  <div className="relative">
                    <Input
                      className="glass-input text-sm pr-10 opacity-60 cursor-not-allowed"
                      value={config['payment_vpa'] ?? 'paytmqr5oka4x@ptys'}
                      readOnly
                      disabled
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    This field is system-locked and cannot be changed from the admin panel.
                  </p>
                </div>
              )}

              {section.fields.map(field => (
                <div key={field.key}>
                  <Label className="text-foreground mb-1.5 block text-sm">{field.label}</Label>
                  {field.multiline ? (
                    <Textarea
                      className="glass-input resize-none text-sm"
                      rows={3}
                      placeholder={field.placeholder}
                      value={config[field.key] ?? ''}
                      onChange={e => handleChange(field.key, e.target.value)}
                    />
                  ) : (
                    <Input
                      className="glass-input text-sm"
                      placeholder={field.placeholder}
                      value={config[field.key] ?? ''}
                      onChange={e => handleChange(field.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
