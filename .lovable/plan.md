
## Plan: Add /about Page

**Goal**: Create a dedicated `/about` page that acts as a payment gateway compliance page — prominently displaying SR LEISURE INN business identity, GSTIN, registered address, contact, and links to all 8 legal pages.

### Files to create/edit

1. **`src/pages/About.tsx`** — New page following the exact same pattern as `ContactUs.tsx` / `PrivacyPolicy.tsx` (BackgroundOrbs + GlassCard + GlassButton). Sections:
   - **Hero card**: Building2 icon, "About Us" heading, tagline "SR LEISURE INN · Hotel Drona Palace"
   - **Business Identity card**: Company name, GSTIN (selectable mono font), registered address, brand/venue name
   - **Contact Details card**: Phone, email, address with icons (same as ContactUs)
   - **What We Do card**: Brief description — hospitality, T20 fan events, ticketing platform
   - **Compliance & Legal card**: Labelled grid of all 8 policy links as prominent clickable chips/buttons
   - **Footer CTA**: Link to Register + small compliance note with GSTIN

2. **`src/App.tsx`** — Add `<Route path="/about" element={<AboutPage />} />` in the public routes block

3. **`src/components/ui/LandingFooter.tsx`** — Add `/about` link to the "Legal & Policies" nav column

### Design details
- Page max-width: `max-w-2xl` (consistent with other legal pages)
- GSTIN displayed with `font-mono select-all` so reviewers can copy it easily
- All 8 policy links displayed as a 2×4 grid of bordered chips (not just plain text) — clearly scannable
- `useSiteConfig` hook used for company name, address, phone, email — consistent with footer
