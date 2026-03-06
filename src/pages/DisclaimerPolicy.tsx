import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { GlassCard } from '@/components/ui/GlassCard';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <GlassCard className="p-5 mb-4">
    <h2 className="font-display text-lg font-bold text-foreground mb-3">{title}</h2>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
  </GlassCard>
);

export default function DisclaimerPolicyPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <BackgroundOrbs />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">

        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <GlassCard variant="elevated" className="p-6 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-warning/15 mb-4">
            <Info className="h-7 w-7 text-warning" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text mb-2">Disclaimer & Fair Use Policy</h1>
          <p className="text-sm text-muted-foreground">SR LEISURE INN · Effective Date: 1 January 2026</p>
        </GlassCard>

        <Section title="1. Fun Guess Game — Not Gambling">
          <p>
            The Fun Guess Game offered at T20 Fan Night events organised by SR LEISURE INN is a{' '}
            <strong className="text-foreground/80">recreational entertainment activity</strong> designed to enhance
            the enjoyment of the live cricket screening experience.
          </p>
          <p>
            This activity is <strong className="text-foreground/80">NOT gambling, betting, wagering, or any form of
            chance-based activity involving real money</strong>. Specifically:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>No money is staked by any participant on any game outcome</li>
            <li>No money is won by any participant based on game predictions</li>
            <li>The game carries no monetary value and involves no financial risk</li>
            <li>Participation is entirely voluntary and free of charge</li>
          </ul>
        </Section>

        <Section title="2. Nature of Payments">
          <p>
            All fees paid to SR LEISURE INN are exclusively for <strong className="text-foreground/80">hospitality
            services</strong>, which include:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Venue access and seating at Hotel Drona Palace</li>
            <li>Food and beverage service during the event</li>
            <li>Event management, staffing, and logistics</li>
            <li>Digital entry pass generation and management</li>
          </ul>
          <p>
            No portion of any fee paid constitutes a stake, wager, bet, or buy-in for the Fun Guess Game.
          </p>
        </Section>

        <Section title="3. No Cash Prizes">
          <p>
            SR LEISURE INN does not offer, promise, or distribute{' '}
            <strong className="text-foreground/80">cash prizes, monetary rewards, or any financial benefit</strong>{' '}
            as a result of Fun Guess Game participation or leaderboard standings.
          </p>
          <p>
            Any recognition or rewards offered are entirely at the organiser's discretion and are of a
            non-monetary, symbolic nature only (such as certificates, trophies, or complimentary hospitality).
          </p>
        </Section>

        <Section title="4. Legal Compliance">
          <p>
            SR LEISURE INN operates in full compliance with all applicable laws of India, including but not limited to
            the Public Gambling Act, 1867, and relevant state gaming regulations. The Fun Guess Game has been designed
            specifically to avoid any feature that could be classified as gambling under Indian law.
          </p>
          <p>
            If you have concerns about the legal status of any event activity, please contact us before attending.
          </p>
        </Section>

        <Section title="5. Event Broadcast Disclaimer">
          <p>
            T20 Fan Night events feature live screening of cricket matches broadcast by authorised broadcasters.
            SR LEISURE INN does not own or control any rights to the cricket content being screened.
          </p>
          <p>
            Match schedules, broadcast availability, and match outcomes are entirely outside the control of
            SR LEISURE INN. No liability is accepted for changes to broadcast schedules or match cancellations
            by the broadcaster or cricket governing body.
          </p>
        </Section>

        <Section title="6. Organiser Liability Limits">
          <p>To the maximum extent permitted by applicable law, SR LEISURE INN expressly excludes liability for:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Any loss or damage arising from participation in the Fun Guess Game</li>
            <li>Technical failures of the prediction platform or leaderboard system</li>
            <li>Outcomes or results of cricket matches</li>
            <li>Decisions made by attendees based on event information or game outcomes</li>
            <li>Any indirect, incidental, or consequential losses</li>
          </ul>
        </Section>

        <Section title="7. Fair Use of Digital Systems">
          <p>
            The digital prediction platform and entry management system are provided for the exclusive use of
            registered event attendees. Any attempt to:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Reverse engineer, hack, or manipulate the platform</li>
            <li>Use automated systems or bots to submit predictions</li>
            <li>Share or misuse entry QR codes</li>
            <li>Impersonate another registered attendee</li>
          </ul>
          <p className="mt-2">
            ...constitutes a breach of these terms and may result in immediate removal from the event, forfeiture
            of hospitality fees, and potential legal action.
          </p>
        </Section>

        <Section title="8. Accuracy of Information">
          <p>
            While SR LEISURE INN makes every effort to ensure that all event information on this platform is
            accurate and up to date, we do not guarantee the completeness or accuracy of all information
            displayed. Event details including dates, times, and venue may be subject to change.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>SR LEISURE INN</p>
          <p>Jaitpur Turn, Bazpur Road, Kashipur, Uttarakhand</p>
          <p>Email: <a href="mailto:dronapalace@gmail.com" className="text-primary underline">dronapalace@gmail.com</a></p>
          <p>Phone: <a href="tel:7217016170" className="text-primary underline">+91 72170 16170</a></p>
          <p>GSTIN: ABOFS1823N1ZS</p>
        </Section>

      </div>
    </div>
  );
}
