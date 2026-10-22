// Unit checks for the scoring rules: run with `npx tsx scripts/scoring-test.ts`
import { Scorer, RULES, CarState, OtherCar } from '../src/mygarage/scoring';

let failed = 0;
const check = (name: string, ok: boolean, info: unknown = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, ok ? '' : JSON.stringify(info));
  if (!ok) failed++;
};

const NO_DRIFT = { active: false, angle: 0 };
const W = 1.96;
const L = 4.45;
/** drive the player north at `speed` past one other car; returns the scorer */
function pass(opts: { gap: number; otherYaw?: number; otherV?: number; speed?: number; touch?: boolean; seconds?: number; scorer?: Scorer }) {
  const s = opts.scorer ?? new Scorer();
  const speed = opts.speed ?? 30;
  const other: OtherCar = {
    id: 1,
    x: W / 2 + 1.86 / 2 + opts.gap,
    z: 40,
    yaw: opts.otherYaw ?? 0,
    v: opts.otherV ?? 10,
    width: 1.86,
    length: 4.65,
  };
  const car: CarState = {
    x: 0,
    z: 0,
    yaw: 0,
    vx: 0,
    vz: speed,
    width: W,
    length: L,
  };
  const dt = 1 / 60;
  for (let t = 0; t < (opts.seconds ?? 4); t += dt) {
    car.z += speed * dt;
    other.z += Math.cos(other.yaw) * other.v * dt;
    if (opts.touch && Math.abs(car.z - other.z) < 2) s.touched(1);
    s.update(car, [other], {
      oncoming: false,
      drift: NO_DRIFT,
      boosting: false,
      dt,
    });
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
  check(
    'very close pass is INSANE',
    s.events.some((e) => e.kind === 'near' && e.tier === 3),
    s.events,
  );
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
  check(
    'oncoming pass is labelled and worth double',
    !!e && e.sub === 'ONCOMING' && e.points >= 2 * pass({ gap: 0.6 }).events.find((x) => x.kind === 'near')!.points * 0.95,
    s.events,
  );
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
  check('scrape loses the unbanked combo', r === 'scrape' && before > 0 && s.comboPoints === 0 && s.score === 0 && s.events.some((e) => e.kind === 'lost'), {
    r,
    before,
    ev: s.events,
  });
}
{
  // a chase: big hits damage the car, nothing ever wrecks it
  const s = pass({ gap: 0.6 });
  const before = s.comboPoints;
  const r1 = s.impact(RULES.bigImpact + 1);
  check(
    'a big hit damages the car and loses the combo',
    r1 === 'damage' && s.damaged && !s.over && before > 0 && s.comboPoints === 0 && s.events.some((e) => e.kind === 'damage'),
    { r1, before },
  );
  const r2 = s.impact(RULES.bigImpact + 3);
  check('the same crash bouncing on does not count twice', r2 === 'none' && !s.over, { r2 });
  const car: CarState = {
    x: 0,
    z: 0,
    yaw: 0,
    vx: 0,
    vz: 0,
    width: W,
    length: L,
  };
  for (let i = 0; i < 60 * (RULES.damageGrace + 0.2); i++)
    s.update(car, [], {
      oncoming: false,
      drift: NO_DRIFT,
      boosting: false,
      dt: 1 / 60,
    });
  const r3 = s.impact(6);
  check('a scrape on a damaged car is still only a scrape', r3 === 'scrape' && !s.over, { r3 });
  for (let i = 0; i < 60 * (RULES.damageGrace + 0.2); i++)
    s.update(car, [], {
      oncoming: false,
      drift: NO_DRIFT,
      boosting: false,
      dt: 1 / 60,
    });
  const r4 = s.impact(RULES.bigImpact + 1);
  for (let i = 0; i < 60 * (RULES.damageGrace + 0.2); i++)
    s.update(car, [], {
      oncoming: false,
      drift: NO_DRIFT,
      boosting: false,
      dt: 1 / 60,
    });
  const r5 = s.impact(RULES.bigImpact + 8);
  check('more big hits take it down to 0% at worst, and nothing ends the run', r4 === 'damage' && r5 === 'damage' && s.health === 0 && !s.over, { r4, r5, health: s.health });
}
{
  // race: big hits stop you but never end anything, and there is no clock
  const s = new Scorer('race');
  const car: CarState = {
    x: 0,
    z: 0,
    yaw: 0,
    vx: 0,
    vz: 0,
    width: W,
    length: L,
  };
  const results: string[] = [];
  for (let k = 0; k < 3; k++) {
    results.push(s.impact(RULES.bigImpact + 4));
    for (let i = 0; i < 60 * (RULES.damageGrace + 0.2); i++)
      s.update(car, [], {
        oncoming: false,
        drift: NO_DRIFT,
        boosting: false,
        dt: 1 / 60,
      });
  }
  check('race: every big hit is a crash, none ends the race', results.every((r) => r === 'crash') && s.crashes === 3 && !s.over && s.health >= RULES.raceFloor, {
    results,
    crashes: s.crashes,
    health: s.health,
  });
  for (let i = 0; i < 60 * 90; i++)
    s.update(car, [], {
      oncoming: false,
      drift: NO_DRIFT,
      boosting: false,
      dt: 1 / 60,
    });
  check('race: no clock', !s.over, { over: s.over });
  const p = pass({ gap: 0.6 });
  const rp = new Scorer('race');
  // near misses still fill the boost in a race
  const boost0 = rp.boost;
  const q = pass({ gap: 0.6, scorer: rp });
  check('race: near misses still count and fill the boost', q.nearMisses === 1 && q.boost > boost0 && p.nearMisses === 1, { boost: q.boost, boost0 });
}
{
  // free drive: nothing to score, nothing to break
  const s = new Scorer('free', { startBoost: 0 });
  const q = pass({ gap: 0.4, scorer: s, seconds: 4 });
  const r = s.impact(RULES.bigImpact + 10);
  for (let i = 0; i < 60 * 10; i++) s.update({ x: 0, z: 0, yaw: 0, vx: 0, vz: 20, width: W, length: L }, [], { oncoming: true, drift: { active: true, angle: 30 }, boosting: false, dt: 1 / 60 });
  check('free drive: no points, no damage, no end', q.nearMisses === 0 && s.events.length === 0 && s.score === 0 && r === 'none' && s.health === 100 && !s.over && s.distance > 300, {
    near: q.nearMisses,
    events: s.events,
    r,
    health: s.health,
  });
  check('free drive: the boost fills up again by itself', s.boost > 0.5, s.boost);
}
{
  const s = new Scorer();
  const car: CarState = {
    x: 0,
    z: 0,
    yaw: 0,
    vx: 0,
    vz: 25,
    width: W,
    length: L,
  };
  for (let i = 0; i < 60 * 3; i++)
    s.update(car, [], {
      oncoming: true,
      drift: NO_DRIFT,
      boosting: false,
      dt: 1 / 60,
    });
  check('oncoming lane builds combo points', s.comboPoints > 100, { cp: s.comboPoints });
}
{
  // boost: drains, and multiplies points earned while active
  const a = pass({ gap: 0.6 });
  const s = new Scorer();
  s.boost = 1;
  const car: CarState = {
    x: 0,
    z: 0,
    yaw: 0,
    vx: 0,
    vz: 30,
    width: W,
    length: L,
  };
  const other: OtherCar = {
    id: 1,
    x: W / 2 + 0.93 + 0.6,
    z: 40,
    yaw: 0,
    v: 10,
    width: 1.86,
    length: 4.65,
  };
  for (let t = 0; t < 4; t += 1 / 60) {
    car.z += 30 / 60;
    other.z += 10 / 60;
    s.update(car, [other], {
      oncoming: false,
      drift: NO_DRIFT,
      boosting: true,
      dt: 1 / 60,
    });
  }
  const e = s.events.find((x) => x.kind === 'near');
  check('boost multiplies near-miss points and drains', !!e && e.points > a.events.find((x) => x.kind === 'near')!.points && s.boost < 1, { e, boost: s.boost });
}
// drifting
function drift(seconds: number, angle: number, after = 0.5) {
  const s = new Scorer();
  const car: CarState = {
    x: 0,
    z: 0,
    yaw: 0,
    vx: 0,
    vz: 25,
    width: W,
    length: L,
  };
  for (let t = 0; t < seconds; t += 1 / 60)
    s.update(car, [], {
      oncoming: false,
      drift: { active: true, angle },
      boosting: false,
      dt: 1 / 60,
    });
  for (let t = 0; t < after; t += 1 / 60)
    s.update(car, [], {
      oncoming: false,
      drift: NO_DRIFT,
      boosting: false,
      dt: 1 / 60,
    });
  return s;
}
{
  const s = drift(1.5, 30);
  const e = s.events.find((x) => x.kind === 'drift');
  check('a held slide scores one drift event when it ends', !!e && e.points > 0 && e.label === 'BIG DRIFT' && s.drifts === 1 && s.mult === 2, s.events);
}
{
  const s = drift(0.4, 30);
  check('a short wiggle is not a drift', !s.events.some((x) => x.kind === 'drift') && s.drifts === 0, s.events);
}
{
  const a = drift(1.5, 20).events.find((x) => x.kind === 'drift')!.points;
  const b = drift(1.5, 40).events.find((x) => x.kind === 'drift')!.points;
  check('deeper angle scores more', b > a * 1.6, { a, b });
}
{
  const s = new Scorer();
  const car: CarState = {
    x: 0,
    z: 0,
    yaw: 0,
    vx: 0,
    vz: 25,
    width: W,
    length: L,
  };
  for (let t = 0; t < 1; t += 1 / 60)
    s.update(car, [], {
      oncoming: false,
      drift: { active: true, angle: 30 },
      boosting: false,
      dt: 1 / 60,
    });
  s.impact(6);
  for (let t = 0; t < 0.5; t += 1 / 60)
    s.update(car, [], {
      oncoming: false,
      drift: NO_DRIFT,
      boosting: false,
      dt: 1 / 60,
    });
  check('a scrape mid-drift loses the drift', !s.events.some((x) => x.kind === 'drift') && s.events.some((x) => x.kind === 'lost'), s.events);
}
{
  // near miss while drifting is worth 1.5x
  const s = new Scorer();
  const car: CarState = {
    x: 0,
    z: 0,
    yaw: 0,
    vx: 0,
    vz: 30,
    width: W,
    length: L,
  };
  const other: OtherCar = {
    id: 1,
    x: W / 2 + 0.93 + 0.6,
    z: 40,
    yaw: 0,
    v: 10,
    width: 1.86,
    length: 4.65,
  };
  for (let t = 0; t < 4; t += 1 / 60) {
    car.z += 30 / 60;
    other.z += 10 / 60;
    s.update(car, [other], {
      oncoming: false,
      drift: { active: true, angle: 25 },
      boosting: false,
      dt: 1 / 60,
    });
  }
  const e = s.events.find((x) => x.kind === 'near');
  const plain = pass({ gap: 0.6 }).events.find((x) => x.kind === 'near')!.points;
  check('near miss mid-drift is worth 1.5x and says so', !!e && e.points >= plain * 1.45 && !!e.sub?.includes('DRIFTING'), { e, plain });
}
// the chase: no clock; it ends when you get away, are busted, or end it
{
  const s = new Scorer('chase');
  const car: CarState = { x: 0, z: 0, yaw: 0, vx: 0, vz: 40, width: W, length: L };
  for (let t = 0; t < 180; t += 1 / 30) s.update(car, [], { oncoming: false, drift: NO_DRIFT, boosting: false, dt: 1 / 30 });
  check('chase: no clock, the drive goes on', s.over === null && s.elapsed > 179, { over: s.over, elapsed: s.elapsed });
  s.pursuit(10, 3);
  check('chase: time with the police after you scores, more at higher heat', s.score === Math.round(RULES.pursuitRate * 3 * 10), s.score);
}
{
  const s = pass({ gap: 0.6, scorer: new Scorer('chase'), seconds: 3.2 });
  const before = s.score;
  const unbanked = s.comboPoints;
  s.end('escaped');
  check('chase: getting away banks the combo', s.over === 'escaped' && unbanked > 0 && s.score > before && s.comboPoints === 0, { before, after: s.score, unbanked });
  const b = pass({ gap: 0.6, scorer: new Scorer('chase'), seconds: 3.2 });
  const was = b.score;
  b.end('busted');
  check('chase: being busted loses it', b.over === 'busted' && b.score === was && b.comboPoints === 0 && b.events.some((e) => e.kind === 'lost'), { was, after: b.score });
}
{
  const wide = pass({ gap: 1.4, scorer: new Scorer('chase'), seconds: 3 });
  const tight = pass({ gap: 1.0, scorer: new Scorer('chase'), seconds: 3 });
  check('chase: a pass down the middle of the next lane is just driving; a close one counts', wide.nearMisses === 0 && tight.nearMisses === 1, { wide: wide.nearMisses, tight: tight.nearMisses });
}
{
  // one car each side in quick succession
  const s = new Scorer('chase');
  const car: CarState = { x: 0, z: 0, yaw: 0, vx: 0, vz: 35, width: W, length: L };
  const a: OtherCar = { id: 1, x: W / 2 + 0.93 + 0.5, z: 30, yaw: 0, v: 20, width: 1.86, length: 4.65 };
  const b: OtherCar = { id: 2, x: -(W / 2 + 0.93 + 0.5), z: 36, yaw: 0, v: 20, width: 1.86, length: 4.65 };
  for (let t = 0; t < 3; t += 1 / 60) {
    car.z += 35 / 60;
    a.z += 20 / 60;
    b.z += 20 / 60;
    s.update(car, [a, b], { oncoming: false, drift: NO_DRIFT, boosting: false, dt: 1 / 60 });
  }
  check('threading between two cars is a bonus', s.nearMisses === 2 && s.events.some((e) => e.label === 'THREADED'), s.events.map((e) => e.label));
}
{
  const s = new Scorer('chase', { startBoost: 0 });
  for (let i = 0; i < 60; i++) s.slipstream(1 / 30, false);
  check('a slipstream refills the boost', s.boost > 0.15 && s.comboPoints > 0, { boost: s.boost, combo: s.comboPoints });
}
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
