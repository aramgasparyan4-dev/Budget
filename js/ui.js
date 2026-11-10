/* Neural Kick — hub, HUD, shop and choice screens, input, sound, main loop. */
(function () {
  'use strict';
  const NK = window.NK, S = NK.S, C = NK.C;
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: play on without saving */ } },
  };
  const cv = $('cv'), ctx = cv.getContext('2d');
  const meta = Object.assign({ cores: 0, up: {}, best: 0, runs: 0, kills: 0 }, store.get('nk-meta', {}));
  const save = () => store.set('nk-meta', meta);
  let W = 0, H = 0, dpr = 1, paused = true, muted = store.get('nk-mute', true) !== false, screen = 'menu';
  let coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  /* ---------- sound (off until switched on) ---------- */
  let ac = null;
  function wake() {
    if (muted) return;
    if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (A) { try { ac = new A(); } catch (e) { ac = null; } } }
    if (ac && ac.state === 'suspended') ac.resume();
  }
  function tone(f0, f1, dur, type, vol, delay) {
    if (muted || !ac) return;
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), gn = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + dur + 0.03);
  }
  const SND = {
    jump: [380, 620, 0.09, 'square', 0.04], kick: [520, 940, 0.09, 'square', 0.04], roll: [300, 160, 0.12, 'triangle', 0.07],
    swing: [700, 300, 0.07, 'triangle', 0.06], heavy: [300, 90, 0.16, 'sawtooth', 0.05], hit: [220, 110, 0.07, 'square', 0.06],
    crit: [880, 220, 0.12, 'square', 0.06], kill: [330, 60, 0.18, 'square', 0.06], hurt: [180, 60, 0.22, 'sawtooth', 0.08],
    die: [420, 40, 0.7, 'sawtooth', 0.07], boom: [120, 40, 0.25, 'sawtooth', 0.09], shoot: [900, 400, 0.07, 'square', 0.04],
    parry: [1200, 1600, 0.06, 'square', 0.04], lunge: [200, 420, 0.1, 'sawtooth', 0.04], spring: [240, 1100, 0.2, 'sawtooth', 0.04],
    coin: [1319, 1319, 0.05, 'square', 0.025], core: [1568, 2093, 0.07, 'triangle', 0.04], heal: [523, 1047, 0.2, 'triangle', 0.07],
    chest: [392, 784, 0.18, 'square', 0.05], equip: [660, 990, 0.1, 'square', 0.05], door: [262, 523, 0.3, 'triangle', 0.07],
    deny: [150, 110, 0.18, 'square', 0.06], buy: [784, 1175, 0.12, 'square', 0.05],
  };
  NK.sfx = (n) => {
    if (n === 'chip' || n === 'win') [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.14, 'square', 0.045, i * 0.09));
    else if (SND[n]) tone.apply(null, SND[n]);
  };

  /* ---------- screens ---------- */
  function show(id) {
    screen = id;
    for (const s of ['menu', 'pause', 'chip', 'safe', 'dead']) $(s).hidden = s !== id;
    const on = id == null;
    paused = !on;
    $('hud').hidden = id === 'menu'; $('touch').hidden = !(on && coarse);
    if (id === 'menu') $('boss').hidden = true;
    if (id) { const f = $(id).querySelector('button.primary:not([hidden])'); if (f && !coarse) f.focus({ preventScroll: true }); }
    else { clearInput(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
  }
  function card(box, title, desc, tag, tagCls, fn, disabled, big) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'card' + (big ? ' big' : ''); b.disabled = !!disabled;
    const t = document.createElement('b'), d = document.createElement('span'), e = document.createElement(big ? 'kbd' : 'em');
    t.textContent = title; d.textContent = desc; e.textContent = tag; if (tagCls) e.className = tagCls;
    b.append(t, d, e);
    b.addEventListener('click', fn);
    box.append(b);
    return b;
  }

  function hub() {
    S.L = null; S.run = null; S.state = 'hub';
    $('m-best').textContent = meta.best; $('m-runs').textContent = meta.runs; $('m-kills').textContent = meta.kills;
    $('m-cores').textContent = meta.cores + (meta.cores === 1 ? ' core' : ' cores') + ' banked';
    const box = $('ups'); box.textContent = '';
    for (const u of NK.UPGRADES) {
      const lv = meta.up[u.id] || 0, max = u.cost.length, cost = u.cost[lv];
      const tag = lv >= max ? (max > 1 ? 'Max level' : 'Unlocked') : cost + ' cores' + (max > 1 ? '  ·  level ' + lv + '/' + max : '');
      card(box, u.name, u.desc, tag, '', () => {
        if (meta.cores < cost) return;
        meta.cores -= cost; meta.up[u.id] = lv + 1; save(); NK.sfx('buy'); hub();
      }, lv >= max || meta.cores < cost);
    }
    show('menu');
  }
  function startRun() {
    wake(); meta.runs++; save(); NK.newRun(meta); hudReset(); show(null);
    if (meta.runs <= 2 && !coarse) { NK.say('J attack  ·  K roll  ·  Q heal  ·  E interact'); S.msg.t = 5; }
  }

  function chipScreen() {
    const r = S.run, box = $('chip-cards'); box.textContent = '';
    const pool = NK.PERKS.filter((p) => !(p.once && r.perks.includes(p.id)));
    const picks = [];
    while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    picks.forEach((p, i) => card(box, p.name, p.desc, String(i + 1), '', () => { takePerk(p); show(null); }, false, true));
    show('chip');
    const first = box.querySelector('button'); if (first && !coarse) first.focus({ preventScroll: true });
  }
  function takePerk(p) { const r = S.run; p.apply(r); r.perks.push(p.id); NK.sfx('chip'); NK.say(p.name + ': ' + p.desc); }

  function safeRoom() {
    const r = S.run, banked = r.cores;
    meta.cores += r.cores; r.cores = 0; r.flask = r.flaskMax;
    meta.best = Math.max(meta.best, r.depth + 2); save();
    const next = NK.FLOORS[(r.depth + 1) % 3];
    $('s-title').textContent = 'Floor ' + (r.depth + 1) + ' cleared';
    $('s-info').textContent = (banked ? banked + (banked === 1 ? ' core' : ' cores') + ' banked for good. ' : '') + 'Heals refilled.' +
      (next.boss ? ' A boss guards the next floor.' : '') + (S.L.floor.boss ? ' You beat the stack. It loops from here and everything hits harder.' : '');
    $('s-next').textContent = 'Continue to ' + next.name;
    const w = NK.rollWeapon(); w.tier = Math.min(4, w.tier + 1);
    const avail = NK.PERKS.filter((p) => !(p.once && r.perks.includes(p.id))), perk = avail[Math.floor(Math.random() * avail.length)];
    const offers = [
      { name: NK.weaponName(w), desc: NK.WEAPONS[w.id].desc + ' ' + NK.weaponDmg(w) + ' damage.', price: 45 + 25 * w.tier, buy() { const slot = NK.WEAPONS[w.id].slot; if (slot === 'main') r.main = w; else { r.alt = w; r.ammo = NK.WEAPONS[w.id].ammo; } } },
      { name: 'Full repair', desc: 'Restore all HP (' + r.hp + ' / ' + r.maxhp + ').', price: 30, off: r.hp >= r.maxhp, buy() { r.hp = r.maxhp; } },
      { name: perk.name, desc: perk.desc, price: 70 + 15 * r.perks.length, buy() { perk.apply(r); r.perks.push(perk.id); } },
    ];
    const draw = () => {
      const box = $('s-shop'); box.textContent = '';
      $('s-gold').textContent = r.gold + ' gold';
      for (const o of offers) card(box, o.name, o.desc, o.sold ? 'Sold' : o.price + ' gold', 'g', () => { r.gold -= o.price; o.sold = true; o.buy(); NK.sfx('buy'); draw(); }, o.sold || o.off || r.gold < o.price);
    };
    draw();
    show('safe');
  }
  function nextFloor() { S.run.depth++; NK.loadFloor(); hudReset(); show(null); }

  function deathScreen() {
    const r = S.run, keep = Math.floor(r.cores * 0.25 * (meta.up.keep || 0));
    meta.cores += keep; meta.kills += r.kills; meta.best = Math.max(meta.best, r.depth + 1); save();
    const row = (k, v) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>';
    $('d-title').textContent = 'Died on floor ' + (r.depth + 1);
    $('d-stats').innerHTML = row('Kills', r.kills) + row('Time', Math.floor(r.time / 60) + ':' + String(Math.floor(r.time % 60)).padStart(2, '0')) + row('Perks', r.perks.length);
    $('d-note').textContent = r.cores ? 'Lost ' + (r.cores - keep) + ' carried cores' + (keep ? ', kept ' + keep : '') + '. Cores are only safe once you clear a floor.' : 'You have ' + meta.cores + ' cores banked to spend on upgrades.';
    show('dead');
  }
  NK.onEvent = (n) => { if (n === 'chip') chipScreen(); else if (n === 'floor') safeRoom(); else if (n === 'dead') deathScreen(); };

  function setMute(m) {
    muted = m; store.set('nk-mute', m);
    $('b-mute').setAttribute('aria-pressed', m ? 'true' : 'false'); $('b-mute').textContent = m ? 'Sound off' : 'Sound on';
    if (!m) wake();
  }
  function pause(on) {
    if (on && screen == null && S.state === 'play') {
      $('p-title').textContent = 'Floor ' + (S.run.depth + 1) + ' · ' + S.L.name;
      const names = S.run.perks.map((id) => NK.PERKS.find((p) => p.id === id).name);
      $('p-perks').textContent = names.length ? 'Perks: ' + names.join(', ') : 'No perks yet. Find an upgrade chip.';
      show('pause');
    } else if (!on && screen === 'pause') show(null);
  }

  /* ---------- HUD ---------- */
  let hud = {};
  function hudReset() { hud = {}; }
  function set(id, key, val) { if (hud[key] !== val) { hud[key] = val; $(id).textContent = val; } }
  function icon(id, wid) { const c = $(id).getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 48, 48); c.setTransform(2, 0, 0, 2, 24, 24); NK.drawWeaponIcon(c, wid, 22); }
  function hudDraw() {
    const r = S.run; if (!r) return;
    const hp = Math.max(0, Math.round(r.hp));
    if (hud.hp !== hp || hud.max !== r.maxhp) { hud.hp = hp; hud.max = r.maxhp; $('hp-fill').style.width = (100 * hp) / r.maxhp + '%'; $('hp-text').textContent = hp + ' / ' + r.maxhp; }
    set('h-flask', 'fl', r.flask + ' heal' + (r.flask === 1 ? '' : 's')); set('h-gold', 'g', r.gold); set('h-cores', 'c', r.cores);
    set('h-floor', 'f', 'Floor ' + (r.depth + 1) + ' · ' + S.L.name);
    const mk = r.main.id + r.main.tier; if (hud.mk !== mk) { hud.mk = mk; icon('w-main', r.main.id); $('w-main-name').textContent = NK.weaponName(r.main); }
    const ak = r.alt ? r.alt.id + r.alt.tier + ':' + r.ammo : '';
    if (hud.ak !== ak) { hud.ak = ak; $('alt-slot').hidden = !r.alt; if (r.alt) { icon('w-alt', r.alt.id); $('w-alt-name').textContent = NK.weaponName(r.alt) + '  ' + r.ammo + '/' + NK.WEAPONS[r.alt.id].ammo; } }
    const b = S.boss, on = !!(b && b.hp > 0 && b.aggro);
    if (hud.boss !== on) { hud.boss = on; $('boss').hidden = !on; if (on) $('boss-name').textContent = NK.ENEMIES.boss.name; }
    if (on) { const w = Math.round((100 * b.hp) / b.maxhp); if (hud.bw !== w) { hud.bw = w; $('boss-fill').style.width = w + '%'; } }
  }

  /* ---------- input ---------- */
  const held = { left: false, right: false, down: false, jump: false };
  const edge = { jump: false, atk: false, roll: false, alt: false, heal: false, use: false, down: false };
  function clearInput() { for (const k in held) held[k] = false; for (const k in edge) edge[k] = false; }
  function press(k, on) {
    if (k in held) { if (on && !held[k] && k in edge) edge[k] = true; held[k] = on; }
    else if (on) edge[k] = true;
  }
  const MAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyJ: 'atk', KeyZ: 'atk', KeyK: 'roll', KeyX: 'roll', ShiftLeft: 'roll', ShiftRight: 'roll',
    KeyL: 'alt', KeyC: 'alt', KeyQ: 'heal', KeyF: 'heal', KeyE: 'use',
  };
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    wake();
    if (screen == null) {
      if (MAP[e.code]) { if (!e.repeat) press(MAP[e.code], true); e.preventDefault(); return; }
      if (!e.repeat && (e.code === 'Escape' || e.code === 'KeyP')) pause(true);
    } else if (!e.repeat) {
      if (screen === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) pause(false);
      else if (screen === 'chip' && /^(Digit|Numpad)[123]$/.test(e.code)) { const b = $('chip-cards').children[Number(e.code.slice(-1)) - 1]; if (b) b.click(); }
    }
    if (!e.repeat && e.code === 'KeyM') setMute(!muted);
  });
  window.addEventListener('keyup', (e) => { const k = MAP[e.code]; if (k && k in held) held[k] = false; });
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
  cv.addEventListener('mousedown', (e) => { if (screen == null) { press(e.button === 2 ? 'alt' : 'atk', true); e.preventDefault(); } });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());

  for (const k of ['left', 'right', 'jump', 'atk', 'roll', 'use', 'heal', 'alt']) {
    const b = $('t-' + k);
    const down = (e) => { e.preventDefault(); wake(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } press(k, true); b.classList.add('on'); };
    const up = (e) => { e.preventDefault(); if (k in held) held[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  window.addEventListener('touchstart', () => { if (!coarse) { coarse = true; if (screen == null) $('touch').hidden = false; } }, { passive: true });

  $('b-start').addEventListener('click', startRun);
  $('b-pause').addEventListener('click', () => pause(true));
  $('b-mute').addEventListener('click', () => setMute(!muted));
  $('p-resume').addEventListener('click', () => pause(false));
  $('p-quit').addEventListener('click', () => { meta.kills += S.run.kills; meta.best = Math.max(meta.best, S.run.depth + 1); save(); hub(); });
  $('s-next').addEventListener('click', nextFloor);
  $('d-again').addEventListener('click', startRun);
  $('d-hub').addEventListener('click', hub);

  /* ---------- loop ---------- */
  function fit() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  let last = 0, acc = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    if (!paused) {
      acc += dt;
      while (acc >= C.DT) {
        NK.step(C.DT, {
          left: held.left, right: held.right, down: held.down, jump: held.jump, jumpPressed: edge.jump,
          atk: edge.atk, roll: edge.roll, alt: edge.alt, heal: edge.heal, use: edge.use, downPressed: edge.down,
        });
        for (const k in edge) edge[k] = false;
        acc -= C.DT;
        if (paused) break;
      }
    } else { S.clock += dt; if (screen === 'menu') { S.cam.x += dt * 14; NK.heroPortrait($('hero-cv'), S.clock); } }
    S.padB = coarse ? 128 / (S.view.z || 1) : 0;
    NK.render(ctx, W, H, dpr);
    if (screen !== 'menu') hudDraw();
  }

  setMute(muted);
  fit();
  window.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(cv);
  hub();
  requestAnimationFrame(frame);
})();
