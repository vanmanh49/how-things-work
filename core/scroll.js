// Scroll position → walkthrough step. sliceProgress is pure (tested in Node);
// initScroll only touches the DOM when called. Each topic maps a slice to its own value.

export function sliceProgress(progress, stepNames) {
  const n = stepNames.length;
  const p = Math.min(1, Math.max(0, progress));
  const index = Math.min(n - 1, Math.floor(p * n));
  return { step: stepNames[index], index, stepProgress: p * n - index };
}

// Progress = where the viewport's centre line sits inside the section, so a panel is "current"
// while it is under the centre. Absolute position, never deltas: a reload mid-page is correct at once.
export function initScroll(section, stepNames, onState) {
  const panels = [...section.querySelectorAll('.panel[data-step]')];
  let lastStep = null;
  const run = () => {
    const r = section.getBoundingClientRect();
    const raw = (innerHeight / 2 - r.top) / r.height;
    const slice = sliceProgress(raw, stepNames);
    if (slice.step !== lastStep) {
      panels.forEach((el) => el.classList.toggle('active', el.dataset.step === slice.step));
      lastStep = slice.step;
    }
    onState(slice, raw);
  };
  addEventListener('scroll', run, { passive: true });
  addEventListener('resize', run);
  run();
}
