
## Plan: Restrict "Send Balance Reminder" to Admin Users Only

### Problem
The "Send Balance Reminder" WhatsApp button currently appears for all users visiting the `/ticket` page with an unpaid/partial order. It should only be visible when an admin (any role: `gate_staff`, `operator`, `super_admin`) is viewing the page.

### How admin detection works
`AuthContext` already provides `useAuth()` which returns `role` — it's `null` for unauthenticated (public) users and a role string for logged-in admins. The `AuthProvider` wraps the entire app in `App.tsx`, so `useAuth()` is safe to call in `TicketPage`.

### What to change — `src/pages/Ticket.tsx` only

1. **Import `useAuth`** at the top of the file.

2. **In `TicketPage`**, call `const { role } = useAuth()` and derive `const isAdmin = role !== null`.

3. **Top action bar** (the "Remind" button in the Print All / WhatsApp row, lines ~869–883): wrap it with `isAdmin &&` so the `<a>` element is only rendered for admins.

4. **`PassCard` call** (lines ~915–919): the `onRemind` prop is already conditionally passed. Add `isAdmin &&` before that condition so the prop is always `undefined` for non-admin users — which already causes the button inside `PassCard` to be hidden (since it checks `onRemind &&`).

No changes needed to `PassCard` itself — it already gates the button on `onRemind` being defined.
No backend changes needed — this is purely a UI-layer gate.

### Files changed
| File | Change |
|------|--------|
| `src/pages/Ticket.tsx` | Add `useAuth` import + `isAdmin` flag, gate `onRemind` prop and top-bar Remind link behind `isAdmin` |
