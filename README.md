# How Things Work

Interactive 3D explainers for high-school and early-engineering students. Each topic is a guided
scroll story followed by a sandbox to experiment in.

**Live site:** https://vanmanh49.github.io/how-things-work/

| Topic | What students learn |
|---|---|
| [4-Stroke Engine](https://vanmanh49.github.io/how-things-work/engine/) | The four strokes, the main parts, displacement, compression ratio, why the cam turns at half crank speed, and the 1-3-4-2 firing order of an inline-4 |
| [Sun, Earth & Moon](https://vanmanh49.github.io/how-things-work/solar/) | Day and night, why seasons happen (tilt, not distance), Moon phases, and why eclipses don't happen every month |

## Run it locally

No install or build step is needed: it's plain static files, with Three.js loaded from a CDN.
You need Node 24 (for the tests) and Python 3 (for the dev server).

```bash
npm run serve   # http://localhost:8000/
npm test        # unit tests for the engine maths, orbit maths and scroll slicing
```

`npm run serve` starts a server that sends `Cache-Control: no-store`, so the browser never
runs stale JavaScript or CSS while you work. Opening `index.html` straight from disk won't
work, because ES modules need to be served over HTTP.

For screenshots, `?theta=N` pins the engine's crank angle (degrees) and `?t=N` pins solar
time (days, where day 0 is the March equinox).

## How it's built

```
index.html      home page with a card for each topic
core/           shared: 3D view and renderer, animation loop, scroll-to-step mapping, base CSS
engine/         4-stroke engine topic
solar/          Sun–Earth–Moon topic
assets/         card images
test/           Node tests (node --test)
docs/           design specs and implementation plans
```

Each topic is driven by **one value**: the crank angle θ for the engine, time `t` in days
for the solar system. That value comes from the scroll position in the walkthrough, or from
the clock in the sandbox, and every moving part is computed from it.

The physics lives in pure, tested modules with no Three.js or DOM code:
`engine/kinematics.js` and `solar/orbits.js`. That keeps the mechanism correct at every
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
