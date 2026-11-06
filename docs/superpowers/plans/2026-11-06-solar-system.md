# Multi-Topic Site + Sun–Earth–Moon Topic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the engine site into a multi-topic "How Things Work" site (home page, shared `core/`, engine at `/engine/`) and add a Sun–Earth–Moon topic at `/solar/` teaching day/night, seasons, Moon phases and eclipses.

**Architecture:** One static page per topic. Shared code (view/renderer, rAF loop, scroll slicing, base CSS) moves to `core/`. Each topic keeps its own scene, pure maths, sandbox and copy. The solar topic is driven by one value, time `t` in days, through pure functions in `solar/orbits.js`, exactly as the engine is driven by crank angle θ.

**Tech Stack:** Three.js 0.160.0 via import map (jsDelivr), `three/addons` (OrbitControls, CSS2DRenderer), Node 24 built-in test runner, `npm run serve` (no-store dev server, `scripts/serve.py`), Playwright for browser checks.

**Spec:** `docs/superpowers/specs/2026-11-06-solar-system-design.md` (also binding: `docs/superpowers/specs/2026-11-06-engine-3d-design.md` for unchanged engine behaviour)

## Global Constraints

- Static files only; no npm dependencies, no bundler. Three.js pinned exactly: `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`, addons `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/`.
- `npm test` = `node --test "test/**/*.test.js"`.
- Pure modules (`engine/kinematics.js`, `solar/orbits.js`, the pure exports of `core/scroll.js`) import no Three.js and touch no DOM at module top level.
- All browser checks run against `npm run serve` (Cache-Control: no-store), never `python3 -m http.server`.
- Engine behaviour must not change: every engine check from `docs/superpowers/plans/2026-11-06-engine-3d.md` Tasks 2–6 passes at `/engine/`.
- Solar constants: `YEAR` 365.25, `SYNODIC` 29.53, `TILT` 23.44°, `MOON_INCL` 5.14°, `NODE` 0°, `SOLAR_LIMIT` 1.48°, `LUNAR_LIMIT` 0.96°. Day 0 = March equinox = new Moon.
- Solar scene units (not to scale): Sun r 10, Earth r 2, Earth orbit r 60, Moon r 0.6, Moon orbit r 8, Moon orbit tilt drawn ×3 (15.42°).
- Desktop first; at ≤ 768 px the layout stacks and nothing overflows horizontally.
- Commit messages plain, no AI attribution.

## Review Focus

1. **Topic URL without trailing slash** (`/solar`): relative imports must still resolve. Expect the server's redirect to `/solar/` and the page to load; pinned by a browser check in Task 7.
2. **Negative time** (stepping back before day 0 in the sandbox): every orbits function returns finite, correctly wrapped values; `subsolarLongitude(-0.5)` = 0, `phaseName(-SYNODIC/2)` = 'full'. Pinned by tests in Task 3.
3. **Poles** (latitude slider at ±90°): `dayLength` returns 24 or 0, never NaN. Pinned by tests in Task 3.
4. **"Next eclipse" pressed during an eclipse**: jumps to the *next* eclipse, not 0.01 days later inside the current one. Pinned by a `nextEvent` test in Task 3.
5. **Hidden tab at 30 days/s**: time advances by at most 3 days in the first frame back. Pinned by an `advanceTime` test (Task 3) and a browser check (Task 7).

---

### Task 1: Shared scroll slicing + test layout

**Files:**
- Create: `core/scroll.js`, `test/core/scroll.test.js`
- Move: `test/kinematics.test.js` → `test/engine/kinematics.test.js`, `test/scroll.test.js` → `test/engine/scroll.test.js` (`git mv`)
- Modify: `js/scroll.js` (build on core), `package.json` (test glob), import paths in moved tests

**Interfaces:**
- Produces (`core/scroll.js`):
  - `sliceProgress(progress: number, stepNames: string[]) → { step: string, index: number, stepProgress: number }`: progress clamped to [0, 1], `index = min(n−1, floor(p·n))`, `stepProgress = p·n − index`.
  - `initScroll(section: HTMLElement, stepNames: string[], onState: (slice, raw: number) => void) → void`. Progress = `(innerHeight/2 − rect.top) / rect.height`. Toggles `.active` on `.panel[data-step]`. Runs on `scroll` (passive), on `resize` and once immediately.
- Engine `js/scroll.js` keeps `STEPS`, `scrollState(progress)` (same return shape and values as today) and `initScroll(section, onState)`, delegating to core.

- [ ] **Step 1: Move the tests and switch the glob.** `git mv` both test files into `test/engine/`, fix their imports to `../../js/…`, and set the `test` script to `node --test "test/**/*.test.js"`. Run `npm test`. Expected: 12/12 PASS (pure move).

- [ ] **Step 2: Write the failing core test** `test/core/scroll.test.js`:

```js
const S = ['a', 'b', 'c', 'd'];
test('sliceProgress: equal slices with in-step progress', () => {
  assert.deepEqual(sliceProgress(0, S), { step: 'a', index: 0, stepProgress: 0 });
  const m = sliceProgress(0.375, S); assert.equal(m.step, 'b'); close(m.stepProgress, 0.5);
  assert.deepEqual(sliceProgress(1, S), { step: 'd', index: 3, stepProgress: 1 });
});
test('sliceProgress clamps out-of-range progress', () => {
  assert.equal(sliceProgress(-2, S).step, 'a'); assert.equal(sliceProgress(9, S).step, 'd');
  assert.equal(sliceProgress(9, S).stepProgress, 1);
});
test('sliceProgress is pure', () => { assert.deepEqual(sliceProgress(0.6, S), sliceProgress(0.6, S)); });
```

- [ ] **Step 3: Run it.** `npm test`. Expected: FAIL, module `core/scroll.js` not found.

- [ ] **Step 4: Implement `core/scroll.js`,** then make `js/scroll.js`'s `scrollState` and `initScroll` delegate to it (the engine's θ mapping stays in `js/scroll.js`).

- [ ] **Step 5: Run.** `npm test`. Expected: 15/15 PASS (12 engine + 3 core).

- [ ] **Step 6: Commit.** `git add -A core test js/scroll.js package.json && git commit -m "Extract shared scroll slicing into core"`

---

### Task 2: Move the engine to `/engine/`; extract view, loop and base CSS; add the home page

**Files:**
- Create: `core/view.js`, `core/loop.js`, `core/page.css`, `index.html` (new home), `assets/engine.png`
- Move (`git mv`): `index.html` → `engine/index.html`; `js/*.js` → `engine/`; `style.css` → `engine/engine.css`; `core/scroll.js` stays
- Modify: `engine/main.js` (use core), `engine/index.html` (paths, top bar, CSS links), `engine/engine.css` (keep only engine-specific rules), test imports → `../../engine/…`

**Interfaces:**
- Produces:
  - `core/view.js`: `hasWebGL() → boolean`; `createView(canvas) → { scene, camera, renderer, visible, resize(), render() }`, moved unchanged from `js/main.js:21-60` (portrait FOV widening, IntersectionObserver visibility and shadows included).
  - `core/loop.js`: `startLoop(resizables: Array<{ resize(): void }>, tick: (dt: number) => void) → void`. One rAF loop, dt in seconds and not clamped. One `resize` listener calls `resize()` on every entry. The engine passes its two views plus `{ resize: sizeLabels }`.
  - `core/page.css`: theme variables, `[hidden]` rule, body/headings, `#no-webgl`, `#story`/`#stage`/`#content`/`.panel`/`#labels`/`.label`, `#sandbox`/`#sandbox-ui`/`#part-card`, buttons, fieldset, `#readout`, `.topbar`, and the ≤ 768 px rules. Everything in today's `style.css` that isn't engine-only.
  - Top bar markup, used on every page:
    `<nav class="topbar"><a href="/">How Things Work</a><select aria-label="Choose a topic" onchange="location.href=this.value"><option value="/engine/">4-Stroke Engine</option></select></nav>`. The current topic's option has `selected`.
  - Home `index.html`: `.topbar`, `h1` "How Things Work", `.cards` grid with one `<a class="card" href="/engine/">` containing an `<img src="assets/engine.png" alt="">`, `<h2>4-Stroke Engine</h2>`, `<p class="meta">Engineering · ~10 min</p>`. No WebGL, no JS.

- [ ] **Step 1: Move files with `git mv`** as listed. Update relative paths: `engine/index.html` links `../core/page.css` and `engine.css`, and its script is `main.js`. Engine module imports of `scroll.js` become `../core/scroll.js` where they use core.

- [ ] **Step 2: Extract `core/view.js` and `core/loop.js`** from `engine/main.js`. `engine/main.js` imports them and keeps LABELS, `?theta`, labels, rebuild and the walkthrough and sandbox wiring.

- [ ] **Step 3: Split CSS** into `core/page.css` and the engine-only `engine/engine.css` (cylinder labels, `.parts-list`).

- [ ] **Step 4: Write the home page** and `.topbar` / `.cards` styles in `core/page.css`. Capture `assets/engine.png`: a Playwright screenshot of `/engine/?theta=450`, clipping the stage to 800×600, PNG.

- [ ] **Step 5: Run.** `npm test`. Expected: 15/15 PASS.

- [ ] **Step 6: Engine regression in the browser.** Start `npm run serve` in the background. Re-run, at `http://localhost:8000/engine/`, the engine checks from the engine plan:
  - every walkthrough step (active panel and screenshot);
  - reload mid-power;
  - the sandbox: 0 RPM holds; 6000 RPM gives 360°/s; part card opens and closes;
  - cutaway; 1/4 cylinder switch;
  - reduced motion: paused, and step-back gives 715°;
  - the no-WebGL fallback;
  - resize aspect; 390 px with no horizontal scroll;
  - the hidden-tab clamp (≤ 42° over two frames after a 3 s freeze);
  - the pinned stage through `multi`.

  Expected: all match the values recorded in the engine plan, with 0 console errors and 0 HTTP errors.

- [ ] **Step 7: Home page check.** At `/`, the card shows and clicking it loads `/engine/`; at 390 px there is no horizontal scroll. Expected: 0 errors.

- [ ] **Step 8: Commit.** `git add -A && git commit -m "Move engine to /engine/, share view/loop/CSS in core, add home page"`

---

### Task 3: Solar maths (`solar/orbits.js`)

**Files:**
- Create: `solar/orbits.js`, `test/solar/orbits.test.js`

**Interfaces:**
- Produces (named exports): constants `YEAR, SYNODIC, TILT, MOON_INCL, NODE, SUN_R, MOON_R, SOLAR_LIMIT, LUNAR_LIMIT` (spec values), and:
  - `wrap360(deg) → [0,360)`
  - `sunLongitude(t) → deg [0,360)`
  - `sunDeclination(t) → deg`
  - `dayLength(lat, t) → hours [0,24]`
  - `noonAltitude(lat, t) → deg`
  - `subsolarLongitude(t) → deg (−180,180]`
  - `moonElongation(t) → deg [0,360)`
  - `moonLongitude(t) → deg [0,360)`
  - `moonLatitude(t) → deg`
  - `illuminatedFraction(t) → [0,1]`
  - `phaseName(t) → 'new'|'waxing crescent'|'first quarter'|'waxing gibbous'|'full'|'waning gibbous'|'last quarter'|'waning crescent'`
  - `seasonNorth(t)` / `seasonSouth(t) → 'spring'|'summer'|'autumn'|'winter'`. North uses Sun-longitude quadrants 0–90 spring, 90–180 summer, 180–270 autumn, 270–360 winter; south is the opposite.
  - `eclipseAt(t) → 'solar'|'lunar'|null`
  - `nextEvent(t, kind) → number`
  - `advanceTime(t, daysPerSecond, dtSeconds) → number`

- [ ] **Step 1: Write the failing tests** `test/solar/orbits.test.js`, using a `close(a, b, eps = 1e-6)` helper:

```js
test('declination: 0 at equinoxes, ±TILT at solstices', () => {
  close(sunDeclination(0), 0); close(sunDeclination(YEAR / 2), 0);
  close(sunDeclination(YEAR / 4), TILT); close(sunDeclination(3 * YEAR / 4), -TILT);
});
test('day length: equator always 12 h; everywhere 12 h at equinox', () => {
  for (let t = 0; t < YEAR; t += 7) close(dayLength(0, t), 12);
  for (let lat = -60; lat <= 60; lat += 10) close(dayLength(lat, 0), 12);
});
test('day length and noon Sun at the June solstice', () => {
  const j = YEAR / 4;
  const n = dayLength(40, j); assert.ok(n > 14.8 && n < 15.2, n);
  const s = dayLength(-40, j); assert.ok(s > 8.8 && s < 9.2, s);
  close(noonAltitude(40, j), 73.44, 0.01);
  assert.equal(dayLength(70, j), 24); assert.equal(dayLength(70, 3 * YEAR / 4), 0);
});
test('poles never NaN', () => {
  for (const t of [0, YEAR / 4, YEAR / 2, 3 * YEAR / 4]) for (const lat of [90, -90]) {
    const d = dayLength(lat, t); assert.ok(Number.isFinite(d) && d >= 0 && d <= 24, `${lat} ${t} ${d}`);
  }
});
test('Moon illumination and phase names', () => {
  close(illuminatedFraction(0), 0); close(illuminatedFraction(SYNODIC / 2), 1); close(illuminatedFraction(SYNODIC / 4), 0.5);
  const names = ['new', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full', 'waning gibbous', 'last quarter', 'waning crescent'];
  names.forEach((nm, k) => assert.equal(phaseName((k / 8) * SYNODIC), nm));
  assert.equal(phaseName(-SYNODIC / 2), 'full');
});
test('noon at longitude 0 when t = n + 0.5, including negative t', () => {
  for (const n of [0, 1, 2, 3, -1]) close(subsolarLongitude(n + 0.5), 0);
  close(sunLongitude(-YEAR / 4), 270);
});
test('seasons by hemisphere', () => {
  assert.equal(seasonNorth(YEAR / 4 + 1), 'summer'); assert.equal(seasonSouth(YEAR / 4 + 1), 'winter');
  assert.equal(seasonNorth(3 * YEAR / 4 + 1), 'winter'); assert.equal(seasonSouth(3 * YEAR / 4 + 1), 'summer');
});
test('eclipses: only near nodes, ≥1 solar per season, not every month', () => {
  assert.equal(eclipseAt(0), 'solar');
  const solarTimes = []; let newMoons = 0, eclipsedNewMoons = 0;
  for (let t = 0; t < 2 * YEAR; t += 0.01) if (eclipseAt(t) === 'solar') solarTimes.push(t);
  for (const t of solarTimes) {
    const d = Math.min(...[0, YEAR / 2, YEAR, 1.5 * YEAR, 2 * YEAR].map((n) => Math.abs(t - n)));
    assert.ok(d <= 17.5, `solar eclipse ${t} is ${d} d from a node`);
  }
  for (const [a, b] of [[-20, 20], [YEAR / 2 - 20, YEAR / 2 + 20], [YEAR - 20, YEAR + 20], [1.5 * YEAR - 20, 1.5 * YEAR + 20]])
    assert.ok(solarTimes.some((t) => t >= a && t <= b), `no solar eclipse in season ${a}..${b}`);
  for (let k = 0; k * SYNODIC < 2 * YEAR; k++) { newMoons++; if (eclipseAt(k * SYNODIC) === 'solar') eclipsedNewMoons++; }
  assert.ok(eclipsedNewMoons < newMoons / 2, `${eclipsedNewMoons}/${newMoons}`);
});
test('nextEvent: strictly after t, analytic kinds exact, eclipse skips the current one', () => {
  close(nextEvent(0, 'juneSolstice'), YEAR / 4); close(nextEvent(0, 'fullMoon'), SYNODIC / 2);
  close(nextEvent(0, 'marchEquinox'), YEAR); close(nextEvent(YEAR / 4, 'juneSolstice'), 1.25 * YEAR);
  close(nextEvent(1, 'newMoon'), SYNODIC);
  const e = nextEvent(0, 'eclipse'); assert.ok(e > 100 && eclipseAt(e) !== null, e);
});
test('advanceTime clamps dt to 0.1 s', () => {
  close(advanceTime(0, 30, 5), 3); close(advanceTime(10, 1 / 24, 0.5), 10 + 0.5 / 24); close(advanceTime(5, -1, 0.1), 4.9);
});
```

- [ ] **Step 2: Run.** `npm test`. Expected: FAIL, `solar/orbits.js` not found.

- [ ] **Step 3: Implement `solar/orbits.js`.** Formulas are in the spec.
  - Angular separation uses the spherical law of cosines on ecliptic coordinates. For the Sun: (λ☉, 0). For the Moon: (λ☾, β☾). The anti-Sun point is (λ☉+180, 0).
  - `nextEvent`, analytic kinds: solstices and equinoxes are at `YEAR·(k/4)` offsets (k = 0 March, 1 June, 2 September, 3 December). New Moon is at `SYNODIC·k` and full Moon at `SYNODIC·(k + ½)`. Take the smallest one strictly greater than `t + 1e-9`.
  - `nextEvent`, `'eclipse'`: step 0.01 days forward from t. First skip while `eclipseAt` is non-null, then return the first step where it is non-null. Search up to 2·YEAR; throw if nothing is found.

- [ ] **Step 4: Run.** `npm test`. Expected: all PASS (15 + 10).

- [ ] **Step 5: Commit.** `git add solar/orbits.js test/solar && git commit -m "Add Sun-Earth-Moon orbit maths with tests"`

---

### Task 4: Solar page skeleton and 3D scene

**Files:**
- Create: `solar/index.html`, `solar/solar.css`, `solar/scene.js`, `solar/main.js`

**Interfaces:**
- Consumes: `core/view.js`, `core/loop.js`, `core/page.css`; orbits functions from Task 3.
- Produces:
  - `solar/scene.js`: `createSystem() → { group, parts, update(t: number, opts: { lat: number }), earth: THREE.Object3D, moon: THREE.Object3D, setPaths(on), setShadowCone(kind|null), dispose() }`.
    - Pickable meshes have `userData.bodyId ∈ 'sun'|'earth'|'moon'|'axis'`.
    - `group.userData.labelAnchors[bodyId]` (plus `earthOrbit`, `moonOrbit`) for Task 5.
  - `solar/index.html` ids: the same layout ids as the engine (`#story`, `#stage`, `#stage-canvas`, `#labels`, `#hero`, `#walkthrough` with `.panel[data-step]` for `system, day, seasons, phases, eclipses`, `#sandbox`, `#sandbox-canvas`, `#sandbox-ui`, `#part-card`, `#no-webgl`), plus `#inset-label`.
  - `?t=N` pins time to N days (for screenshots).

- [ ] **Step 1: Write `solar/index.html`.**
  - Same import map; links `../core/page.css` and `solar.css`.
  - Top bar with the solar option selected.
  - Hero title "Sun, Earth & Moon" with the subtitle "Why days, seasons and Moon phases happen".
  - Five empty panels (copy comes in Task 5).
  - `#no-webgl` with the message "Your browser can't show 3D graphics. Here's a diagram instead." and an inline SVG: the Sun in the centre, Earth at left (June) and right (December), each with its axis tilted the same way and labels "June: north leans toward the Sun" / "December: north leans away".

- [ ] **Step 2: Implement `solar/scene.js`** using the spec scene rules and the units in Global Constraints.
  - Ecliptic plane = xz, with `dir(λ) = (cos λ, 0, −sin λ)`. Earth position = 60·dir(sunLongitude + 180°).
  - Earth's axis is fixed in space at `(0, cos TILT, −sin TILT)`. At the June solstice Earth is at (0, 0, 60), so the Sun lies toward −z from Earth and the north pole leans toward the Sun.
  - Spin: rotate about the tilted axis so the pin at longitude 0° faces the Sun at t = n + 0.5, using `subsolarLongitude`.
  - Moon position: Earth position + 8·(cos β′·dir(moonLongitude) + sin β′·ŷ), where β′ is the drawn latitude. The drawn latitude is `asin(sin(3·MOON_INCL)·sin(λ☾ − NODE))`, so it has the same sign as `moonLatitude`.
  - Continents: 6 low-poly blobs as vertex colours from a seeded noise threshold. Ocean `#2563eb`, land `#16a34a`, ice caps `#e5e7eb` above |65°|.
  - The pin is a small red cone at (lat, 0°).
  - Shadow cone: translucent dark cone. For `'solar'`, from the Moon toward Earth; for `'lunar'`, from Earth away from the Sun.

- [ ] **Step 3: Implement `solar/main.js`** with a minimal loop:
  - stage view, `createSystem`;
  - t advanced by `advanceTime(t, 2, dt)` in the hero unless reduced motion is on;
  - `?t` overrides;
  - camera fixed wide at (0, 70, 110) looking at (0, 0, 0).
  - The WebGL fallback uses `hasWebGL`.

- [ ] **Step 4: Browser check** at `/solar/?t=N`, screenshotting each:
  - N = 91.3125 (June): Earth's north pole visibly leans toward the Sun.
  - N = 273.9375 (December): it leans away.
  - N = 14.765 (full Moon): the Moon is on the far side of Earth from the Sun.
  - N = 0.5: the pin is on Earth's sunlit side facing the Sun.
  - With getContext → null: the fallback SVG shows.

  Expected: all visually true, 0 console errors.

- [ ] **Step 5: Commit.** `git add solar && git commit -m "Add solar page skeleton and Sun-Earth-Moon scene"`

---

### Task 5: Solar walkthrough

**Files:**
- Modify: `solar/index.html` (panel copy), `solar/main.js`, `solar/solar.css`

**Interfaces:**
- Consumes: `core/scroll.js` `sliceProgress`/`initScroll`; scene from Task 4; orbits.
- Produces (in `solar/main.js`):
  - `const STEPS = ['system', 'day', 'seasons', 'phases', 'eclipses']`.
  - `solarState(slice) → { t, camera: 'wide'|'earthClose'|'seasons'|'moonTop'|'edgeOn', inset: 'none'|'daylight'|'moonView', labels: boolean }`.
    - The t mapping per spec table: system 0; day `2·sp`; seasons `YEAR·sp`; phases `SYNODIC·sp`; eclipses `YEAR·sp`.

- [ ] **Step 1: Fill the panel copy** with the exact numbers from the spec walkthrough table. Add the "not to scale" badge in the `system` panel, the myth-buster in `seasons`, and the simplification note in `eclipses`. That note reads: "Real eclipse seasons drift ~19 days earlier each year; this model keeps them fixed."

- [ ] **Step 2: Implement `solarState`** and the camera presets. All are relative to Earth's position E except `wide` and `edgeOn`:
  - `wide`: (0, 70, 110) → (0, 0, 0).
  - `earthClose`: E + (6, 3, 8) → E.
  - `seasons`: (0, 45, 95) → (0, 0, 0).
  - `moonTop`: E + (0, 24, 4) → E.
  - `edgeOn`: (0, 6, 115) → (0, 0, 0).

  Ease the camera to the preset over 0.6 s. Reduced motion snaps instead.

- [ ] **Step 3: Implement the insets** using scissor rendering, bottom-right at 28% of the width.
  - `daylight` is a DOM box instead, filled from `dayLength`/`noonAltitude` at the pin: "Daylight: 14.8 h · Noon Sun: 73°".
  - `moonView` is a second camera at Earth's surface toward the Moon. Its FOV is 6°, so the Moon fills the inset. `#inset-label` shows `phaseName` and the % lit.
- [ ] **Step 4: Part labels** come from `labelAnchors` via CSS2DRenderer and show only in `system`. While `eclipseAt(t)` is non-null, call `setShadowCone`.

- [ ] **Step 5: Browser check.** Scroll to the middle of each panel and screenshot.
  - `system`: labels and the badge.
  - `day`: the close view; the day/night line sweeps between two screenshots 0.2 s of scroll apart.
  - `seasons`: the daylight inset is about 14.8 h near the June point.
  - `phases`: the Moon inset goes from dark to full across the panel.
  - `eclipses`: edge-on, with the tilted Moon orbit visible.
  - Reload mid-`seasons`: t is correct immediately.
  - Scroll back up: time runs backward.
  - 0 errors.

- [ ] **Step 6: Commit.** `git add solar && git commit -m "Add Sun-Earth-Moon scroll walkthrough"`

---

### Task 6: Solar sandbox

**Files:**
- Create: `solar/sandbox.js`, `solar/bodies.js`
- Modify: `solar/index.html` (`#sandbox-ui` controls), `solar/main.js`, `solar/solar.css`, `solar/orbits.js` (`speedFromSlider`), `test/solar/orbits.test.js`

**Interfaces:**
- Consumes: the view object passed from `main.js` (`{ scene, camera, renderer }`), `createSystem`, and orbits (`advanceTime`, `nextEvent`, `phaseName`, `illuminatedFraction`, `dayLength`, `noonAltitude`, `seasonNorth`, `seasonSouth`, `eclipseAt`, `YEAR`).
- Produces:
  - `solar/bodies.js`: `export const BODIES: Record<'sun'|'earth'|'moon'|'axis', { name, text }>`, 1–3 student-level sentences each.
  - `solar/sandbox.js`: `initSandbox(view, ui) → { tick(dt) }`.
  - `solar/orbits.js` gains `speedFromSlider(v: 0..100) → daysPerSecond`, a pure export: log scale, so 0 gives 1/24 and 100 gives 30. It lives in `orbits.js` because `sandbox.js` imports Three.js, which Node can't load. Tested in Step 1.

- [ ] **Step 1: Write the failing test.** In `test/solar/orbits.test.js`, add `test('speed slider is log-scaled 1 h/s … 30 d/s')`, asserting `speedFromSlider(0) = 1/24`, `speedFromSlider(100) = 30` and `speedFromSlider(50) = sqrt(30/24)` (geometric mean). Run `npm test`. Expected: FAIL.

- [ ] **Step 2: Implement `speedFromSlider`** in `solar/orbits.js` as `(1/24)·(720)^(v/100)`. Run `npm test`. Expected: PASS.

- [ ] **Step 3: Add the controls** to `#sandbox-ui`:
  - speed slider `#speed` (0–100, default 60) with a live label such as "1.4 days per second";
  - `#play`;
  - step buttons `#back-day`, `#back-hour`, `#fwd-hour`, `#fwd-day`;
  - jump buttons with `data-kind` = `juneSolstice`, `decSolstice`, `marchEquinox`, `newMoon`, `fullMoon`, `eclipse`;
  - latitude slider `#lat` (−90 to 90, default 40) with a label;
  - toggles `#paths`, `#labels-toggle`, `#moon-inset`;
  - `#readout` and `#part-card`.

  All of these need visible labels and must work from the keyboard.

- [ ] **Step 4: Implement `initSandbox`.**
  - Orbit-only OrbitControls targeting Earth, re-targeted each tick.
  - `t` starts at 0 and plays, or is paused under reduced motion.
  - Step and jump buttons pause playback; jumps use `nextEvent`.
  - Readout lines:
    - `Day {floor(wrap(t, YEAR))} of year`
    - `North: {seasonNorth} · South: {seasonSouth}`
    - `At {lat}°: {dayLength} h daylight, noon Sun {noonAltitude}°`
    - `Moon: {phaseName} ({round(100·illuminatedFraction)}% lit)`
    - `Eclipse: {solar|lunar|none}`
  - Picking works like the engine (click without a drag of more than 4 px); Escape or clicking empty space closes the card.

- [ ] **Step 5: Wire it into `solar/main.js`:** a second view and `tick`, rendering only while visible.

- [ ] **Step 6: Browser check.**
  - June solstice jump: readout "North: summer · South: winter", and the north pole leans toward the Sun.
  - Set latitude −40, then the December solstice jump: "South: summer" and ≈ 14.8 h.
  - New Moon jump: the inset Moon is dark, 0% lit.
  - Next eclipse jump: "Eclipse: solar" or "lunar", with the shadow cone visible.
  - Speed 100 for 1 s: day advances by about 30.
  - Click Earth: the Earth card opens.
  - 0 errors.

- [ ] **Step 7: Commit.** `git add solar test/solar && git commit -m "Add Sun-Earth-Moon sandbox"`

---

### Task 7: Home card for solar, cross-links, whole-site verification

**Files:**
- Create: `assets/solar.png`
- Modify: `index.html` (solar card), `engine/index.html` and `solar/index.html` (top-bar options for both topics)

- [ ] **Step 1: Capture `assets/solar.png`** from `/solar/?t=91.3125`, stage clip 800×600. Add the solar card: "Sun, Earth & Moon", "Space · ~10 min", linking `/solar/`. Add both `<option>`s to every top bar, with the current topic `selected`.

- [ ] **Step 2: Run.** `npm test`. Expected: all PASS.

- [ ] **Step 3: Whole-site browser pass** against `npm run serve`:
  - `/`: both cards; both links load.
  - Top-bar select switches topics from each page.
  - `/solar` with no trailing slash loads (redirect).
  - Each topic: reduced motion (no idle animation, sandbox paused, scroll still drives); no-WebGL fallback; resize 1000×700 → 1600×900 with correct aspect; 390 px with `scrollWidth ≤ 390`.
  - Solar hidden tab: speed 100, freeze the main thread 3 s, and t advances ≤ 3.3 days over two frames.
  - The engine regression set from Task 2 Step 6 again.
  - 0 console errors and 0 HTTP errors everywhere.

- [ ] **Step 4: Commit.** `git add -A && git commit -m "Add solar card and topic switcher; whole-site verification fixes"`
