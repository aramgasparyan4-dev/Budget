/* Neural Kick — run state, the player's actions, combat, loot. */
(function (g) {
  'use strict';
  const NK = g.NK, C = NK.C, T = C.T, PW = C.PW, PH = C.PH, TAU = Math.PI * 2;
  const S = (NK.S = {
    state: 'hub', L: null, p: null, run: null, a: null, view: { w: 640, h: 400, z: 1 }, cam: { x: 0, y: 0 },
    en: [], shots: [], picks: [], items: [], nums: [], parts: [], trail: [], springT: {},
    clock: 0, hitstop: 0, shake: 0, near: null, msg: null, boss: null, rot: 0, sqx: 1, sqy: 1,
  });
  const sfx = (n) => NK.sfx && NK.sfx(n);
  const rand = (a, b) => a + Math.random() * (b - a);
  const ev = (n, d) => NK.onEvent && NK.onEvent(n, d);

  function puff(x, y, n, color, speed, life, grav) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(0.3, 1) * speed;
      S.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: rand(2, 5), grav: grav || 0 });
    }
  }
  NK.puff = puff;
  NK.num = (x, y, text, color, big) => S.nums.push({ x: x + rand(-6, 6), y, text, color, t: 0, big });
  NK.say = (text) => { S.msg = { text, t: 2.2 }; };
  const pcx = () => S.p.x + PW / 2, pcy = () => S.p.y + PH / 2;

  /* ---------- run + floor setup ---------- */
  NK.newRun = function (meta) {
    const u = meta.up || {};
    const maxhp = 100 + 15 * (u.vit || 0), fl = 2 + (u.flask || 0);
    const pool = ['sword', 'daggers', 'blaster'];
    for (const id of ['pike', 'sledge', 'bombs']) if (u[id]) pool.push(id);
    S.run = {
      depth: 0, seed: (Math.random() * 1e9) | 0, gold: 40 * (u.purse || 0), cores: 0, kills: 0, time: 0, perks: [],
      main: { id: 'sword', tier: 0 }, alt: null, ammo: 0, ammoT: 0, maxhp, hp: maxhp, flaskMax: fl, flask: fl,
      dmgMul: 1 + 0.08 * (u.edge || 0), atkSpd: 1, reach: 1, crit: 0, vamp: 0, airJumps: 0, rollCd: 0.45, spd: 1,
      goldMul: 1, revive: 0, slamMul: 1, pool,
    };
    NK.loadFloor();
  };

  NK.loadFloor = function () {
    const r = S.run, L = NK.genFloor(r.depth, r.seed), rnd = NK.rng(r.seed + r.depth * 31 + 5);
    S.L = L; S.state = 'play';
    S.en = []; S.shots = []; S.picks = []; S.items = []; S.nums = []; S.parts = []; S.trail = []; S.springT = {};
    S.hitstop = 0; S.shake = 0; S.near = null; S.msg = null; S.boss = null; S.dieT = 0;
    S.p = NK.newPlayer(L.start.x, L.start.y); S.p.ev = [];
    S.a = { atk: null, combo: 0, comboT: 0, atkBuf: 0, rollCd: 0, airRoll: false, iframes: 1, healT: 0, runT: 0 };
    S.rot = 0; S.sqx = S.sqy = 1;
    const ground = L.floor.ground, tot = Object.keys(ground).reduce((s, k) => s + ground[k], 0);
    const pickGround = () => { let v = rnd() * tot; for (const k in ground) { v -= ground[k]; if (v <= 0) return k; } return 'bug'; };
    for (const s of L.spawns) {
      if (s.c === 'e') NK.spawnEnemy(pickGround(), s.x, s.y);
      else if (s.c === 'b') NK.spawnEnemy(r.depth >= 1 ? 'bloat' : 'bug', s.x, s.y);
      else if (s.c === 'f') NK.spawnEnemy('wisp', s.x, s.y - 40);
      else if (s.c === 't') NK.spawnEnemy('spam', s.x, s.y);
      else if (s.c === 'B') S.boss = NK.spawnEnemy('boss', s.x, s.y);
      else if (s.c === 'c') S.picks.push({ kind: 'gold', x: s.x, y: s.y - 12, vx: 0, vy: 0, t: 0, val: 2, still: true });
      else if (s.c === 'T') S.items.push({ kind: 'chest', x: s.x, y: s.y, open: false });
      else if (s.c === 'U') S.items.push({ kind: 'chip', x: s.x, y: s.y });
    }
    if (r.depth >= 1) {
      const c = S.en.filter((e) => e.type === 'bug' || e.type === 'glitch');
      if (c.length) NK.makeElite(c[Math.floor(rnd() * c.length)]);
    }
    const c = camTarget(); S.cam.x = c.x; S.cam.y = c.y;
    NK.say(L.name + (L.loop ? '  ·  loop ' + (L.loop + 1) : ''));
  };

  function camTarget() {
    const p = S.p, v = S.view, L = S.L, lw = L.w * T, lh = L.h * T;
    let x = p.x + PW / 2 + p.facing * 40 - v.w / 2, y = p.y + PH / 2 - v.h * 0.66;
    const b = S.boss;
    if (b && b.hp > 0 && b.aggro) { // keep the boss in frame without losing the player
      const pc = p.x + PW / 2, mid = (pc + b.x + b.w / 2) / 2 - v.w / 2;
      x = Math.max(pc - v.w + 120, Math.min(pc - 120, mid));
    }
    x = lw <= v.w ? (lw - v.w) / 2 : Math.max(0, Math.min(lw - v.w, x));
    return { x, y: Math.min(lh - v.h + T + (S.padB || 0), y) };
  }

  /* ---------- damage ---------- */
  NK.hitEnemy = function (e, dmg, dirX, kb, o) {
    if (e.hp <= 0) return;
    o = o || {};
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg; e.flash = 0.12; e.aggro = true;
    NK.num(e.x + e.w / 2, e.y - 4, String(dmg), o.crit ? '#ffd75e' : '#ffffff', o.crit);
    puff(e.x + e.w / 2, e.y + e.h / 2, o.crit ? 9 : 5, o.crit ? '#ffd75e' : '#ffffff', 170, 0.3, 300);
    if (!e.armor) {
      e.vx = dirX * kb; if (!e.fly) e.vy = Math.min(e.vy, -110);
      e.stun = Math.max(e.stun, o.stun || 0.22);
      if (e.state === 'wind' || e.state === 'attack') { e.state = 'idle'; e.cd = 0.5; }
    } else if (o.stun && e.type !== 'boss') e.stun = Math.max(e.stun, o.stun * 0.6);
    sfx(o.crit ? 'crit' : 'hit');
    if (e.hp <= 0) NK.killEnemy(e);
  };

  NK.dropLoot = function (x, y, gold, cores, heal) {
    const r = S.run;
    for (let n = Math.round(gold * r.goldMul); n > 0; n -= 2) S.picks.push({ kind: 'gold', x, y, vx: rand(-140, 140), vy: rand(-320, -140), t: 0, val: Math.min(2, n) });
    for (let i = 0; i < cores; i++) S.picks.push({ kind: 'core', x, y, vx: rand(-120, 120), vy: rand(-340, -180), t: 0, val: 1 });
    if (heal) S.picks.push({ kind: 'heal', x, y, vx: 0, vy: -260, t: 0, val: heal });
  };
  NK.dropWeapon = function (x, y, w) { S.items.push({ kind: 'weapon', x, y, w }); };
  NK.rollWeapon = function (slot) {
    const r = S.run, pool = r.pool.filter((id) => !slot || NK.WEAPONS[id].slot === slot);
    const id = pool[Math.floor(Math.random() * pool.length)];
    return { id, tier: Math.min(4, Math.floor(r.depth / 2) + (Math.random() < 0.3 ? 1 : 0)) };
  };

  NK.hurtPlayer = function (dmg, dirX) {
    const r = S.run, p = S.p, a = S.a;
    if (S.state !== 'play' || a.iframes > 0 || p.roll > 0) return false;
    dmg = Math.round(dmg);
    r.hp -= dmg; a.iframes = 0.85; a.atk = null; p.slow = 1; p.faceLock = false;
    p.vx = (dirX || -p.facing) * 250; p.vy = -300; p.dive = false; p.lock = 0.15;
    S.shake = 9; S.hitstop = 0.07;
    NK.num(pcx(), p.y - 6, '-' + dmg, '#ff5d73', true);
    puff(pcx(), pcy(), 10, '#ff5d73', 220, 0.4, 300);
    sfx('hurt');
    if (r.hp <= 0) {
      if (r.revive > 0) {
        r.revive--; r.hp = Math.round(r.maxhp * 0.4); a.iframes = 2.2;
        puff(pcx(), pcy(), 30, '#7cf0c8', 300, 0.8); NK.say('Backup restored'); sfx('chip');
      } else {
        r.hp = 0; S.state = 'dead'; S.dieT = 1.1; S.shake = 14;
        puff(pcx(), pcy(), 34, '#d97757', 340, 0.9, 500); sfx('die');
      }
    }
    return true;
  };

  function explode(x, y, dmg) {
    puff(x, y, 26, '#ff9d6b', 320, 0.5); puff(x, y, 12, '#ffffff', 200, 0.35);
    S.shake = Math.max(S.shake, 8); sfx('boom');
    for (const e of S.en) {
      const dx = e.x + e.w / 2 - x, dy = e.y + e.h / 2 - y;
      if (dx * dx + dy * dy < 78 * 78) NK.hitEnemy(e, dmg, Math.sign(dx) || 1, 300, { stun: 0.4 });
    }
  }

  /* ---------- player actions ---------- */
  function interact() {
    const it = S.near, r = S.run;
    if (!it) return;
    if (it.kind === 'chest') {
      it.open = true; sfx('chest');
      NK.dropLoot(it.x, it.y - 20, 14 + r.depth * 4, 1, Math.random() < 0.5 ? 25 : 0);
      if (Math.random() < 0.6) NK.dropWeapon(it.x + 30, it.y, NK.rollWeapon());
    } else if (it.kind === 'weapon') {
      const slot = NK.WEAPONS[it.w.id].slot, old = slot === 'main' ? r.main : r.alt;
      if (slot === 'main') r.main = it.w; else { r.alt = it.w; r.ammo = NK.WEAPONS[it.w.id].ammo; r.ammoT = 0; }
      if (old) it.w = old; else S.items.splice(S.items.indexOf(it), 1);
      S.a.combo = 0; sfx('equip'); NK.say('Equipped ' + NK.weaponName(slot === 'main' ? r.main : r.alt));
    } else if (it.kind === 'chip') {
      S.items.splice(S.items.indexOf(it), 1); sfx('chip'); ev('chip');
    } else if (it.kind === 'door') {
      if (S.boss && S.boss.hp > 0) { NK.say('Locked. Defeat ' + NK.ENEMIES.boss.name + '.'); sfx('deny'); }
      else { sfx('door'); ev('floor'); }
    }
  }

  function playerActions(dt, inp) {
    const p = S.p, a = S.a, r = S.run, dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    a.rollCd -= dt; a.comboT -= dt; a.atkBuf -= dt; a.iframes -= dt; a.healT -= dt;
    if (p.onGround || p.wallDir) a.airRoll = false;
    if (inp.roll && a.rollCd <= 0 && p.roll <= 0 && (p.onGround || !a.airRoll)) {
      p.roll = C.ROLLT; p.rollDir = dir || p.facing; p.facing = p.rollDir; p.dive = false;
      if (!p.onGround) { a.airRoll = true; p.vy = Math.min(p.vy, -60); }
      a.rollCd = C.ROLLT + r.rollCd; a.atk = null; p.faceLock = false; sfx('roll');
    }
    if (inp.downPressed && !p.onGround && !p.dive && p.roll <= 0 && !p.wallDir) { p.dive = true; a.atk = null; p.faceLock = false; }
    if (inp.atk) a.atkBuf = 0.18;
    const W = NK.WEAPONS[r.main.id];
    if (a.atkBuf > 0 && !a.atk && p.roll <= 0 && !p.dive) {
      const n = a.comboT > 0 ? a.combo : 0;
      a.atk = { n, t: 0, dur: W.time / r.atkSpd, hit: new Set() };
      a.atkBuf = 0;
      if (dir) p.facing = dir;
      if (p.onGround) p.vx += p.facing * 70;
      sfx(W.id === 'sledge' ? 'heavy' : 'swing');
    }
    if (a.atk) {
      const k = a.atk; k.t += dt;
      const u = k.t / k.dur;
      if (u >= 0.2 && u <= 0.75) meleeHits(W, k);
      if (u >= 1) { a.atk = null; a.combo = (k.n + 1) % W.combo.length; a.comboT = 0.42; }
    }
    p.faceLock = !!a.atk;
    p.slow = a.healT > 0 ? 0.3 : a.atk && p.onGround ? 0.42 : 1;
    // secondary
    if (r.alt) {
      const A = NK.WEAPONS[r.alt.id];
      if (r.ammo < A.ammo) { r.ammoT += dt; if (r.ammoT >= A.reload) { r.ammo++; r.ammoT = 0; } }
      if (inp.alt && r.ammo > 0 && p.roll <= 0) {
        r.ammo--;
        const dmg = NK.weaponDmg(r.alt) * r.dmgMul;
        if (A.kind === 'gun') { S.shots.push({ kind: 'bullet', from: 'p', x: pcx() + p.facing * 14, y: pcy() - 2, vx: p.facing * 660, vy: 0, grav: 0, dmg, life: 0.7 }); sfx('shoot'); }
        else { S.shots.push({ kind: 'bomb', from: 'p', x: pcx(), y: pcy() - 8, vx: p.facing * 300 + p.vx * 0.4, vy: -430, grav: 1500, dmg, life: 1.4 }); sfx('roll'); }
      }
    }
    if (inp.heal && r.flask > 0 && r.hp < r.maxhp && a.healT <= 0) {
      r.flask--; const h = Math.round(r.maxhp * 0.6); r.hp = Math.min(r.maxhp, r.hp + h); a.healT = 0.45;
      NK.num(pcx(), p.y - 6, '+' + h, '#7cf0a0', true); puff(pcx(), pcy(), 14, '#7cf0a0', 120, 0.6, -200); sfx('heal');
    }
    if (inp.use) interact();
  }

  function meleeHits(W, k) {
    const p = S.p, r = S.run, f = p.facing, cx = pcx(), cy = pcy(), R = W.range * r.reach;
    const x0 = f > 0 ? cx - 8 : cx - R, x1 = f > 0 ? cx + R : cx + 8, y0 = cy - W.h / 2 - 4, y1 = cy + W.h / 2;
    for (const e of S.en) {
      if (e.hp <= 0 || k.hit.has(e) || e.x > x1 || e.x + e.w < x0 || e.y > y1 || e.y + e.h < y0) continue;
      k.hit.add(e);
      let dmg = NK.weaponDmg(r.main) * W.combo[k.n] * r.dmgMul, crit = Math.random() < r.crit;
      if (W.back && e.dir === f && !e.fly) crit = true;
      if (crit) dmg *= 2;
      const fin = k.n === W.combo.length - 1;
      NK.hitEnemy(e, dmg, f, W.kb * (fin ? 1.5 : 1), { crit, stun: W.stun });
      S.hitstop = Math.max(S.hitstop, W.id === 'sledge' || fin ? 0.075 : 0.04);
      S.shake = Math.max(S.shake, fin ? 5 : 2.5);
    }
    for (const s of S.shots) {
      if (s.from === 'e' && s.kind === 'bolt' && s.x > x0 && s.x < x1 && s.y > y0 && s.y < y1) { s.life = 0; puff(s.x, s.y, 6, '#ffd75e', 150, 0.25); sfx('parry'); }
    }
  }

  function bodyEvents() {
    const p = S.p, r = S.run, cx = pcx(), fy = p.y + PH;
    for (const e of p.ev) {
      const type = e[0];
      if (type === 'jump' || type === 'jump2') { sfx('jump'); S.sqx = 0.75; S.sqy = 1.3; puff(cx, fy, 5, 'rgba(255,255,255,0.7)', 70, 0.3); }
      else if (type === 'kick') { sfx('kick'); S.sqx = 1.2; S.sqy = 0.82; puff(e[1] < 0 ? p.x : p.x + PW, pcy(), 7, 'rgba(255,255,255,0.8)', 110, 0.35); }
      else if (type === 'land') { S.sqx = 1.3; S.sqy = 0.72; puff(cx, fy, 5, 'rgba(255,255,255,0.6)', 80, 0.3); }
      else if (type === 'spring') { S.springT[e[1] + ',' + e[2]] = 0.3; sfx('spring'); S.sqx = 0.7; S.sqy = 1.4; }
      else if (type === 'slam') {
        S.sqx = 1.5; S.sqy = 0.55; S.shake = Math.max(S.shake, 7); sfx('boom');
        puff(cx, fy, 16, 'rgba(255,255,255,0.8)', 220, 0.35);
        const dmg = NK.weaponDmg(r.main) * 0.8 * r.slamMul * r.dmgMul;
        for (const en of S.en) {
          const dx = en.x + en.w / 2 - cx, dy = en.y + en.h - fy;
          if (Math.abs(dx) < 70 + en.w / 2 && Math.abs(dy) < 46) NK.hitEnemy(en, dmg, Math.sign(dx) || 1, 260, { stun: 0.45 });
        }
      }
    }
    p.ev.length = 0;
    if (p.spiked && NK.hurtPlayer(15, -p.facing)) p.vy = -430;
  }

  /* ---------- shots, pickups, items ---------- */
  function stepShots(dt) {
    const L = S.L, p = S.p;
    for (const s of S.shots) {
      s.life -= dt; s.vy += (s.grav || 0) * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.life <= 0) { if (s.kind === 'bomb') explode(s.x, s.y, s.dmg); continue; }
      if (s.kind === 'wave') {
        if (NK.solidAtPx(L, s.x, s.y - 8) || !NK.floorAt(L, s.x, s.y)) { s.life = 0; continue; }
        if (Math.abs(pcx() - s.x) < 16 && p.y + PH > s.y - 20 && p.y < s.y) { NK.hurtPlayer(s.dmg, Math.sign(s.vx)); }
        continue;
      }
      if (NK.solidAtPx(L, s.x, s.y)) {
        if (s.kind === 'bomb') explode(s.x, s.y, s.dmg); else puff(s.x, s.y, 4, '#ffffff', 90, 0.2);
        s.life = 0; continue;
      }
      if (s.from === 'p') {
        for (const e of S.en) {
          if (e.hp > 0 && s.x > e.x - 4 && s.x < e.x + e.w + 4 && s.y > e.y - 4 && s.y < e.y + e.h + 4) {
            if (s.kind === 'bomb') explode(s.x, s.y, s.dmg); else NK.hitEnemy(e, s.dmg, Math.sign(s.vx), 90, { crit: Math.random() < S.run.crit });
            s.life = 0; break;
          }
        }
      } else if (s.x > p.x - 3 && s.x < p.x + PW + 3 && s.y > p.y - 3 && s.y < p.y + PH + 3) {
        if (NK.hurtPlayer(s.dmg, Math.sign(s.vx))) s.life = 0;
      }
    }
    S.shots = S.shots.filter((s) => s.life > 0);
  }

  function stepPicks(dt) {
    const r = S.run, cx = pcx(), cy = pcy();
    for (const q of S.picks) {
      q.t += dt;
      const dx = cx - q.x, dy = cy - q.y, d = Math.hypot(dx, dy);
      if (q.still && d > 60) continue;
      q.still = false;
      if (q.t > 0.45 || d < 60) { const sp = 520; q.vx += ((dx / (d || 1)) * sp - q.vx) * Math.min(1, dt * 9); q.vy += ((dy / (d || 1)) * sp - q.vy) * Math.min(1, dt * 9); }
      else { q.vy += 900 * dt; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (d < 18) {
        q.got = true;
        if (q.kind === 'gold') { r.gold += q.val; sfx('coin'); }
        else if (q.kind === 'core') { r.cores += q.val; sfx('core'); }
        else { const h = Math.min(r.maxhp - r.hp, q.val); r.hp += h; if (h > 0) NK.num(cx, S.p.y - 6, '+' + h, '#7cf0a0'); sfx('heal'); }
      }
    }
    S.picks = S.picks.filter((q) => !q.got);
  }

  function findNear() {
    const cx = pcx(), fy = S.p.y + PH, D = S.L.door;
    let best = null, bd = 46;
    for (const it of S.items) {
      if (it.kind === 'chest' && it.open) continue;
      const d = Math.abs(it.x - cx) + Math.abs(it.y - fy) * 0.6;
      if (d < bd) { bd = d; best = it; }
    }
    if (!best && D && Math.abs(D.x - cx) < 30 && Math.abs(D.y - fy) < 40) best = { kind: 'door', x: D.x, y: D.y };
    S.near = best;
  }

  function stepFx(dt) {
    for (const q of S.parts) { q.life -= dt; q.vy += q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    if (S.parts.length) S.parts = S.parts.filter((q) => q.life > 0);
    for (const n of S.nums) n.t += dt;
    if (S.nums.length) S.nums = S.nums.filter((n) => n.t < 0.7);
    for (const t of S.trail) t.life -= dt;
    if (S.trail.length) S.trail = S.trail.filter((t) => t.life > 0);
    for (const k in S.springT) { S.springT[k] -= dt; if (S.springT[k] <= 0) delete S.springT[k]; }
    S.shake = Math.max(0, S.shake - dt * 40);
    if (S.msg) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
    const k = Math.min(1, dt * 11);
    S.sqx += (1 - S.sqx) * k; S.sqy += (1 - S.sqy) * k;
  }

  NK.step = function (dt, inp) {
    S.clock += dt;
    if (!S.L) return;
    if (S.state === 'play') {
      if (inp.atk) S.a.atkBuf = 0.18;
      if (S.hitstop > 0) { S.hitstop -= dt; return; }
      const p = S.p, r = S.run;
      r.time += dt;
      playerActions(dt, inp);
      p.spd = r.spd; p.airJumps = r.airJumps;
      NK.stepPlayer(p, inp, dt, S.L);
      bodyEvents();
      NK.stepEnemies(dt);
      stepShots(dt); stepPicks(dt); findNear();
      if (p.roll > 0) { S.rot += p.rollDir * (TAU / C.ROLLT) * dt; S.trail.push({ x: pcx(), y: p.y + PH, life: 0.18, rot: S.rot }); }
      else S.rot = 0;
      const c = camTarget(), k = Math.min(1, dt * 7);
      S.cam.x += (c.x - S.cam.x) * k; S.cam.y += (c.y - S.cam.y) * Math.min(1, dt * 6);
    } else if (S.state === 'dead') {
      NK.stepEnemies(dt); stepShots(dt);
      S.dieT -= dt;
      if (S.dieT <= 0 && S.dieT > -9) { S.dieT = -10; ev('dead'); }
    }
    stepFx(dt);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
