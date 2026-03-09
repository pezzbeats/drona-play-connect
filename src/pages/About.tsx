import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, MapPin, Phone, Mail, FileText,
  Shield, Truck, Tag, CalendarCheck, AlertTriangle, Info,
} from 'lucide-react';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { useSiteConfig } from '@/hooks/useSiteConfig';

const LEGAL_LINKS = [
  { to: '/privacy',      label: 'Privacy Policy',         icon: Shield },
  { to: '/terms',        label: 'Terms & Conditions',      icon: FileText },
  { to: '/refund-policy',label: 'Refund & Cancellation',   icon: Tag },
  { to: '/shipping',     label: 'Shipping / Delivery',     icon: Truck },
  { to: '/pricing',      label: 'Pricing Policy',          icon: Tag },
  { to: '/contact',      label: 'Contact Us',              icon: Phone },
  { to: '/event-terms',  label: 'Event Participation',     icon: CalendarCheck },
  { to: '/disclaimer',   label: 'Disclaimer',              icon: AlertTriangle },
];

export default function AboutPage() {
  const { get } = useSiteConfig();

  const companyName = get('footer_company_name', 'SR LEISURE INN');
  const gstin       = get('footer_gstin', 'ABOFS1823N1ZS');
  const address     = get('footer_address', 'Jaitpur Turn, Bazpur Road, Kashipur, Uttarakhand');
  const phone       = get('footer_phone', '7217016170');
  const email       = get('footer_email', 'dronapalace@gmail.com');
  const venue       = get('register_header_venue', 'Hotel Drona Palace');
  const aboutText   = get('footer_about_text', 'Hotel Drona Palace is a premium hospitality destination offering curated event experiences and luxury services in Kashipur, Uttarakhand.');

  return (
    <div className="min-h-screen relative overflow-hidden">
      <BackgroundOrbs />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">

        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        {/* Hero */}
        <GlassCard variant="elevated" className="p-6 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/15 mb-4">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text mb-2">About Us</h1>
          <p className="text-sm text-muted-foreground font-medium">
            {companyName} · {venue}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Hospitality &amp; curated event experiences — Kashipur, Uttarakhand
          </p>
        </GlassCard>

        {/* Business Identity — most important for gateway review */}
        <GlassCard className="p-5 mb-4 border border-secondary/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-secondary/15 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-secondary" />
            </div>
            <h2 className="font-display text-base font-bold text-foreground">Business Identity</h2>
          </div>
          <dl className="space-y-2.5 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
              <dt className="text-muted-foreground w-36 flex-shrink-0">Legal Name</dt>
              <dd className="text-foreground font-bold text-base">{companyName}</dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
              <dt className="text-muted-foreground w-36 flex-shrink-0">Brand / Venue</dt>
              <dd className="text-foreground/90 font-medium">{venue}</dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
              <dt className="text-muted-foreground w-36 flex-shrink-0">GSTIN</dt>
              <dd>
                <span className="font-mono text-secondary font-semibold select-all bg-secondary/10 px-2 py-0.5 rounded text-sm">
                  {gstin}
                </span>
              </dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
              <dt className="text-muted-foreground w-36 flex-shrink-0">Industry</dt>
              <dd className="text-foreground/80">Hospitality &amp; Entertainment Events</dd>
            </div>
            <div className="flex flex-col sm:flex-row gap-1 sm:gap-3">
              <dt className="text-muted-foreground w-36 flex-shrink-0">Registered Address</dt>
              <dd className="text-foreground/80 leading-relaxed border-l-2 border-primary/30 pl-3">
                {address}
              </dd>
            </div>
          </dl>
        </GlassCard>

        {/* What We Do */}
        <GlassCard className="p-5 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-base font-bold text-foreground">What We Do</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{aboutText}</p>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-none">
            {[
              '🏏 Live T20 cricket screening events with interactive fan experiences',
              '🎟️ Digital ticketing and QR-based entry management',
              '🏆 Fun Guess Game — real-time ball-by-ball prediction game for event attendees',
              '🍽️ Curated hospitality packages including food & beverage',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">{item}</li>
            ))}
          </ul>
        </GlassCard>

        {/* Contact */}
        <GlassCard className="p-5 mb-4">
          <h2 className="font-display text-base font-bold text-foreground mb-4">Contact Details</h2>
          <div className="space-y-4">
            <a href={`tel:${phone}`} className="flex items-start gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/25 transition-colors">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone / WhatsApp</p>
                <p className="text-foreground font-semibold group-hover:text-primary transition-colors">
                  +91 {phone.slice(0, 5)} {phone.slice(5)}
                </p>
              </div>
            </a>
            <a href={`mailto:${email}`} className="flex items-start gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/25 transition-colors">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-foreground font-semibold group-hover:text-primary transition-colors">{email}</p>
              </div>
            </a>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-foreground font-semibold leading-relaxed">{address}</p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Compliance & Legal — 2×4 chip grid */}
        <GlassCard className="p-5 mb-6">
          <h2 className="font-display text-base font-bold text-foreground mb-4">Legal &amp; Compliance</h2>
          <div className="grid grid-cols-2 gap-2">
            {LEGAL_LINKS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2 border border-border/50 rounded-lg px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0 text-primary/60" />
                {label}
              </Link>
            ))}
          </div>
        </GlassCard>

        {/* CTA */}
        <div className="text-center space-y-3">
          <Link to="/register">
            <GlassButton variant="primary" size="lg">
              Register for the Event
            </GlassButton>
          </Link>
          <p className="text-xs text-muted-foreground">
            {companyName} · GSTIN: <span className="font-mono select-all">{gstin}</span> · Kashipur, Uttarakhand
          </p>
        </div>

      </div>
    </div>
  );
}
