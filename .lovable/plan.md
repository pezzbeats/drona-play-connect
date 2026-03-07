
## Analysis

The current AdminValidate.tsx has NO camera/QR scanning capability at all — only a text input for paste/keyboard scanner. The user wants a "Open Camera" button that uses the device camera to scan QR codes.

### What's needed:

1. **Camera QR Scanner button** — A dedicated button next to the scan input that opens the device rear camera
2. **QR decoding from camera stream** — Use `BarcodeDetector` API (Chrome/Android native, very fast) with a fallback using `jsQR` library
3. **Camera modal/overlay** — Show a video feed with a scan overlay, auto-close on successful detection
4. **Browser security** — `getUserMedia` MUST be called directly in the click handler (not in useEffect or after awaits)

### Technical approach:

**Step 1: Install jsQR** (for browsers without BarcodeDetector — Safari, Firefox)
- `jsqr` npm package — pure JS, no native dependencies, works everywhere

**Step 2: Add camera state to the component**
```typescript
const [cameraOpen, setCameraOpen] = useState(false);
const [cameraError, setCameraError] = useState<string | null>(null);
const videoRef = useRef<HTMLVideoElement>(null);
const streamRef = useRef<MediaStream | null>(null);
const rafRef = useRef<number>();
```

**Step 3: `openCamera()` — called DIRECTLY from button onClick**
```typescript
const openCamera = async () => {
  setCameraError(null);
  setCameraOpen(true);
  try {
    // CRITICAL: getUserMedia directly in click handler
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      startScanning();
    }
  } catch (err) {
    if (err.name === 'NotAllowedError') setCameraError('Camera permission denied. Please allow camera access in browser settings.');
    else setCameraError('Could not open camera: ' + err.message);
  }
};
```

**Step 4: Scan loop using BarcodeDetector + jsQR canvas fallback**
```typescript
const startScanning = () => {
  const tick = async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) { rafRef.current = requestAnimationFrame(tick); return; }
    
    // Try BarcodeDetector first (fast, native)
    if ('BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      const codes = await detector.detect(videoRef.current);
      if (codes.length > 0) { handleCameraResult(codes[0].rawValue); return; }
    } else {
      // jsQR fallback — draw to canvas and decode
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      if (code) { handleCameraResult(code.data); return; }
    }
    rafRef.current = requestAnimationFrame(tick);
  };
  rafRef.current = requestAnimationFrame(tick);
};
```

**Step 5: On successful scan**
```typescript
const handleCameraResult = (qrText: string) => {
  closeCamera();
  setQrInput(qrText);
  lookupTicket(qrText);
  playBeep('success');
  vibrate([120]);
};
```

**Step 6: `closeCamera()` — stop stream and cleanup**
```typescript
const closeCamera = () => {
  cancelAnimationFrame(rafRef.current);
  streamRef.current?.getTracks().forEach(t => t.stop());
  streamRef.current = null;
  setCameraOpen(false);
};
```

**Step 7: Camera overlay UI** — Full-screen modal with:
- `<video>` element showing camera feed
- A centered SVG square "viewfinder" overlay (corner brackets)
- "Tap QR code to scan" instruction text
- Close button
- Error state display

**Step 8: Add camera button** next to the existing scan input
```tsx
<button onClick={openCamera} className="...">
  <Camera className="h-5 w-5" />
</button>
```

### Files changed:

| File | Change |
|------|--------|
| `src/pages/admin/AdminValidate.tsx` | Add camera scanning: new state, openCamera(), startScanning(), closeCamera(), camera modal overlay UI, Camera button |
| `package.json` | Add `jsqr` dependency |

### Important details:
- Camera overlay is a fixed full-screen div (z-50), NOT a Dialog component — keeps gesture chain clean
- Close on successful scan (auto-dismiss) + close button
- Cleanup on unmount via useEffect return
- Show camera button icon (Camera from lucide-react) in the scan zone alongside existing scan button
- On iOS Safari — `getUserMedia` works in mobile Safari 11+, no issues
- `jsqr` is ~30KB, no wasm, no native deps — perfect for this use case
- Viewfinder: a 260×260 centered square with corner accent brackets (CSS/SVG)
- Scan frequency: rAF loop (60fps) — responsive without being wasteful
- Add `playBeep` on camera success for audio feedback

### No DB/edge function changes needed — camera just provides the QR text, then the existing `lookupTicket` flow runs exactly as before.
