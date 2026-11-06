# How a 4-Stroke Engine Works — 3D Explainer: Design

Date: 2026-11-06

## Goal

A 3D website that teaches high-school / early-engineering students how a 4-stroke
piston engine works. After using it, a student can name the 4 strokes and the main
parts, and explain displacement, compression ratio, why the cam turns at half crank
speed, and why an inline-4 uses firing order 1-3-4-2.

Audience: students on desktop browsers (laptops, lab PCs). Phones must not break
(layout stacks, 3D still renders) but are not the design target.

Success: a student can scroll the guided walkthrough start to finish, then use the
sandbox, with motion that is mechanically correct at every crank angle.

## Out of scope

Sound, quizzes, other engine types (diesel, 2-stroke, rotary), translations,
accounts, backend, build tooling.

## Approach

Plain Three.js, engine built procedurally in code (cylinders, boxes, tori), motion
driven by exact kinematics. Static files only; Three.js `0.160.0` loaded via import
map from a CDN (pinned exact version). Schematic, color-coded look rather than
photoreal.

## Page structure

1. **Hero** — full-screen single-cylinder engine idling slowly, title
   "How a 4-Stroke Engine Works", scroll hint.
2. **Guided walkthrough** — 3D canvas pinned on one side, text panels scroll on the
   other. Scroll position maps directly to crank angle θ (scroll back = engine runs
   back).

   | Step | θ (crank) | Scene | Numbers |
   |---|---|---|---|
   | Meet the parts | held at 0° | Labels on piston, rod, crankshaft, intake/exhaust valves, camshaft, spark plug | — |
   | 1. Intake | 0–180° | Intake valve open, blue mixture flows in, piston down | Bore 86 mm, stroke 86 mm → displacement = π/4·b²·s ≈ 0.5 L |
   | 2. Compression | 180–360° | Valves shut, mixture color shifts blue→yellow as it's squeezed | Compression ratio 10:1 |
   | 3. Power | 360–540° | Spark flash at 360°, orange burst, piston driven down | Only 1 of 4 strokes makes power |
   | 4. Exhaust | 540–720° | Exhaust valve open, grey gas exits | 1 cycle = 2 crank turns → cam turns at ½ crank speed |
   | 1 → 4 cylinders | 0–720° looping with scroll | Camera pulls back, engine becomes inline-4 | Firing order 1-3-4-2, power stroke every 180° |

3. **Sandbox** — inline-4 by default, OrbitControls camera, plus:
   - RPM slider 0–6000. Animation runs at RPM/100 (6000 RPM shown as 60 rpm) with a
     label "shown at 1/100 speed". 0 = stopped.
   - Play/pause; step buttons ±5°.
   - Cutaway toggle (hides block/head so internals are visible).
   - 1 / 4 cylinder toggle.
   - Click a part → side card with its name and what it does (text in `parts.js`).
   - Live readout: θ and the current stroke of each cylinder.

## Code organization

```
index.html          page skeleton, text panels, sandbox UI, import map
style.css
js/main.js          renderer, camera, lights, render loop; scroll vs sandbox mode
js/kinematics.js    pure math, no Three.js imports
js/engine.js        builds meshes for 1 or 4 cylinders; update(θ)
js/effects.js       gas color/particles, spark flash; update(θ)
js/scroll.js        scroll position → current step + θ
js/sandbox.js       controls, raycast picking, info cards
js/parts.js         part card text
test/kinematics.test.js
```

### Single source of truth: crank angle θ

θ is in degrees, 0–720 for one full 4-stroke cycle (wraps). Scroll mode derives θ from
scroll; sandbox mode advances θ by `RPM/100 · 360/60 · dt` degrees per frame. Each
frame `engine.update(θ)`, `effects.update(θ)` and the readout consume θ. No other code
moves parts.

### kinematics.js API

Geometry constants: crank radius r = 43 mm (stroke/2), rod length l = 143 mm.

- `pistonY(θ, r, l)` — piston pin height above crank axis, exact slider-crank:
  `r·cos θ + √(l² − r²·sin² θ)`. Max (TDC) at θ = 0°, 360°; min (BDC) at 180°, 540°.
- `valveLift(θ, opens, closes, maxLift)` — 0 outside [opens, closes], smooth
  `sin²` bump inside, peak maxLift (9 mm) at midpoint. Simplified timing, no overlap:
  intake 0–180°, exhaust 540–720°. A note in the Exhaust panel mentions real engines
  overlap these slightly.
- `strokeAt(θ)` — `"intake" | "compression" | "power" | "exhaust"` by 180° quarter
  of θ mod 720.
- `cylinderPhase(i, firingOrder)` — for cylinder number i (1-based), returns
  `180 · firingOrder.indexOf(i)` so cylinder i runs at θ − phase. With [1,3,4,2]:
  cyl1 0°, cyl3 180°, cyl4 360°, cyl2 540°.

### Error handling

If WebGL is unavailable, show a plain message plus a static diagram instead of the
canvas. The CDN is the only external dependency.

## Testing

- `node --test test/` on kinematics.js, no dependencies:
  - pistonY is max at 0° and 360°, min at 180° and 540°, and max−min equals stroke.
  - valveLift is 0 for both valves throughout compression (180–360°) and power
    (360–540°).
  - strokeAt returns the right stroke at 90, 270, 450, 630.
  - With firing order 1-3-4-2, exactly one cylinder is in power stroke at any θ, and
    each cylinder enters power once per 720°, in order 1,3,4,2.
- Browser screenshot check of each walkthrough step and the sandbox.
