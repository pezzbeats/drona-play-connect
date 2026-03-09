import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Building2 } from 'lucide-react';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import hotelLogo from '@/assets/hotel-logo.png';

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
    <footer className="relative z-10 mt-2" style={{ background: 'hsl(var(--card) / 0.6)', borderTop: '1px solid hsl(var(--border) / 0.5)' }}>
      {/* Top shimmer accent */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />

      <div className="max-w-5xl mx-auto px-4 pt-10 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">

          {/* Col 1 — About Organiser */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full"
                style={{ background: 'hsl(38 60% 10%)', border: '1.5px solid hsl(38 75% 52% / 0.55)', boxShadow: '0 0 14px hsl(38 75% 52% / 0.45)' }}>
                <img src={hotelLogo} alt="Hotel Drona Palace" className="w-7 h-7 object-contain" style={{ filter: 'drop-shadow(0 0 4px hsl(38 75% 52% / 0.8))' }} />
              </div>
              <div>
                <p className="font-display font-bold text-base gradient-text leading-tight">{heroTitle}</p>
                <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Hotel Drona Palace</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              {aboutText}
            </p>
            <a
              href="https://dronapalace.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-bold transition-all hover:opacity-80"
              style={{ color: 'hsl(var(--secondary))' }}
            >
              <span>🌐</span>
              dronapalace.com
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
            </a>
          </div>

          {/* Col 2 — Legal Information */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider flex items-center gap-1.5 mb-4"
              style={{ color: 'hsl(var(--secondary))' }}>
              <Building2 className="h-4 w-4" style={{ color: 'hsl(var(--secondary))' }} />
              Legal Info
            </h4>
            <div className="space-y-2 text-sm">
              <p className="font-bold text-foreground">{companyName}</p>
              <p className="text-muted-foreground">
                GSTIN: <span className="font-mono font-semibold" style={{ color: 'hsl(var(--secondary))' }}>{gstin}</span>
              </p>
              <div className="pt-1 flex items-start gap-2">
                <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'hsl(var(--primary))' }} />
                <address className="not-italic text-muted-foreground leading-relaxed text-sm">
                  {address}
                </address>
              </div>
            </div>
          </div>

          {/* Col 3 — Contact */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-4"
              style={{ color: 'hsl(var(--secondary))' }}>
              Contact
            </h4>
            <div className="space-y-3 text-sm">
              <a
                href={`tel:${phone}`}
                className="flex items-center gap-2 transition-colors hover:text-foreground"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                <Phone className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
                <span>+91 {phone.slice(0, 5)} {phone.slice(5)}</span>
              </a>
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-2 transition-colors hover:text-foreground"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                <Mail className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
                <span>{email}</span>
              </a>
            </div>
          </div>

          {/* Col 4 — Legal Pages */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider flex items-center gap-1.5 mb-4"
              style={{ color: 'hsl(var(--secondary))' }}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'hsl(var(--primary))' }} />
              Legal &amp; Policies
            </h4>
            <nav className="space-y-2 text-sm">
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
                  className="block py-0.5 transition-colors hover:underline"
                  style={{ color: 'hsl(var(--muted-foreground))' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'hsl(var(--primary))')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'hsl(var(--muted-foreground))')}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm"
          style={{ borderTop: '1px solid hsl(var(--border) / 0.4)', color: 'hsl(var(--muted-foreground))' }}>
          <p>{copyright}</p>
          <p className="text-center">
            Hospitality event by{' '}
            <span className="font-semibold text-foreground">{get('register_header_venue', 'Hotel Drona Palace')}, Kashipur</span>
          </p>
        </div>
      </div>
    </footer>
  );
};
