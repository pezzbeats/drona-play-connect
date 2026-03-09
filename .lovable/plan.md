
## Plan: Live Canvas Preview of Coupon Design

### What we're building
A live preview panel that renders the coupon PNG directly in the page using a visible `<canvas>` element — updated in real-time whenever discount type, value, or expiry date changes. No CSV upload required to see the coupon design.

---

### How it works

The existing `buildCouponCanvas()` function returns a `Blob` for export. We need a **second render path** that draws onto a real visible `<canvas>` element instead of an off-screen one.

The simplest approach: add a `previewCanvasRef` ref pointing to a `<canvas>` in the JSX, then create a `renderPreview()` function that draws to it using the same drawing logic as `buildCouponCanvas`, substituting a sample name/mobile for placeholder text.

To avoid duplicating all the drawing code, we can refactor `buildCouponCanvas` to accept an **optional canvas element** — if provided, it draws to that canvas and skips the `toBlob` return. If not, it creates one and returns the blob as before.

**OR** (simpler, less risky) — keep `buildCouponCanvas` unchanged and add a thin `renderToCanvas(canvasEl)` wrapper that:
1. Uses the same drawing calls from `buildCouponCanvas` but targets the passed canvas element
2. Uses a static "preview" row: `{ name: 'GUEST NAME', mobile: '9876543210', valid: true }` and a static code `WC25-3210-PREV`

This keeps the existing export path 100% untouched and adds preview as a separate concern.

---

### Changes to `AdminCoupons.tsx`

**1. New ref:**
```ts
const previewCanvasRef = useRef<HTMLCanvasElement>(null);
```

**2. New `drawToCanvas(canvasEl, row, discountText, code, logoImg, expiryStr)` function:**
Identical drawing logic to `buildCouponCanvas` but:
- Takes an existing `HTMLCanvasElement` as first argument instead of creating one
- No `toBlob` at the end — just draws and returns void

We extract the drawing logic into `drawToCanvas`, then:
- `buildCouponCanvas` calls `drawToCanvas` then calls `canvas.toBlob(...)` 
- `renderPreview()` calls `drawToCanvas` with `previewCanvasRef.current` and the placeholder row

**3. `renderPreview` function:**
```ts
const renderPreview = useCallback(() => {
  const canvas = previewCanvasRef.current;
  if (!canvas || !logoRef.current || !fontReady) return;
  const previewRow = { name: 'GUEST NAME', mobile: '9876543210', valid: true };
  const previewCode = 'WC25-3210-PREV';
  drawToCanvas(canvas, previewRow, discountText, previewCode, logoRef.current, expiryStr);
}, [discountText, expiryStr, fontReady]);
```

**4. Auto-trigger preview on settings change:**
```ts
useEffect(() => { renderPreview(); }, [renderPreview]);
```
This fires whenever `discountText`, `expiryStr`, or `fontReady` changes — so the preview is always live.

**5. New preview card in JSX** — inserted between the "Coupon Settings" card and the "Upload CSV" card:

```
┌─────────────────────────────────────────────────────┐
│  🖼  Coupon Preview  (live · updates as you type)    │
│                                                       │
│  [canvas element — scaled to fit, ~375px wide]       │
│                                                       │
│  Showing preview with sample name & code             │
└─────────────────────────────────────────────────────┘
```

The canvas is displayed at 50% scale (`style={{ width: '375px', height: '525px' }}`) since the actual canvas is 750×1050 — sharp on retina, fits on all screens.

On mobile, we use `w-full max-w-[375px] mx-auto` to center it.

---

### Refactor plan (minimal, safe)

The key refactor is extracting drawing logic into `drawToCanvas`:

```ts
// NEW - draws onto any canvas element
function drawToCanvas(canvas: HTMLCanvasElement, row, discountText, code, logoImg, expiryStr) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  // ... all existing drawing code from buildCouponCanvas ...
}

// UPDATED - thin wrapper around drawToCanvas
async function buildCouponCanvas(row, discountText, code, logoImg, expiryStr): Promise<Blob> {
  const canvas = document.createElement('canvas');
  drawToCanvas(canvas, row, discountText, code, logoImg, expiryStr);
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/png');
  });
}
```

This is a pure refactor — no behaviour change for existing generation. The preview reuses the same pixel-perfect drawing code.

---

### Files to edit

| File | Change |
|---|---|
| `src/pages/admin/AdminCoupons.tsx` | Extract `drawToCanvas`, add `previewCanvasRef`, `renderPreview`, auto-trigger `useEffect`, and preview card JSX |

No other files. No DB. No edge functions.
