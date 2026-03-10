import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { GlassCard } from '@/components/ui/GlassCard';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <GlassCard className="p-5 mb-4">
    <h2 className="font-display text-lg font-bold text-foreground mb-3">{title}</h2>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
  </GlassCard>
);

export default function EventParticipationTermsPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <BackgroundOrbs />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">

        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <GlassCard variant="elevated" className="p-6 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/15 mb-4">
            <ClipboardList className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text mb-2">Event Participation Terms</h1>
          <p className="text-sm text-muted-foreground">SR LEISURE INN · Effective Date: 1 January 2026</p>
        </GlassCard>

        <Section title="1. Agreement to Terms">
          <p>
            By purchasing a hospitality package and attending any Cricket Fan Night event organised by SR LEISURE INN,
            you agree to be bound by these Event Participation Terms. Please read them carefully before attending.
          </p>
        </Section>

        <Section title="2. Entry Requirements">
          <ul className="list-disc list-inside space-y-1">
            <li>All attendees must present a valid digital entry pass (QR code) issued after confirmed booking</li>
            <li>Entry is strictly on a per-seat, per-person basis</li>
            <li>Passes are non-transferable unless explicitly approved by the organiser in writing</li>
            <li>Attendees must carry a valid government-issued photo ID for verification purposes</li>
            <li>The organiser reserves the right to deny entry to any person at its sole discretion</li>
          </ul>
        </Section>

        <Section title="3. Age Requirements">
          <p>
            The event is open to attendees of all ages. However, attendees under the age of 18 must be accompanied
            by a parent or legal guardian at all times. The organiser reserves the right to request age verification.
          </p>
        </Section>

        <Section title="4. Code of Conduct">
          <p>All attendees are expected to:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Behave in a respectful and courteous manner towards staff and fellow attendees</li>
            <li>Refrain from any disruptive, aggressive, or offensive behaviour</li>
            <li>Follow all instructions from event staff and security personnel</li>
            <li>Not engage in any illegal activity on the premises</li>
            <li>Consume food and beverages responsibly</li>
          </ul>
          <p className="mt-2">
            The organiser reserves the right to remove any attendee who violates the code of conduct without
            refund of hospitality fees.
          </p>
        </Section>

        <Section title="5. Fun Guess Game — Participation Rules">
          <ul className="list-disc list-inside space-y-1">
            <li>Participation in the Fun Guess Game is entirely voluntary</li>
            <li>The game is for entertainment purposes only — no monetary stakes are involved</li>
            <li>Access requires a valid registered mobile number and active event ticket</li>
            <li>Leaderboard standings and game outcomes are final as determined by the game system</li>
            <li>Any attempt to manipulate or cheat the system may result in disqualification and removal from the event</li>
            <li>Prizes (if any) are non-cash recognition rewards at the organiser's discretion</li>
          </ul>
        </Section>

        <Section title="6. Photography & Recording">
          <p>
            By attending the event, you consent to being photographed or recorded as part of general event
            coverage. Such images or recordings may be used by SR LEISURE INN for promotional purposes on
            social media or marketing materials.
          </p>
          <p>
            Personal photography for private use is permitted. Commercial photography, live streaming, and
            unauthorised broadcast of the cricket match or event are strictly prohibited.
          </p>
        </Section>

        <Section title="7. Liability Waiver">
          <p>
            SR LEISURE INN and Hotel Drona Palace accept no liability for:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Loss, theft, or damage to personal belongings at the venue</li>
            <li>Personal injury sustained at the event unless caused by gross negligence of the organiser</li>
            <li>Technical issues affecting digital passes or the Fun Guess Game platform</li>
            <li>Disruptions caused by circumstances beyond the organiser's control (force majeure)</li>
            <li>Dissatisfaction with cricket match results or broadcast quality</li>
          </ul>
        </Section>

        <Section title="8. Health & Safety">
          <p>
            Attendees are expected to comply with all health and safety guidelines in place at the venue.
            The organiser reserves the right to implement additional safety measures at any time.
          </p>
        </Section>

        <Section title="9. Changes to Terms">
          <p>
            SR LEISURE INN reserves the right to update these terms at any time. The most current version will
            always be available on the event website. Continued participation in events constitutes acceptance
            of the updated terms.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>SR LEISURE INN</p>
          <p>Jaitpur Turn, Bazpur Road, Kashipur, Uttarakhand</p>
          <p>Email: <a href="mailto:dronapalace@gmail.com" className="text-primary underline">dronapalace@gmail.com</a></p>
          <p>Phone: <a href="tel:7217016170" className="text-primary underline">+91 72170 16170</a></p>
        </Section>

      </div>
    </div>
  );
}
