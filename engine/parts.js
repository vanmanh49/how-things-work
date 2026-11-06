// Info-card text for each clickable part (keys match mesh.userData.partId).
export const PARTS = {
  piston: {
    name: 'Piston',
    text: 'A metal plug that slides up and down inside the cylinder. Gas pressure pushes on its top (the crown); piston rings seal the gap so the gas can’t leak past.',
  },
  rod: {
    name: 'Connecting rod',
    text: 'Links the piston to the crankshaft. It turns the piston’s straight-line push into a force that spins the crank — like your leg on a bicycle pedal.',
  },
  crankshaft: {
    name: 'Crankshaft',
    text: 'The offset “throws” on the crankshaft turn up-and-down motion into rotation. In an inline-4, throws for cylinders 1 & 4 point one way and 2 & 3 the other, so pistons balance each other.',
  },
  intakeValve: {
    name: 'Intake valve',
    text: 'Opens during the intake stroke to let the fuel–air mixture in, then snaps shut so nothing escapes during compression and power.',
  },
  exhaustValve: {
    name: 'Exhaust valve',
    text: 'Opens during the exhaust stroke so the rising piston can push the burnt gas out. It runs much hotter than the intake valve.',
  },
  camshaft: {
    name: 'Camshaft',
    text: 'Egg-shaped lobes push each valve open at the right moment. It turns at half crank speed, because each valve opens once per cycle and a cycle takes two crank turns.',
  },
  sparkPlug: {
    name: 'Spark plug',
    text: 'Fires an electric spark across a small gap just as compression ends, igniting the squeezed mixture to start the power stroke.',
  },
  block: {
    name: 'Engine block & head',
    text: 'The block holds the cylinders; the head on top holds the valves and spark plug and closes off the combustion chamber. Turn on Cutaway to see inside.',
  },
};
