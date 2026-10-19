import RAPIER from '@dimforge/rapier3d-compat';
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = 1 / 60;
world.createCollider(RAPIER.ColliderDesc.cuboid(500, 1, 500).setTranslation(0, -1, 0).setFriction(1));
// curb
world.createCollider(RAPIER.ColliderDesc.cuboid(2, 0.075, 2).setTranslation(0, 0.075, 60));
const spec = { length: 4.65, width: 1.86, height: 1.46, wheelBase: 2.8, track: 1.6, r: 0.34, mass: 1400, engine: 5600, brake: 46, steer: 0.58, grip: 2.35, susp: 32 };
const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.2, 0).setLinearDamping(0.05).setAngularDamping(0.6).setCanSleep(false));
const col = world.createCollider(RAPIER.ColliderDesc.cuboid(spec.width / 2, 0.38, spec.length / 2).setTranslation(0, 0.25, 0).setMass(spec.mass).setFriction(0.4), body);
const vc = world.createVehicleController(body);
(vc as any).setIndexForwardAxis = 2;
console.log('up', vc.indexUpAxis, 'fwd', vc.indexForwardAxis);
const rest = 0.32;
for (const [x, z] of [[spec.track / 2, spec.wheelBase / 2], [-spec.track / 2, spec.wheelBase / 2], [spec.track / 2, -spec.wheelBase / 2], [-spec.track / 2, -spec.wheelBase / 2]]) {
  vc.addWheel({ x, y: 0.0, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, rest, spec.r);
}
for (let i = 0; i < 4; i++) {
  vc.setWheelSuspensionStiffness(i, spec.susp);
  vc.setWheelSuspensionCompression(i, 0.82 * 2 * Math.sqrt(spec.susp));
  vc.setWheelSuspensionRelaxation(i, 0.88 * 2 * Math.sqrt(spec.susp));
  vc.setWheelMaxSuspensionTravel(i, 0.25);
  vc.setWheelMaxSuspensionForce(i, 60000);
  vc.setWheelFrictionSlip(i, spec.grip);
  vc.setWheelSideFrictionStiffness(i, 1.0);
}
const step = (n: number, eng: number, brake: number, steer: number) => {
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < 4; i++) {
      vc.setWheelEngineForce(i, i >= 2 ? eng : eng * 0.0);
      vc.setWheelBrake(i, brake);
      vc.setWheelSteering(i, i < 2 ? steer : 0);
    }
    vc.updateVehicle(world.timestep);
    world.step();
  }
};
step(60, 0, 0, 0);
let t = body.translation();
console.log('settled y', t.y.toFixed(3), 'contacts', [0, 1, 2, 3].map((i) => vc.wheelIsInContact(i)), 'susp', [0, 1, 2, 3].map((i) => vc.wheelSuspensionLength(i)?.toFixed(3)));
for (let s = 1; s <= 10; s++) {
  step(60, spec.engine, 0, 0);
  const v = body.linvel();
  t = body.translation();
  console.log(`t=${s}s speed=${vc.currentVehicleSpeed().toFixed(1)} v=(${v.x.toFixed(1)},${v.y.toFixed(1)},${v.z.toFixed(1)}) pos=(${t.x.toFixed(1)},${t.y.toFixed(2)},${t.z.toFixed(1)})`);
}
// turn at speed
step(120, spec.engine * 0.3, 0, 0.35);
const r = body.rotation();
const v = body.linvel();
console.log('after turn rot', r, 'vel', v);
step(180, 0, spec.brake, 0);
console.log('after brake speed', vc.currentVehicleSpeed().toFixed(2));
