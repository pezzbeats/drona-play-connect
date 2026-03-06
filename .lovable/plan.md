
## Changes needed

### 1. Sticky bar — add dismiss (X) button
Add a close button to the sticky bar so users can hide it. Use local state `const [barDismissed, setBarDismissed] = useState(false)` in `Index.tsx`. When dismissed, the entire bar is unmounted. The X sits as a small icon button to the right of both CTA buttons.

```text
┌──────────────────────────────────────────────────┐
│  [Reserve Seats →]  [View Passes →]  [✕]         │
└──────────────────────────────────────────────────┘
```

Remove the existing `pr-[84px]` hack (it was only needed because the mic button was bottom-right). Replace with `pr-0` + the X button in the row itself.

### 2. VoiceAgent — move to top-right
Change `fixed bottom-[88px] right-5` → `fixed top-5 right-5` in `VoiceAgent.tsx`.

The status label ("Speaking… / Listening…") currently sits to the left of the button. At top-right this still works fine — the label just shifts left from the top-right corner.

The "Need Help? 🎙️" nudge text also sits to the left inline — that's fine at top-right too.

### Files to change
1. **`src/pages/Index.tsx`**
   - Add `useState` import for `barDismissed`
   - Add `X` to the lucide imports  
   - Add `const [barDismissed, setBarDismissed] = useState(false)` near other state declarations
   - Wrap sticky bar in `{!barDismissed && (...)}`
   - Remove `pr-[84px]` from the flex container
   - Add X dismiss button at the end of the flex row

2. **`src/components/VoiceAgent.tsx`**
   - Change `bottom-[88px]` → `top-5` in the wrapper div's positioning class

### New sticky bar markup
```tsx
{!barDismissed && (
  <div className="fixed bottom-0 inset-x-0 z-[9000] pb-safe">
    <div className="backdrop-blur-md bg-background/80 border-t border-border/50 px-4 pt-2.5 pb-3">
      <div className="flex gap-2.5 max-w-2xl mx-auto items-center">
        <Link to="/register" className="flex-1">
          <button className="w-full h-12 btn-gradient rounded-xl ...">Reserve Seats <ChevronRight /></button>
        </Link>
        <Link to="/ticket" className="flex-1">
          <button className="w-full h-12 bg-success ...">View Passes <ChevronRight /></button>
        </Link>
        <button
          onClick={() => setBarDismissed(true)}
          aria-label="Dismiss"
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
)}
```
