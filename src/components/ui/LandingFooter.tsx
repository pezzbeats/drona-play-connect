import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Building2 } from 'lucide-react';

export const LandingFooter: React.FC = () => (
  <footer className="relative z-10 border-t border-border/40 mt-2">
    {/* Top gradient accent line */}
    <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">

        {/* Col 1 — About Organiser */}
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🏏</span>
            <span className="font-display font-bold text-lg gradient-text">T20 Fan Night</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Hotel Drona Palace is a premium hospitality destination offering curated event experiences
            and luxury services in Kashipur, Uttarakhand.
          </p>
        </div>

        {/* Col 2 — Legal Information */}
        <div>
          <h4 className="font-display font-bold text-sm text-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-secondary" />
            Legal Info
          </h4>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p className="text-foreground/80 font-semibold">SR LEISURE INN</p>
            <p>GSTIN: <span className="font-mono text-secondary/80">ABOFS1823N1ZS</span></p>
            <div className="pt-1 flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
              <address className="not-italic leading-relaxed">
                Jaitpur Turn, Bazpur Road,<br />
                Kashipur, Uttarakhand
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
              href="tel:7217016170"
              className="flex items-center gap-2 hover:text-primary transition-colors"
            >
              <Phone className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span>+91 72170 16170</span>
            </a>
            <a
              href="mailto:dronapalace@gmail.com"
              className="flex items-center gap-2 hover:text-primary transition-colors"
            >
              <Mail className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span>dronapalace@gmail.com</span>
            </a>
          </div>
        </div>

        {/* Col 4 — Legal Pages */}
        <div>
          <h4 className="font-display font-bold text-sm text-foreground mb-3 uppercase tracking-wider">
            Policies
          </h4>
          <nav className="space-y-2 text-xs">
            {[
              { to: '/privacy', label: 'Privacy Policy' },
              { to: '/terms', label: 'Terms & Conditions' },
              { to: '/refund-policy', label: 'Refund & Cancellation' },
              { to: '/event-terms', label: 'Event Participation Terms' },
              { to: '/disclaimer', label: 'Disclaimer & Fair Use' },
            ].map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="block text-muted-foreground hover:text-primary transition-colors py-0.5"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="pt-6 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground/60">
        <p>© 2026 SR LEISURE INN. All Rights Reserved.</p>
        <p className="text-center">
          Hospitality event by{' '}
          <span className="text-muted-foreground font-medium">Hotel Drona Palace, Kashipur</span>
        </p>
      </div>
    </div>
  </footer>
);
