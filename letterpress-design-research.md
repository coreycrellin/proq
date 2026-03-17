# Letterpress Website Design Research

Research for building a printmaker/poet portfolio site with a thick high-quality paper + letterpress aesthetic.

---

## Part 1: Real Letterpress Web Design Examples

### Letterpress Studio Sites Worth Studying

- **Studio On Fire** — [studioonfire.com](https://www.studioonfire.com) — Minneapolis premium packaging/letterpress. High-quality photography emphasizing texture and tactile depth.
- **Mama's Sauce** — [mamas-sauce.com](https://www.mamas-sauce.com) — Boutique spot color print shop (letterpress, screenprinting, hot foil).
- **Meticulous Ink** — [meticulousink.com](https://meticulousink.com) — Bath, UK. Original Heidelberg presses. Deep textured impressions on cotton paper.
- **Boxcar Press** — [boxcarpress.com](https://www.boxcarpress.com) — Major letterpress supplier and community hub.
- **Sesame Letterpress** — [sesameletterpress.com](https://www.sesameletterpress.com) — Brooklyn, 1880s antique presses. Vintage craft aesthetic.
- **Paper & Honey** — [paperandhoney.com](https://paperandhoney.com) — Michigan, "old-timey printing for new-timey times."
- **The Mandate Press** — [themandatepress.com](https://www.themandatepress.com) — Salt Lake City design-driven letterpress.
- **Elegante Press** — [elegantepress.com](https://www.elegantepress.com) — Letterpress, hot foiling, emboss, silkscreen on luxury cotton paper.

### Award-Winning Sites (Awwwards / Curated)

- **Awwwards Texture Collection** — [awwwards.com/websites/texture/](https://www.awwwards.com/websites/texture/) — Best single page to browse for textured web design.
- **Miranda Paper Portfolio** — [awwwards.com/sites/miranda-paper-portfolio](https://www.awwwards.com/sites/miranda-paper-portfolio) — Site of the Day, paper-themed portfolio.
- **-ism crafts** — [awwwards.com/sites/ism-crafts](https://www.awwwards.com/sites/ism-crafts) — Honorable Mention, Japanese craft shop with tactile aesthetic.
- **Newspaper-Inspired Websites** — [awwwards.com/newspaper-inspired-websites.html](https://www.awwwards.com/newspaper-inspired-websites.html) — Paper textures, big headlines, retro typography.
- **Mohawk Maker Quarterly** — [mohawkconnects.com/inspiration/maker-quarterly](https://www.mohawkconnects.com/inspiration/maker-quarterly) — Paper company editorial celebrating craft and printing.

### Inspiration Collections

- [Awwwards — Brilliant Uses of Texture in Website Design](https://www.awwwards.com/brilliant-uses-of-texture-in-website-design-and-some-resources.html)
- [Line25 — 15 Examples of Creative Paper Use in Web Design](https://line25.com/inspiration/25-examples-of-creative-paper-use-in-web-design/)
- [Tripwire Magazine — 35 Paper Texture Inspired Website Designs](https://tripwiremagazine.com/35-awesome-examples-of-paper-texture-inspired-website-design/)
- [WebFX — 30 Creative Examples of Using Paper in Web Designs](https://www.webfx.com/blog/web-design/30-creative-examples-of-using-paper-in-web-designs/)
- [Webflow — Best Paper Websites](https://webflow.com/made-in-webflow/paper)
- [FreeFrontEnd — 34 CSS Paper Effects](https://freefrontend.com/css-paper-effects/)
- [Subframe — 10 CSS Paper Effect Examples](https://www.subframe.com/tips/css-paper-effect-examples)

---

## Part 2: CSS Techniques for Letterpress & Paper

### Debossed / Letterpress Text (text-shadow)

The fundamental CSS technique. Text slightly darker than background + light shadow below = pressed-in illusion.

**On dark backgrounds:**
```css
.debossed {
  color: #1a1a1a;
  text-shadow: 0px 1px 1px rgba(255, 255, 255, 0.1);
}
```

**On light/cream backgrounds (more like real letterpress):**
```css
.letterpress-light {
  color: #d7dee1;
  text-shadow: 0 2px 3px rgba(255, 255, 255, 0.3),
               0 -1px 2px rgba(0, 0, 0, 0.2);
}
```

**Deep inset with background-clip:**
```css
.deep-inset {
  background-color: #666666;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: rgba(255,255,255,0.5) 0px 3px 3px;
}
```

Rules:
- Text must be only slightly darker than background (a few shades)
- Use `rgba()` for transparency
- 1px offset + 1px blur = classic subtle letterpress
- Embossed (raised) = light shadow top-left, dark bottom-right
- Debossed (pressed) = dark shadow top-left, light bottom-right

### Paper Texture Overlay (No Images Needed)

**SVG feTurbulence noise — the primary technique:**
```html
<svg width="0" height="0">
  <filter id="grain">
    <feTurbulence type="fractalNoise" baseFrequency="0.65"
                  numOctaves="3" stitchTiles="stitch"/>
  </filter>
</svg>
```
```css
.grain-overlay::before {
  content: '';
  position: fixed;
  inset: 0;
  filter: url(#grain);
  opacity: 0.05;
  pointer-events: none;
}
```

**Image-based texture overlay:**
```css
.texture-overlay {
  position: fixed;
  inset: 0;
  background: url('/paper-texture.png') repeat;
  mix-blend-mode: multiply;
  pointer-events: none;
  opacity: 0.3;
  z-index: 9999;
}
```

### Paper Color Palette

Real letterpress paper is never pure white:
- Warm cream: `#f5f0e8` or `#faf6f0`
- Cool cotton: `#f0f0ec`
- Kraft brown: `#c4a882`
- Aged parchment: `#e8dcc8`

### CodePen Demos

- [Letterpress Effect with Text Shadow](https://codepen.io/kccnma/pen/nadNRx)
- [Engrave & Emboss in Pure CSS](https://codepen.io/daryl/pen/XWXpyz)
- [CSS Text Embossing Effect](https://codepen.io/firstwebdesigner/pen/JjeEMGb)
- [Rough Paper Texture with SVG Filters](https://codepen.io/Chokcoco/pen/OJWLXPY)
- [CSS Wrinkled Paper (Giana)](https://codepen.io/giana/pen/YVEMaM)

### CSS Texture Tools

- [Frontend Hero CSS Noise Generator](https://frontend-hero.com/css-noise-generator)
- [nnnoise by fffuel](https://www.fffuel.co/nnnoise/) — SVG noise texture generator
- [CSSmatic Noise Texture](https://www.cssmatic.com/noise-texture)
- [Subtle Patterns by Toptal (paper tag)](https://www.toptal.com/designers/subtlepatterns/tag/paper/)

---

## Part 3: Three.js / WebGL Libraries & Techniques

### Dedicated Libraries

**@paper-design/shaders** — The most directly relevant library. Zero-dependency. Works with React and vanilla JS.
- Provides a `PaperTexture` shader with params: `fiber`, `fiberSize`, `crumples`, `crumpleSize`, `folds`, `foldCount`, `roughness`, `drops`, `fade`, `seed`, `scale`
- ~442K npm downloads
- Demo: [shaders.paper.design](https://shaders.paper.design/)
- Paper texture specifically: [shaders.paper.design/paper-texture](https://shaders.paper.design/paper-texture)
- GitHub: [paper-design/shaders](https://github.com/paper-design/shaders)
- npm: `@paper-design/shaders-react`
- **Note:** Renders to `<canvas>` directly (not inside Three.js scene graph). Use as background/overlay or sample as texture.

**Risograph Grain Shader** — Best ready-made print-like grain effect. Screen-space simplex noise that "sticks" to the screen.
- GitHub: [Robpayot/risograph-grain-shader](https://github.com/Robpayot/risograph-grain-shader)
- Tutorial: [Codrops — Creating a Risograph Grain Light Effect in Three.js](https://tympanus.net/codrops/2022/03/07/creating-a-risograph-grain-light-effect-in-three-js/)

**Troika Text** — SDF-based text rendering for Three.js. Lets you supply any material as base.
- Use `MeshStandardMaterial` with a paper normal map
- Use `createDerivedMaterial()` to inject custom shader code for displacement/letterpress depth
- [Troika docs](https://protectwise.github.io/troika/troika-three-text/)
- npm: `troika-three-text`

**pmndrs/lamina** — Declarative layer-based shader material for R3F. Stack layers:
- `Noise` layer for paper grain
- `Displace` layer for surface deformation
- `Depth` or `Fresnel` for edge effects
- Custom GLSL layers for ink absorption
- GitHub: [pmndrs/lamina](https://github.com/pmndrs/lamina)
- **Caveat:** Still WIP, may have compatibility issues with newer Three.js.

### Letterpress Impression Techniques

**Approach A: Text-to-Canvas as Height/Normal Map (most practical)**
1. Render text to 2D `<canvas>` using `fillText()` (white text on black = height map)
2. Use as bump/normal map on `MeshStandardMaterial` applied to subdivided plane
3. Invert for debossed, non-inverted for embossed
4. Optionally convert height→normal via Sobel filter in shader

References:
- [Text-to-Canvas-to-Texture pipeline (Three.js Forum)](https://discourse.threejs.org/t/an-example-of-text-to-canvas-to-texture-to-material-to-mesh-not-too-difficult/13757)
- [Creating Normal Maps from Canvas (Three.js Forum)](https://discourse.threejs.org/t/is-it-possible-to-create-normalmap-from-html5-canvas/26946)
- [Normal Maps in Three.js (Dustin Pfister)](https://dustinpfister.github.io/2021/06/24/threejs-normal-map/)

**Approach B: Troika Text + Custom Derived Material** — SDF text with paper material and custom vertex/fragment shader for impression depth.

**Approach C: TextGeometry with Bevel + Lighting** — Built-in `TextGeometry` with small extrusion depth, bevel, and raking directional light. Simpler but less realistic.

### Grain / Halftone Post-Processing

- **Three.js HalftoneShader** — Built-in halftone dot printing as post-processing
  - [Official RGB Halftone example](https://threejs.org/examples/webgl_postprocessing_rgb_halftone.html)
- **glsl-film-grain** — Realistic noise-based grain (Matt DesLauriers)
  - GitHub: [mattdesl/glsl-film-grain](https://github.com/mattdesl/glsl-film-grain)
- **Grain on Scroll (Codrops, 2024)** — [Tutorial](https://tympanus.net/codrops/2024/07/18/how-to-create-distortion-and-grain-effects-on-scroll-with-shaders-in-three-js/)

### R3F (React Three Fiber) Specifics

- [Displacement/Normal Maps in R3F (codeworkshop.dev)](https://codeworkshop.dev/blog/2020-11-05-displacement-maps-normal-maps-and-textures-in-react-three-fiber)
- [Adding texture to ShaderMaterial in R3F (Medium)](https://gabrielm-linassi.medium.com/adding-texture-to-a-glsl-shader-material-on-react-three-fiber-612c7db7cc4)
- [Shader-Based Reveal Effect with R3F (Codrops)](https://tympanus.net/codrops/2024/12/02/how-to-code-a-shader-based-reveal-effect-with-react-three-fiber-glsl/)
- [The Study of Shaders with R3F (Maxime Heckel)](https://blog.maximeheckel.com/posts/the-study-of-shaders-with-react-three-fiber/)
- [three.js displacementMap/normalMap CodePen](https://codepen.io/kuxazoso/pen/GVYMda?editors=0010)

---

## Part 4: Paper Texture Rendering (Separate from Letterpress)

Paper texture and letterpress impression are two independent layers. The paper is the surface; the letterpress is what's done to it.

### CSS-Only Paper Texture

**SVG feTurbulence** is the primary technique. Key parameters:
- `type="fractalNoise"` — organic, cloudy pattern (vs `turbulence` which is ripple-like)
- `baseFrequency` — grain size. Lower (~0.04) = coarse tooth; higher (~0.15) = fine smooth
- `numOctaves` — more octaves = more fiber detail. 4-5 typical for paper

**Multi-layer approach for realistic depth:**
1. Base color (off-white gradient, `#f9f7f1` center to `#f5f1e6` edges)
2. SVG noise via `::before` with `mix-blend-mode: multiply`
3. Subtle diagonal linear gradients at low opacity for crease simulation
4. Radial gradients on `::after` for age spots (optional)

**Reference articles:**
- [Codrops/Sara Soueidan: SVG feTurbulence deep-dive](https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence/)
- [CSS-Tricks: Grainy Gradients](https://css-tricks.com/grainy-gradients/)
- [freeCodeCamp: Grainy CSS Backgrounds](https://www.freecodecamp.org/news/grainy-css-backgrounds-using-svg-filters/)

### Three.js Paper Material Setup

Use `MeshPhysicalMaterial` with:
```
normalMap        — paper fiber/grain surface detail
normalScale      — Vector2, start around 0.3-0.8
roughness        — 0.85-1.0 for matte paper feel
roughnessMap     — spatial variation (smoother in some areas)
map              — diffuse/albedo (cream/off-white with subtle variation)
displacementMap  — optional, for thick paper with visible tooth
aoMap            — ambient occlusion for fiber depth
```

**Subsurface scattering (paper translucency):**
1. `MeshPhysicalMaterial` built-in: set `transmission` (0-1), low `thickness`, warm `attenuationColor`
2. [MeshTranslucentMaterial](https://threejs-subsurface.vercel.app/) — drop-in SSS replacement
3. [mattdesl's SSS gist](https://gist.github.com/mattdesl/2ee82157a86962347dedb6572142df7c) — patches SSS into PBR pipeline
4. [Three.js SSS example](https://threejs.org/examples/webgl_materials_subsurface_scattering.html)

### Procedural Paper Shaders (GLSL)

Building blocks for generating paper texture without image files:

1. **FBM (Fractional Brownian Motion)** — multiple octaves of Perlin/Simplex noise. Creates base paper grain. 4-6 octaves typical.
2. **Anisotropic noise** — stretch x or y coordinate before noise function. Simulates directional fiber alignment.
3. **Worley/Cellular noise** — fiber clump patterns. Cell boundaries = where fiber bundles meet.
4. **Domain warping** — feed noise output back as coordinate offsets. Creates organic non-uniform distortion of handmade paper.
5. **Color modulation** — base `vec3(0.95, 0.93, 0.88)` with subtle FBM variation. Paper is never uniform.

**ShaderToy examples:**
- [Paper Texture](https://www.shadertoy.com/view/ddjcRm)
- [Tileable Perlin-Worley 3D](https://www.shadertoy.com/view/3dVXDc)

**Key resources:**
- [Book of Shaders: Noise (Ch 11)](https://thebookofshaders.com/11/)
- [Book of Shaders: Cellular Noise (Ch 12)](https://thebookofshaders.com/12/)
- [GLSL Noise Algorithms collection](https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83)
- [stegu/webgl-noise library](https://stegu.github.io/webgl-noise/webdemo/)
- [NVIDIA GPU Gems: Improved Perlin Noise](https://developer.nvidia.com/gpugems/gpugems2/part-iii-high-quality-rendering/chapter-26-implementing-improved-perlin-noise)

### Free PBR Paper Texture Downloads (CC0)

- **AmbientCG** — [ambientcg.com/list?q=paper](https://ambientcg.com/list?q=paper) — Paper001 through Paper006 + Cardboard sets. All CC0. Includes Color, Normal, Roughness, Displacement, AO maps.
- **Poly Haven** — [polyhaven.com/textures](https://polyhaven.com/textures) — CC0, up to 8K resolution.
- **3D Textures** — [3dtextures.me](https://3dtextures.me) — Full PBR sets.
- **ShareTextures** — [sharetextures.com](https://www.sharetextures.com) — CC0, up to 4K.

### Paid / Specialty Paper Textures

- **Poliigon** — [poliigon.com](https://www.poliigon.com) — Professional PBR with dedicated paper category.
- **Superellipse** — [Kitakata Japanese Washi Paper PBR (4K)](https://superellipse.co/en-us/products/kitakata-japanese-washi-paper) — Calibrated maps, 25cm physical scale.
- **Adobe Substance 3D** — [Japanese Washi Paper 01](https://substance3d.adobe.com/assets/allassets/f054b4d1ef6e43bb29fc5f391384c986cbc75426)
- **TextureCan** — [Japanese Shoji Screen Paper](https://www.texturecan.com/details/281/) — Free PBR + SBSAR for procedural fiber density adjustment + translucency mask.
- **FlippedNormals** — [84 Washi Paper Textures](https://flippednormals.com/product/84-washi-paper-textures-10622)

---

## Part 5: Paper Types & How They Render Differently

| Property | Cotton Rag | Laid | Wove | Washi |
|---|---|---|---|---|
| Normal map character | Random organic noise | Regular parallel lines + noise | Very subtle fine noise | Long directional fibers |
| Roughness | 0.9–1.0 | 0.8–0.95 | 0.7–0.85 | 0.6–0.9 (variable) |
| Displacement depth | Medium | Medium (ridges) | Low | Low–medium |
| Translucency | Low–moderate | Low | Low | **High** (defining trait) |
| Color uniformity | Moderate variation | Moderate | High (uniform) | Low (highly variable) |
| Key shader technique | Multi-octave FBM | Sine waves + FBM | Low-amplitude FBM | Anisotropic noise + SSS |

### Cotton Rag (Rives BFK, Stonehenge, Arches)
- Thick, soft, visible random fiber structure, deckle edges, warm off-white
- Normal map: high-frequency organic FBM noise (5+ octaves), no directional bias
- Color: warm cream `~#F5F0E8` with subtle FBM-driven variation
- Edge treatment: irregular deckle edges via alpha mask or geometry displacement

### Laid Paper
- Visible parallel "laid lines" (~1mm spacing) crossed by "chain lines" (~25mm spacing)
- Normal map: sine-wave pattern (regular lines) with subtle FBM on top
- **The lines are the defining characteristic** — without them it's just generic paper

### Wove Paper
- Smooth, uniform. The simplest to render.
- Normal map: very subtle fine-grained noise, low amplitude FBM
- Essentially fine grain noise with minimal surface relief

### Japanese Washi
- Long visible fibers, translucent, irregular thickness, sometimes botanical inclusions
- **SSS/translucency is critical** — washi is often semi-transparent
- Normal map: anisotropic noise stretched heavily in fiber direction, or elongated Worley noise
- Alpha/opacity variation visible when backlit (unlike Western papers)

---

## Part 6: Recommended Architecture

For a printmaker/poet portfolio, here's how these layers combine:

1. **Paper surface** — Subdivided `PlaneGeometry` with `MeshPhysicalMaterial`. Apply PBR paper textures from AmbientCG (albedo + normal + roughness) OR procedural FBM noise shader. For a simpler approach, use `@paper-design/shaders` as a canvas background.

2. **Letterpress impression** — Render text to a 2D `<canvas>` at high resolution. Use as bump/normal map on the same material (inverted = debossed). For actual geometry deformation, use as displacement map with sufficient subdivisions.

3. **Ink absorption** — Overlay noise-based grain (risograph shader technique or glsl-film-grain) that is stronger in text areas, weaker in paper areas. Simulates ink bleeding into fibers.

4. **Lighting** — Single directional light at a raking angle to emphasize impression depth, like photographing real letterpress work.

5. **In React Three Fiber** — `@react-three/drei`'s `useTexture` for PBR maps, custom `shaderMaterial` or Lamina layers for procedural effects, Troika for dynamic text.

**Simpler CSS-only alternative:**
- Warm cream background (`#f5f0e8`)
- SVG feTurbulence noise overlay at low opacity
- `text-shadow` letterpress effect on typography
- Serif/slab-serif fonts at generous sizes with careful letterspacing
- 1-2 spot colors plus paper tone (mimics real ink-on-paper constraints)
