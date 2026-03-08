
## What's Left: URL Replacement in Customer-Facing Pages

Everything from the recent plans is implemented and working **except one thing**: the base URL replacement to `cricket.dronapalace.com` was applied inside the **admin Bookings module** but was **missed in the customer-facing pages** that also generate WhatsApp share links.

### 3 remaining occurrences of `drona-play-connect.lovable.app`

| File | Line | Context |
|---|---|---|
| `src/pages/Ticket.tsx` | 64 | `buildReminderLink()` — admin balance reminder WhatsApp message |
| `src/pages/Ticket.tsx` | 731 | `whatsappShare()` — customer "Share" button on each pass |
| `src/pages/Register.tsx` | 972 | `buildConfirmationWALink()` — booking confirmation WhatsApp message |
| `src/pages/Register.tsx` | 1004 | `handleWhatsAppShare()` — Web Share API fallback to WhatsApp |

All 4 occurrences follow the same pattern:
```ts
// Before
`https://drona-play-connect.lovable.app/ticket?mobile=${...}`

// After
`https://cricket.dronapalace.com/ticket?mobile=${...}`
```

### Changes

**`src/pages/Ticket.tsx`** — 2 line edits:
- Line 64: replace URL in `buildReminderLink`
- Line 731: replace URL in `whatsappShare`

**`src/pages/Register.tsx`** — 2 line edits:
- Line 972: replace URL in `buildConfirmationWALink`
- Line 1004: replace URL in `handleWhatsAppShare`

No logic changes, no new state, no structural edits — pure string replacement in 4 lines across 2 files.
