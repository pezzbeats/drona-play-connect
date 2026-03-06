
## Full Content Customization from Admin Panel

### What's Currently Hardcoded (Customer-Visible)

**Landing page (`Index.tsx`):**
- Hero title: "T20 Fan Night"
- Subheading: "An Exclusive Cricket Celebration Experience"
- Venue badge: "Hosted at Hotel Drona Palace, Kashipur"
- 4 Feature cards (labels + descriptions)
- 4 Trust strip items
- Top disclaimer bar text
- Legal disclaimer body text

**Registration page (`Register.tsx`):**
- Header title: "T20 Fan Night" + "Hotel Drona Palace"
- `PAYEE_VPA` = `paytmqr5oka4x@ptys`
- `PAYEE_NAME` = `Hotel Drona Palace`
- Top disclaimer bar text

**Footer (`LandingFooter.tsx`):**
- About blurb, company name "SR LEISURE INN", GSTIN, address, phone, email, copyright line

---

### Solution: `site_config` Database Table

A single `site_config` table with `key` (text, unique) + `value` (text) rows. This is the lightest approach — no new schemas, just key-value pairs read once on load.

**Rows to seed:**
| Key | Default Value |
|---|---|
| `hero_title` | T20 Fan Night |
| `hero_subtitle` | An Exclusive Cricket Celebration Experience |
| `hero_venue_badge` | Hosted at Hotel Drona Palace, Kashipur |
| `disclaimer_bar_text` | 🎯 Fun Guess Game only — for entertainment... |
| `legal_disclaimer_title` | 🎯 Fun Guess Game — Legal Disclaimer |
| `legal_disclaimer_body` | This event includes a recreational... |
| `feature_1_label` | Live Stadium Screening |
| `feature_1_desc` | Experience the electrifying atmosphere... |
| `feature_2_label` | Fun Guess Game |
| `feature_2_desc` | Make predictions for entertainment... |
| `feature_3_label` | Premium Food & Beverages |
| `feature_3_desc` | Unlimited hospitality services... |
| `feature_4_label` | Live Leaderboard |
| `feature_4_desc` | Compete with fellow guests... |
| `trust_1_label` | Safe & professionally managed |
| `trust_2_label` | Organised hospitality experience |
| `trust_3_label` | Secure entry & digital passes |
| `trust_4_label` | Premium venue & arrangements |
| `footer_about_text` | Hotel Drona Palace is a premium... |
| `footer_company_name` | SR LEISURE INN |
| `footer_gstin` | ABOFS1823N1ZS |
| `footer_address` | Jaitpur Turn, Bazpur Road, Kashipur, Uttarakhand |
| `footer_phone` | 7217016170 |
| `footer_email` | dronapalace@gmail.com |
| `footer_copyright` | © 2026 SR LEISURE INN. All Rights Reserved. |
| `register_header_title` | T20 Fan Night |
| `register_header_venue` | Hotel Drona Palace |
| `payment_vpa` | paytmqr5oka4x@ptys |
| `payment_payee_name` | Hotel Drona Palace |

---

### Database Changes

1. **Migration** — Create `site_config` table:
```sql
CREATE TABLE public.site_config (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;
-- Public can read
CREATE POLICY "Config readable by all" ON public.site_config FOR SELECT USING (true);
-- Only authenticated (admins) can write
CREATE POLICY "Config writable by authenticated" ON public.site_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Seed default rows (INSERT ... ON CONFLICT DO NOTHING)
```

---

### Frontend Changes

**New hook** `src/hooks/useSiteConfig.ts`:
- Fetches all rows from `site_config` once
- Returns a `get(key: string, fallback?: string)` helper
- Used by `Index.tsx`, `Register.tsx`, `LandingFooter.tsx`

**Update `Index.tsx`** — replace all hardcoded strings with `config.get('key', 'fallback')`

**Update `Register.tsx`** — replace `PAYEE_VPA`, `PAYEE_NAME`, header title, venue, disclaimer bar text

**Update `LandingFooter.tsx`** — replace all hardcoded strings with config values

---

### New Admin Page: `src/pages/admin/AdminSiteConfig.tsx`

A new admin page at `/admin/site-config` (operator+ role) with a clean form:

**Sections (grouped):**
1. **Landing Page** — hero title, subtitle, venue badge
2. **Event Features** — 4 feature cards (label + desc each)
3. **Trust Items** — 4 trust strip labels
4. **Disclaimers** — top bar text, legal disclaimer title + body
5. **Registration** — header title, venue line, UPI VPA, payee name
6. **Footer** — about text, company name, GSTIN, address, phone, email, copyright

Each field is a simple `<Input>` or `<Textarea>` with a Save button per section (or one global Save All). Uses a `useToast` on save success.

---

### Router + Navigation Changes

- Add `/admin/site-config` route in `App.tsx` (operator+ protected)
- Add "Site Content" nav item with a `FileText` icon to `AdminSidebar.tsx` and `AdminBottomNav.tsx` (minRole: 'operator')

---

### Files Changed

| File | Action |
|---|---|
| `supabase/migrations/new.sql` | Create `site_config` table + seed defaults |
| `src/hooks/useSiteConfig.ts` | New hook |
| `src/pages/admin/AdminSiteConfig.tsx` | New admin page |
| `src/pages/Index.tsx` | Use hook instead of hardcoded strings |
| `src/pages/Register.tsx` | Use hook for VPA, payee name, headers |
| `src/components/ui/LandingFooter.tsx` | Use hook for all company info |
| `src/App.tsx` | Add new route |
| `src/components/admin/AdminSidebar.tsx` | Add nav item |
| `src/components/admin/AdminBottomNav.tsx` | Add nav item |
