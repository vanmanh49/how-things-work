# Sun, Earth & Moon Topic + Multi-Topic Site: Design

Date: 2026-11-06

## Goal

Turn the single-topic engine site into a "How Things Work" site with a home page and
one page per topic, then add a second topic teaching **day & night, seasons, Moon
phases and eclipses** with one Sun–Earth–Moon 3D scene.

After the solar topic a student can explain: Earth's spin causes day and night; the
23.4° axial tilt (not distance from the Sun) causes seasons, and they are reversed in
the southern hemisphere; Moon phases are the changing view of a half-lit Moon over
29.5 days (not Earth's shadow); eclipses don't happen monthly because the Moon's orbit
is tilted 5.1°, so they cluster in two "eclipse seasons" a year.

Audience and constraints are unchanged from the engine spec
(`2026-11-06-engine-3d-design.md`): high-school / early-engineering students, desktop
browsers (phones must not break), static files, no build step, Three.js `0.160.0`
pinned via import map.

Success:
1. The engine topic behaves exactly as today, at `/engine/`.
2. The solar topic works at `/solar/`: walkthrough start to finish, then sandbox.
3. `/` is a home page linking to both.

## Out of scope

Real calendar dates, elliptical orbits / Kepler's laws, other planets, tides, true-scale
view, axial precession, node regression, home-page search/filters (wait for ~8 topics),
a build step, a shared info-card module (revisit at topic 3).

## Part 1 — Multi-topic structure

Approach: one page per topic plus a shared `core/` folder.

```
index.html            home: topic cards
core/view.js          createView(canvas), hasWebGL()
core/loop.js          startLoop(views, tick) — single rAF loop, passes dt (seconds)
core/scroll.js        sliceProgress (pure) + initScroll
core/page.css         base theme, top bar, sticky stage, panels, sandbox panel, fallback
engine/               index.html main.js engine.js effects.js sandbox.js parts.js kinematics.js
solar/                index.html main.js scene.js sandbox.js bodies.js orbits.js
assets/engine.png     card image (screenshot of the scene)
assets/solar.png
test/core/scroll.test.js  test/engine/*.test.js  test/solar/orbits.test.js
```

- **`core/scroll.js`**
  - `sliceProgress(progress, stepNames) → { step, index, stepProgress }`: clamps
    progress to [0, 1], equal slices. Pure, no DOM at top level.
  - `initScroll(section, stepNames, onState)`: keeps the existing behaviour.
    Progress is measured at the viewport centre line, it is absolute (never
    deltas), the `.panel[data-step]` element gets the `active` class, and
    `onState(state, raw)` is called.
  - The engine keeps `scrollState(progress)`, built on `sliceProgress`, so the
    existing engine scroll tests still apply unchanged.
- **`core/view.js` and `core/loop.js`**
  - Hold the code currently in `js/main.js`: renderer setup, resize, portrait
    field-of-view widening, the visibility observer, and the WebGL check.
  - The loop clamps nothing itself. Each topic's advance function clamps `dt`.
- **`core/page.css`**
  - Holds the shared rules from `style.css`.
  - Topic-only rules stay in the topic page, inline or in a small topic CSS file.
- **Top bar** on every page: "How Things Work" (links to `/`) and a topic
  `<select>` that navigates on change. Plain HTML plus a one-line inline handler.
- **Home page**
  - A grid of cards, one per topic: image, title, subject tag, approximate
    minutes. The engine card reads Engineering, ~10 min; the solar card reads
    Space, ~10 min.
  - Each whole card is a link.
  - It has no WebGL, so it always works.
- **Moving the engine**
  - Use `git mv` so file history is kept.
  - Import paths become `../core/…`.
  - The move is done when the engine tests pass from `test/engine/` and every
    engine browser check from the engine plan passes at `/engine/`.
- **Dev server:** `scripts/serve.py` (no-store) is unchanged. `npm test` runs
  `node --test "test/**/*.test.js"`.

## Part 2 — Solar topic

### Model (idealized)

Time **t in days** is the single source of truth. Day 0 = March equinox, so:
- day ≈ 91.3 is the June solstice;
- day ≈ 182.6 is the September equinox;
- day ≈ 273.9 is the December solstice.

These are idealized day numbers, not dates.

Constants (`solar/orbits.js`):

| Name | Value |
|---|---|
| `YEAR` | 365.25 days |
| `SYNODIC` | 29.53 days (new Moon → new Moon) |
| `TILT` | 23.44° |
| `MOON_INCL` | 5.14° |
| `NODE` | 0° (ascending node longitude; fixed) |
| `SUN_R`, `MOON_R` (angular radii) | 0.266°, 0.259° |
| `SOLAR_LIMIT` | 1.48° (Sun–Moon separation for an eclipse seen somewhere on Earth; includes lunar parallax) |
| `LUNAR_LIMIT` | 0.96° (Moon to anti-Sun point: umbra 0.70° + Moon radius) |

- Circular orbits; Sun moves uniformly along the ecliptic.
- New Moon at t = 0. With the node at 0° this gives a central solar eclipse at day 0.
- Eclipse seasons fall near both equinoxes, every year, because the node line is
  fixed. The page states this simplification.

### Pure functions (`solar/orbits.js`, no Three.js, no DOM)

- `sunLongitude(t)` = 360·t/YEAR (deg, wrapped to [0,360)).
- `sunDeclination(t)` = asin(sin TILT · sin λ☉).
- `dayLength(lat, t)` hours = (24/π)·acos(−tan φ · tan δ).
  - Clamped to 24 for polar day and 0 for polar night.
- `noonAltitude(lat, t)` = 90 − |φ − δ|.
- `subsolarLongitude(t)` = 180 − 360·frac(t), wrapped to (−180, 180].
  - So noon at longitude 0° is at t = n + 0.5.
- `moonElongation(t)` = 360·t/SYNODIC (deg, wrapped).
- `moonLongitude(t)` = λ☉ + elongation.
- `moonLatitude(t)` = asin(sin MOON_INCL · sin(λ☾ − NODE)).
- `illuminatedFraction(t)` = (1 − cos elongation)/2.
- `phaseName(t)`: one of 8 names, each centred on a multiple of 45° elongation.
  - The names are new, waxing crescent, first quarter, waxing gibbous, full,
    waning gibbous, last quarter, waning crescent.
- `eclipseAt(t)` → `'solar' | 'lunar' | null`, using the angular separation on the
  sky:
  - Sun–Moon separation < SOLAR_LIMIT → solar;
  - Moon to anti-Sun point < LUNAR_LIMIT → lunar.
- `nextEvent(t, kind)` → the first time strictly after t.
  - `kind` is one of `'juneSolstice' | 'decSolstice' | 'marchEquinox' |
    'septEquinox' | 'newMoon' | 'fullMoon' | 'eclipse'`.
  - All except `'eclipse'` are found analytically.
  - `'eclipse'` searches forward in 0.01-day steps, up to 2 years.
- `advanceTime(t, daysPerSecond, dtSeconds)` = t + daysPerSecond·min(dt, 0.1).
  - Not wrapped; time runs on.

### Scene (`solar/scene.js`, not to scale)

- **Sizes and positions**
  - Sun radius 10, emissive, with a PointLight at its centre.
  - Earth radius 2, on an orbit of radius 60.
  - Moon radius 0.6, on an orbit of radius 8 around Earth.
- **Moon orbit tilt is drawn 3× larger** (15.4°) so it is visible. The page says
  so. The sign of the Moon's height above Earth's orbital plane always matches
  `moonLatitude`.
- **Earth**
  - A sphere with simple vertex-coloured continents (no image files).
  - A visible axis line.
  - The axis always points the same way in space, so the north pole leans
    toward the Sun at the June solstice.
  - Spin follows `subsolarLongitude`.
  - A "you are here" pin at latitude `lat` (default 40°N), longitude 0°.
- **Lighting and effects**
  - Day/night and Moon phases come from real lighting by the Sun light.
  - A shadow cone mesh is shown while `eclipseAt(t)` is non-null.
- **Paths and labels:** orbit path lines and CSS2D labels for the Sun, Earth,
  Earth's axis, the Moon and the orbits.
- **"View from Earth" inset:** a second camera at Earth looking at the Moon,
  drawn with scissor/viewport into the corner of the same canvas.
- `createSystem() → { group, parts, update(t, { lat }), dispose }`.
  - Pickable meshes carry `userData.bodyId`, one of `sun | earth | moon | axis`.

### Walkthrough

The shared stage/panel layout. Scroll maps through `sliceProgress` to a step, then
the step maps `stepProgress` to t and a camera preset.

| Step | t range | Camera | Panel content (exact numbers) |
|---|---|---|---|
| `system` | held at 0 | wide | Labels on. "Not to scale: the Sun is ≈109 Earths wide; the Moon is ≈30 Earth-widths away; the Sun is 150 million km away." |
| `day` | 0 → 2 | close, follows Earth | Day/night line, pin. "One spin = 24 hours. The equator moves at ≈1670 km/h." |
| `seasons` | 0 → YEAR | wide, angled | Inset: day length + noon Sun height at the pin. "Tilt 23.4°. At 40°N: ~15 h daylight in June, ~9 h in December." Myth-buster: "Earth is closest to the Sun in early January — distance doesn't cause seasons." |
| `phases` | 0 → SYNODIC | above Earth–Moon, follows Earth | View-from-Earth inset on. "Half the Moon is always lit; we see a changing share of that half over 29.5 days." |
| `eclipses` | 0 → YEAR | edge-on to Earth's orbit | Tilted Moon orbit visible. "The Moon's orbit is tilted 5.1°, so most months it passes above or below the Sun. Eclipses happen only near the two points where the orbits cross — about twice a year." |

### Sandbox

- **Speed slider:** log scale, from 1 hour/s (1/24 day/s) to 30 days/s, with a
  live label. There is also play/pause, plus step buttons for −1 day, −1 h, +1 h
  and +1 day.
- **Jump buttons:** June solstice, December solstice, March equinox, new Moon,
  full Moon and next eclipse. Each uses `nextEvent` and pauses.
- **Latitude slider:** from −90° to +90°, default 40.
- **Toggles:** orbit paths, labels and the view-from-Earth inset.
- **Readout:**
  - day of year;
  - season in the north and in the south (by Sun longitude quadrant);
  - day length and noon Sun height at the pin;
  - Moon phase name and % lit;
  - eclipse status.
- **Info cards:** click a body to open its card (text in `bodies.js`). Escape or
  clicking empty space closes it.
- **Camera:** orbit only (no zoom or pan), the same as the engine.
- **Reduced motion:** the sandbox starts paused, the intro doesn't animate, and
  scroll still drives time.

### Error handling

The WebGL fallback works the same way as the engine's, but uses its own inline SVG
showing the tilted Earth at the June and December solstices. The CDN is the only
external dependency.

## Testing

- **`npm test`** covers, with no dependencies:
  - The existing 12 engine tests, now under `test/engine/`.
  - `test/core/scroll.test.js`:
    - `sliceProgress` slices and clamps correctly;
    - the same input always gives the same output.
  - `test/solar/orbits.test.js`, seasons:
    - Declination is 0 at t = 0 and YEAR/2, +23.44 at YEAR/4 and −23.44 at
      3·YEAR/4.
    - Day length is 12 h at the equator for every t, and 12 h at any latitude
      between −60 and 60 at the equinoxes.
    - At 40°N on the June solstice, day length is between 14.8 and 15.2 h and
      noon altitude is 73.44 ± 0.01.
    - At 40°S on the June solstice, day length is between 8.8 and 9.2 h.
    - At 70°N on the June solstice, day length = 24; at 70°N on the December
      solstice, day length = 0.
  - Moon:
    - % lit is 0 at t = 0, 1 at SYNODIC/2 and 0.5 at SYNODIC/4.
    - `phaseName` steps through the 8 names in order over one cycle.
  - Day and night: `subsolarLongitude(n + 0.5)` = 0 for n = 0..3.
  - Eclipses, over 2 years in 0.01-day steps:
    - `eclipseAt(0)` = 'solar'.
    - Every solar-eclipse instant is within 17.5 days of a time when the Sun is
      at a node (t ≡ 0 or YEAR/2 mod YEAR).
    - Each of the 4 eclipse seasons contains ≥ 1 solar eclipse.
    - Fewer than half of all new Moons have an eclipse.
  - Events and time:
    - `nextEvent` returns a time strictly after t.
    - `nextEvent(0,'juneSolstice')` = YEAR/4.
    - `nextEvent(0,'fullMoon')` = SYNODIC/2.
    - `nextEvent(t,'eclipse')` returns a t′ where `eclipseAt(t′)` is non-null.
    - `advanceTime(0, 30, 5)` = 3 (dt clamped).
- **Browser checks** against `npm run serve` (no-store):
  - The engine passes all of its checks at `/engine/`.
  - The home page shows both cards and both links load.
  - Solar:
    - Every walkthrough step is screenshotted.
    - The June solstice jump gives a north-pole lean toward the Sun and
      readout "N: summer".
    - At latitude −40 the readout shows "S: summer" in December.
    - The new Moon jump gives a dark Moon in the inset.
    - The next-eclipse jump gives a visible shadow cone.
  - Reduced motion, no-WebGL fallback, resize, 390 px width and the hidden-tab
    clamp.
  - Zero console errors and zero HTTP errors.
