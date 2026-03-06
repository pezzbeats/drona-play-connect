import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { GlassCard } from '@/components/ui/GlassCard';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <GlassCard className="p-5 mb-4">
    <h2 className="font-display text-lg font-bold text-foreground mb-3">{title}</h2>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
  </GlassCard>
);

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <BackgroundOrbs />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">

        {/* Back button */}
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        {/* Header */}
        <GlassCard variant="elevated" className="p-6 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/15 mb-4">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">SR LEISURE INN · Effective Date: 1 January 2026</p>
        </GlassCard>

        <Section title="1. Introduction">
          <p>
            SR LEISURE INN ("we", "our", "us"), operating Hotel Drona Palace, Kashipur, respects your privacy and is
            committed to protecting the personal information you share with us when registering for T20 Fan Night events.
          </p>
          <p>
            This Privacy Policy explains what data we collect, how we use it, and the steps we take to protect it.
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <p>When you register for an event, we collect:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li><strong className="text-foreground/80">Full Name</strong> — for your entry pass and booking records</li>
            <li><strong className="text-foreground/80">Mobile Number</strong> — for booking confirmation and entry verification</li>
            <li><strong className="text-foreground/80">Email Address</strong> (optional) — for digital receipt and communication</li>
            <li><strong className="text-foreground/80">Payment Proof Image</strong> — UPI screenshot or transaction reference for payment verification</li>
            <li><strong className="text-foreground/80">Seat Preference</strong> — for event logistics</li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul className="list-disc list-inside space-y-1">
            <li>To process your booking and issue digital entry passes (QR codes)</li>
            <li>To verify payment and manage attendee records</li>
            <li>To facilitate check-in at the venue</li>
            <li>To enable participation in the Fun Guess Game at the event</li>
            <li>To contact you about your booking, event updates, or cancellations</li>
          </ul>
        </Section>

        <Section title="4. Data Storage & Security">
          <p>
            Your data is stored securely on encrypted servers. Access to your personal information is restricted to
            authorised event staff only. We implement industry-standard security measures to protect your information
            against unauthorised access, disclosure, or loss.
          </p>
          <p>
            Payment proof images are stored only for the purpose of payment verification and are not shared or
            used for any other purpose.
          </p>
        </Section>

        <Section title="5. Data Retention">
          <p>
            We retain your personal data for a period of 12 months from the event date for record-keeping and
            dispute resolution purposes. After this period, data is securely deleted or anonymised.
          </p>
        </Section>

        <Section title="6. No Third-Party Sale or Sharing">
          <p>
            We do <strong className="text-foreground/80">not sell, rent, or trade</strong> your personal information to
            any third party for commercial purposes. Your data will not be shared with marketing agencies, data brokers,
            or other commercial entities.
          </p>
          <p>
            Data may only be shared in the following limited circumstances:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>With payment processors solely to verify transactions</li>
            <li>When required by law or a court order</li>
            <li>To protect the safety and security of event attendees</li>
          </ul>
        </Section>

        <Section title="7. Your Rights">
          <p>You have the right to:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Request access to the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data (subject to legal obligations)</li>
          </ul>
          <p className="mt-2">
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:dronapalace@gmail.com" className="text-primary underline">dronapalace@gmail.com</a>.
          </p>
        </Section>

        <Section title="8. Contact Us">
          <p>SR LEISURE INN</p>
          <p>Jaitpur Turn, Bazpur Road, Kashipur, Uttarakhand</p>
          <p>Email: <a href="mailto:dronapalace@gmail.com" className="text-primary underline">dronapalace@gmail.com</a></p>
          <p>Phone: <a href="tel:7217016170" className="text-primary underline">+91 72170 16170</a></p>
        </Section>

      </div>
    </div>
  );
}
