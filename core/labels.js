// Floating part names over a 3D view. `labels` maps an anchor id to [text, side, y offset]:
// side 'left' | 'right' nudges the text off its anchor; anchors without an entry are skipped.
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export function createLabelLayer(layer) {
  const renderer = new CSS2DRenderer({ element: layer });
  const resize = () => renderer.setSize(layer.clientWidth, layer.clientHeight);
  resize();
  return {
    resize,
    render: (scene, camera) => renderer.render(scene, camera),
    add(anchors, labels) {
      for (const [id, [text, side = '', y = 0]] of Object.entries(labels)) {
        if (!anchors[id]) continue;
        const el = document.createElement('div');
        el.className = `label ${side}`;
        el.innerHTML = `<span>${text}</span>`;
        const obj = new CSS2DObject(el);
        obj.position.y = y;
        anchors[id].add(obj);
      }
    },
  };
}
