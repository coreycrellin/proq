# Pattern Maker — Islamic Geometric & Escher Patterns

## Feasibility Assessment

**Can Parakeet serve as a basis?** Not directly — Parakeet is a closed-source Grasshopper/Rhino plugin (C#/.NET). But its *conceptual architecture* is excellent and well-documented enough to replicate the key algorithms in a web stack. The good news: the underlying math (tilings, star patterns, symmetry groups, isohedral tessellations) is well-studied and has existing JavaScript implementations we can build on.

## Core Architecture: "Tile + Transform + Decorate"

Parakeet's workflow is: **pick a tiling → apply a pattern method → render**. We'd replicate this as a three-stage pipeline:

### Stage 1: Tiling Engine (The Grid)
Generate the base tessellation that patterns are built on.

| Tiling Type | Algorithm | Relevance |
|---|---|---|
| Regular tilings (square, hex, triangle) | Simple grid math | Foundation for everything |
| Semi-regular (Archimedean) tilings | Vertex configuration notation (e.g. 3.6.3.6) | Islamic patterns use these heavily |
| k-uniform tilings | Extended vertex configs | Advanced Islamic patterns |
| Isohedral tilings (93 types) | **TactileJS library** | Escher-style tessellations |
| Hyperbolic tilings (Poincaré disk) | Dunham's algorithm / **EscherSketch** | Escher's Circle Limit series |

### Stage 2: Pattern Generation (The Decoration)
Apply pattern-making algorithms to the tiling:

**Islamic Geometric Patterns:**
- **Hankin method** (polygons in contact) — Lines from midpoints of polygon edges at a contact angle; where they meet forms the star. Single parameter controls the entire pattern family. This is what Kaplan's research and Parakeet's Star Pattern components use.
- **Symmetry group replication** — Design a motif in a fundamental domain, apply wallpaper group transforms (17 groups). Good for complex hand-designed patterns.
- **n-fold rosette construction** — Parametric star/rosette generation (6-fold, 8-fold, 10-fold, 12-fold).

**Escher-Style Patterns:**
- **Isohedral tiling deformation** — Start with a known isohedral tiling type, deform tile edges with Bézier curves while preserving the symmetry constraints. TactileJS handles the math.
- **Heesch type classification** — 28 tile types that tessellate via translation, rotation, glide reflection. User edits one edge, constraints propagate.

### Stage 3: Rendering
- **SVG** (primary) — Resolution-independent, exportable, styleable with CSS, DOM-interactable for editing
- **Canvas/WebGL** (secondary) — For real-time preview of large/hyperbolic patterns
- Export: SVG, PNG, PDF (via svg-to-pdf)

## Proposed Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Rendering | SVG + D3.js | Vector output, zoom/pan, pattern editing. D3 handles transforms natively |
| Geometry | Paper.js or custom | Boolean ops, path offsetting, intersection |
| Isohedral tilings | TactileJS | Battle-tested Escher tessellation library (Craig Kaplan's PhD work) |
| Hyperbolic | Port from EscherSketch | WebGL Poincaré disk rendering |
| UI framework | React (already in proq) | Fits existing stack |
| State | Zustand or React context | Pattern parameters, undo/redo history |

## Feature Roadmap

### Phase 1: Foundation (MVP)
- [ ] Canvas component with SVG rendering, zoom/pan (d3-zoom)
- [ ] Regular + semi-regular tiling generator (the 11 Archimedean + 3 regular)
- [ ] Hankin method Islamic star pattern generator with contact angle slider
- [ ] Basic isohedral tiling with edge deformation (TactileJS integration)
- [ ] Parameter panel: tiling type, symmetry, scale, contact angle, colors
- [ ] SVG export

### Phase 2: Rich Patterns
- [ ] All 17 wallpaper symmetry groups with fundamental domain editor
- [ ] n-fold rosette library (6, 8, 10, 12-fold presets)
- [ ] Interlace/weaving rendering (over-under crossings — signature Islamic feature)
- [ ] Escher: all 93 isohedral types with Bézier edge editing
- [ ] Color symmetry (perfect coloring algorithms)
- [ ] Pattern library / presets (historic patterns: Alhambra, Topkapı, etc.)

### Phase 3: Advanced
- [ ] Hyperbolic tilings (Poincaré disk — Escher's Circle Limit)
- [ ] Pattern-on-surface mapping (project onto 3D meshes via Three.js)
- [ ] Fractal/recursive subdivision patterns
- [ ] Animation (parameter morphing, growth patterns)
- [ ] Collaborative editing / sharing

## Key Algorithms to Implement

### 1. Hankin Method (Islamic Stars)
```
For each edge E of the base tiling:
  1. Find midpoint M of E
  2. From M, cast two rays inward at ±(contact_angle) from E's normal
  3. Intersect each ray with rays from adjacent edges
  4. Connect intersection points → forms the star/rosette motif
```
Single `contact_angle` parameter (typically 55°–75°) controls pattern family.

### 2. Isohedral Tiling Deformation (Escher)
```
1. Select isohedral type (IH1–IH93) from TactileJS
2. For each edge of the prototile:
   - Edge has a symmetry constraint (translation, rotation, glide)
   - User edits edge as Bézier curve
   - Paired/constrained edges auto-update per symmetry
3. Tile the plane by applying the tiling's symmetry group
```

### 3. Wallpaper Group Replication
```
1. User draws motif in fundamental domain (triangle/rectangle)
2. Select one of 17 wallpaper groups (p1, p2, pm, pg, cm, ...)
3. Apply group generators (translations, rotations, reflections, glides)
4. Clip to desired region
```

## Proposed Project Structure

```
src/
├── pattern-maker/
│   ├── engine/
│   │   ├── tilings/           # Tiling generators
│   │   │   ├── regular.ts     # Square, hex, triangle grids
│   │   │   ├── archimedean.ts # 11 semi-regular tilings
│   │   │   └── hyperbolic.ts  # Poincaré disk tilings
│   │   ├── patterns/
│   │   │   ├── hankin.ts      # Islamic star pattern (polygons in contact)
│   │   │   ├── rosette.ts     # n-fold rosette construction
│   │   │   ├── interlace.ts   # Over-under weaving
│   │   │   └── wallpaper.ts   # 17 symmetry group transforms
│   │   ├── escher/
│   │   │   ├── isohedral.ts   # TactileJS integration
│   │   │   └── deform.ts      # Bézier edge deformation
│   │   └── geometry/
│   │       ├── vector.ts      # 2D vector math
│   │       ├── transform.ts   # Affine transforms
│   │       └── intersect.ts   # Line/ray intersection
│   ├── components/
│   │   ├── PatternCanvas.tsx  # Main SVG canvas with zoom/pan
│   │   ├── TilingPicker.tsx   # Visual tiling type selector
│   │   ├── ParamPanel.tsx     # Sliders, dropdowns for pattern params
│   │   ├── ColorPalette.tsx   # Color scheme editor
│   │   └── ExportDialog.tsx   # SVG/PNG/PDF export
│   └── presets/
│       ├── islamic.json       # Historic pattern parameter sets
│       └── escher.json        # Classic Escher-style presets
```

## What Parakeet Does That We'd Replicate vs. Skip

| Parakeet Feature | Replicate? | Notes |
|---|---|---|
| Star Pattern I & II | ✅ Yes | Core Islamic patterns — Hankin method |
| Semi-regular tilings | ✅ Yes | Essential base grids |
| Isohedral tilings | ✅ Yes | Via TactileJS — Escher patterns |
| Hyperbolic tilings | ✅ Phase 3 | Poincaré disk for Circle Limit |
| Venation/growth patterns | ❌ Skip | Natural patterns, not our focus |
| DLA/aggregation | ❌ Skip | Natural patterns |
| Maze algorithms | ❌ Skip | Not relevant |
| 3D surface mapping | ⚠️ Maybe Phase 3 | Nice for architectural viz |
| Calligraphy | ❌ Skip | Very specialized |
| Fracture patterns | ❌ Skip | Not relevant |

## Key Dependencies

- **tactile-js** — Isohedral tessellations (Craig Kaplan)
- **d3** — SVG rendering, zoom/pan, transforms
- **paper.js** (optional) — Path booleans, offsets for interlace rendering
- Existing: React, Next.js, Tailwind (already in proq)

## Summary

**Yes, Parakeet's architecture is an excellent conceptual blueprint.** The "tiling → pattern method → render" pipeline translates cleanly to a web app. The key algorithms (Hankin method, isohedral deformation, wallpaper groups) are well-documented in academic literature and have partial JavaScript implementations we can build on. The main advantage of a web-based version: interactive parameter editing with instant visual feedback, which Grasshopper's node-based approach can't match for this use case.
