// Info-card text for each clickable part (keys match mesh.userData.partId).
export const PARTS = {
  magnetN: { name: 'North pole', text: 'One side of a permanent magnet. Its magnetic field runs across the gap to the south pole, through the coil.' },
  magnetS: { name: 'South pole', text: 'The other side of the magnet. Together the poles make a steady field of about 0.5 tesla across the coil.' },
  coil: { name: 'Coil', text: 'A loop of copper wire wound 20 times. Current along its two long sides feels the push F = BIL, one side up and one down, so it turns.' },
  commutator: { name: 'Commutator', text: 'A split copper ring that turns with the coil. Every half turn it swaps which brush feeds which end of the coil, so the current reverses and the coil keeps turning the same way.' },
  brushes: { name: 'Brushes', text: 'Carbon blocks pressed against the commutator. They stay still and carry current into and out of the spinning coil. They wear out, which is why modern motors are often brushless.' },
  battery: { name: 'Battery', text: 'Pushes current around the circuit. More voltage means more current at the start, more torque and a higher top speed. Reversing it reverses the motor.' },
  bulb: { name: 'Bulb', text: 'In generator mode the spinning coil makes a voltage (EMF = kω) that lights the bulb. The current that flows also pushes back against the crank — that is what regenerative braking uses.' },
  shaft: { name: 'Shaft', text: 'The steel axle the coil and commutator are fixed to. It carries the turning force out to whatever the motor drives.' },
};
