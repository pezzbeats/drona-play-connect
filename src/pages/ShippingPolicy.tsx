import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Package, Smartphone, CheckCircle2, Clock } from 'lucide-react';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { GlassCard } from '@/components/ui/GlassCard';
import { MobileBreadcrumb } from '@/components/ui/MobileBreadcrumb';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <GlassCard className="p-5 mb-4">
    <h2 className="font-display text-lg font-bold text-foreground mb-3">{title}</h2>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
  </GlassCard>
);

export default function ShippingPolicyPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <BackgroundOrbs />
      <MobileBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'About', to: '/about' }, { label: 'Shipping Policy' }]} />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">

        <GlassCard variant="elevated" className="p-6 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-secondary/15 mb-4">
            <Package className="h-7 w-7 text-secondary" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text-accent mb-2">Shipping & Delivery Policy</h1>
          <p className="text-sm text-muted-foreground">SR LEISURE INN · Effective Date: 1 January 2026</p>
        </GlassCard>

        {/* Key Highlight */}
        <GlassCard className="p-4 mb-4 border border-success/30 bg-success/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
              <Smartphone className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="font-display font-bold text-foreground">100% Digital — No Physical Shipping</p>
              <p className="text-xs text-muted-foreground mt-0.5">All passes and tickets are delivered digitally through this website</p>
            </div>
          </div>
        </GlassCard>

        <Section title="1. Nature of Our Products">
          <p>
            SR LEISURE INN operates T20 Fan Night events at Hotel Drona Palace, Kashipur. All booking confirmations,
            entry passes (QR codes), and event access credentials are{' '}
            <strong className="text-foreground/80">fully digital in nature</strong>.
          </p>
          <p>
            We do <strong className="text-foreground/80">not</strong> ship or deliver any physical product, printed ticket,
            or physical document to customers. There is no postal or courier delivery involved in any transaction
            made on this platform.
          </p>
        </Section>

        <Section title="2. Digital Pass Delivery — How It Works">
          <div className="space-y-3 mt-1">
            {[
              { icon: <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />, text: 'You complete your registration and choose a payment method on this website.' },
              { icon: <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />, text: 'After successful payment verification (or "Pay at Hotel" booking), your digital QR passes are generated instantly.' },
              { icon: <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />, text: 'Your passes are displayed immediately on-screen after booking. You can also access them anytime at /ticket using your registered mobile number.' },
              { icon: <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />, text: 'At the event venue, show your QR code at the gate for digital check-in.' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                {item.icon}
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="3. Delivery Timelines by Payment Method">
          <div className="space-y-3 mt-1">
            <div className="p-3 rounded-lg bg-success/10 border border-success/20">
              <p className="font-semibold text-foreground/80">Pay via Razorpay (Cards, UPI, Wallets)</p>
              <p className="mt-1">Passes generated <strong className="text-success">instantly</strong> after successful payment confirmation from Razorpay gateway. No manual step required.</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="font-semibold text-foreground/80">Pay via UPI QR (Screenshot Upload)</p>
              <p className="mt-1">Passes generated after AI verification of your payment screenshot — typically within <strong className="text-foreground/80">seconds to 30 minutes</strong>. Manual review may extend this in rare cases.</p>
            </div>
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
              <p className="font-semibold text-foreground/80">Pay at Hotel</p>
              <p className="mt-1">QR passes are generated immediately at the time of booking. However, the booking is marked <strong className="text-warning">Unpaid</strong> until payment is collected at the venue. Gate entry requires payment.</p>
            </div>
          </div>
        </Section>

        <Section title="4. Accessing Your Passes">
          <p>Your digital passes can be accessed at any time at:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>The <strong className="text-foreground/80">confirmation screen</strong> immediately after booking</li>
            <li>The <Link to="/ticket" className="text-primary underline">/ticket</Link> page using your registered mobile number</li>
          </ul>
          <p className="mt-2">
            We recommend saving a screenshot of your QR pass for quick access at the venue, especially
            in areas with limited internet connectivity.
          </p>
        </Section>

        <Section title="5. Pass Not Appearing — What To Do">
          <p>If your pass is not visible after completing payment:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Wait 5–10 minutes and refresh the <Link to="/ticket" className="text-primary underline">/ticket</Link> page</li>
            <li>If paying via Razorpay, ensure the payment was successfully deducted from your account</li>
            <li>If paying via UPI screenshot, ensure the screenshot was uploaded and processed</li>
            <li>Contact our support team at <a href="mailto:dronapalace@gmail.com" className="text-primary underline">dronapalace@gmail.com</a> or <a href="tel:7217016170" className="text-primary underline">+91 72170 16170</a> with your mobile number and payment reference</li>
          </ul>
        </Section>

        <Section title="6. No Physical Delivery Fees">
          <p>
            Since all deliveries are digital, there are <strong className="text-foreground/80">no shipping charges, delivery fees,
            or courier costs</strong> associated with any booking made on this platform. The price displayed
            at checkout is the final amount payable — there are no hidden charges.
          </p>
        </Section>

        <Section title="7. Contact">
          <p>SR LEISURE INN</p>
          <p>Jaitpur Turn, Bazpur Road, Kashipur, Uttarakhand</p>
          <p>Email: <a href="mailto:dronapalace@gmail.com" className="text-primary underline">dronapalace@gmail.com</a></p>
          <p>Phone: <a href="tel:7217016170" className="text-primary underline">+91 72170 16170</a></p>
        </Section>

      </div>
    </div>
  );
}
