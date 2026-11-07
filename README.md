# How Things Work

Interactive 3D explainers for high-school and early-engineering students. Each topic is a guided
scroll story followed by a sandbox to experiment in.

**Live site:** https://vanmanh49.github.io/how-things-work/

| Topic | What students learn |
|---|---|
| [4-Stroke Engine](https://vanmanh49.github.io/how-things-work/engine/) | The four strokes, the main parts, displacement, compression ratio, why the cam turns at half crank speed, and the 1-3-4-2 firing order of an inline-4 |
| [Sun, Earth & Moon](https://vanmanh49.github.io/how-things-work/solar/) | Day and night, why seasons happen (tilt, not distance), Moon phases, and why eclipses don't happen every month |
| [Electric Motor](https://vanmanh49.github.io/how-things-work/motor/) | F = BIL, why the commutator is needed, speed/torque/back-EMF, and the generator |

## Run it locally

No install or build step is needed: it's plain static files, with Three.js loaded from a CDN.
You need Node 24 (for the tests) and Python 3 (for the dev server).

```bash
npm run serve   # http://localhost:8000/
npm test        # unit tests for the engine maths, orbit maths, motor physics and scroll slicing
```

`npm run serve` starts a server that sends `Cache-Control: no-store`, so the browser never
runs stale JavaScript or CSS while you work. Opening `index.html` straight from disk won't
work, because ES modules need to be served over HTTP.

`test/browser/` holds the browser checks for the 3D pages: walkthrough steps, info cards, the sandboxes,
the solar Moon-view inset, and the whole site including the GitHub Pages sub-path. Each file is a
Playwright function `async (page) => {...}`. Run it with Playwright's `run_code` (for example the Playwright
MCP tool, with `filename` set to the script) against `npm run serve`. The dev server also serves the site under
`/how-things-work/`, the GitHub Pages sub-path, which `site-check.js` uses to test relative links. Each check returns its measured values and any console or HTTP
errors.

For screenshots, `?theta=N` pins the engine's crank angle (degrees) and `?t=N` pins solar
time (days, where day 0 is the March equinox). `?angle=N` pins the motor's rotor angle (degrees).

## How it's built

```
index.html      home page with a card for each topic
core/           shared: 3D view and renderer, animation loop, scroll-to-step mapping, click-to-pick info cards, base CSS
engine/         4-stroke engine topic
solar/          Sun–Earth–Moon topic
motor/          electric motor and generator topic
assets/         card images
test/           Node tests (node --test); test/browser/ holds the Playwright browser checks
docs/           design specs and implementation plans
```

Each topic is driven by **one value**: the crank angle θ for the engine, time `t` in days
for the solar system, the rotor state (angle and speed) for the motor. That value comes from the scroll position in the walkthrough, or from
the clock in the sandbox, and every moving part is computed from it.

The physics lives in pure, tested modules with no Three.js or DOM code:
`engine/kinematics.js`, `solar/orbits.js` and `motor/physics.js`. That keeps the mechanism correct at every
angle, and it means scrolling backwards runs everything backwards.

## Adding a topic

1. Create `topic-name/` with `index.html`, a pure maths module, the scene, and a sandbox.
   `solar/` is the most complete example.
2. Use `core/view.js`, `core/loop.js`, `core/scroll.js` and `core/page.css` for the
   shared layout and plumbing.
3. Add tests under `test/topic-name/`.
4. Add a card to `index.html` (plus an image in `assets/`), and add an `<option>` to the
   top-bar menu on every page.
5. Add the folder to the `cp` line in `.github/workflows/deploy.yml`.

## Deployment

Every push to `master` runs the tests in GitHub Actions. If they pass, the site deploys
to GitHub Pages. Pull requests run the tests only.
