import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Building2 } from 'lucide-react';
import { useSiteConfig } from '@/hooks/useSiteConfig';

export const LandingFooter: React.FC = () => {
  const { get } = useSiteConfig();

  const companyName = get('footer_company_name', 'SR LEISURE INN');
  const gstin = get('footer_gstin', 'ABOFS1823N1ZS');
  const address = get('footer_address', 'Jaitpur Turn, Bazpur Road, Kashipur, Uttarakhand');
  const phone = get('footer_phone', '7217016170');
  const email = get('footer_email', 'dronapalace@gmail.com');
  const copyright = get('footer_copyright', '© 2026 SR LEISURE INN. All Rights Reserved.');
  const aboutText = get('footer_about_text', 'Hotel Drona Palace is a premium hospitality destination offering curated event experiences and luxury services in Kashipur, Uttarakhand.');
  const heroTitle = get('hero_title', 'T20 Fan Night');

  return (
    <footer className="relative z-10 border-t border-border/40 mt-2">
      {/* Top gradient accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">

          {/* Col 1 — About Organiser */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🏏</span>
              <span className="font-display font-bold text-lg gradient-text">{heroTitle}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {aboutText}
            </p>
          </div>

          {/* Col 2 — Legal Information */}
          <div>
            <h4 className="font-display font-bold text-sm text-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-secondary" />
              Legal Info
            </h4>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p className="text-foreground/80 font-semibold">{companyName}</p>
              <p>GSTIN: <span className="font-mono text-secondary/80">{gstin}</span></p>
              <div className="pt-1 flex items-start gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                <address className="not-italic leading-relaxed">
                  {address}
                </address>
              </div>
            </div>
          </div>

          {/* Col 3 — Contact */}
          <div>
            <h4 className="font-display font-bold text-sm text-foreground mb-3 uppercase tracking-wider">
              Contact
            </h4>
            <div className="space-y-2.5 text-xs text-muted-foreground">
              <a
                href={`tel:${phone}`}
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Phone className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span>+91 {phone.slice(0, 5)} {phone.slice(5)}</span>
              </a>
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Mail className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span>{email}</span>
              </a>
            </div>
          </div>

          {/* Col 4 — Legal Pages */}
          <div>
            <h4 className="font-display font-bold text-sm text-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-primary/70" />
              Legal &amp; Policies
            </h4>
            <nav className="space-y-2 text-xs">
              {[
                { to: '/about', label: 'About Us' },
                { to: '/privacy', label: 'Privacy Policy' },
                { to: '/terms', label: 'Terms & Conditions' },
                { to: '/refund-policy', label: 'Refund & Cancellation' },
                { to: '/shipping', label: 'Shipping / Delivery' },
                { to: '/pricing', label: 'Pricing Policy' },
                { to: '/contact', label: 'Contact Us' },
                { to: '/event-terms', label: 'Event Terms' },
                { to: '/disclaimer', label: 'Disclaimer' },
              ].map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className="block text-muted-foreground hover:text-primary transition-colors py-0.5 hover:underline"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground/60">
          <p>{copyright}</p>
          <p className="text-center">
            Hospitality event by{' '}
            <span className="text-muted-foreground font-medium">{get('register_header_venue', 'Hotel Drona Palace')}, Kashipur</span>
          </p>
        </div>
      </div>
    </footer>
  );
};
