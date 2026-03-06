import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone, Mail, Clock, MessageCircle } from 'lucide-react';
import { BackgroundOrbs } from '@/components/ui/BackgroundOrbs';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';

export default function ContactUsPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <BackgroundOrbs />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">

        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <GlassCard variant="elevated" className="p-6 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/15 mb-4">
            <MessageCircle className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text mb-2">Contact Us</h1>
          <p className="text-sm text-muted-foreground">SR LEISURE INN · Hotel Drona Palace, Kashipur</p>
        </GlassCard>

        {/* Business Identity */}
        <GlassCard className="p-5 mb-4">
          <h2 className="font-display text-lg font-bold text-foreground mb-3">Business Details</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="text-foreground font-semibold">SR LEISURE INN</p>
            <p>Operating as: <span className="text-foreground/80">Hotel Drona Palace</span></p>
            <p>GSTIN: <span className="font-mono text-secondary/80">ABOFS1823N1ZS</span></p>
          </div>
        </GlassCard>

        {/* Contact Information */}
        <GlassCard className="p-5 mb-4">
          <h2 className="font-display text-lg font-bold text-foreground mb-4">Get in Touch</h2>
          <div className="space-y-4">
            <a href="tel:7217016170" className="flex items-start gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/25 transition-colors">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone / WhatsApp</p>
                <p className="text-foreground font-semibold group-hover:text-primary transition-colors">+91 72170 16170</p>
              </div>
            </a>

            <a href="mailto:dronapalace@gmail.com" className="flex items-start gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/25 transition-colors">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-foreground font-semibold group-hover:text-primary transition-colors">dronapalace@gmail.com</p>
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
                <p className="text-foreground font-semibold">10:00 AM – 8:00 PM</p>
                <p className="text-muted-foreground text-sm">Monday to Sunday (Event Days)</p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Booking / Payment Support */}
        <GlassCard className="p-5 mb-4">
          <h2 className="font-display text-lg font-bold text-foreground mb-3">Booking & Payment Support</h2>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>For issues related to ticket booking, payment confirmation, or pass delivery:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Email us with your <strong className="text-foreground/80">mobile number</strong> and <strong className="text-foreground/80">booking reference</strong></li>
              <li>For urgent issues on event day, call the phone number above</li>
              <li>Payment-related disputes will be addressed within <strong className="text-foreground/80">2 business days</strong></li>
              <li>Refund requests must be made in writing via email</li>
            </ul>
          </div>
        </GlassCard>

        {/* CTA */}
        <div className="text-center mt-6 space-y-3">
          <Link to="/register">
            <GlassButton variant="primary" size="lg">
              Back to Registration
            </GlassButton>
          </Link>
          <p className="text-xs text-muted-foreground">
            See also:{' '}
            <Link to="/refund-policy" className="text-primary underline">Refund Policy</Link>
            {' · '}
            <Link to="/shipping" className="text-primary underline">Delivery Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
