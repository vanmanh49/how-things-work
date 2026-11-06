// Scroll position → walkthrough step + crank angle. scrollState is pure (tested in Node);
// initScroll only touches the DOM when called.
import { wrapTheta } from './kinematics.js';

export const STEPS = ['parts', 'intake', 'compression', 'power', 'exhaust', 'multi'];

export function scrollState(progress) {
  const p = Math.min(1, Math.max(0, progress));
  const k = Math.min(STEPS.length - 1, Math.floor(p * STEPS.length));
  const stepProgress = p * STEPS.length - k;
  const step = STEPS[k];
  let theta = 0;
  if (step === 'multi') theta = stepProgress * 720;
  else if (step !== 'parts') theta = (k - 1) * 180 + stepProgress * 180;
  return { step, theta: wrapTheta(theta), cylinders: step === 'multi' ? 4 : 1, stepProgress };
}

// Progress = where the viewport's centre line sits inside the section, so a panel is "current"
// while it is under the centre. Absolute position, never deltas: a reload mid-page is correct at once.
export function initScroll(section, onState) {
  const panels = [...section.querySelectorAll('.panel[data-step]')];
  let lastStep = null;
  const run = () => {
    const r = section.getBoundingClientRect();
    const raw = (innerHeight / 2 - r.top) / r.height;
    const state = scrollState(raw);
    if (state.step !== lastStep) {
      panels.forEach((el) => el.classList.toggle('active', el.dataset.step === state.step));
      lastStep = state.step;
    }
    onState(state, raw);
  };
  addEventListener('scroll', run, { passive: true });
  addEventListener('resize', run);
  run();
}
