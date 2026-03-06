
## Plan: Add Hotel Logo Across Key Pages

### What's needed
Copy the uploaded logo (`WhatsApp_Image_2026-02-14_at_5.23.37_PM.jpeg`) into `src/assets/hotel-logo.png` and place it in 4 locations:

1. **Landing page (Index.tsx)** — prominently in the hero section above the title, alongside the cricket emoji, as a circular/rounded logo badge
2. **Admin login page (AdminLogin.tsx)** — replace the generic Shield icon in the blue circle with the actual hotel logo image above it, keeping the Shield as a secondary element or swapping it out cleanly
3. **Register page (Register.tsx)** — small logo at the top of the form header so customers see the hotel branding when booking
4. **Ticket page (Ticket.tsx)** — on each printed/digital ticket pass, in the bottom strip or header of the seat pass card, so it appears on downloadable/printable tickets

### Placement Details

**Landing (Index.tsx)** — In the hero section (line ~157), add the logo above or alongside the cricket emoji row. Show it as a ~80px rounded image with a gold/amber glow ring matching the logo's color palette, centered between the decorative lines.

**Admin Login (AdminLogin.tsx)** — Replace the `<Shield>` icon's parent div (the gradient circle) with the hotel logo image. Keep "Admin Portal" heading. Logo ~64px circular with a subtle glow.

**Register (Register.tsx)** — Add a small ~40px logo in the page header area (near the top, before StepBar), centered with "T20 Fan Night" branding.

**Ticket (Ticket.tsx)** — Inside each `seat-pass` card's bottom strip (the `border-t` section at the bottom), add the logo image (~28px) alongside "T20 Fan Night · Hotel Drona Palace" text. This ensures it appears when printing.

### Files to change
| File | Change |
|---|---|
| `src/assets/hotel-logo.png` | Copy from user-uploads |
| `src/pages/Index.tsx` | Add logo to hero section |
| `src/pages/admin/AdminLogin.tsx` | Replace shield icon with logo |
| `src/pages/Register.tsx` | Add small logo to page header |
| `src/pages/Ticket.tsx` | Add logo to ticket card bottom strip |
