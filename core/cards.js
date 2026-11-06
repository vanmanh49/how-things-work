// Shared click-to-pick (a click, not a drag) and the info card used by every sandbox.
import * as THREE from 'three';

export function bindPicking(canvas, camera, getTargets, onHit, onMiss) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(getTargets(), false);
    if (hits.length) onHit(hits); else onMiss();
  });
}

export function createCard(el, { onHide } = {}) {
  const hide = () => { el.hidden = true; onHide?.(); };
  el.querySelector('button').addEventListener('click', hide);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  return {
    show(title, text) {
      el.querySelector('h3').textContent = title;
      el.querySelector('p').textContent = text;
      el.hidden = false;
    },
    hide,
  };
}
