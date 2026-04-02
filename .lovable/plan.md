

## Remaining Enhancements & Fixes

After reviewing the full codebase, here are the most impactful improvements still available — grouped by priority.

---

### HIGH PRIORITY

**1. PWA / Add-to-Home-Screen Support**
The app has zero PWA support — no `manifest.json`, no service worker, no offline caching. For a mobile-first live cricket app used at a hotel venue, this is a big miss. Users should be able to "Add to Home Screen" for an app-like experience.
- Add `public/manifest.json` with app name, icons, theme colors, `display: standalone`
- Add a service worker with Workbox for caching static assets and API responses
- Add install prompt banner on the landing page

**2. OG Image is a Signed URL That Will Expire**
The `og:image` in `index.html` (line 15) uses a Google Cloud signed URL with `Expires=1772784656` (~2026-03-03). This has likely **already expired**, meaning social sharing previews show a broken image. Replace with a permanent public URL from your `match-assets` storage bucket.

**3. SEO & Meta Improvements**
- Missing `<link rel="canonical">` tag
- Missing favicon / apple-touch-icon references in `index.html`
- The `<title>` still says "Cricket Fan Night" — should match the app's actual branding "Drona Play Connect"
- No structured data (JSON-LD) for the event

**4. QueryClient is Unconfigured**
`QueryClient` on line 60 of `App.tsx` is instantiated with zero config — no `staleTime`, no `retry`, no `gcTime`. Since the app uses React Query in `package.json`, configure sensible defaults:
```
staleTime: 30_000, retry: 2, refetchOnWindowFocus: false
```

---

### MEDIUM PRIORITY

**5. IPL Team Logo Imports Are Bundled Statically**
Both `Index.tsx` and `Register.tsx` import ~10 team logo PNGs at the top level — these are bundled into the main JS chunk even if unused. Move these to `public/` or use dynamic imports to reduce initial bundle size.

**6. Landing Page Calls `cricket-api-sync` Edge Function on Every Load**
Lines 425-428 of `Index.tsx`: if no matches found, it fires the sync function then refetches. Plus a 60s background polling loop. This is wasteful and could hit rate limits. Add a localStorage timestamp to prevent firing more than once per 5 minutes.

**7. Admin Dashboard Fetches ALL Orders Without Match Filter**
`AdminDashboard.tsx` line 41 fetches ALL orders in the database with no match filter. As the platform grows, this will become slow. Filter by active match or add pagination.

**8. Ticket Page is 963 Lines**
`Ticket.tsx` is a massive monolith. Extract into sub-components (TicketCard, TicketSearch, TicketActions) for maintainability.

**9. No Loading/Error States on Several Admin Pages**
Some admin pages silently fail with empty `catch {}` blocks (e.g., AdminDashboard line 76). Add proper error toasts.

---

### LOW PRIORITY / POLISH

**10. Accessibility Improvements**
- Many interactive elements use `<div>` or `<span>` with `onClick` but no `role="button"` or keyboard handlers
- Color contrast on `text-muted-foreground` against dark backgrounds may not meet WCAG AA
- Missing `aria-label` on icon-only buttons throughout admin panel

**11. WhatsApp / Share Integration**
The Ticket page mentions share functionality. Add proper Web Share API integration with WhatsApp deeplink fallback for sharing tickets and match invites.

**12. Rate Limiting Feedback on Registration**
If `create-order` returns `RATE_LIMITED`, the user gets a generic error. Surface the specific "too many attempts" message clearly.

---

### Recommended Implementation Order

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Fix expired OG image URL | Small | High (social sharing broken) |
| 2 | Configure QueryClient defaults | Small | Medium (prevents stale data issues) |
| 3 | Add PWA manifest + install prompt | Medium | High (app-like experience) |
| 4 | Throttle landing page sync calls | Small | Medium (prevents rate limits) |
| 5 | Filter admin dashboard by active match | Small | Medium (performance) |
| 6 | Lazy-load team logos | Small | Medium (bundle size) |
| 7 | SEO fixes (canonical, favicon, title) | Small | Medium |
| 8 | Accessibility audit fixes | Medium | Medium |
| 9 | Refactor Ticket.tsx | Medium | Low (maintainability) |
| 10 | Web Share API for tickets | Small | Low (nice-to-have) |

Would you like me to implement all of these, or pick specific items?

