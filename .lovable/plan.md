
## Problem
The camera scan loop is slow because:
1. `new BarcodeDetector({ formats: ['qr_code'] })` is created **inside the RAF tick function** — so it's re-instantiated ~60 times per second
2. `BarcodeDetector.detect()` is `async` but the loop doesn't throttle — it keeps firing new RAF ticks while a detect call is still in flight, creating a queue of overlapping promises
3. jsQR fallback runs on full 1280×720 video frames — scanning 921K pixels per frame is expensive on mobile CPUs
4. After a successful QR scan, `closeCamera()` is awaited (torch off + stop tracks) before `lookupTicket()` is called, adding latency

## Fix Plan

### 1. Hoist `BarcodeDetector` instance outside the scan loop
Create the `BarcodeDetector` once when the scan loop starts, store it in a ref (`detectorRef`). The RAF tick just calls `detectorRef.current.detect(video)`.

### 2. Add in-flight guard to prevent overlapping detect calls
Add a `detectingRef = useRef(false)` boolean. At the start of each tick, if `detectingRef.current` is true, skip and schedule the next RAF immediately. Set to true before `detect()`, false in finally.

```typescript
const tick = async () => {
  if (!scanningRef.current) return;
  if (detectingRef.current) { rafRef.current = requestAnimationFrame(tick); return; }
  detectingRef.current = true;
  try {
    // ... detect logic
  } finally {
    detectingRef.current = false;
    if (scanningRef.current) rafRef.current = requestAnimationFrame(tick);
  }
};
tick(); // start immediately (no outer RAF needed)
```

### 3. Downscale canvas for jsQR fallback
Instead of drawing the full 1280×720 frame, scale down to max 480px wide while maintaining aspect ratio. This reduces jsQR's pixel count by ~7x on a 720p stream.

```typescript
const SCAN_RES = 480;
const scale = Math.min(1, SCAN_RES / w);
canvas.width = Math.round(w * scale);
canvas.height = Math.round(h * scale);
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
```

### 4. Fire lookupTicket immediately, close camera concurrently
In `handleCameraResult`, call `lookupTicket` immediately and close camera in parallel (don't await close before lookup):

```typescript
const handleCameraResult = useCallback((qrText: string) => {
  if (!scanningRef.current) return; // guard duplicate fires
  scanningRef.current = false;      // stop the loop right away
  cancelAnimationFrame(rafRef.current);
  playBeep('success');
  vibrate([120]);
  setQrInput(qrText);
  lookupTicket(qrText);             // fire immediately, no await
  closeCamera();                    // close concurrently
}, [closeCamera, lookupTicket]);
```

### 5. Request higher-fps camera constraint
Add `frameRate: { ideal: 30 }` to `getUserMedia` constraints so the browser doesn't default to a lower rate on mobile.

## Files to change
| File | Change |
|------|--------|
| `src/pages/admin/AdminValidate.tsx` | Hoist BarcodeDetector into ref; add in-flight guard; downscale jsQR canvas; fire lookupTicket immediately; add frameRate constraint |

No DB changes. No edge function changes. No new files.
