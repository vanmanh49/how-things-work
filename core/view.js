// Shared 3D view: renderer + scene + camera for one canvas, with resize and on-screen tracking.
// Lighting is topic-specific, so topics add their own lights to view.scene.
import * as THREE from 'three';

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.setClearColor(0x0f172a);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 500);

  const view = {
    scene, camera, renderer, visible: true,
    resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = camera.aspect < 1 ? Math.min(75, 40 / camera.aspect) : 40;   // keep width in frame on portrait screens
      camera.updateProjectionMatrix();
    },
    render() { renderer.render(scene, camera); },
  };
  new IntersectionObserver(([e]) => { view.visible = e.isIntersecting; }).observe(canvas);
  view.resize();
  return view;
}
