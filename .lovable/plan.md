
## Add "IPL Fan Night — 28 March 2026" teaser header

**Goal**: Show a prominent announcement banner below the hero section telling users to get ready for IPL Fan Night starting 28 March 2026, with registrations opening soon.

**Two changes in `src/pages/Index.tsx`:**

### 1. Insert teaser banner between hero and match section (line 398)
Add a glowing announcement card right after the hero closes (after line 397), always visible regardless of match state:

```tsx
{/* ─── IPL FAN NIGHT TEASER ─── */}
<div className="mb-6 animate-slide-up" style={{ animationDelay: '0.04s' }}>
  <div className="relative overflow-hidden rounded-2xl border border-secondary/40 p-5 text-center"
    style={{
      background: 'linear-gradient(135deg, hsl(355 25% 7%), hsl(140 30% 7%), hsl(355 20% 8%))',
      boxShadow: '0 0 40px hsl(38 75% 52% / 0.2), 0 0 0 1px hsl(38 60% 52% / 0.15)',
    }}>
    {/* shimmer bar top */}
    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-secondary to-primary" />
    <div className="text-3xl mb-2">🏆</div>
    <p className="section-title mb-1">Coming Soon</p>
    <h2 className="font-display font-bold gradient-text-accent mb-1"
      style={{ fontSize: 'clamp(1.4rem, 6vw, 2rem)' }}>
      IPL Fan Night 2026
    </h2>
    <p className="text-foreground/80 text-sm font-medium mb-3">
      Get ready! Starting from <span className="text-secondary font-bold">28 March 2026</span>
    </p>
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-secondary/30 bg-secondary/10">
      <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
      <span className="text-secondary text-xs font-bold uppercase tracking-widest">Registrations Opening Soon</span>
    </div>
  </div>
</div>
```

### 2. Update "Coming Soon" card copy (lines 630-632)
Update the generic copy to specifically mention IPL Fan Night and March 28:

```tsx
<h2 className="font-display text-2xl font-bold gradient-text mb-2">IPL Fan Night 2026 — Coming Soon</h2>
<p className="text-muted-foreground text-sm mb-6">
  Get ready for the biggest cricket celebration! IPL Fan Night starts from{' '}
  <span className="text-secondary font-semibold">28 March 2026</span>.
  Registrations will open soon — stay tuned!
</p>
```

**Result**: Every visitor sees the IPL teaser prominently below the hero, and the "no match" card also reflects the specific event details.
