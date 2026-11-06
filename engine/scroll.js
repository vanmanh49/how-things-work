// Engine walkthrough: shared scroll slice → crank angle and cylinder count. scrollState is pure.
import { wrapTheta } from './kinematics.js';
import { sliceProgress, initScroll as initCoreScroll } from '../core/scroll.js';

export const STEPS = ['parts', 'intake', 'compression', 'power', 'exhaust', 'multi'];

export function scrollState(progress) {
  const { step, index, stepProgress } = sliceProgress(progress, STEPS);
  let theta = 0;
  if (step === 'multi') theta = stepProgress * 720;
  else if (step !== 'parts') theta = (index - 1) * 180 + stepProgress * 180;
  return { step, theta: wrapTheta(theta), cylinders: step === 'multi' ? 4 : 1, stepProgress };
}

export const initScroll = (section, onState) =>
  initCoreScroll(section, STEPS, (_slice, raw) => onState(scrollState(raw), raw));
