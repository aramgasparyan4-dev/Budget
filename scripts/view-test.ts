// Unit checks for fitting the view to the frame: run with `npx tsx scripts/view-test.ts`
import { fitFov } from '../src/game/CameraController';

let failed = 0;
const check = (name: string, ok: boolean, info: unknown = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, ok ? '' : JSON.stringify(info));
  if (!ok) failed++;
};
/** horizontal field of view (degrees) for a vertical one at an aspect ratio */
const hfov = (v: number, a: number) => (2 * Math.atan(Math.tan((v * Math.PI) / 360) * a) * 180) / Math.PI;

check('a wide frame keeps the field of view it asked for', fitFov(62, 16 / 9) === 62 && fitFov(62, 4 / 3) === 62);
const a4 = fitFov(62, 794 / 1123);
check('an A4 page (portrait) opens it up', a4 > 80 && a4 <= 92, a4);
check('so it still sees about as much to the sides as a nearly square frame', Math.abs(hfov(a4, 794 / 1123) - hfov(62, 1.15)) < 1, [hfov(a4, 794 / 1123), hfov(62, 1.15)]);
check('never wider than 92 degrees, even on a very tall frame', fitFov(62, 0.3) === 92 && fitFov(75, 0.5) <= 92);
check('nonsense aspect ratios leave it alone', fitFov(62, 0) === 62 && fitFov(62, NaN) === 62);

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
