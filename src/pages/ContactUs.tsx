import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Phone, Mail, Clock, MessageCircle,
  Ticket, CreditCard, CalendarCheck, HelpCircle, Building2,
} from 'lucide-react';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { MobileBreadcrumb } from '@/components/ui/MobileBreadcrumb';

const SupportCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <GlassCard className="p-5 mb-4">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <h2 className="font-display text-base font-bold text-foreground">{title}</h2>
    </div>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-1.5">{children}</div>
  </GlassCard>
);

export default function ContactUsPage() {
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
            <MessageCircle className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text mb-2">Contact Us</h1>
          <p className="text-sm text-muted-foreground">
            SR LEISURE INN · Hotel Drona Palace, Kashipur
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            We're here to help — reach out for any booking or event queries.
          </p>
        </GlassCard>

        {/* Business Identity */}
        <GlassCard className="p-5 mb-4 border border-border/50">
          <div className="flex items-center gap-3 mb-3">
            <Building2 className="h-5 w-5 text-secondary" />
            <h2 className="font-display text-base font-bold text-foreground">Operated By</h2>
          </div>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p className="text-foreground font-semibold text-base">SR LEISURE INN</p>
            <p>Brand / Venue: <span className="text-foreground/80 font-medium">Hotel Drona Palace</span></p>
            <p>GSTIN: <span className="font-mono text-secondary/80 select-all">ABOFS1823N1ZS</span></p>
            <p>Registered Address:</p>
            <p className="pl-3 border-l border-primary/30 text-foreground/70 leading-relaxed">
              Jaitpur Turn, Bazpur Road<br />
              Kashipur, Uttarakhand
            </p>
          </div>
        </GlassCard>

        {/* Primary Contact Info */}
        <GlassCard className="p-5 mb-4">
          <h2 className="font-display text-base font-bold text-foreground mb-4">Get in Touch</h2>
          <div className="space-y-4">
            <a href="tel:7217016170" className="flex items-start gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/25 transition-colors">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone / WhatsApp</p>
                <p className="text-foreground font-semibold group-hover:text-primary transition-colors">
                  +91 72170 16170
                </p>
                <p className="text-xs text-muted-foreground/70">Tap to call or WhatsApp</p>
              </div>
            </a>

            <a href="mailto:dronapalace@gmail.com" className="flex items-start gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/25 transition-colors">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-foreground font-semibold group-hover:text-primary transition-colors">
                  dronapalace@gmail.com
                </p>
                <p className="text-xs text-muted-foreground/70">We respond within 1–2 business days</p>
              </div>
            </a>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-foreground font-semibold">Jaitpur Turn, Bazpur Road</p>
                <p className="text-muted-foreground text-sm">Kashipur, Uttarakhand</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Support Hours</p>
                <p className="text-foreground font-semibold">10:00 AM – 9:00 PM</p>
                <p className="text-muted-foreground text-sm">All days · Extended on event days</p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Ticketing Support */}
        <SupportCard icon={<Ticket className="h-4 w-4 text-primary" />} title="Ticketing Support">
          <p>For issues with booking, digital pass access, or entry QR codes:</p>
          <ul className="list-disc list-inside space-y-1 mt-1.5">
            <li>Share your registered mobile number and booking reference</li>
            <li>Access your passes anytime at the <Link to="/ticket" className="text-primary underline">/ticket</Link> page</li>
            <li>For pass re-issue queries, contact us via email with your booking details</li>
            <li>On event day, gate staff can assist with pass verification in person</li>
          </ul>
        </SupportCard>

        {/* Payment Support */}
        <SupportCard icon={<CreditCard className="h-4 w-4 text-primary" />} title="Payment Support">
          <p>For payment-related issues including failed transactions, duplicate charges, or refund requests:</p>
          <ul className="list-disc list-inside space-y-1 mt-1.5">
            <li>
              <strong className="text-foreground/80">Razorpay payments:</strong> Share your Razorpay Payment ID and
              Order ID — we'll reconcile and resolve within 2 business hours on event days
            </li>
            <li>
              <strong className="text-foreground/80">UPI screenshot verification:</strong> If your payment proof
              is pending review, please wait up to 30 minutes before contacting us
            </li>
            <li>
              <strong className="text-foreground/80">Refund requests:</strong> Must be raised in writing via email
              — see our{' '}
              <Link to="/refund-policy" className="text-primary underline">Refund & Cancellation Policy</Link>
            </li>
            <li>Payment disputes must include your mobile number, amount paid, and payment reference number</li>
          </ul>
        </SupportCard>

        {/* Event Information */}
        <SupportCard icon={<CalendarCheck className="h-4 w-4 text-primary" />} title="Event Information">
          <p>For queries about upcoming events, match dates, venue arrangements, or hospitality packages:</p>
          <ul className="list-disc list-inside space-y-1 mt-1.5">
            <li>Visit the home page for the latest event announcements and registration details</li>
            <li>Call or WhatsApp us for real-time event status and seating availability</li>
            <li>
              Event details including food & beverage inclusions, seating type, and timing are displayed
              on the registration page before checkout
            </li>
            <li>Check our{' '}
              <Link to="/event-terms" className="text-primary underline">Event Participation Terms</Link>{' '}
              for venue policies, entry requirements, and the Fun Guess Game rules
            </li>
          </ul>
        </SupportCard>

        {/* General Inquiries */}
        <SupportCard icon={<HelpCircle className="h-4 w-4 text-primary" />} title="General Inquiries">
          <p>For all other queries — partnerships, media, group bookings, or feedback:</p>
          <ul className="list-disc list-inside space-y-1 mt-1.5">
            <li>Email us at <a href="mailto:dronapalace@gmail.com" className="text-primary underline">dronapalace@gmail.com</a> with a clear subject line</li>
            <li>Group bookings of 10+ guests may be eligible for special arrangements — contact us in advance</li>
            <li>Corporate or partnership inquiries are welcome via email</li>
            <li>
              For legal / compliance queries, include your full name, organisation, and nature of inquiry
            </li>
          </ul>
        </SupportCard>

        {/* Legal Links */}
        <GlassCard className="p-5 mb-6">
          <h2 className="font-display text-base font-bold text-foreground mb-3">Helpful Links</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              { to: '/privacy', label: 'Privacy Policy' },
              { to: '/terms', label: 'Terms & Conditions' },
              { to: '/refund-policy', label: 'Refund & Cancellation' },
              { to: '/shipping', label: 'Delivery Policy' },
              { to: '/pricing', label: 'Pricing Policy' },
              { to: '/event-terms', label: 'Event Participation' },
              { to: '/disclaimer', label: 'Disclaimer & Fair Use' },
              { to: '/ticket', label: 'View My Passes' },
            ].map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="text-muted-foreground hover:text-primary transition-colors py-0.5"
              >
                → {label}
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
            SR LEISURE INN · GSTIN: ABOFS1823N1ZS · Kashipur, Uttarakhand
          </p>
        </div>

      </div>
    </div>
  );
}
