
## Sticky Bottom CTA Bar — Implementation Plan

### What to build
A `fixed bottom-0` bar that stays visible as the user scrolls, containing both buttons side by side (or stacked, depending on space). It needs to sit above the VoiceAgent mic button (`z-[99999]`) — actually it should be below the mic so the mic stays accessible. The bar will be `z-[9000]` with padding-right to avoid overlapping the mic.

### Key decisions
- **Layout**: Two buttons side by side in a row — "Reserve Seats" (crimson gradient, flex-1) and "View Passes" (green, flex-1). Same visual style as the inline buttons above.
- **Height**: Compact — `h-14` total bar with `pb-safe` for iOS home indicator safety.
- **Blur backdrop**: `backdrop-blur-md` glass panel with border-top, so it doesn't hard-cut the content.
- **VoiceAgent conflict**: VoiceAgent is at `bottom-5 right-5`. The sticky bar is at `bottom-0`. The bar needs `padding-right` on mobile so the right button doesn't obscure the mic. Alternatively, give the bar `pr-20` on the right to leave space — but this wastes space. Better: **move VoiceAgent up** by changing its `bottom-5` to `bottom-20` so it floats above the sticky bar.
- **Page bottom padding**: The main content div needs `pb-24` so the sticky bar doesn't cover the footer.

### Files to change
1. **`src/pages/Index.tsx`**
   - Add `pb-24` to the outermost wrapper div so footer isn't hidden behind the bar
   - Add the sticky bar just before the closing `</div>` of the main wrapper (after `LandingFooter`), as a sibling element fixed to viewport
   
2. **`src/components/VoiceAgent.tsx`**
   - Change `bottom-5` to `bottom-[88px]` so it floats above the sticky bar

### Sticky bar markup (inside Index.tsx, outside the scroll container)
```tsx
{/* ─── STICKY BOTTOM CTA ─── */}
<div className="fixed bottom-0 inset-x-0 z-[9000] pb-safe">
  <div className="backdrop-blur-md bg-background/80 border-t border-border/50 px-4 pt-2.5 pb-3 flex gap-2.5 max-w-2xl mx-auto">
    <Link to="/register" className="flex-1">
      <button className="w-full h-12 btn-gradient rounded-xl font-display font-bold text-sm tracking-wide flex items-center justify-center gap-1.5 animate-glow-pulse">
        Reserve Seats <ChevronRight className="h-4 w-4" />
      </button>
    </Link>
    <Link to="/ticket" className="flex-1">
      <button className="w-full h-12 bg-success text-success-foreground rounded-xl font-display font-bold text-sm tracking-wide flex items-center justify-center gap-1.5 shadow-[0_0_16px_hsl(142_70%_45%/0.4)]">
        View Passes <ChevronRight className="h-4 w-4" />
      </button>
    </Link>
  </div>
</div>
```

The `pb-safe` utility (already defined in `index.css` as `padding-bottom: env(safe-area-inset-bottom)`) handles iPhone home bar. The `max-w-2xl mx-auto` constrains it on desktop to match the page width.

### Summary of changes
- `src/pages/Index.tsx`: Add sticky bar fixed element + `pb-24` on content wrapper
- `src/components/VoiceAgent.tsx`: `bottom-5` → `bottom-[88px]` so mic button clears the bar
