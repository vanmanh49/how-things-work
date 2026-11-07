# Electric Motor Topic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third topic at `/motor/`, a brushed DC motor that also runs as a generator. It teaches F = BIL, the commutator, speed/torque/back-EMF and the generator, using a scroll walkthrough and a real-physics sandbox. Card picking moves into shared `core/cards.js`.

**Architecture:** The same per-topic layout as `solar/`. Pure physics in `motor/physics.js`, tested in Node, drives everything. The walkthrough maps scroll to a rotor angle or a precomputed spin-up sample. The sandbox steps the simulation each frame at 20× slow motion.

**Tech Stack:** Three.js 0.160.0 via import map (jsDelivr), `three/addons` (OrbitControls, CSS2DRenderer), Node 24 test runner, `npm run serve` (no-store), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-06-electric-motor-design.md`

## Global Constraints

- Work on branch `motor-topic`, not `master`. Do not push unless the user asks.
- Static files only; no npm dependencies, no bundler. Three.js pinned exactly: `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`, addons `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/`.
- `motor/physics.js` imports no Three.js and touches no DOM.
- Constants as in the spec: TURNS 20, COIL_L 0.05, COIL_W 0.04, B0 0.5, K0 0.02, R 2, J 2e-5, FRICTION 1e-5, BULB_R 4, MAX_LOAD 0.05, SLOW 20.
- Links are relative (the site is served under `/how-things-work/` on GitHub Pages).
- Browser checks run against `npm run serve` (no-store), never `python3 -m http.server`.
- Engine and solar behaviour must not change. Their existing browser checks must pass after Task 1 and again in Task 6.
- Colours: N pole `#ef4444`, S pole `#3b82f6`, field arrows `#facc15`, current arrows `#f97316`, force arrows `#22c55e`, copper `#b87333`.
- Desktop first. At ≤ 768 px the layout stacks and nothing overflows horizontally.
- Commit messages are plain, with no AI attribution.

## Review Focus

1. **Voltage dragged to 0 while the motor spins:** it coasts down from friction, ω shrinks toward 0 and never changes sign or turns NaN. Pinned by a `step` test in Task 2.
2. **Switching Generator → Motor mid-spin:** speed carries over from the crank speed, with no jump to 0. Pinned by a `step` continuity test in Task 2.
3. **Efficiency when power in ≤ 0** (V = 0, or V below the back-EMF so the motor feeds power back): reads 0 %, never NaN or Infinity. Pinned by a `readouts` test in Task 2.
4. **Brake while running backwards:** the load still opposes motion, so |ω| drops and the brake never flips direction. Pinned by a `step` test in Task 2.
5. **Reload mid-walkthrough in the back-EMF step:** the sample comes from absolute scroll, so the chart and coil match immediately. Pinned by a browser check in Task 4.

---

### Task 1: Shared picking + info card in `core/cards.js`; switch engine and solar to it

**Files:**
- Create: `core/cards.js`
- Modify: `engine/sandbox.js`, `solar/sandbox.js`

**Interfaces:**
- Produces (`core/cards.js`):
  - `bindPicking(canvas: HTMLCanvasElement, camera: THREE.Camera, getTargets: () => THREE.Object3D[], onHit: (hits: THREE.Intersection[]) => void, onMiss: () => void) → void`.
    - Fires on pointerup when the drag since pointerdown is ≤ 4 px.
    - Raycasts `getTargets()` with `recursive: false`.
    - Calls `onHit(hits)` when there is at least one hit, otherwise `onMiss()`.
  - `createCard(el: HTMLElement, { onHide }: { onHide?: () => void } = {}) → { show(title: string, text: string): void, hide(): void }`.
    - `el` holds an `h3`, a `p` and a close `button`.
    - The button and the Escape key call `hide()`.
    - `hide()` sets `el.hidden = true` and then calls `onHide`.
- The engine keeps its own hit selection: the first non-`block` hit, falling back to `hits[0]`. It keeps its highlight too, cleared through `onHide`.

- [ ] **Step 1: Write `core/cards.js`.** It imports `THREE` for `Raycaster` and `Vector2`.

- [ ] **Step 2: Switch `engine/sandbox.js`.**
  - Remove its local pointer, raycast and Escape code.
  - `const card = createCard($('part-card'), { onHide: clearHighlight })`.
  - Call `bindPicking(...)` with `onHit` choosing the part, highlighting it and calling `card.show(...)`, and `onMiss: card.hide`.
  - `build()` still calls `card.hide()`.

- [ ] **Step 3: Switch `solar/sandbox.js`** the same way, with no highlight.

- [ ] **Step 4: Run.** `npm test`. Expected: 26/26 PASS (no maths changed).

- [ ] **Step 5: Browser regression.** Start `npm run serve` in the background if it isn't running.
  - Run `.playwright-mcp/engine-regression.js`. Expected: every value matches the last recorded run (steps 6/6, 360°/s, hidden-tab 42°, …), with 0 errors.
  - Then the engine card checks:
    - clicking the piston gives the card "Piston" and an emissive highlight;
    - clicking empty space hides the card and clears the highlight;
    - Escape hides it.
  - The engine's block-skip: with cutaway off, clicking the piston through the block still gives "Piston".
  - Solar: clicking Earth gives "Earth"; Escape closes it. 0 errors.

- [ ] **Step 6: Commit.** `git add core/cards.js engine/sandbox.js solar/sandbox.js && git commit -m "Share click-to-pick and info cards in core/cards.js"`

---

### Task 2: Motor physics (`motor/physics.js`)

**Files:**
- Create: `motor/physics.js`, `test/motor/physics.test.js`

**Interfaces:**
- Produces (named exports):
  - Constants: `TURNS, COIL_L, COIL_W, B0, K0, R, J, FRICTION, BULB_R, MAX_LOAD, SLOW`.
  - `motorConstant(magnet) → k`
  - `current(V, omega, k) → A`
  - `emf(k, omega) → V`
  - `toRpm(omega)`, `fromRpm(rpm)`
  - `step(state: { t, omega, angle }, inputs, dtShown) → { t, omega, angle }`
    - `inputs` is `{ mode: 'motor', V, magnet, load }` or `{ mode: 'generator', crankRpm, magnet }`.
  - `steadyState({ V, magnet, load }) → { omega, current, torque }`
  - `readouts(state, inputs) → { rpm, current, torque, backEmf, powerIn, powerOut, efficiency, bulbPower }`
    - `torque` is in N·m and `efficiency` is in 0..1.
  - `loopTorque(thetaDeg, 'slip' | 'split') → number`
  - `commutatorSign(thetaDeg) → 1 | -1`
  - `rockingAngle(p) → deg`
  - `spinUp(V, magnet, seconds, n) → Array<{ t, omega, current, angle }>`

- [ ] **Step 1: Write the failing tests** `test/motor/physics.test.js`, with a `close(a, b, eps)` helper and `run(state, inputs, realSeconds)`. The helper calls `step` repeatedly with `dtShown = 0.05` until real time advances by `realSeconds`:

```js
const MOTOR = (V, magnet = 1, load = 0) => ({ mode: 'motor', V, magnet, load });
test('motor constant and stall current', () => {
  close(motorConstant(1), 0.02); close(motorConstant(1), TURNS * B0 * COIL_L * COIL_W);
  close(current(6, 0, 0.02), 3);
});
test('steady state: no-load speed, linear in load, magnet scaling', () => {
  close(steadyState(MOTOR(6)).omega, 285.714, 0.1);
  const w = [0, 0.01, 0.02].map((l) => steadyState(MOTOR(6, 1, l)).omega);
  close(w[0] - w[1], w[1] - w[2], 1e-9);
  const lo = steadyState(MOTOR(6, 0.75)).omega, hi = steadyState(MOTOR(6, 1.5)).omega;
  assert.ok(Math.abs(hi / lo - 0.5) <= 0.05, hi / lo);
  close((motorConstant(1.5) * 6 / R) / (motorConstant(0.75) * 6 / R), 2);
});
test('simulation converges to steady state; current falls as speed rises', () => {
  let s = { t: 0, omega: 0, angle: 0 }, lastI = 3.0001, lastW = -1;
  for (let k = 0; k < 400; k++) {
    s = step(s, MOTOR(6), 0.05);
    const i = current(6, s.omega, 0.02);
    assert.ok(i <= lastI && s.omega >= lastW); lastI = i; lastW = s.omega;
  }
  assert.ok(Math.abs(s.omega / steadyState(MOTOR(6)).omega - 1) < 0.01, s.omega);
});
test('reverse voltage spins backwards with the same speed', () => {
  const s = run({ t: 0, omega: 0, angle: 0 }, MOTOR(-6), 1);
  close(s.omega, -steadyState(MOTOR(6)).omega, 0.5);
});
test('brake bigger than stall torque holds the motor still', () => {
  const s = run({ t: 0, omega: 0, angle: 0 }, MOTOR(2, 1, 0.05), 1);
  assert.equal(s.omega, 0);
});
test('coasting at 0 V and braking while reversed never flip direction', () => {
  let s = { t: 0, omega: 200, angle: 0 };
  for (let k = 0; k < 2000; k++) { const n = step(s, MOTOR(0), 0.05); assert.ok(n.omega >= 0 && n.omega <= s.omega); s = n; }
  s = { t: 0, omega: -200, angle: 0 };
  for (let k = 0; k < 200; k++) { const n = step(s, MOTOR(0, 1, 0.05), 0.05); assert.ok(n.omega <= 0 && Math.abs(n.omega) <= Math.abs(s.omega)); s = n; }
});
test('dt clamp: one 5 s call advances real time by 0.1/SLOW', () => {
  close(step({ t: 0, omega: 0, angle: 0 }, MOTOR(6), 5).t, 0.1 / SLOW);
});
test('generator: EMF, current, bulb power at 1000 rpm; switching back to motor keeps speed', () => {
  const g = { mode: 'generator', crankRpm: 1000, magnet: 1 };
  const s = step({ t: 0, omega: 0, angle: 0 }, g, 0.05);
  const r = readouts(s, g);
  close(r.backEmf, 2.094, 0.001); close(r.current, 0.349, 0.001); close(r.bulbPower, 0.487, 0.001);
  const m = step(s, MOTOR(0), 0.001);
  assert.ok(Math.abs(m.omega - fromRpm(1000)) < 1, m.omega);
});
test('efficiency is 0 (never NaN) when power in is not positive', () => {
  // V = 0, and V below the back-EMF (4 V at 200 rad/s): the motor feeds power back, so power in ≤ 0
  for (const V of [0, 2]) {
    const e = readouts({ t: 0, omega: 200, angle: 0 }, MOTOR(V, 1, 0.01)).efficiency;
    assert.ok(Number.isFinite(e) && e === 0, `${V}: ${e}`);
  }
});
test('commutator: slip torque flips past vertical, split never negative, sign flips at 90/270', () => {
  assert.ok(loopTorque(80, 'slip') > 0 && loopTorque(100, 'slip') < 0 && loopTorque(260, 'slip') < 0 && loopTorque(280, 'slip') > 0);
  for (let th = 0; th < 360; th += 1) assert.ok(loopTorque(th, 'split') >= 0);
  assert.equal(commutatorSign(45), 1); assert.equal(commutatorSign(135), -1);
  assert.equal(commutatorSign(225), -1); assert.equal(commutatorSign(315), 1);
});
test('rocking angle stays in [0,180] and settles near vertical', () => {
  for (let p = 0; p <= 1; p += 0.01) { const a = rockingAngle(p); assert.ok(a >= 0 && a <= 180, a); }
  assert.ok(Math.abs(rockingAngle(1) - 90) < 5);
});
test('spinUp: evenly spaced, starts at rest with 3 A, ends near steady state', () => {
  const s = spinUp(6, 1, 0.5, 200);
  assert.equal(s.length, 200); close(s[0].omega, 0); close(s[0].current, 3);
  close(s[1].t - s[0].t, s[2].t - s[1].t, 1e-9);
  assert.ok(Math.abs(s.at(-1).omega / steadyState(MOTOR(6)).omega - 1) < 0.02);
});
```

- [ ] **Step 2: Run.** `npm test`. Expected: FAIL, `motor/physics.js` not found.

- [ ] **Step 3: Implement `motor/physics.js`.**
  - **`step` sub-stepping:** real time `T = min(dtShown, 0.1)/SLOW`, split into `n = ceil(T/0.001)` sub-steps of `h = T/n`.
  - **Motor-mode sub-step:**
    - `k = motorConstant(magnet)`, `I = current(V, ω, k)`, `τd = k·I − FRICTION·ω`.
    - If `ω === 0 && |τd| <= load`, ω stays 0.
    - Otherwise `ω' = ω + h·(τd − load·sign)/J`, where `sign` = sign(ω), or sign(τd) when ω = 0.
    - If ω' crosses zero while the brake or coasting slows the motor (sign(ω') ≠ sign(ω) and ω ≠ 0), set ω' = 0.
  - **Generator-mode sub-step:** ω = `fromRpm(crankRpm)`.
  - **After each sub-step:** `angle = wrap360(angle + ω·h·180/π)` and `t += h`.
  - **`readouts`, motor mode:**
    - `powerIn = V·I`, `powerOut = load·|ω|`, `efficiency = powerIn > 0 ? powerOut/powerIn : 0`.
    - `torque = k·I`, `backEmf = k·ω`, `bulbPower = 0`.
  - **`readouts`, generator mode:**
    - `I = backEmf/(R + BULB_R)`, `bulbPower = I²·BULB_R`.
    - `powerIn = k·I·ω + FRICTION·ω²` and `powerOut = bulbPower`.
  - **`spinUp`:** sample `step` at even real-time intervals of `seconds/(n − 1)`, recording `current(V, ω, k)` at each sample.

- [ ] **Step 4: Run.** `npm test`. Expected: all PASS (26 existing + 12 new).

- [ ] **Step 5: Commit.** `git add motor/physics.js test/motor && git commit -m "Add DC motor and generator physics with tests"`

---

### Task 3: Motor page skeleton and 3D scene

**Files:**
- Create: `motor/index.html`, `motor/motor.css`, `motor/scene.js`, `motor/main.js`

**Interfaces:**
- Consumes: `core/view.js`, `core/loop.js`, `core/page.css`, and the physics exports.
- Produces:
  - `motor/scene.js`: `createMotor() → { group, parts, labelAnchors, update({ angle, currentSign, currentMag, forceMag, mode, bulbPower }), setCommutator('split'|'slip'), setArrows({ field, current, force }), dispose() }`.
    - `currentMag` and `forceMag` are 0..1 (normalized against stall at 12 V).
    - `mode` is `'motor' | 'generator'`.
    - Pickable meshes have `userData.partId` ∈ `magnetN | magnetS | coil | commutator | brushes | battery | bulb | shaft`.
    - `labelAnchors[partId]` gives an `Object3D` for every partId.
  - `motor/index.html`:
    - The same layout ids as `solar/index.html`: `#story`, `#stage`, `#stage-canvas`, `#labels`, `#hero`, `#walkthrough`, `#sandbox`, `#sandbox-canvas`, `#sandbox-ui`, `#part-card`, `#no-webgl`.
    - Panels have `data-step` = `parts, force, commutator, backemf, generator, ev`.
    - Plus `#lhr` (left-hand-rule SVG overlay, hidden by default) and `#chart-box` (holding `<canvas id="chart">`, hidden by default).
  - `?angle=N` pins the rotor angle in degrees, for screenshots.

- [ ] **Step 1: Write `motor/index.html`.**
  - Import map, `../core/page.css` and `motor.css`.
  - Top bar with three options: `../engine/`, `../solar/`, and `../motor/` (selected), plus `autocomplete="off"` and the `if (this.value)` handler used on the other pages.
  - Hero "Electric Motor", subtitle "How electricity and magnets make things spin — and back again".
  - Six panels with headings only.
  - `#no-webgl` with the message "Your browser can't show 3D graphics. Here's a diagram instead." and an inline SVG:
    - a rectangle coil between a red N block (left) and a blue S block (right);
    - yellow field arrows N→S;
    - an orange current arrow along each side;
    - green force arrows (up on one side, down on the other);
    - the label "F = BIL".
  - `#lhr`: an inline SVG of a left hand, with First finger = Field, seCond = Current and thuMb = Motion, labelled.

- [ ] **Step 2: Implement `motor/scene.js`.** Units: 1 unit = 1 cm; the shaft runs along z and the field along +x.
  - **Magnets:** curved pole pieces, made as 60°-wide arc segments of a cylinder shell (inner radius 3.4, outer 4.4, length 7) centred at ±x. N is at −x in red, S is at +x in blue.
  - **Coil:** a rectangular loop made of 4 thin copper boxes, with sides along z of length 5 at ±2 (half of the 4 cm width) from the axis. It sits in a group rotated about z by θ, with θ = 0 horizontal.
  - **Shaft:** a cylinder along z.
  - **Commutator** at z = −4.5:
    - `'split'`: two copper half-cylinder shells, gaps aligned with the coil's vertical (90°/270°), rotating with the coil.
    - `'slip'`: two full copper rings at z = −4.2 and −5.
  - **Brushes:** dark grey boxes touching the commutator from ±y. They stay fixed.
  - **Battery:** a box at (0, −7, −6) with "+" and "−" caps, wired to the brushes with tube lines.
  - **Bulb:** a sphere at the same spot, `MeshStandardMaterial` with emissive intensity `min(1, bulbPower/0.5)`. It is visible only in generator mode, when the battery is hidden.
  - **Arrows** (`ArrowHelper`):
    - Five field arrows along +x.
    - Current arrows on the two coil sides along ±z, with direction from `currentSign` (the near side carries +z when the sign is +1) and length 1 + 2·currentMag.
    - Force arrows on each side, perpendicular to the field and the wire: from F = I L × B, the direction is ±y in the rotating frame, with length 0.5 + 3·forceMag. Recompute the direction from θ each update.
  - **Lights:** hemisphere light, plus a directional key light without shadows.

- [ ] **Step 3: Implement a minimal `motor/main.js`:**
  - WebGL fallback;
  - stage view with the camera at (14, 9, 16) looking at (0, 0, −1);
  - `createMotor()`;
  - in the hero, rotate θ at 30°/s unless reduced motion is on;
  - `?angle` overrides θ;
  - `update` with `currentSign = commutatorSign(θ)` and `currentMag = forceMag = 0.5`.

- [ ] **Step 4: Browser check** at `/motor/?angle=0`, `?angle=45` and `?angle=90`, screenshotting each.
  - The coil is horizontal at 0° and vertical at 90°.
  - The split-ring gaps line up with the brushes at 90°.
  - The red magnet is on the left and the blue on the right.
  - The force arrows point opposite ways on the two sides.
  - With `getContext` returning null, the fallback SVG shows.
  - 0 errors.

- [ ] **Step 5: Commit.** `git add motor && git commit -m "Add motor page skeleton and 3D DC motor scene"`

---

### Task 4: Motor walkthrough

**Files:**
- Create: `motor/chart.js`
- Modify: `motor/index.html` (panel copy), `motor/main.js`, `motor/motor.css`

**Interfaces:**
- Consumes: `core/scroll.js`, the scene from Task 3, and the physics.
- Produces:
  - `motor/chart.js`: `createChart(canvas: HTMLCanvasElement, series: Array<{ key: string, label: string, color: string, max: number }>) → { draw(points: Array<{ t: number, [key]: number }>, windowSeconds: number): void }`.
    - It plots the last `windowSeconds` of `t` on the x-axis, and each series scaled to its own `max`.
    - It draws a legend.
    - It handles device-pixel ratio.
  - In `motor/main.js`:
    - `STEPS = ['parts', 'force', 'commutator', 'backemf', 'generator', 'ev']`.
    - `motorState(slice) → { angle, commutator: 'split'|'slip', mode, arrows: { field, current, force }, camera, lhr: boolean, chart: number | null, labels: boolean, crankRpm }`. Here `chart` is a sample index into `SPINUP`.

- [ ] **Step 1: Fill the panel copy** with the exact text from the spec's walkthrough table. Add the conventional-current footnote in `force` and the "one loop drawn, many coils modelled" note in `backemf`. The `ev` panel links to `../engine/`.

- [ ] **Step 2: Implement `motorState`.** Precompute `SPINUP = spinUp(6, 1, 0.5, 200)`.
  - `parts`: θ 30, labels on, arrows off, camera `wide`.
  - `force`: θ = 60·sp, all arrows on, `lhr` true, camera `sideClose`.
  - `commutator`:
    - sp < 0.5: `'slip'`, θ = `rockingAngle(2·sp)`, torque sign from `loopTorque(θ, 'slip')`.
    - Otherwise: `'split'`, θ = 360·(2·sp − 1).
    - Force arrows on, camera `wide`.
  - `backemf`: index `i = round(sp·199)`, θ = `SPINUP[i].angle`, `chart = i`, camera `wide`.
  - `generator`: mode generator, crank = 1500·sp rpm, θ = the angle integrated by `step` with `dtShown = 1/60` per frame while in this step (visual only), camera `wide`.
  - `ev`: held θ 30, camera `wide`, labels off.

  Camera presets:
  - `wide`: (14, 9, 16) → (0, 0, −1).
  - `sideClose`: (0, 2, 12) → (0, 0, 0).

  Ease the camera over 0.2 s, or snap under reduced motion.

- [ ] **Step 3: Wire the walkthrough.**
  - **Chart:** shown in `backemf`; draws `SPINUP[0..i]` as `{ t: t·SLOW, rpm, current }` with a window of 10 s. Series: rpm (max 3000, `#38bdf8`) and current (max 3 A, `#f97316`).
  - **Left-hand rule:** `#lhr` is shown in `force`.
  - **Labels:** CSS2D, shown in `parts`.
  - **Force magnitude:** `forceMag` = |loopTorque| in the `commutator` step, and 0.5 elsewhere.
  - **Bulb:** `bulbPower` comes from `readouts` in the `generator` step.

- [ ] **Step 4: Browser check.** Scroll to the middle of each panel and screenshot it.
  - `parts`: labels.
  - `force`: arrows and the left-hand rule.
  - `commutator` at sp 0.25: the slip rings are visible and θ < 180.
  - `commutator` at sp 0.75: the split ring is visible.
  - `backemf` at sp 1: the chart's current has fallen to about 0.1 A, and the rpm line has flattened near 2700.
  - `generator` at sp 0.7: the bulb glows.
  - `ev`: the link is present.

  Then:
  - Reload mid-`backemf`: the chart shows the same index immediately.
  - Scroll back through `commutator`: the coil runs backwards.
  - 0 errors.

- [ ] **Step 5: Commit.** `git add motor && git commit -m "Add electric motor scroll walkthrough"`

---

### Task 5: Motor sandbox

**Files:**
- Create: `motor/sandbox.js`, `motor/parts.js`
- Modify: `motor/index.html` (`#sandbox-ui` controls), `motor/main.js`, `motor/motor.css`

**Interfaces:**
- Consumes:
  - from `main.js`: the view (`{ scene, camera, renderer }`);
  - `createMotor`, `createChart`, `core/cards.js`;
  - from physics: `step`, `readouts`, `commutatorSign`, `MAX_LOAD`, `SLOW`.
- Produces:
  - `motor/parts.js`: `export const PARTS: Record<partId, { name, text }>` for the 8 partIds, each 1–3 student-level sentences.
  - `motor/sandbox.js`: `initSandbox(view, ui) → { tick(dt): void, labels }`.

- [ ] **Step 1: Add the controls** to `#sandbox-ui`:
  - a mode radio group `name="mode"` (motor, default, or generator);
  - motor controls (`#motor-controls`):
    - `#volts`: −12 to 12, step 0.5, default 6;
    - `#load`: 0 to 50 mN·m, step 1, default 0;
  - `#magnet`: 50 to 150 %, step 5, default 100, shared by both modes;
  - generator controls (`#gen-controls`, hidden by default): `#crank`, 0 to 3000 rpm, step 50, default 1000;
  - `#play`;
  - toggles `#show-field`, `#show-current`, `#show-force` (all checked);
  - `#readout` (`pre`);
  - `<canvas id="sandbox-chart">`;
  - the note "Shown 20× slower".

  Each slider has a live `<output>` label.

- [ ] **Step 2: Write `motor/parts.js`.**

- [ ] **Step 3: Implement `initSandbox`.**
  - Orbit-only OrbitControls, target (0, 0, −1).
  - `state = { t: 0, omega: 0, angle: 0 }`. `playing` starts false under reduced motion.
  - `tick(dt)`:
    - Build `inputs` from the controls, with load converted from mN·m to N·m.
    - If playing, `state = step(state, inputs, dt)`.
    - `r = readouts(state, inputs)`.
    - `motor.update({ angle: state.angle, currentSign: commutatorSign(state.angle) * Math.sign(r.current || 1), currentMag: min(1, |r.current|/6), forceMag: min(1, |r.torque|/0.12), mode, bulbPower: r.bulbPower })`.
    - Push `{ t: state.t·SLOW, rpm: |r.rpm|, current: |r.current| }` to a rolling array trimmed to 5 s, then call `chart.draw(points, 5)` with rpm max 6000 and current max 6.
  - Readout lines:
    - `Speed: {rpm} rpm`
    - `Current: {A} A · Torque: {mN·m} mN·m`
    - `Back-EMF: {V} V`
    - `Power in: {W} W · out: {W} W · Efficiency: {%} %`
    - Generator mode adds `Bulb: {W} W`.
  - Switching mode keeps `state`.
  - Cards via `createCard` and `bindPicking`, with targets `motor.parts`.

- [ ] **Step 4: Wire it into `motor/main.js`:** a second view, and `tick` called while it is visible.

- [ ] **Step 5: Browser check.**
  - Play at 6 V for 15 s: rpm reads 2728 ± 30.
  - Set load to 20 mN·m: rpm falls and current rises.
  - At −6 V: rpm is negative and the coil turns backwards.
  - Generator mode at 1000 rpm: "Back-EMF: 2.09 V", "Bulb: 0.49 W", and the bulb glows.
  - Switch back to motor at 0 V: rpm starts near 1000 and coasts down.
  - Click the coil: the "Coil" card opens; Escape closes it.
  - 0 errors.

- [ ] **Step 6: Commit.** `git add motor && git commit -m "Add electric motor sandbox with live physics and chart"`

---

### Task 6: Site wiring and whole-site verification

**Files:**
- Create: `assets/motor.png`
- Modify: `index.html`, `engine/index.html`, `solar/index.html` (top-bar option), `.github/workflows/deploy.yml` (`cp` line), `README.md` (topics table)

- [ ] **Step 1: Capture `assets/motor.png`** from `/motor/?angle=30`, stage clip 800×600.
  - Add the home card: "Electric Motor", "Engineering · ~10 min", `href="motor/"`.
  - Add `<option value="../motor/">Electric Motor</option>` to the engine and solar top bars, and `value="motor/"` on the home page.
  - Add `motor` to the workflow `cp` line.
  - Add the README row: "Electric Motor | F = BIL, why the commutator is needed, speed/torque/back-EMF, and the generator".

- [ ] **Step 2: Run.** `npm test`. Expected: all PASS.

- [ ] **Step 3: Whole-site browser pass** against `npm run serve`:
  - `.playwright-mcp/engine-regression.js`: all values as before.
  - Solar spot checks:
    - the June jump reads "North: summer";
    - `.playwright-mcp/inset-sun-check.js` gives 0 / >0.
  - Home page:
    - three cards, with images loaded;
    - every card and top-bar option navigates;
    - the home page and all three topics load at the sub-path `http://localhost:8001/how-things-work/` (start the 8001 sub-path server if needed).
  - Motor:
    - reduced motion (no idle spin, sandbox paused, scroll still drives);
    - the no-WebGL fallback;
    - resize 1000×700 → 1600×900 with correct aspect;
    - 390 px with `scrollWidth ≤ 390`;
    - hidden tab: at 12 V from rest, freeze 3 s, and real-time advance over two frames ≤ (0.1 + 1/60)/SLOW s.
  - 0 console errors and 0 HTTP errors everywhere.

- [ ] **Step 4: Commit.** `git add -A && git commit -m "Add electric motor card, topic switcher entries and deploy wiring"` (do not push).
