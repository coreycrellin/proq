# DONK IT UP

## The Philosophy

In the South — Georgia, Florida, the Carolinas — there's a car culture called **donks**. Originally a 1971-76 Chevy Impala on 26" rims, the term now covers any big-body vehicle that's been given THE TREATMENT: lifted to the sky, rolling on wheels that cost more than the car, painted in candy colors or wrapped head-to-toe in a Skittles theme, chrome dripping off every surface, subwoofers rattling the windows of everyone in a three-block radius.

A donk is not trying to blend in. A donk is maximalist self-expression. It's loud, proud, and unapologetically extra.

**"Donk it up"** means: take whatever we're working on — UI, code, config, docs — and apply donk principles. Remove all restraint. Turn it up past 10.

---

## The Principles

### 1. LIFTED — Big Spacing

A donk sits HIGH. The suspension lift is the first thing you notice. In UI terms: **absurd padding, margins, and gaps**. Everything floats. Nothing is cramped.

```
// Normal
className="p-4 gap-2"

// Donked
className="p-12 gap-8 my-10"
```

Whitespace isn't "breathing room" — it's a lift kit. Elements should look like they're hovering above the page.

### 2. RIMS — Oversized Interactive Elements

The wheels are the centerpiece of a donk. 24", 26", 28", 30"+. In UI: **buttons, icons, inputs, and interactive elements should be MASSIVE**. Thick borders. Huge border-radius. They dominate the layout.

```
// Normal
className="px-4 py-2 rounded-md text-sm"

// Donked
className="px-10 py-5 rounded-3xl text-2xl font-black border-4"
```

If a user can't see the button from across the room, it's not donked.

### 3. CANDY PAINT — Saturated Color

No muted tones. No `gray-400`. Donk colors are **candy-coated, neon, and electric**. Gradients are mandatory.

```
// Normal
className="bg-blue-600 text-white"

// Donked
className="bg-gradient-to-r from-fuchsia-500 via-cyan-400 to-yellow-300 text-white"
```

Think: what would this look like if it were a Jolly Rancher? A pack of Skittles? A Miami sunset reflecting off chrome? That's your palette.

### 4. CHROME — Shine & Gloss Effects

If a surface exists on a donk, it's chromed. In UI: **glassmorphism, metallic gradients, shimmer animations, glossy borders**. Things should gleam.

```
// Normal
className="bg-zinc-800 border border-zinc-700"

// Donked
className="bg-zinc-800/60 backdrop-blur-xl border border-white/20 shadow-[0_0_30px_rgba(139,92,246,0.3)]"
```

Layer those box-shadows. Make borders translucent and glowing. If it's not catching light, it's not chromed.

### 5. SOUND SYSTEM — Animations That Hit

A donk's sound system rattles your chest. The bass is physical. In UI: **bouncy transitions, pulsing glows, entrance animations, hover effects with WEIGHT**. Things should move like they have hydraulics.

```css
/* Normal */
transition: opacity 150ms ease;

/* Donked */
transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
animation: donk-bounce 0.6s ease infinite alternate;

@keyframes donk-bounce {
  from { transform: translateY(0) scale(1); }
  to { transform: translateY(-8px) scale(1.05); }
}
```

Hover states should feel like hitting a switch on hydraulics — snappy, bouncy, alive.

### 6. CUSTOM INTERIOR — No Default Survives

Every inch of a donk's interior is customized. Matching upholstery, LED strips, TVs in the headrests. In UI: **style EVERYTHING**. Scrollbars, selection colors, focus rings, cursors, placeholder text, even the caret.

```css
/* Donked scrollbar */
::-webkit-scrollbar { width: 14px; }
::-webkit-scrollbar-track { background: linear-gradient(to bottom, #1a1a2e, #16213e); }
::-webkit-scrollbar-thumb {
  background: linear-gradient(to bottom, #e94560, #0f3460);
  border-radius: 99px;
  border: 3px solid #1a1a2e;
}

/* Donked selection */
::selection {
  background: #f72585;
  color: #fff;
}
```

If a browser default is still visible, the job isn't done.

### 7. PRESENCE — Shadows, Glows, & Spectacle

A donk commands the parking lot. It doesn't ask for attention — it takes it. In UI: **stacked shadows, colored glows, text shadows, neon outlines**. Visual gravity on every element.

```
// Normal
className="shadow-md"

// Donked
className="shadow-[0_4px_20px_rgba(244,63,94,0.4),0_8px_40px_rgba(139,92,246,0.3),0_0_80px_rgba(6,182,212,0.15)]"
```

If your component doesn't have at least two shadow layers, it's stock.

### 8. WRAP / THEME — Cohesive & Committed

Donks don't half-theme. If it's a Snickers donk, EVERYTHING is Snickers — paint, interior, rims, even the air freshener. In UI: **pick a vibe and go ALL IN**. Every component, every state, every micro-interaction should drip the same aesthetic.

No mixing minimal cards with donked buttons. It's all or nothing.

---

## The Checklist

Before you ship, ask yourself:

- [ ] **Is the padding unreasonable?** (If it feels "just right," add more)
- [ ] **Are buttons/inputs comically large?** (Visible from orbit)
- [ ] **Are there gradients?** (Minimum 2 color stops, ideally 3+)
- [ ] **Is something glowing?** (Box-shadow with color, `drop-shadow`, neon borders)
- [ ] **Are things animated?** (Hover, entrance, idle — something should always be moving)
- [ ] **Is there chrome/glass?** (`backdrop-blur`, translucent borders, metallic sheen)
- [ ] **Are ALL defaults styled?** (Scrollbars, selection, focus rings, placeholders)
- [ ] **Does it feel like too much?** (Good. That's the point. More.)
- [ ] **Is the theme consistent?** (Every element matches the vibe)
- [ ] **Would someone stop and stare?** (The parking lot test)

---

## Anti-Patterns (NOT Donk)

These are the enemies of donk. If you see these, you haven't donked it up:

- **Minimalism** — "Less is more" is the opposite of donk. More is more.
- **Muted palettes** — `slate-400` and `gray-500` are a stock Honda Civic.
- **Subtle transitions** — `opacity 150ms ease` is invisible. Unacceptable.
- **System fonts at default sizes** — That's a base-model Impala with hubcaps.
- **Single-color flat backgrounds** — No depth, no shine, no presence.
- **`rounded-md`** — This is a Corolla corner radius. You need `rounded-3xl` minimum.
- **Restraint of any kind** — If you're asking "is this too much?", the answer is always no.

---

## Before & After

### A Button

**Stock:**
```html
<button class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
  Save
</button>
```

**Donked:**
```html
<button class="
  px-12 py-5 text-2xl font-black uppercase tracking-widest
  bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400
  text-white rounded-full
  border-4 border-white/30
  shadow-[0_0_20px_rgba(236,72,153,0.6),0_0_60px_rgba(249,115,22,0.3)]
  hover:scale-110 hover:shadow-[0_0_40px_rgba(236,72,153,0.8),0_0_80px_rgba(249,115,22,0.5)]
  active:scale-95
  transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
  animate-pulse
">
  SAVE
</button>
```

### A Card

**Stock:**
```html
<div class="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
  <h3 class="text-sm font-medium">Task Title</h3>
  <p class="text-xs text-zinc-400">Description here</p>
</div>
```

**Donked:**
```html
<div class="
  p-10 bg-zinc-900/50 backdrop-blur-2xl
  border-2 border-cyan-400/30
  rounded-3xl
  shadow-[0_0_30px_rgba(34,211,238,0.2),0_10px_60px_rgba(0,0,0,0.5)]
  hover:border-cyan-400/60
  hover:shadow-[0_0_50px_rgba(34,211,238,0.4),0_10px_80px_rgba(0,0,0,0.6)]
  hover:-translate-y-2
  transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
  group
">
  <h3 class="text-2xl font-black bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent
    group-hover:from-fuchsia-500 group-hover:to-cyan-400 transition-all duration-500">
    TASK TITLE
  </h3>
  <p class="text-lg text-cyan-200/70 mt-4 tracking-wide">Description here</p>
</div>
```

---

## TL;DR

When someone says **"donk it up"**:

1. Triple the padding
2. Double the font size
3. Add a gradient (3+ stops)
4. Add a glow (colored box-shadow)
5. Make it bounce (spring easing, scale on hover)
6. Round it out (`rounded-3xl` or `rounded-full`)
7. Chrome it (glass, blur, translucent borders)
8. Commit to the theme (every element, every state)
9. Ask yourself: "Is this too much?" → No. Add more.
