// Garage rules, no rendering: which archetype a real car drives as, that each archetype really is
// best at what it claims, damage, the economy, and parsing what a host page sends.
// Run: npx tsx scripts/garage-test.ts
import { ARCHETYPES, ARCHETYPE, ratings, zeroToHundred } from '../src/mygarage/garage/archetypes';
import { matchArchetype } from '../src/mygarage/garage/catalog';
import { parseVehicle, paintOf, tweaksOf, GarageVehicle } from '../src/mygarage/garage/vehicle';
import {
  buyUpgrade,
  carSetup,
  emptySave,
  finishRun,
  freshProgress,
  MAX_LEVEL,
  LIMP_HEALTH,
  startHealth,
  progressOf,
  repair,
  repairCost,
  sanitizeSave,
  upgradeCost,
  withCar,
} from '../src/mygarage/garage/progress';
import { decodeGarage, encodeGarage, parseImport, readHash } from '../src/mygarage/garage/bridge';
import { RULES, Scorer } from '../src/mygarage/scoring';
import { VEHICLES } from '../src/sim/vehicles';

let failed = 0;
const check = (name: string, ok: boolean, info: unknown = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' ' + JSON.stringify(info)}`);
  if (!ok) failed++;
};

// ------------------------------------------------------------------ catalogue
const cases: [string, string, number | undefined, string | undefined, string][] = [
  ['Soueast', 'DX5', 2024, undefined, 'crossover'],
  ['Toyota', 'Camry', 2018, undefined, 'sedan'],
  ['Toyota', 'Land Cruiser 200', 2014, undefined, 'offroad'],
  ['Toyota', 'Hilux', 2020, undefined, 'utility'],
  ['Lada (VAZ)', '2107', 1998, undefined, 'classic'],
  ['ВАЗ', 'Niva', 2010, undefined, 'offroad'],
  ['Lada', 'Vesta', 2021, undefined, 'sedan'],
  ['Mercedes', 'E-Class', 2017, undefined, 'exec'],
  ['Mercedes-Benz', 'Sprinter 316', 2015, undefined, 'utility'],
  ['BMW', 'M4', 2021, undefined, 'sports'],
  ['Porsche', '911', 2019, undefined, 'sports'],
  ['Volkswagen', 'Golf GTI', 2019, undefined, 'hatch'],
  ['Hyundai', 'i10', 2015, undefined, 'compact'],
  ['Tesla', 'Model Y', 2023, undefined, 'ev'],
  ['Toyota', 'Corolla', 2020, 'electric', 'ev'],
  ['Abarth', '595', 2018, undefined, 'hatch'],
  ['Unknownmake', 'Pickup 4x2', 2012, undefined, 'utility'],
  ['Unknownmake', 'Something', 1979, undefined, 'classic'],
  ['Unknownmake', 'Something', 2015, undefined, 'sedan'],
];
const wrong = cases
  .filter(([mk, md, y, e, want]) => matchArchetype(mk, md, y, e).archetype !== want)
  .map(([mk, md, y, e, want]) => ({ mk, md, want, got: matchArchetype(mk, md, y, e) }));
check('real cars map to the right archetype', wrong.length === 0, wrong);

// ------------------------------------------------------------------ each archetype is best at its thing
const by = <T>(f: (a: (typeof ARCHETYPES)[number]) => T) => ARCHETYPES.map((a) => [a.id, f(a)] as const);
const top = (xs: readonly (readonly [string, number])[], dir: 1 | -1) => [...xs].sort((a, b) => (b[1] - a[1]) * dir)[0][0];
const claims: [string, string][] = [
  [
    'compact',
    top(
      by((a) => a.perks.repairMul + a.perks.priceMul),
      -1,
    ),
  ],
  [
    'sedan',
    top(
      by((a) => a.perks.cashMul),
      1,
    ),
  ],
  [
    'exec',
    top(
      by((a) => a.perks.boostDrainMul),
      -1,
    ),
  ],
  [
    'sports',
    top(
      by((a) => VEHICLES[a.type].maxSpeed),
      1,
    ),
  ],
  [
    'hatch',
    top(
      by((a) => ratings(a).handling),
      1,
    ),
  ],
  [
    'hatch',
    top(
      by((a) => a.perks.driftMul),
      1,
    ),
  ],
  [
    'crossover',
    top(
      by((a) => a.perks.rainPenalty),
      -1,
    ),
  ],
  [
    'offroad',
    top(
      by((a) => a.perks.toughness),
      1,
    ),
  ],
  [
    'utility',
    top(
      by((a) => a.perks.nearMul),
      1,
    ),
  ],
  [
    'ev',
    top(
      by((a) => zeroToHundred(a.type)),
      -1,
    ),
  ],
  [
    'classic',
    top(
      by((a) => a.perks.scoreMul),
      1,
    ),
  ],
];
const broken = claims.filter(([want, got]) => want !== got);
check('every archetype is the best at what it claims', broken.length === 0, broken);
check(
  'ten archetypes, each on its own player-only spec',
  ARCHETYPES.length === 10 && new Set(ARCHETYPES.map((a) => a.type)).size === 10 && ARCHETYPES.every((a) => VEHICLES[a.type].traffic === 0),
);

// ------------------------------------------------------------------ damage
const v = (make: string, model: string, extra: Partial<GarageVehicle> = {}): GarageVehicle => ({ id: `${make}-${model}`, make, model, source: 'local', ...extra });
function hardHits(car: GarageVehicle, armor = 0) {
  const p = freshProgress(car);
  p.upgrades.armor = armor;
  const st = carSetup(car, p);
  const s = new Scorer('score', { health: p.health, damageTaken: st.damageTaken });
  let hits = 0;
  while (!s.over && hits < 10) {
    s.impact(30); // a very hard crash every time
    hits++;
    for (let i = 0; i < 120; i++)
      s.update({ x: 0, z: 0, yaw: 0, vx: 0, vz: 0, width: 2, length: 4.5 }, [], { oncoming: false, drift: { active: false, angle: 0 }, boosting: false, dt: 1 / 60 });
  }
  return hits;
}
const firstHit = ARCHETYPES.map((a) => {
  const s = new Scorer('score', { damageTaken: carSetup(v('X', a.id, { archetype: a.id }), freshProgress(v('X', a.id))).damageTaken });
  return [a.id, s.impact(30)] as const;
});
check(
  'every fresh car survives its first hard crash',
  firstHit.every(([, r]) => r === 'damage'),
  firstHit,
);
check('a sedan is wrecked by the second', hardHits(v('Toyota', 'Camry')) === 2);
check('an off-roader takes three', hardHits(v('Toyota', 'Land Cruiser')) === 3, hardHits(v('Toyota', 'Land Cruiser')));
check('full body armour buys a sedan an extra hit', hardHits(v('Toyota', 'Camry'), 5) === 3, hardHits(v('Toyota', 'Camry'), 5));
{
  const s = new Scorer('score', { health: 40 });
  check('a car already at 40% is wrecked by one hard crash', s.impact(30) === 'wreck' && s.over === 'wrecked');
  const t = new Scorer('score', { health: 100 });
  t.impact(RULES.wreckImpact + 1);
  check('condition lost is tracked for the results', t.damageTaken > 50 && t.health < 50, { lost: t.damageTaken, h: t.health });
}

// ------------------------------------------------------------------ economy
{
  const car = v('Toyota', 'Camry');
  let save = { ...emptySave(), coins: 1000 };
  const r1 = buyUpgrade(save, car, 'engine');
  check('buying an upgrade costs coins and adds a level', r1.ok && r1.save.coins === 1000 - upgradeCost(ARCHETYPE.sedan, 0)! && progressOf(r1.save, car).upgrades.engine === 1);
  save = r1.ok ? r1.save : save;
  const before = carSetup(car, freshProgress(car)).power;
  const after = carSetup(car, progressOf(save, car)).power;
  check('an engine level adds power', after > before * 1.06, { before, after });
  const poor = buyUpgrade({ ...save, coins: 10 }, car, 'tires');
  check('cannot buy without the coins', !poor.ok);
  const maxed = withCar(save, car, (p) => ({ ...p, upgrades: { ...p.upgrades, nitro: MAX_LEVEL } }));
  check('cannot go past the top level', !buyUpgrade({ ...maxed, coins: 1e6 }, car, 'nitro').ok && upgradeCost(ARCHETYPE.sedan, MAX_LEVEL) === null);
  check(
    'the compact is the cheapest to upgrade, the sports coupe the dearest',
    upgradeCost(ARCHETYPE.compact, 2)! < upgradeCost(ARCHETYPE.sedan, 2)! && upgradeCost(ARCHETYPE.sports, 2)! > upgradeCost(ARCHETYPE.exec, 2)!,
  );

  const hurt = finishRun({ ...save, coins: 500 }, car, 30, 120, 2400);
  check(
    'a run saves condition and adds coins',
    progressOf(hurt, car).health === 30 && hurt.coins === 620 && progressOf(hurt, car).runs === 1 && progressOf(hurt, car).bestScore === 2400,
  );
  const cost = repairCost(ARCHETYPE.sedan, 30);
  const fixed = repair(hurt, car);
  check('repair brings it back to 100% for the quoted price', fixed.ok && progressOf(fixed.save, car).health === 100 && fixed.save.coins === 620 - cost, { cost });
  const partial = repair({ ...hurt, coins: Math.floor(cost / 2) }, car);
  check('without enough coins, a partial repair', partial.ok && progressOf(partial.save, car).health > 30 && progressOf(partial.save, car).health < 100 && partial.save.coins >= 0);
  const wreck = finishRun({ ...save, coins: 0 }, car, 0, 0, 0);
  check('a wreck still drives: it limps out at the limp-home condition', startHealth(progressOf(wreck, car).health) === LIMP_HEALTH && startHealth(80) === 80);
}

// ------------------------------------------------------------------ the garage details
{
  const t = tweaksOf(v('Toyota', 'Camry', { engine: 'diesel', gasEquipment: true, wheelSize: 19, condition: 'damaged' }));
  check('diesel, gas, wheels and condition all do something', t.power !== 1 && t.cashMul > 1 && t.grip > 1 && t.startHealth === 60 && t.notes.length === 4, t);
  check(
    'colour names map to paint',
    paintOf('White', 0) === 0xeeeeea && paintOf('Черный', 0) === 0x141416 && paintOf('#123456', 0) === 0x123456 && paintOf('Unobtainium', 7) === 7,
  );
}

// ------------------------------------------------------------------ parsing what a host sends
{
  check('a vehicle needs make and model', parseVehicle({ make: 'Toyota' }) === null && parseVehicle('Toyota Camry') === null && parseVehicle(null) === null);
  const p = parseVehicle({
    id: 'abc 1',
    make: ' <b>Toyota</b> ',
    model: 'Camry'.repeat(20),
    year: '2019',
    vin: 'jtdbe32k-123456789oq',
    engine: 'Gasoline',
    gasEquipment: 'Yes',
    condition: 'Damaged',
    wheelSize: 'R18',
    headlights: 'LED',
    steeringWheel: 'RHD',
    archetype: 'rocket',
    extra: 'dropped',
  })!;
  check(
    'fields are cleaned and normalised',
    p.make === 'bToyota/b' &&
      p.model.length === 40 &&
      p.year === 2019 &&
      p.engine === 'petrol' &&
      p.gasEquipment === true &&
      p.condition === 'damaged' &&
      p.wheelSize === 18 &&
      p.headlights === 'led' &&
      p.steeringWheel === 'right' &&
      p.archetype === undefined &&
      !('extra' in p) &&
      p.id === 'abc-1' &&
      !/[IOQ-]/.test(p.vin ?? ''),
    p,
  );
  check(
    'impossible years and wheels are dropped',
    parseVehicle({ make: 'A', model: 'B', year: 3000, wheelSize: 99 })!.year === undefined && parseVehicle({ make: 'A', model: 'B', wheelSize: 99 })!.wheelSize === undefined,
  );
  const many = Array.from({ length: 25 }, (_, i) => ({ id: 'same', make: 'Kia', model: `Rio ${i}` }));
  const imp = parseImport({ vehicles: many, progress: { coins: -50, cars: { 'id:same': { health: 900, upgrades: { engine: 99 } } } } })!;
  check('at most 10 vehicles, ids made unique', imp.vehicles.length === 10 && new Set(imp.vehicles.map((x) => x.id)).size === 10);
  check('host progress is clamped', imp.progress!.coins === 0 && imp.progress!.cars['id:same'].health === 100 && imp.progress!.cars['id:same'].upgrades.engine === MAX_LEVEL);
  const payload = { vehicles: [{ id: 'g1', make: 'Soueast', model: 'DX5', year: 2024, color: 'Սպիտակ / white', primary: true }] };
  const hash = '#garage=' + encodeGarage(payload);
  const back = readHash(hash)!;
  check('#garage= links round-trip (UTF-8 included)', back.vehicles[0].model === 'DX5' && back.vehicles[0].color === 'Սպիտակ / white' && back.vehicles[0].primary === true, back);
  check('junk and oversized fragments are ignored', readHash('#garage=%%%') === null && decodeGarage('A'.repeat(30000)) === null && readHash('#other=1') === null);
}

// ------------------------------------------------------------------ hostile saves
{
  const s = sanitizeSave({
    coins: 'lots',
    cars: { k: { health: -5, runs: 1e12, upgrades: { armor: -3 } } },
    localVehicles: [{ make: 'Lada', model: '2107' }, { nope: 1 }],
    activeId: 'x'.repeat(500),
  });
  check(
    'a corrupt save loads safely',
    s.coins >= 0 && s.cars.k.health === 0 && s.cars.k.upgrades.armor === 0 && s.localVehicles.length === 1 && (s.activeId?.length ?? 0) <= 64,
    s,
  );
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
