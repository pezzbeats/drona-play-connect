import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { GlassCard } from '@/components/ui/GlassCard';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <GlassCard className="p-5 mb-4">
    <h2 className="font-display text-lg font-bold text-foreground mb-3">{title}</h2>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
  </GlassCard>
);

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <BackgroundOrbs />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">

        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <GlassCard variant="elevated" className="p-6 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-secondary/15 mb-4">
            <RefreshCw className="h-7 w-7 text-secondary" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text-accent mb-2">Refund & Cancellation Policy</h1>
          <p className="text-sm text-muted-foreground">SR LEISURE INN · Effective Date: 1 January 2026</p>
        </GlassCard>

        <Section title="1. Important Note — Nature of Payment">
          <p>
            All payments made for Cricket Fan Night events are exclusively for <strong className="text-foreground/80">hospitality services</strong>,
            which include venue access, food and beverage service, and event arrangements. These are{' '}
            <strong className="text-foreground/80">not payments for tickets to a sports match</strong> and are not
            gambling or wagering fees.
          </p>
          <p>
            The Fun Guess Game is a free entertainment feature included with your hospitality booking and carries no
            separate monetary value.
          </p>
        </Section>

        <Section title="2. No Refund Policy (Post-Event)">
          <p>
            Once an event has taken place, <strong className="text-foreground/80">no refunds will be issued</strong> under any circumstances,
            including but not limited to:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Voluntary non-attendance</li>
            <li>Dissatisfaction with the match result</li>
            <li>Personal or travel emergencies</li>
            <li>Technical issues with personal devices</li>
          </ul>
        </Section>

        <Section title="3. No Refund — Pre-Event Cancellation by Attendee">
          <p>
            If an attendee wishes to cancel their booking prior to the event, the following policy applies:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li><strong className="text-foreground/80">More than 7 days before the event:</strong> 50% refund of the hospitality fee</li>
            <li><strong className="text-foreground/80">3–7 days before the event:</strong> No refund, but booking may be transferred to another person</li>
            <li><strong className="text-foreground/80">Less than 3 days before the event:</strong> No refund, no transfer</li>
          </ul>
          <p className="mt-2 text-xs italic">
            All cancellation requests must be made in writing via email to dronapalace@gmail.com.
          </p>
        </Section>

        <Section title="4. Full Refund — Organiser Cancellation">
          <p>
            In the event that SR LEISURE INN cancels or postpones an event for any reason (including but not limited to
            force majeure, venue unavailability, or broadcaster restrictions), a{' '}
            <strong className="text-foreground/80">full refund</strong> of the hospitality fee will be processed within{' '}
            <strong className="text-foreground/80">5 business days</strong> via the original payment method.
          </p>
          <p>
            Attendees will be notified via the registered mobile number as soon as any cancellation is confirmed.
          </p>
        </Section>

        <Section title="5. Match Postponement">
          <p>
            If a live cricket match is postponed or rescheduled by the broadcaster or cricket board, SR LEISURE INN
            will endeavour to adjust the event accordingly. Where the event cannot be rescheduled:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>A full refund will be offered for the hospitality fee paid</li>
            <li>Refunds will be processed within 5 business days</li>
          </ul>
        </Section>

        <Section title="6. Razorpay Gateway — Payments & Failed Transactions">
          <p>
            When paying via the Razorpay payment gateway:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li><strong className="text-foreground/80">Failed payment:</strong> If a transaction fails, no amount is charged. If an amount was deducted but passes were not issued, contact us within 24 hours with the Razorpay payment reference.</li>
            <li><strong className="text-foreground/80">Duplicate payment:</strong> If the same order is charged more than once due to a gateway error, the duplicate payment will be fully refunded within 5 business days.</li>
            <li><strong className="text-foreground/80">Gateway fees:</strong> SR LEISURE INN absorbs any payment gateway processing fees. These are not deducted from refunds.</li>
            <li><strong className="text-foreground/80">Refund method:</strong> Razorpay payments will be refunded back to the original payment instrument (card, UPI, wallet) used for the transaction.</li>
          </ul>
        </Section>

        <Section title="7. Refund Process">
          <p>To request a refund (where applicable), contact us at:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Email: <a href="mailto:dronapalace@gmail.com" className="text-primary underline">dronapalace@gmail.com</a></li>
            <li>Phone: <a href="tel:7217016170" className="text-primary underline">+91 72170 16170</a></li>
          </ul>
          <p className="mt-2">
            Please provide your booking reference number, registered mobile number, and (for Razorpay payments) your Razorpay payment ID when contacting us.
          </p>
        </Section>

        <Section title="8. Contact">
          <p>SR LEISURE INN</p>
          <p>Jaitpur Turn, Bazpur Road, Kashipur, Uttarakhand</p>
          <p>GSTIN: ABOFS1823N1ZS</p>
        </Section>

      </div>
    </div>
  );
}
