import * as THREE from 'three';
import { generateCity } from '../src/world/CityGenerator';
import { TrafficSystem } from '../src/sim/traffic/TrafficSystem';
const city = generateCity(20261019);
const t0 = performance.now();
const ts = new TrafficSystem(city, null, 1);
console.log('graph', ts.graph.lanes.length, 'lanes', ts.graph.conns.length, 'connectors', 'build ms', (performance.now() - t0).toFixed(1));
const conf = ts.graph.conns.reduce((s, c) => s + c.conflicts.length, 0) / ts.graph.conns.length;
console.log('avg conflicts per connector', conf.toFixed(2));
ts.maxVehicles = 90;
ts.spawnRadius = { min: 0, max: 500, despawn: 700 };
const center = new THREE.Vector3(0, 0, 0);
const fwd = new THREE.Vector2(0, 1);
const dt = 1 / 30;
let stuckMax = 0;
const stillTime = new Map<number, number>();
const anchors = new Map<number, { x: number; z: number; t: number }>();
let crossings = 0;
const seenConn = new Set<string>();
const tStart = performance.now();
for (let step = 0; step < 30 * 600; step++) {
  ts.update(dt, center, fwd, 8 + step * dt / 3600 * 30);
  for (const v of ts.vehicles) {
    if (v.conn >= 0 && !seenConn.has(v.id + ':' + v.conn)) { seenConn.add(v.id + ':' + v.conn); crossings++; }
    const anchor = (anchors.get(v.id) ?? { x: v.x, z: v.z, t: 0 });
    if (Math.hypot(v.x - anchor.x, v.z - anchor.z) > 1.5) { anchor.x = v.x; anchor.z = v.z; anchor.t = 0; } else anchor.t += dt;
    anchors.set(v.id, anchor);
    const st = anchor.t;
    stillTime.set(v.id, st);
    if (st > stuckMax) stuckMax = st;
  }
  if (step % (30 * 60) === 0) {
    const n = ts.vehicles.length;
    const avgV = ts.vehicles.reduce((s, v) => s + v.v, 0) / Math.max(1, n);
    const stuck = ts.vehicles.filter((v) => (stillTime.get(v.id) ?? 0) > 60).length;
    console.log(`t=${(step * dt).toFixed(0)}s vehicles=${n} parked=${ts.parked.length} avgV=${avgV.toFixed(1)} stuck>60s=${stuck} crossings=${crossings}`);
  }
}
console.log('sim ms per frame', ((performance.now() - tStart) / (30 * 600)).toFixed(3), 'max still', stuckMax.toFixed(1));
const stuck = ts.vehicles.filter((v) => (stillTime.get(v.id) ?? 0) > 60);
for (const v of stuck.slice(0, 8)) {
  const lane = v.lane >= 0 ? ts.graph.lanes[v.lane] : null;
  console.log('stuck', v.id, 'lane', v.lane, 'conn', v.conn, 's', v.s.toFixed(1), lane ? 'len ' + lane.length.toFixed(1) : '', 'route', v.route.length, 'committed', v.committed, 'stopT', v.stopT.toFixed(1), 'state', v.state, 'inter', lane ? lane.to : -1);
}
// diagnostics
const tsx: any = ts;
for (const v of stuck.filter((q) => q.lane < 0 || ts.laneVeh[q.lane].indexOf(q) === ts.laneVeh[q.lane].length - 1).slice(0, 14)) {
  if (v.lane < 0) { console.log(v.id, 'on connector', v.conn); continue; }
  const lane = ts.graph.lanes[v.lane];
  const list = ts.laneVeh[v.lane];
  const idx = list.indexOf(v);
  const c = tsx.nextConn(v);
  const remain = lane.length - v.s;
  if (idx < list.length - 1) { const lead = list[idx + 1]; console.log(v.id, 'behind', lead.id, 'gap', (lead.s - lead.len - v.s).toFixed(1)); continue; }
  if (!c) { console.log(v.id, 'no conn; route', v.route); continue; }
  const it = city.intersections[c.inter];
  const phase = ts.signalPhase(c.inter, lane.axis);
  const occ = c.conflicts.filter((cid: number) => ts.connVeh[cid].length > 0).map((cid: number) => cid + '(' + ts.connVeh[cid].map((o) => o.id).join(',') + ')');
  const tl = ts.laneVeh[c.to];
  const full = tl.length ? (tl[0].s.toFixed(1) + ' v' + tl[0].v.toFixed(1) + ' id' + tl[0].id) : 'empty';
  const waiters = [...ts.interWait[c.inter]].map((o) => o.id + '@' + o.arrive.toFixed(0));
  console.log(v.id, 'remain', remain.toFixed(1), 'turn', c.turn, 'sig', it.signalized, 'phase', phase, 'occ', occ.join(' '), 'target', full, 'waiters', waiters.join(' '), 'mayEnter', tsx.mayEnter(v, c, remain));
}
