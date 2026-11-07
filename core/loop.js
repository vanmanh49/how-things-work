// One requestAnimationFrame loop per page. dt is raw seconds; each topic clamps it in its own advance function.
export function startLoop(resizables, tick) {
  addEventListener('resize', () => resizables.forEach((r) => r.resize()));
  let last = performance.now();
  function frame(now) {
    const dt = Math.max(0, (now - last) / 1000);   // the first frame's timestamp can predate `last`
    last = now;
    tick(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
