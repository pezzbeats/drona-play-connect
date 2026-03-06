import React from 'react';
import { Link } from 'react-router-dom';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { ArrowLeft, Shield, CreditCard, Camera, Gamepad2, Zap } from 'lucide-react';

interface TermsSection {
  icon: React.ReactNode;
  title: string;
  items: string[];
}

const sections: TermsSection[] = [
  {
    icon: <Shield className="h-5 w-5" />,
    title: 'Event Entry Terms',
    items: [
      'Entry is only permitted upon valid QR ticket scan at the gate.',
      'Each QR code is valid for one person per event. Do not share your QR code.',
      'Hotel Drona Palace reserves the right to refuse entry at its discretion.',
      'Attendees must follow all venue rules and staff instructions at all times.',
      'Tickets are non-transferable once issued. The name on the ticket must match the attendee.',
      'Tickets cannot be exchanged or refunded after the event has commenced.',
      'Children under 12 must be accompanied by a registered adult at all times.',
      'The organiser reserves the right to modify event schedule due to unforeseen circumstances.',
    ],
  },
  {
    icon: <CreditCard className="h-5 w-5" />,
    title: 'Payment & Refund Terms',
    items: [
      'All ticket prices are final and inclusive of applicable charges.',
      '"Pay at Hotel" bookings must be settled at the venue before entry. Unpaid bookings will be denied entry.',
      'UPI payments are verified automatically via AI. Manual verification may take up to 30 minutes.',
      'Razorpay gateway payments are confirmed instantly. Passes are generated automatically upon successful payment.',
      'Refunds are available only if the event is cancelled by the organiser.',
      'Partial refunds are not available for seat downgrades or unused seats.',
      'Payment disputes must be raised within 48 hours of the event date.',
      'For Razorpay payments: if payment is deducted but passes are not generated, contact us immediately with your payment reference. We will reconcile and issue passes within 2 business hours.',
      'All fees collected are for event hospitality services (venue, food & beverage, entertainment access) only.',
    ],
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: 'Razorpay Gateway Payments',
    items: [
      'When paying via Razorpay, you will be redirected to a secure Razorpay checkout — you may pay by card, UPI, net banking, or wallet.',
      'SR LEISURE INN does not store your card, CVV, or banking credentials. All payment data is handled by Razorpay directly.',
      'On successful Razorpay payment, passes are generated and available immediately — no screenshot upload is required.',
      'If a Razorpay payment fails or is cancelled, the booking remains unpaid. No charges are levied for failed transactions.',
      'In the rare event of a duplicate charge (same order charged twice), contact us at dronapalace@gmail.com with the Razorpay payment IDs. We will initiate a full refund of the duplicate amount within 5 business days.',
      'Razorpay gateway fees (if any) are absorbed by SR LEISURE INN and are not added to the displayed ticket price.',
    ],
  },
  {
    icon: <Camera className="h-5 w-5" />,
    title: 'Payment Proof Verification Terms',
    items: [
      'Uploaded payment screenshots are processed by an AI verification system.',
      'AI verification extracts transaction details (amount, date, UPI ID) from the screenshot.',
      'Screenshots must clearly show the transaction amount, date, and recipient details.',
      'Fraudulent payment proofs will result in immediate ticket cancellation and may be reported to authorities.',
      'The organiser reserves the right to manually override AI decisions in case of disputes.',
      'Payment proof images are stored securely and used only for verification purposes.',
      'Re-uploading a rejected proof with modifications constitutes fraud and is a punishable offence.',
    ],
  },
  {
    icon: <Gamepad2 className="h-5 w-5" />,
    title: 'Fun Guess Game Disclaimer',
    items: [
      'The "Fun Guess Game" is a free entertainment feature for registered attendees only.',
      'It is a game of prediction for entertainment purposes only — not a gambling, betting, or wagering activity.',
      'No real money is staked, won, or lost through the Fun Guess Game.',
      'Leaderboard rankings and points are for fun participation only. There is no cash prize.',
      'Any rewards or hospitality perks associated with high leaderboard positions are purely promotional and at the discretion of the organiser.',
      'Results of the guess game are final and based on live match data recorded by the scoring system.',
      'Participants must not attempt to manipulate or exploit the guess system in any way.',
      'The organiser reserves the right to disqualify participants for unsportsmanlike conduct or technical abuse.',
      'By participating, you confirm you are of legal age and understand this is a free entertainment feature only.',
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen relative">
      <BackgroundOrbs />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link to="/register">
            <GlassButton variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4" /> Back
            </GlassButton>
          </Link>
          <div className="text-center">
            <div className="text-4xl mb-2">📋</div>
            <h1 className="font-display text-3xl font-bold gradient-text">Terms & Conditions</h1>
            <p className="text-muted-foreground text-sm mt-2">T20 Fan Night · SR LEISURE INN · Hotel Drona Palace</p>
            <p className="text-xs text-muted-foreground mt-1">Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })}</p>
          </div>
        </div>

        {/* Intro */}
        <GlassCard className="p-4 mb-6 border border-primary/20">
          <p className="text-sm text-muted-foreground leading-relaxed">
            By registering for T20 Fan Night and purchasing a hospitality package, you agree to the following terms. Please read them carefully before proceeding.
            These terms govern your participation in the event, payment obligations, and the Fun Guess Game.
          </p>
        </GlassCard>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((section, i) => (
            <GlassCard key={i} className="overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b border-border/50 bg-primary/5">
                <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center text-primary-foreground flex-shrink-0">
                  {section.icon}
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">{section.title}</h2>
              </div>
              <div className="p-4">
                <ul className="space-y-2.5">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center space-y-3">
          <div className="disclaimer-bar rounded-lg p-3 text-xs">
            🎯 The Fun Guess Game is <strong>not gambling</strong>. It is a free entertainment feature for fun participation only. No money is at stake.
          </div>
          <p className="text-xs text-muted-foreground">
            For questions, contact SR LEISURE INN at{' '}
            <a href="mailto:dronapalace@gmail.com" className="text-primary underline">dronapalace@gmail.com</a>
            {' or '}
            <a href="tel:7217016170" className="text-primary underline">+91 72170 16170</a>
          </p>
          <Link to="/register">
            <GlassButton variant="primary" size="md" className="mt-2">
              Back to Registration
            </GlassButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
