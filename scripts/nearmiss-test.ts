// Unit checks for Near Miss scoring: run with `npx tsx scripts/nearmiss-test.ts`
import { Scorer, RULES, CarState, OtherCar } from '../src/nearmiss/scoring';

let failed = 0;
const check = (name: string, ok: boolean, info: unknown = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, ok ? '' : JSON.stringify(info));
  if (!ok) failed++;
};

const W = 1.96;
const L = 4.45;
/** drive the player north at `speed` past one other car; returns the scorer */
function pass(opts: { gap: number; otherYaw?: number; otherV?: number; speed?: number; touch?: boolean; seconds?: number }) {
  const s = new Scorer();
  const speed = opts.speed ?? 30;
  const other: OtherCar = { id: 1, x: W / 2 + 1.86 / 2 + opts.gap, z: 40, yaw: opts.otherYaw ?? 0, v: opts.otherV ?? 10, width: 1.86, length: 4.65 };
  const car: CarState = { x: 0, z: 0, yaw: 0, vx: 0, vz: speed, width: W, length: L };
  const dt = 1 / 60;
  for (let t = 0; t < (opts.seconds ?? 4); t += dt) {
    car.z += speed * dt;
    other.z += Math.cos(other.yaw) * other.v * dt;
    if (opts.touch && Math.abs(car.z - other.z) < 2) s.touched(1);
    s.update(car, [other], { oncoming: false, slip: 0, boosting: false, dt });
  }
  return s;
}

{
  const s = pass({ gap: 0.6 });
  const e = s.events.find((x) => x.kind === 'near');
  check('close pass counts as a near miss', !!e && e.tier === 2, s.events);
  check('near miss raises multiplier', s.bestCombo === 2, s.bestCombo);
}
{
  const s = pass({ gap: 0.2 });
  check('very close pass is INSANE', s.events.some((e) => e.kind === 'near' && e.tier === 3), s.events);
}
{
  const s = pass({ gap: 2.5 });
  check('wide pass does not count', !s.events.some((e) => e.kind === 'near'), s.events);
}
{
  const s = pass({ gap: 0.6, touch: true });
  check('touching the car cancels the near miss', !s.events.some((e) => e.kind === 'near'), s.events);
}
{
  const s = pass({ gap: 0.6, otherYaw: Math.PI, otherV: 12 });
  const e = s.events.find((x) => x.kind === 'near');
  check('oncoming pass is labelled and worth double', !!e && e.sub === 'ONCOMING' && e.points >= 2 * pass({ gap: 0.6 }).events.find((x) => x.kind === 'near')!.points * 0.95, s.events);
}
{
  const s = pass({ gap: 0.6, speed: 8 });
  check('too slow does not count', !s.events.some((e) => e.kind === 'near'), s.events);
}
{
  const s = pass({ gap: 0.6, seconds: 4 + RULES.comboWindow + 1 });
  const bank = s.events.find((e) => e.kind === 'bank');
  check('combo banks after the window with its multiplier', !!bank && s.score === bank.points && s.score > 0 && s.comboPoints === 0, s.events);
}
{
  const s = pass({ gap: 0.6 });
  const before = s.comboPoints;
  const r = s.impact(6);
  check('scrape loses the unbanked combo', r === 'scrape' && before > 0 && s.comboPoints === 0 && s.score === 0 && s.events.some((e) => e.kind === 'lost'), { r, before, ev: s.events });
}
{
  const s = new Scorer();
  const r = s.impact(RULES.wreckImpact + 1);
  check('big hit wrecks the run', r === 'wreck' && s.over === 'wrecked');
}
{
  const s = new Scorer();
  const car: CarState = { x: 0, z: 0, yaw: 0, vx: 0, vz: 0, width: W, length: L };
  for (let i = 0; i < 60 * (RULES.startTime + 1); i++) s.update(car, [], { oncoming: false, slip: 0, boosting: false, dt: 1 / 60 });
  check('clock runs out', s.over === 'time' && s.time === 0);
}
{
  const s = new Scorer();
  const car: CarState = { x: 0, z: 0, yaw: 0, vx: 0, vz: 25, width: W, length: L };
  for (let i = 0; i < 60 * 3; i++) s.update(car, [], { oncoming: true, slip: 0, boosting: false, dt: 1 / 60 });
  check('oncoming lane builds combo points and keeps the clock up', s.comboPoints > 100 && s.time > RULES.startTime - 3, { cp: s.comboPoints, t: s.time });
}
{
  // boost: drains, and multiplies points earned while active
  const a = pass({ gap: 0.6 });
  const s = new Scorer();
  s.boost = 1;
  const car: CarState = { x: 0, z: 0, yaw: 0, vx: 0, vz: 30, width: W, length: L };
  const other: OtherCar = { id: 1, x: W / 2 + 0.93 + 0.6, z: 40, yaw: 0, v: 10, width: 1.86, length: 4.65 };
  for (let t = 0; t < 4; t += 1 / 60) {
    car.z += 30 / 60;
    other.z += 10 / 60;
    s.update(car, [other], { oncoming: false, slip: 0, boosting: true, dt: 1 / 60 });
  }
  const e = s.events.find((x) => x.kind === 'near');
  check('boost multiplies near-miss points and drains', !!e && e.points > a.events.find((x) => x.kind === 'near')!.points && s.boost < 1, { e, boost: s.boost });
}
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
