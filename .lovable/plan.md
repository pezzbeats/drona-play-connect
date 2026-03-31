

## Breadcrumb Navigation — All Pages

### Approach

Create a reusable `<MobileBreadcrumb>` component that renders a compact, mobile-native breadcrumb bar (back arrow + path trail). Use it consistently across all public pages and admin pages.

### New File: `src/components/ui/MobileBreadcrumb.tsx`

A single component accepting a `items` array of `{ label, to? }` objects:
- Renders a fixed/sticky top bar with glass styling matching the app theme
- Shows a back arrow (navigates to previous crumb or `/`) + breadcrumb trail
- On mobile: truncates middle crumbs if more than 3 levels, shows only parent + current
- Uses existing `Breadcrumb*` primitives from `src/components/ui/breadcrumb.tsx`
- Compact height (~40px) to not waste mobile real estate

```text
┌─────────────────────────────┐
│ ← Home / Live / RR vs CSK  │
└─────────────────────────────┘
```

### Public Pages — Add Breadcrumbs

Each page gets `<MobileBreadcrumb>` at the top of its content:

| Page | Breadcrumb trail |
|---|---|
| `/register` | Home → Register |
| `/ticket` | Home → My Tickets |
| `/play` | Home → Play |
| `/live` (match picker) | Home → Live |
| `/live` (match view) | Home → Live → {Match Name} |
| `/about` | Home → About |
| `/terms`, `/privacy`, etc. | Home → About → {Page Title} |
| `/contact` | Home → Contact Us |

### Admin Pages — Add Breadcrumbs

Add `<MobileBreadcrumb>` inside `AdminLayout.tsx` before `<Outlet>`, reading the current route to auto-generate breadcrumbs:

| Route | Trail |
|---|---|
| `/admin/dashboard` | Admin → Dashboard |
| `/admin/matches` | Admin → Matches |
| `/admin/matches/:id` | Admin → Matches → Match Detail |
| `/admin/orders` | Admin → Bookings |
| `/admin/control` | Admin → Live Control |
| etc. | Admin → {Page Label from sidebar navItems} |

For admin, auto-derive the breadcrumb from the sidebar `navItems` array (already defined in `AdminSidebar.tsx`) by matching the current path. This avoids duplicating route labels.

### Files to Change

| File | Change |
|---|---|
| `src/components/ui/MobileBreadcrumb.tsx` | **New** — reusable breadcrumb bar component |
| `src/components/admin/AdminLayout.tsx` | Add auto-generated breadcrumb before `<Outlet>` using route matching against navItems |
| `src/pages/Register.tsx` | Add `<MobileBreadcrumb>` |
| `src/pages/Ticket.tsx` | Add `<MobileBreadcrumb>` |
| `src/pages/Play.tsx` | Add `<MobileBreadcrumb>` |
| `src/pages/Live.tsx` | Add `<MobileBreadcrumb>` (dynamic: match picker vs match view) |
| `src/pages/About.tsx` | Add `<MobileBreadcrumb>` |
| `src/pages/ContactUs.tsx` | Add `<MobileBreadcrumb>` |
| `src/pages/Terms.tsx` | Add `<MobileBreadcrumb>` |
| `src/pages/PrivacyPolicy.tsx` | Add `<MobileBreadcrumb>` |
| `src/pages/RefundPolicy.tsx` | Add `<MobileBreadcrumb>` |
| `src/pages/DisclaimerPolicy.tsx` | Add `<MobileBreadcrumb>` |
| `src/pages/EventParticipationTerms.tsx` | Add `<MobileBreadcrumb>` |
| `src/pages/PricingPolicy.tsx` | Add `<MobileBreadcrumb>` |
| `src/pages/ShippingPolicy.tsx` | Add `<MobileBreadcrumb>` |

