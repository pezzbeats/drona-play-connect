
## Gate Validate — Torch Toggle + Mobile-First Redesign

### What's changing

**1. Torch/Flashlight toggle** (new feature)
- Add `torchOn` state. When user taps torch button, call `stream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch: true/false }] })`.
- Show torch button only when `cameraReady` (stream exists and video is playing).
- Use a `Flashlight` / `FlashlightOff` icon (Lucide `Flashlight` isn't available — use `Zap` / `ZapOff`) with a yellow active glow.
- Torch capability is checked via `track.getCapabilities().torch` — show button only if supported, otherwise silently omit.
- Add `Zap`, `ZapOff` to the existing imports at line 18–21.
- Place torch button in the camera overlay header bar, right of the close button.
- Clean up torch on `closeCamera` (call `applyConstraints({ advanced: [{ torch: false }] })` before stopping tracks).

**2. Mobile-first scan zone redesign** (the main page)

Current state: Small 56×56px camera icon button tucked next to a text input. Hard to tap, not prominent.

Proposed changes to the Scan Zone card (lines 712–767):
- Replace the current layout (input + small camera button + scan button row) with a **2-section stacked layout**:
  - **Top**: A large, full-width "📷 Scan QR" button — `h-20` with a pulsing camera icon, primary gradient, glow. This is the primary CTA for mobile gate staff.
  - **Bottom**: Collapsible/secondary row — text input + manual scan button (smaller, ghost) for hardware scanners / paste fallback.
- The "OR" divider text between the two sections.
- The big scan button should animate when `scanFeedback` is active (green flash for success, red for error).

**3. Camera overlay header improvements**
- Current header: Camera icon + title + close button.
- Add torch button between title and close (visible only when `cameraReady && torchSupported`).
- Torch button: `h-11 w-11 rounded-xl` with Zap icon — yellow when on (`bg-warning/20 border-warning/60`), muted when off.

### Files changed
- `src/pages/admin/AdminValidate.tsx` — only file, ~5 edits:
  1. Add `Zap`, `ZapOff` to import
  2. Add `torchOn` state + `torchSupported` ref
  3. Add `toggleTorch` function using `applyConstraints`
  4. Update `closeCamera` to reset torch
  5. Update camera overlay header to add torch button
  6. Redesign the scan zone card in the main render (big scan button + secondary input row)

### Torch implementation snippet
```typescript
const [torchOn, setTorchOn] = useState(false);
const torchSupportedRef = useRef(false);

const toggleTorch = useCallback(async () => {
  const track = streamRef.current?.getVideoTracks()[0];
  if (!track) return;
  const newVal = !torchOn;
  try {
    await track.applyConstraints({ advanced: [{ torch: newVal } as any] });
    setTorchOn(newVal);
  } catch { /* torch not supported */ }
}, [torchOn]);

// In the pendingStream useEffect, after video plays:
const track = stream.getVideoTracks()[0];
torchSupportedRef.current = !!track?.getCapabilities()?.torch;
```

### Scan zone new layout
```
┌──────────────────────────────────────┐
│  QrCode icon   Scan Zone    [match]  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  📷  TAP TO SCAN QR CODE       │  │  ← h-20, full-width, gradient, glow
│  │      Hardware scanner ready    │  │
│  └────────────────────────────────┘  │
│                                      │
│  ── OR TYPE / PASTE ──               │
│                                      │
│  [input field ........................] [↵]  │
│                                      │
│  ✓ Ticket found  (status line)       │
└──────────────────────────────────────┘
```

No new dependencies. All in one file.
