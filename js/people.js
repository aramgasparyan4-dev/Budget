/* Sundown Protocol — the hero and every person, drawn as jointed figures that walk, aim, fall and surrender.
   Draw calls expect the context translated to the feet (centre-bottom), world units. */
(function (g) {
  'use strict';
  const SD = g.SD, TAU = Math.PI * 2;

  /* The hero: a small amber four-legged robot with a visor, an antenna and a red bandana.
     o = {face, anim: idle|run|air|roll|ride, t, rot, flash, crouch, vx} */
  SD.drawHero = function (c, o) {
    const fl = o.flash, body = fl ? '#ffffff' : '#e0893c', lite = fl ? '#ffffff' : '#f4aa58', dark = fl ? '#ffffff' : '#a65a26', leg = fl ? '#ffffff' : '#5f3520';
    const t = o.t || 0, run = o.anim === 'run', air = o.anim === 'air', roll = o.anim === 'roll', ride = o.anim === 'ride';
    c.save();
    if (roll) { c.translate(0, -10); c.rotate(o.rot || 0); c.translate(0, 10); }
    c.scale(o.face || 1, 1);
    const bob = run ? Math.abs(Math.sin(t * 16)) * 1.4 : air ? 0 : Math.sin(t * 2.4) * 0.5;
    const sq = o.crouch ? 4.5 : 0;
    if (!roll) {
      const ph = t * 16;
      for (let i = 0; i < 4; i++) {
        const hx = [-7.5, -3, 3, 7.5][i], s = run ? Math.sin(ph + (i % 2 ? Math.PI : 0)) : 0, lift = run ? Math.max(0, Math.cos(ph + (i % 2 ? Math.PI : 0))) * 2.2 : 0;
        const tuck = air || ride ? 2.4 : 0, out = (i < 2 ? -1 : 1) * (1.6 + sq * 0.5);
        c.strokeStyle = leg; c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(hx, -4.5 + sq * 0.4); c.lineTo(hx + out + s * 1.5, -2.6 - tuck * 0.4 + sq * 0.2); c.lineTo(hx + out * 0.6 + s * 3.2, -lift - tuck); c.stroke();
      }
    }
    c.translate(0, -bob + sq);
    // antenna and bandana tails trail behind the motion
    const sway = Math.sin(t * 5) * 0.6 - Math.max(-3, Math.min(3, (o.vx || 0) * (o.face || 1) / 70));
    c.strokeStyle = dark; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-4, -17); c.quadraticCurveTo(-4.5 + sway * 0.4, -21, -4 + sway, -24); c.stroke();
    c.fillStyle = fl ? '#ffffff' : '#ff5d5d'; c.beginPath(); c.arc(-4 + sway, -24.6, 1.7, 0, TAU); c.fill();
    c.fillStyle = body; SD.rr(c, -10.5, -15.5, 21, 11.5, 3); c.fill();
    c.beginPath(); c.ellipse(0, -15, 8, 3.6, 0, Math.PI, TAU); c.fill();
    c.fillStyle = lite; SD.rr(c, -9, -14.6, 18, 2, 1); c.fill();
    c.fillStyle = dark; SD.rr(c, -10.5, -6.6, 21, 2.6, 1.3); c.fill();
    c.fillStyle = '#1b1410'; SD.rr(c, -1.5, -13.6, 11.4, 4.6, 2); c.fill();
    const blink = !run && t % 3.4 > 3.25;
    c.fillStyle = blink ? '#1b1410' : '#7fe3ff'; c.fillRect(4.6, -12.3, 3.4, blink ? 0.6 : 1.9);
    if (!blink) { c.fillStyle = 'rgba(127,227,255,0.35)'; c.fillRect(0.6, -12.3, 3, 1.9); }
    c.fillStyle = fl ? '#ffffff' : '#b8322a'; SD.rr(c, -1, -8.6, 11.8, 2.6, 1); c.fill();
    const fw = Math.sin(t * 9) * 1.2;
    SD.poly(c, [-1, -8.4, -6 + sway * 0.5, -6 + fw, -5, -3.6 - fw * 0.5, -0.5, -6.4]); c.fill();
    c.restore();
  };

  const SKINS = ['#d9a57e', '#c98f66', '#a8714c', '#e6bd98', '#8a5a3c'];
  SD.lookFor = function (a) {
    const r = (n) => SD.hash((a.hx * 7) | 0, n + a.kind.length);
    a.skin = SKINS[(r(1) * SKINS.length) | 0];
    a.pants = ['#3b3644', '#4a3a2a', '#2e3340', '#5a4a38'][(r(2) * 4) | 0];
    a.dress = a.kind === 'folk' && r(3) < 0.45;
    a.hatKind = a.dress ? 3 : a.kind === 'foreman' ? 1 : a.kind === 'folk' && r(4) < 0.3 ? 2 : 0;
    a.coat = a.kind === 'duelist' || a.kind === 'law' || a.kind === 'ally' || a.kind === 'outlaw' || a.kind === 'foreman';
    a.beard = a.kind === 'foreman' || (a.kind !== 'folk' || !a.dress) && r(5) < 0.25;
  };

  /* a: actor record. Uses kind, face, t, vx, state, st, dead, deadT, surrender, roped, out, h, flash, ax, ay, muzzle. */
  SD.drawHuman = function (c, a, opts) {
    if (!a.skin) SD.lookFor(a);
    opts = opts || {};
    const K = SD.KINDS[a.kind] || SD.KINDS.folk, f = a.face || 1, t = a.t || 0, sp = Math.abs(a.vx || 0), fl = a.flash > 0;
    const W = '#ffffff', skin = fl ? W : a.skin, shirt = fl ? W : a.shirt, pants = fl ? W : a.pants, hat = fl ? W : a.hat, boot = fl ? W : '#241a14';
    const bk = (col) => (fl ? W : SD.shade(col, -0.3));
    const big = a.kind === 'foreman' ? 1.22 : 1, seated = !!opts.seated;
    const down = a.dead || a.roped > 0 || a.out, fall = a.dead ? Math.min(1, (a.deadT || 0) / 0.3) : down ? 1 : 0;
    c.save();
    if (fall) { c.translate(-f * fall * 6, -fall * 3.5); c.rotate(-f * fall * 1.45); }
    c.scale(f * big, big);
    const crouch = !seated && !down && a.h < K.h * 0.8 ? 1 : 0, run = sp > 105, walk = sp > 12 && !down && !seated;
    const ph = t * (run ? 13 : 8.5), sw = walk ? (run ? 0.9 : 0.5) : 0;
    const hipY = seated ? -20 : -20 + crouch * 7 - (walk ? Math.abs(Math.sin(ph)) * 1.3 : 0) + (down ? 0 : Math.sin(t * 2.1) * 0.25);
    const lean = (run ? 0.2 : walk ? 0.06 : 0) + crouch * 0.28, shX = lean * 14, shY = hipY - 14 + crouch * 2;
    const armed = !!K.gun && !down && !a.surrender, aiming = armed && (a.alert || a.state === 'aim');
    const leg = (off, col) => {
      let a1, a2;
      if (seated) { a1 = 1.15; a2 = 0.1; }
      else { const s = Math.sin(ph + off), cz = Math.cos(ph + off); a1 = s * sw + crouch * 0.95; a2 = a1 - Math.max(0, cz) * sw * 1.5 - crouch * 1.9; }
      const e = SD.bone2(c, off ? -1 : 1, hipY, a1, 10, a2, 10, 4.2, col);
      SD.limb(c, e[0], e[1] - 0.8, e[0] + 3, e[1] - 0.8, 2.6, boot);
    };
    const arm = (ang, len, col) => { const hx = shX + Math.cos(ang) * len, hy = shY + 2 + Math.sin(ang) * len; SD.limb(c, shX, shY + 2, hx, hy, 3.4, col); return [hx, hy]; };
    // back arm, back leg
    if (a.surrender && !down) arm(-1.9, 13, bk(shirt));
    else arm(Math.PI / 2 + (walk ? Math.sin(ph) * sw * 0.8 : 0.08), 12, bk(shirt));
    if (!a.dress) leg(Math.PI, bk(pants));
    // torso
    if (a.dress) { c.fillStyle = shirt; SD.poly(c, [shX - 4.5, shY + 4, shX + 4.5, shY + 4, 7.5, -1.5, -7.5, -1.5]); c.fill(); SD.limb(c, -2, -1, 0, -1, 2.4, boot); SD.limb(c, 3, -1, 5, -1, 2.4, boot); }
    else leg(0, pants);
    if (a.coat) { SD.limb(c, -0.6, hipY + 5, shX - 0.6, shY + 1, 11.5, fl ? W : a.kind === 'law' || a.kind === 'ally' ? '#2c3a5a' : a.kind === 'duelist' ? '#17141a' : SD.shade(a.shirt, -0.45)); SD.limb(c, 0.8, hipY - 1, shX + 0.8, shY + 2, 5.5, shirt); }
    else SD.limb(c, 0, hipY - 1, shX, shY + 1.5, 9.5, shirt);
    if (!a.dress) { c.fillStyle = fl ? W : '#2a1c12'; c.fillRect(-4.6, hipY - 2.2, 9.6, 2); }
    if ((a.law || a.kind === 'law' || a.kind === 'ally') && !fl) { c.fillStyle = '#ffd166'; c.beginPath(); c.arc(shX + 2.6, shY + 5, 1.5, 0, TAU); c.fill(); }
    if (armed && !aiming) { c.fillStyle = '#2a2726'; c.fillRect(2.6, hipY - 1, 2.2, 5.5); }
    // head and hat
    const hx = shX + lean * 5 + 0.6, hy = shY - 6.2;
    c.fillStyle = skin; c.beginPath(); c.arc(hx, hy, 4.7, 0, TAU); c.fill();
    c.fillRect(hx - 1.6, hy + 3, 3.4, 3.4);
    if (!fl) {
      c.fillStyle = '#1b1410'; c.fillRect(hx + 2.1, hy - 1.2, 1.3, 1.3);
      if (a.beard) { c.fillStyle = '#3a2a20'; c.beginPath(); c.arc(hx + 0.6, hy + 1.6, 4.2, 0.1, Math.PI - 0.5); c.fill(); }
      if (a.team === 'gang' && a.kind !== 'duelist' && a.kind !== 'foreman') { c.fillStyle = '#9b2c22'; SD.poly(c, [hx - 4.4, hy + 0.4, hx + 4.9, hy + 0.4, hx + 3.4, hy + 5.6, hx - 2, hy + 5]); c.fill(); SD.poly(c, [hx - 4.2, hy + 0.6, hx - 8.5, hy + 2 + Math.sin(t * 8) * 1.2, hx - 4, hy + 3]); c.fill(); }
    }
    c.fillStyle = hat;
    if (a.hatKind === 2) { c.fillStyle = fl ? W : '#3a2a20'; c.beginPath(); c.arc(hx - 0.4, hy - 1.2, 4.9, Math.PI * 0.95, TAU * 1.02); c.fill(); }
    else if (a.hatKind === 3) { c.fillStyle = fl ? W : SD.shade(a.shirt, 0.45); c.beginPath(); c.arc(hx - 0.8, hy - 0.6, 5.6, Math.PI * 0.75, TAU * 0.97); c.fill(); c.fillRect(hx - 6, hy - 1, 3, 5.5); }
    else if (a.hatKind === 1) { c.beginPath(); c.ellipse(hx, hy - 3.6, 7, 1.5, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(hx, hy - 4.2, 4.6, Math.PI, TAU); c.fill(); }
    else if (!down || fall < 1) {
      c.beginPath(); c.ellipse(hx + 0.4, hy - 3.4, 9, 1.9, -0.05, 0, TAU); c.fill();
      SD.poly(c, [hx - 4.6, hy - 3.6, hx - 3.6, hy - 9.4, hx - 0.4, hy - 8.4, hx + 3.2, hy - 9.6, hx + 4.8, hy - 3.6]); c.fill();
      c.fillStyle = fl ? W : SD.shade(a.hat, -0.4); c.fillRect(hx - 4.4, hy - 5.4, 9, 1.5);
    }
    // front arm and weapon
    if (a.surrender && !down) arm(-1.25, 13, shirt);
    else if (down) arm(Math.PI / 2 + 0.5, 11, shirt);
    else if (a.kind === 'knife') {
      const ang = a.state === 'wind' ? -1.3 : 0.5 + Math.sin(ph) * 0.3, h = arm(ang, 12, shirt);
      c.save(); c.translate(h[0], h[1]); c.rotate(ang - 0.3); c.fillStyle = '#d8dde6'; SD.poly(c, [0, -1, 9, -0.6, 10.5, 0.4, 0, 1.2]); c.fill(); c.restore();
    } else if (aiming && a.state === 'reload') { arm(0.35, 8, shirt); c.save(); c.translate(shX + 7, shY + 5); SD.drawGun(c, 'revolver', -0.9, 0); c.restore(); }
    else if (aiming) {
      const lx = ((a.ax == null ? a.x + f * 100 : a.ax) - a.x) * f / big, ly = ((a.ay == null ? a.y - 30 : a.ay) - (a.y + (opts.lift || 0) + (shY + 2) * big)) / big;
      const ang = Math.atan2(ly, Math.max(4, lx)), h = arm(ang, 12.5, shirt);
      c.save(); c.translate(h[0], h[1]); SD.drawGun(c, a.kind === 'rifle' ? 'rifle' : a.kind === 'foreman' ? 'shotgun' : 'revolver', ang, a.muzzle > 0 ? 2 : 0);
      if (a.muzzle > 0) { c.rotate(ang); c.fillStyle = '#fff1b8'; SD.poly(c, [15, 0, 25, -4.5, 21, 0, 25, 4.5]); c.fill(); }
      c.restore();
    } else arm(Math.PI / 2 - (walk ? Math.sin(ph) * sw * 0.8 : -0.08), 12, shirt);
    c.restore();
    // a fallen cowboy hat lies beside the body
    if (a.dead && fall >= 1 && a.hatKind === 0) { c.fillStyle = a.hat; c.beginPath(); c.ellipse(-f * 30, -1.6, 8, 1.8, 0, 0, TAU); c.fill(); c.fillRect(-f * 30 - 4, -6, 8, 4.5); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
