import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Tag, Users, Star, CreditCard, Info } from 'lucide-react';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { GlassCard } from '@/components/ui/GlassCard';
import { MobileBreadcrumb } from '@/components/ui/MobileBreadcrumb';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <GlassCard className="p-5 mb-4">
    <h2 className="font-display text-lg font-bold text-foreground mb-3">{title}</h2>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
  </GlassCard>
);

export default function PricingPolicyPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <BackgroundOrbs />
      <MobileBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'About', to: '/about' }, { label: 'Pricing Policy' }]} />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">

        <GlassCard variant="elevated" className="p-6 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-secondary/15 mb-4">
            <Tag className="h-7 w-7 text-secondary" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text-accent mb-2">Pricing Policy</h1>
          <p className="text-sm text-muted-foreground">SR LEISURE INN · Cricket Fan Night Events</p>
        </GlassCard>

        {/* What you pay for */}
        <GlassCard className="p-4 mb-4 border border-primary/20 bg-primary/5">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground text-sm">What You're Paying For</p>
              <p className="text-xs text-muted-foreground mt-1">
                All fees charged by SR LEISURE INN are exclusively for <strong className="text-foreground/80">hospitality services</strong> — 
                venue access, seating, food & beverages, and event management. The Fun Guess Game is a free entertainment feature 
                included with your booking at no extra charge.
              </p>
            </div>
          </div>
        </GlassCard>

        <Section title="1. Standard Seat Pricing">
          <p>
            Seat prices for Cricket Fan Night events are set per event by SR LEISURE INN and displayed clearly on the
            registration page before you proceed to payment. Prices may vary between events based on match significance,
            venue capacity, and hospitality package inclusions.
          </p>
          <p>
            The price shown on the booking form is the <strong className="text-foreground/80">final price per seat</strong>.
            There are no hidden fees, booking charges, or surcharges added at checkout.
          </p>
        </Section>

        <Section title="2. Seat Types">
          <div className="space-y-3 mt-1">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/40">
              <div className="text-2xl">🪑</div>
              <div>
                <p className="font-semibold text-foreground/80">Regular Seat</p>
                <p className="mt-0.5">Standard seating with full hospitality access including food, beverages, and event entry.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/40">
              <div className="text-2xl">👨‍👩‍👧</div>
              <div>
                <p className="font-semibold text-foreground/80">Family Seat</p>
                <p className="mt-0.5">Family-oriented seating arrangement. Same hospitality inclusions as regular seating.</p>
              </div>
            </div>
          </div>
        </Section>

        <Section title="3. Returning Customer (Loyalty) Pricing">
          <div className="flex items-start gap-3">
            <Star className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
            <div>
              <p>
                Customers who have attended a previous Cricket Fan Night event and had a{' '}
                <strong className="text-foreground/80">verified payment</strong> may be eligible for a returning customer
                (loyalty) discount on future events.
              </p>
              <p className="mt-2">
                When eligible, the discounted rate is automatically applied to seats up to your previous booking
                quantity. Any additional seats beyond that count are billed at the standard new-customer rate.
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs italic">
            Loyalty pricing eligibility and discount amounts are configured per event at the organiser's discretion.
            The pricing calculator on the registration page will show your applicable rate automatically.
          </p>
        </Section>

        <Section title="4. Multiple Seat Pricing">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p>You can book multiple seats in a single registration (up to 10 seats per booking).</p>
              <p className="mt-2">
                For returning customers, loyalty pricing applies to seats up to your previous booking count.
                Any seats beyond that threshold are billed at the <strong className="text-foreground/80">standard rate</strong>.
              </p>
              <p className="mt-2">
                The booking form shows a per-seat breakdown with the applicable price and reason for each seat
                before you proceed to payment.
              </p>
            </div>
          </div>
        </Section>

        <Section title="5. Price Transparency">
          <p>Before you pay, the registration form clearly shows:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Price per seat (with reason: new customer / returning / extra seat)</li>
            <li>Number of seats selected</li>
            <li>Total amount payable</li>
            <li>Seating type (Regular / Family)</li>
          </ul>
          <p className="mt-2">
            You can review this breakdown before choosing a payment method and are not charged until you confirm.
          </p>
        </Section>

        <Section title="6. Payment Options">
          <div className="flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <div>
                <p className="font-semibold text-foreground/80">Pay via Razorpay</p>
                <p>Supports credit/debit cards, UPI, net banking, and wallets. Payment confirmation is instant and passes are generated automatically.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground/80">Pay via UPI QR</p>
                <p>Scan the displayed QR code and upload your payment screenshot. AI verification typically takes a few seconds to 30 minutes.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground/80">Pay at Hotel</p>
                <p>Book now and pay in cash or UPI at the venue on the day of the event. Entry is conditional on payment at the gate.</p>
              </div>
            </div>
          </div>
        </Section>

        <Section title="7. No Extra Charges">
          <p>SR LEISURE INN does not charge:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Booking fees or convenience charges</li>
            <li>Delivery or shipping charges (all passes are digital)</li>
            <li>Processing fees on top of ticket price</li>
            <li>GST on hospitality packages (included in displayed price where applicable)</li>
          </ul>
          <p className="mt-2">The price you see is the price you pay.</p>
        </Section>

        <Section title="8. Price Changes">
          <p>
            SR LEISURE INN reserves the right to revise prices for future events. Once a booking is confirmed
            at a stated price, that price will not be changed for the confirmed booking.
          </p>
        </Section>

        <Section title="9. Contact for Pricing Queries">
          <p>SR LEISURE INN</p>
          <p>Jaitpur Turn, Bazpur Road, Kashipur, Uttarakhand</p>
          <p>Email: <a href="mailto:dronapalace@gmail.com" className="text-primary underline">dronapalace@gmail.com</a></p>
          <p>Phone: <a href="tel:7217016170" className="text-primary underline">+91 72170 16170</a></p>
        </Section>

      </div>
    </div>
  );
}
