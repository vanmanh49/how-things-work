# Electric Motor Topic: Design

Date: 2026-11-06

## Goal

Add a third topic, at `/motor/`, that teaches how a simple brushed DC motor works and
how the same machine works as a generator.

After using it, a student can explain:

- **F = BIL.** A current in a magnetic field feels a force (left-hand rule), so a loop
  of wire in a field wants to turn.
- **The commutator.** It flips the current every half turn. Without it the loop only
  rocks back and forth.
- **Speed and torque.** More current means more torque. A free-spinning motor stops
  speeding up because of back-EMF (kω). Load slows it and makes it draw more current.
- **The generator.** Spinning the same machine makes a voltage, EMF = kω, which is how
  regenerative braking works.

The audience, pattern and constraints are the same as the existing topics
(`2026-11-06-engine-3d-design.md`, `2026-11-06-solar-system-design.md`):

- High-school and early-engineering students on desktop browsers. Phones must not
  break.
- A scroll walkthrough, then a sandbox.
- Static files and no build step. Three.js `0.160.0` is pinned via an import map.
- The shared `core/` is used, along with the top bar and a home card.

Success:

1. `/motor/` works from the start of the walkthrough to the end, and then the sandbox
   works.
2. The sandbox physics matches the textbook DC-motor results.
3. The engine and solar topics still pass all their checks after the shared-card change.

## Out of scope

- Brushless and AC induction motors in 3D. They get text only, in the closing panel.
- Motor-control electronics, heating, and coil inductance.
- A multi-coil 3D armature. The drawing shows one loop.

## Model (classroom DC motor)

Constants (`motor/physics.js`):

| Name | Value | Meaning |
|---|---|---|
| `TURNS` | 20 | coil turns |
| `COIL_L`, `COIL_W` | 0.05 m, 0.04 m | coil side length (in field) and width |
| `B0` | 0.5 T | field at 100 % magnet strength |
| `K0` | 0.02 V·s/rad | motor constant = TURNS·B0·COIL_L·COIL_W |
| `R` | 2 Ω | coil resistance |
| `J` | 2e-5 kg·m² | rotor inertia |
| `FRICTION` | 1e-5 N·m·s | viscous friction |
| `BULB_R` | 4 Ω | generator load (bulb) |
| `MAX_LOAD` | 0.05 N·m | brake slider maximum |
| `SLOW` | 20 | everything is shown 20× slower (rotation and time) |

Key results, which are the reference values for the tests:

| Result | Value |
|---|---|
| Stall current at 6 V | 3 A |
| Stall torque at 6 V | 0.06 N·m |
| No-load speed at 6 V | 285.7 rad/s ≈ 2728 rpm (V/k = 300 rad/s minus friction) |
| Mechanical time constant | J/(k²/R + FRICTION) ≈ 0.095 s, so spin-up takes about 10 s on screen |
| Force on one coil side at stall (all turns) | TURNS·B0·I·COIL_L = 1.5 N |
| Generator at 1000 rpm, 100 % magnet | EMF 2.094 V, current 0.349 A, bulb power 0.487 W |

Simplifications, stated on the page:

- The drawing shows one loop so that it's clear. The sandbox physics treats the motor
  as having many coils, so its torque is smooth.
- The commutator step shows the one-loop torque, which varies as cos θ.
- Coil inductance is ignored, so current responds instantly.
- Current arrows show conventional current (+ to −). A footnote says electrons flow the
  other way.

Angle convention: θ = 0° when the coil plane is horizontal, parallel to the field. That
is the position of maximum torque. At θ = 90° the coil is vertical and the torque is 0.

### Pure functions (`motor/physics.js`, no Three.js, no DOM)

- `motorConstant(magnet)` = K0·magnet, for magnet in [0.5, 1.5].
- `current(V, omega, k)` = (V − k·ω)/R.
- `emf(k, omega)` = k·ω.
- `toRpm(omega)` = ω·60/2π.
- `step(state, inputs, dtShownSeconds) → state`, where state is `{ t, omega, angle }`
  (`t` in real seconds, `angle` in degrees, wrapped to [0, 360)).
  - Real time advanced = min(dtShown, 0.1)/SLOW. It is integrated in internal steps of
    at most 1 ms, using semi-implicit Euler.
  - **Motor mode:** `inputs = { mode: 'motor', V, magnet, load }`.
    - Drive torque τd = k·I − FRICTION·ω.
    - The brake `load` (N·m) opposes motion. When |ω| ≈ 0 and |τd| ≤ load, ω stays 0,
      so the brake never makes the motor turn backwards.
    - The change in speed is τ/J.
  - **Generator mode:** `inputs = { mode: 'generator', crankRpm, magnet }`.
    - ω is set to the crank speed.
    - I = EMF/(R + BULB_R) and bulb power = I²·BULB_R.
- `steadyState({ V, magnet, load }) → { omega, current, torque }`, in closed form:
  - ω = (k·V/R − load)/(k²/R + FRICTION) if that is > 0, else 0.
  - For V < 0, mirror the result.
- `readouts(state, inputs) → { rpm, current, torque, backEmf, powerIn, powerOut, efficiency, bulbPower }`.
  - Motor mode: powerIn = V·I, powerOut = load·|ω|, efficiency = powerOut/powerIn
    (0 when powerIn ≤ 0).
  - Generator mode: powerIn = mechanical power, powerOut = bulbPower.
- `loopTorque(thetaDeg, 'slip' | 'split')`.
  - Returns cos θ for slip rings, so the sign flips past 90°.
  - Returns |cos θ| for the split-ring commutator.
- `commutatorSign(thetaDeg)`: +1 for θ in (−90°, 90°), −1 otherwise. This is the
  direction of current in the loop.
- `rockingAngle(p)`, for p in [0, 1]: a damped oscillation about 90°,
  90 − 90·e^(−3p)·cos(4πp). It stays in [0, 180] and ends near 90.
- `spinUp(V, magnet, seconds, n) → [{ t, omega, current, angle }]`: n samples of a
  motor-mode run from rest with load 0. It is used by the walkthrough, so scroll is a
  pure lookup.

## Shared info cards (`core/cards.js`)

- `bindPicking(canvas, camera, getTargets, onHit, onMiss)`:
  - On pointerup with less than 4 px of drag, raycast `getTargets()`.
  - Call `onHit(hits)` with all hits, sorted, or `onMiss()` if there are none.
- `createCard(el) → { show(title, text), hide() }`:
  - `el` holds an `h3`, a `p` and a close `button`.
  - Escape also hides it.
- The engine and solar sandboxes switch to these. The engine's `onHit` keeps its own
  rules: skip the see-through block when a solid part is behind it, and highlight the
  part.

## Scene (`motor/scene.js`)

Units: 1 Three.js unit = 1 cm.

- **Magnets:** two curved pole pieces, N in red (`#ef4444`) at −x and S in blue
  (`#3b82f6`) at +x. The field runs along +x.
- **Coil:** a rectangular loop, 5 cm along z (the shaft axis) by 4 cm across. It turns
  about z by θ, and θ = 0 is horizontal.
- **Commutator:** either a split ring (two copper half-rings with gaps at the coil's
  vertical position) or two full slip rings, switched with
  `setCommutator('split' | 'slip')`.
- **Brushes:** two dark grey blocks touching the commutator, wired to the battery, or
  to the bulb in generator mode.
- **Arrows**, each toggleable:
  - field lines (yellow);
  - current direction along each coil side (orange);
  - force on each side (green), with length proportional to |force|.
- **Bulb:** an emissive sphere. Brightness ∝ bulb power, capped.
- `createMotor() → { group, parts, update({ angle, currentSign, currentMag, forceMag, mode, bulbPower }), setCommutator, setArrows({ field, current, force }), labelAnchors, dispose }`.
  - Pickable meshes carry `userData.partId`, one of `magnetN | magnetS | coil |
    commutator | brushes | battery | bulb | shaft`.

## Walkthrough

Steps are `parts, force, commutator, backemf, generator, ev`.

| Step | Scroll drives | Scene | Panel copy (exact numbers) |
|---|---|---|---|
| `parts` | held, θ = 30° | labels on, all arrows off | "Magnets make a field; a coil of wire carries current; the commutator and brushes feed it." |
| `force` | θ 0 → 60° | close on one coil side; field, current and force arrows on; left-hand-rule SVG overlay | "F = BIL. 20 turns × 0.5 T × 3 A × 0.05 m = **1.5 N** on each side, in opposite directions, so the coil turns." |
| `commutator` | first half: slip rings, θ = `rockingAngle(2·sp)`; second half: split ring, θ = 360·(2·sp − 1) | force arrows on; torque gauge | "Without a commutator the force flips past vertical and the coil just rocks. The split ring swaps the connections every half turn, so the current reverses and the coil keeps turning." |
| `backemf` | `spinUp(6, 1, 0.5, 200)`, sample at sp | inset chart of speed and current over time | "At the start the current is the full 3 A (6 V ÷ 2 Ω). As the coil speeds up it acts as a generator, making a back-EMF that cancels more of the battery voltage, until the speed settles near **2700 rpm**." |
| `generator` | crank 0 → 1500 rpm, θ integrated | battery replaced by bulb; bulb glows | "Spin it and it makes electricity: EMF = kω. At 1000 rpm that's **2.1 V**. This is regenerative braking." |
| `ev` | held | static | "Electric-car motors have no brushes: electronics switch the coils. They are about **90 %** efficient (a petrol engine is about **30 %**) and give full torque from 0 rpm." Link to `../engine/`. |

## Sandbox

- **Mode switch:** Motor or Generator.
- **Motor controls:**
  - voltage slider, −12 to +12 V (default 6);
  - magnet slider, 50 to 150 % (default 100);
  - brake load slider, 0 to 0.05 N·m (default 0).
- **Generator controls:** crank slider, 0 to 3000 rpm, plus the magnet slider.
- **Toggles:** field, current and force arrows. Also play/pause.
- **Readout:** rpm, current (A), torque (mN·m), back-EMF (V), power in and out (W),
  efficiency (%), and bulb power in generator mode. The label "shown 20× slower" is
  always visible.
- **Chart:** a rolling 5-second (shown time) chart of speed and current on a 2D
  canvas.
- **Info cards** use `core/cards.js`, with text from `parts.js`.
- **Reduced motion:** the sandbox starts paused, and scroll still drives the
  walkthrough.

## Site wiring

- Add a home card: "Electric Motor", Engineering · ~10 min, linking to `motor/`, with
  the image `assets/motor.png`.
- Add a top-bar `<option>` on all four pages.
- Add `motor` to the `cp` line in `.github/workflows/deploy.yml`.
- Add a row for the topic in the README topics table.

## Error handling

- Use the same WebGL fallback as the other topics. Its inline SVG shows the coil
  between N and S, with current and force arrows and the label "F = BIL".
- The CDN is the only external dependency.

## Testing

**`npm test`, `test/motor/physics.test.js`:**

- Motor constant and stall:
  - `motorConstant(1)` = 0.02 and equals TURNS·B0·COIL_L·COIL_W.
  - `current(6, 0, 0.02)` = 3.
- Steady state:
  - At 6 V no-load, `steadyState` gives ω = 285.7 ± 0.1 rad/s.
  - ω falls linearly with load: equal load steps give equal ω drops.
  - Magnet at 2× (from 0.75 to 1.5) gives a no-load speed ratio within 0.5 ± 0.05, and
    a stall-torque ratio of exactly 2.
- Simulation:
  - `step` from rest at 6 V reaches within 1 % of `steadyState` after 1 real second.
  - During spin-up the current decreases monotonically from 3 A while ω increases.
  - At −6 V, ω becomes negative with the same magnitude.
  - With V = 2 (stall torque 0.02) and load 0.05, ω stays exactly 0.
  - The dt clamp holds: one 5 s call advances real time by 0.1/SLOW.
- Generator: at 1000 rpm, EMF = 2.094 ± 0.001 V, current 0.349 ± 0.001 A and bulb power
  0.487 ± 0.001 W.
- Commutator:
  - `loopTorque(θ,'slip')` changes sign across 90° and 270°.
  - `loopTorque(θ,'split')` ≥ 0 for every θ.
  - `commutatorSign` flips at 90° and 270°.
  - `rockingAngle` stays in [0, 180] over [0, 1], and `rockingAngle(1)` is within 5° of
    90.
- `spinUp`: samples are evenly spaced, the first sample has ω = 0 and current = 3, and
  the last is within 2 % of steady state.

**Shared cards:** the engine and solar regressions pass with `core/cards.js`. That
covers the part cards opening and closing, the engine highlight, and the engine
skipping the block.

**Browser (against `npm run serve`, no-store):**

- Every motor walkthrough step is screenshotted.
- Commutator first half: the coil rocks and never completes a turn. Second half: it
  turns fully.
- Sandbox:
  - At 6 V it settles at 2728 ± 30 rpm.
  - Adding load reduces rpm and raises current.
  - At −6 V it spins backwards.
  - Generator mode at 1000 rpm reads "2.09 V" and the bulb glows.
  - Clicking the coil opens its card.
- Reduced motion, the no-WebGL fallback, resizing, 390 px width and the hidden-tab
  clamp all work.
- The home card and top bar work on all four pages.
- There are 0 console errors and 0 HTTP errors.
