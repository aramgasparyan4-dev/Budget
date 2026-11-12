/* Sundown Protocol — the page: screens, shops, HUD, input, sound, saving, main loop. */
(function () {
  'use strict';
  const SD = window.SD, K = SD.K;
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: the game still plays */ } },
  };
  const cv = $('cv'), ctx = cv.getContext('2d');
  let W = 1, H = 1, dpr = 1, screen = 'title', muted = store.get('sd-mute', true) !== false, playing = false;
  let coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const mouse = { x: 0, y: 0, wx: 0, wy: 0, active: false, inside: false, last: -99 };

  /* ---------- sound: synthesized, off until switched on ---------- */
  let ac = null, noise = null;
  function wake() {
    if (muted) return;
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const n = ac.sampleRate * 0.6; noise = ac.createBuffer(1, n, ac.sampleRate);
        const d = noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
  }
  function tone(f0, f1, dur, type, vol, delay) {
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), gn = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + dur + 0.03);
  }
  function burst(dur, freq, vol, delay) {
    const t = ac.currentTime + (delay || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain();
    s.buffer = noise; f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.15), t + dur);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(gn); gn.connect(ac.destination); s.start(t); s.stop(t + dur + 0.03);
  }
  const SFX = {
    shot_revolver() { burst(0.28, 3200, 0.5); tone(170, 60, 0.12, 'triangle', 0.2); },
    shot_rifle() { burst(0.42, 4200, 0.55); tone(120, 40, 0.2, 'triangle', 0.25); },
    shot_shotgun() { burst(0.5, 2000, 0.7); tone(90, 35, 0.25, 'sine', 0.3); },
    eshot() { burst(0.22, 2200, 0.22); }, eshot2() { burst(0.32, 2600, 0.28); },
    dry() { tone(1800, 1800, 0.03, 'square', 0.05); },
    reload() { [0, 0.14, 0.32].forEach((d) => tone(950, 950, 0.03, 'square', 0.05, d)); },
    hit() { burst(0.06, 900, 0.18); }, hurt() { tone(220, 80, 0.2, 'sawtooth', 0.1); }, ric() { tone(2600, 900, 0.12, 'sine', 0.05); },
    jump() { tone(330, 520, 0.07, 'square', 0.025); }, roll() { burst(0.16, 700, 0.14); },
    whistle() { tone(1400, 2100, 0.16, 'sine', 0.08); tone(1500, 2400, 0.26, 'sine', 0.08, 0.22); },
    neigh() { tone(700, 1100, 0.15, 'sawtooth', 0.035); tone(1100, 480, 0.35, 'sawtooth', 0.035, 0.12); },
    hoof() { tone(150, 90, 0.05, 'triangle', 0.08); burst(0.03, 500, 0.05); },
    coin() { tone(1319, 1319, 0.05, 'square', 0.035); tone(1760, 1760, 0.1, 'square', 0.035, 0.05); },
    glass() { tone(2600, 3400, 0.06, 'triangle', 0.08); burst(0.14, 6000, 0.12); },
    boom() { burst(0.9, 900, 0.8); tone(80, 30, 0.5, 'sine', 0.4); }, fuse() { burst(0.3, 5000, 0.04); },
    job() { [523, 659, 784].forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.09, i * 0.1)); },
    draw() { tone(880, 880, 0.7, 'triangle', 0.16); },
    ocOn() { tone(200, 70, 0.35, 'sine', 0.28); }, ocOff() { tone(70, 220, 0.2, 'sine', 0.22); }, mark() { tone(1250, 1250, 0.04, 'square', 0.05); },
    swing() { burst(0.08, 1800, 0.12); }, bite() { burst(0.08, 700, 0.2); }, rope() { burst(0.2, 1200, 0.08); }, skin() { burst(0.15, 900, 0.1); },
    drink() { tone(400, 700, 0.25, 'sine', 0.08); }, equip() { tone(600, 900, 0.06, 'square', 0.04); },
  };
  SD.sfx = (n) => { if (!muted && ac && SFX[n]) SFX[n](); };
  function setMute(m) { muted = m; store.set('sd-mute', m); $('b-mute').setAttribute('aria-pressed', String(m)); $('b-mute').textContent = m ? 'Sound off' : 'Sound on'; if (!m) wake(); }

  /* ---------- saving ---------- */
  const saveGame = () => { if (playing && SD.save) store.set('sd-save', SD.save); };

  /* ---------- screens ---------- */
  function show(id) {
    screen = id;
    for (const s of ['title', 'place', 'pause', 'dead', 'ending']) $(s).hidden = s !== id;
    const on = id == null;
    for (const h of ['hud-tl', 'hud-tr', 'hud-bl', 'hud-br']) $(h).hidden = !playing || id === 'title';
    $('touch').hidden = !(on && coarse);
    cv.classList.toggle('menu', !on);
    clearInput();
    if (id) { const f = $(id).querySelector('.btn.primary:not([hidden])'); if (f && !coarse) f.focus({ preventScroll: true }); }
    else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  let toastT = 0;
  function toast(big, small) { $('toast-big').textContent = big; $('toast-small').textContent = small || ''; $('toast').hidden = false; toastT = 3.2; }

  function startGame(save) {
    wake(); playing = true;
    SD.newGame(save); SD.cam.init = false;
    if (save.active) SD.resumeMission();
    show(null);
    if (!save.mission && !save.active) SD.say('Copperhead Flats. The sheriff\'s office is just east of here.', 4);
  }

  /* ---------- places in town ---------- */
  const priceMul = () => (SD.save.rep >= 40 ? 0.85 : SD.save.rep <= -40 ? 1.25 : 1);
  const price = (n) => Math.ceil(n * priceMul());
  let place = null;
  function opt(title, desc, tag, fn, disabled, cls) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'opt' + (cls ? ' ' + cls : ''); b.disabled = !!disabled;
    const t = document.createElement('b'), d = document.createElement('span'), e = document.createElement('em');
    t.textContent = title; d.textContent = desc; e.textContent = tag;
    b.append(t, d, e); b.addEventListener('click', () => { wake(); fn(); });
    $('pl-opts').append(b);
  }
  function buy(cost, fn) { const sv = SD.save; if (sv.money < cost) return; sv.money -= cost; fn(); SD.sfx('coin'); fillPlace(); }
  function openPlace(b) { place = { b, line: null, offers: null }; if (b.kind === 'sheriff' && SD.G.p.carry) place.line = SD.deliver(); show('place'); fillPlace(); }
  function fillPlace() {
    const b = place.b, sv = SD.save, G = SD.G, m = SD.MISSIONS[sv.mission];
    $('pl-opts').textContent = '';
    $('pl-kicker').textContent = 'Copperhead Flats · $' + sv.money;
    $('pl-title').textContent = b.name.charAt(0) + b.name.slice(1).toLowerCase();
    let who = '', line = place.line || '';
    const job = (mm) => { line = line || mm.brief; opt(mm.title, 'Story job from ' + mm.who.split(',')[0], 'Take the job', () => { close(); SD.acceptMission(); }, false, 'job'); };
    if (b.kind === 'sheriff') {
      who = 'Sheriff Ada Whitlock';
      if (sv.fine > 0) {
        line = line || 'You owe the county $' + sv.fine + ' for the trouble you caused. No work until it is paid.';
        opt('Pay your fine', 'Clears your record and your wanted level', '$' + sv.fine, () => buy(sv.fine, () => { sv.fine = 0; G.wanted = 0; for (const a of G.actors) if (a.kind === 'law') a.leaving = true, a.alert = false; place.line = 'Paid in full. Behave.'; }), sv.money < sv.fine);
      } else if (sv.active) line = line || 'Still waiting on you: ' + SD.missionNow().objective().toLowerCase() + '.';
      else if (m && m.giver === 'sheriff') job(m);
      else if (m) line = line || (m.giver === 'store' ? 'Hollis at the general store has been asking for you.' : 'Mags at the saloon wants a word with you.');
      else line = line || 'Quiet since the Rattlers went down. The board always has names on it.';
      if (sv.mission >= 2 && !sv.fine) {
        const bt = sv.bounty;
        if (bt) opt('Wanted: ' + bt.name, 'Near ' + SD.regionAt(bt.x).name + '. $' + bt.alive + ' alive, $' + bt.dead + ' dead.', 'Drop this bounty', () => { G.actors = G.actors.filter((a) => a.tag !== 'bounty' && a.tag !== 'bountyg'); sv.bounty = null; fillPlace(); });
        else {
          place.offers = place.offers || [SD.makeBounty(), SD.makeBounty()];
          for (const o of place.offers) opt('Wanted: ' + o.name, 'Last seen near ' + SD.regionAt(o.x).name + '. Wound them and they give up.', '$' + o.alive + ' alive · $' + o.dead + ' dead', () => { SD.acceptBounty(o); close(); });
        }
      }
    } else if (b.kind === 'store') {
      who = 'Hollis, storekeeper';
      const p = sv.pelts;
      if (m && m.giver === 'store' && !sv.active) job(m);
      else if (sv.active && m && m.giver === 'store') {
        line = line || 'Got my hides? Two deer, three rabbits.';
        opt('Hand over hides', 'Deer ' + Math.min(2, p.deer) + '/2, rabbit ' + Math.min(3, p.rabbit) + '/3', 'Reward: the Repeater', () => { if (m.turnIn()) { place.line = 'Fine work. The Repeater is yours. Press 2 to use it.'; fillPlace(); } }, p.deer < 2 || p.rabbit < 3, 'job');
      } else line = line || (sv.rep <= -40 ? 'I know what you did. Prices went up.' : sv.rep >= 40 ? 'For you, a discount. Folks talk well of you.' : 'Take a look. Prices are fair.');
      opt('Pistol rounds', '12 rounds for the revolver', '$' + price(4), () => buy(price(4), () => { sv.ammo.pistol += 12; }), sv.money < price(4));
      if (sv.guns.rifle) opt('Rifle rounds', '10 rounds for the Repeater', '$' + price(6), () => buy(price(6), () => { sv.ammo.rifle += 10; }), sv.money < price(6));
      if (sv.guns.shotgun) opt('Shells', '8 shells for the Scattergun', '$' + price(6), () => buy(price(6), () => { sv.ammo.shells += 8; }), sv.money < price(6));
      opt('Tonic', 'Heals 60. Press T to drink.', '$' + price(8), () => buy(price(8), () => { sv.tonics++; }), sv.money < price(8));
      if (!sv.guns.shotgun) opt('Scattergun', 'Two barrels, wide spread, close range. Press 3.', '$' + price(90), () => buy(price(90), () => { sv.guns.shotgun = true; sv.ammo.shells += 8; }), sv.money < price(90));
      if (!sv.guns.rifle) opt('Repeater', 'Long-range rifle, hits hard. Press 2.', '$' + price(150), () => buy(price(150), () => { sv.guns.rifle = true; sv.ammo.rifle += 10; }), sv.money < price(150));
      const PEL = { rabbit: 2, coyote: 4, wolf: 6, deer: 8 }, keep = sv.mission <= 3 ? { deer: 2, rabbit: 3 } : {};
      for (const k in PEL) {
        const n = p[k] - (keep[k] || 0);
        if (n > 0) opt('Sell ' + n + ' ' + k + ' pelt' + (n > 1 ? 's' : ''), keep[k] ? 'Keeping ' + keep[k] + ' for the order' : 'Hollis buys every hide', '+$' + n * PEL[k], () => { sv.money += n * PEL[k]; p[k] -= n; SD.sfx('coin'); fillPlace(); });
      }
    } else if (b.kind === 'saloon') {
      who = 'Mags, saloon keeper';
      if (m && m.giver === 'saloon' && !sv.active) { line = m.brief; opt(m.title, 'Story job from Mags', 'Step outside', () => { close(); SD.acceptMission(); }, false, 'job'); }
      else line = line || ['Bitterroot water is clean past the bridge. Deer like it too.', 'Wolves come out after dark. Stay by the lamps.', 'The Rattlers used to drink here. Now they just steal the bottles.', 'Pay off a fine and folks forget. Mostly.'][Math.floor(G.time / 7) % 4];
      opt('Whiskey', '+25 health and +20 Overclock', '$' + price(3), () => buy(price(3), () => { G.p.hp = Math.min(G.p.maxhp, G.p.hp + 25); G.oc = Math.min(100, G.oc + 20); }), sv.money < price(3));
      opt('Rent a room', 'Sleep until 8 AM. Heals you and saves.', '$' + price(6), () => buy(price(6), () => { if (sv.hour >= 8) sv.day++; sv.hour = 8; G.p.hp = G.p.maxhp; saveGame(); place.line = 'Slept like a rock. It is 8 in the morning.'; }), sv.money < price(6));
    } else if (b.kind === 'doctor') {
      who = 'Doc Pell';
      line = line || (G.p.hp < G.p.maxhp ? 'Hold still. This will pinch.' : 'You look fine to me. Mostly bolts.');
      opt('Patch up', 'Restore full health', '$' + price(10), () => buy(price(10), () => { G.p.hp = G.p.maxhp; }), sv.money < price(10) || G.p.hp >= G.p.maxhp);
      opt('Tonic', 'Heals 60. Press T to drink.', '$' + price(8), () => buy(price(8), () => { sv.tonics++; }), sv.money < price(8));
    } else { who = 'Bank clerk'; line = 'Closed till Monday. Come back with a deposit.'; }
    $('pl-who').textContent = who; $('pl-line').textContent = line;
  }
  function close() { place = null; saveGame(); show(null); }

  function pauseOpen() {
    if (screen != null || !playing) return;
    const sv = SD.save, row = (k, v) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>';
    $('pa-day').textContent = sv.day;
    $('pa-stats').innerHTML = row('Money', '$' + sv.money) + row('Reputation', sv.rep) + row('Kills', sv.kills) + row('Bounties', sv.bountiesDone) +
      row('Story', Math.min(sv.mission, SD.MISSIONS.length) + ' / ' + SD.MISSIONS.length) + row('Pelts', Object.keys(sv.pelts).map((k) => sv.pelts[k] + ' ' + k).join(', '));
    $('pa-keys').innerHTML = $('keys').innerHTML;
    show('pause');
  }

  /* ---------- HUD ---------- */
  const hud = {};
  const put = (id, v) => { if (hud[id] !== v) { hud[id] = v; $(id).textContent = v; } };
  function clock(h) { const hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10; return ((hh + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? ' AM' : ' PM'); }
  function hudDraw() {
    const G = SD.G, sv = SD.save, p = G.p, gun = SD.GUNS[p.gun];
    const hp = Math.max(0, Math.round(p.hp));
    if (hud.hp !== hp) { hud.hp = hp; $('hp').firstElementChild.style.width = hp + '%'; $('hp').lastElementChild.textContent = hp + ' / ' + p.maxhp; }
    const oc = Math.round(G.oc); if (hud.oc !== oc) { hud.oc = oc; $('oc').firstElementChild.style.width = oc + '%'; }
    $('oc').classList.toggle('on', G.ocOn);
    put('money', '$' + sv.money); put('rep', (sv.rep > 0 ? '+' : '') + sv.rep);
    $('rep').style.color = sv.rep >= 40 ? 'var(--sage)' : sv.rep <= -40 ? 'var(--blood)' : '';
    $('stars-chip').hidden = !G.wanted; put('stars', '★'.repeat(G.wanted));
    put('clock', 'Day ' + sv.day + ' · ' + clock(sv.hour)); put('region', SD.regionAt(p.x).name);
    const m = SD.missionNow(), next = SD.MISSIONS[sv.mission];
    put('obj-title', m ? m.title : next ? 'Next job' : 'Free roam');
    put('obj-text', m ? m.objective() : next ? ({ sheriff: 'See the sheriff in town', store: 'See Hollis at the general store', saloon: 'See Mags at the saloon' })[next.giver] : 'Bounties are posted at the sheriff');
    const bt = sv.bounty;
    $('bounty-line').hidden = !bt;
    if (bt) put('bounty-line', p.carry && p.carry.tag === 'bounty' ? 'Bounty: take ' + bt.name + ' to the sheriff' : 'Bounty: ' + bt.name + ' near ' + SD.regionAt(bt.x).name);
    const am = sv.clip[p.gun] + ' <small>/ ' + sv.ammo[gun.ammo] + '</small>'; if (hud.am !== am) { hud.am = am; $('ammo').innerHTML = am; }
    put('gun', gun.name + (p.reload > 0 ? ' · reloading' : '')); put('tonics', sv.tonics + ' tonic' + (sv.tonics === 1 ? '' : 's'));
  }

  /* ---------- input ---------- */
  const held = { left: 0, right: 0, down: 0, jump: 0, sprint: 0, oc: 0, fire: 0 };
  const edge = {};
  function clearInput() { for (const k in held) held[k] = 0; for (const k in edge) edge[k] = 0; }
  const MAP = {
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyS: 'down', ArrowDown: 'down', KeyW: 'jump', ArrowUp: 'jump', Space: 'jump',
    ShiftLeft: 'sprint', ShiftRight: 'sprint', KeyQ: 'oc', KeyR: 'reload', KeyE: 'use', KeyH: 'call', KeyT: 'tonic', KeyF: 'knife', KeyJ: 'fire', KeyK: 'roll',
    Digit1: 'g1', Digit2: 'g2', Digit3: 'g3',
  };
  function press(k, on) { if (on && !held[k]) edge[k] = 1; if (k in held) held[k] = on ? 1 : 0; }
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    wake();
    if (screen == null) {
      const k = MAP[e.code];
      if (k) { if (!e.repeat) press(k, true); e.preventDefault(); if (k === 'fire') mouse.active = false; return; }
      if (!e.repeat && (e.code === 'KeyP' || e.code === 'Escape')) pauseOpen();
    } else if (!e.repeat && (e.code === 'Escape' || e.code === 'KeyP')) { if (screen === 'pause' || screen === 'place') close(); }
    if (!e.repeat && e.code === 'KeyM') setMute(!muted);
  });
  window.addEventListener('keyup', (e) => { const k = MAP[e.code]; if (k && k in held) held[k] = 0; });
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pauseOpen(); saveGame(); } });
  cv.addEventListener('mousemove', (e) => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.active = true; mouse.inside = true; mouse.last = performance.now(); });
  cv.addEventListener('mouseleave', () => { mouse.inside = false; });
  cv.addEventListener('mousedown', (e) => { if (screen != null) return; wake(); if (e.button === 2) press('oc', true); else { press('fire', true); mouse.active = true; } e.preventDefault(); });
  window.addEventListener('mouseup', (e) => { if (e.button === 2) held.oc = 0; else held.fire = 0; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  for (const k of ['left', 'right', 'jump', 'use', 'call', 'roll', 'fire']) {
    const b = $('t-' + k);
    const down = (e) => { e.preventDefault(); wake(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } press(k, true); mouse.active = false; b.classList.add('on'); };
    const up = (e) => { e.preventDefault(); if (k in held) held[k] = 0; b.classList.remove('on'); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  }
  window.addEventListener('touchstart', () => { if (!coarse) { coarse = true; mouse.active = false; if (screen == null) $('touch').hidden = false; } }, { passive: true });

  function aimPoint() {
    const G = SD.G, p = G.p, cam = SD.cam;
    if (mouse.active && performance.now() - mouse.last < 8000) return { x: cam.x + mouse.x / cam.z, y: cam.y + mouse.y / cam.z };
    let best = null, bd = 700;
    for (const a of G.actors) {
      if (a.dead || a.inside || a.kind === 'folk' || a.kind === 'bottle' && !SD.save.active || a.team === 'law' && !G.wanted) continue;
      const dx = a.x - p.x;
      if (Math.sign(dx) !== p.face && Math.abs(dx) > 20) continue;
      if (Math.abs(dx) < bd && Math.abs(a.y - p.y) < 220) { bd = Math.abs(dx); best = a; }
    }
    return best ? { x: best.x, y: best.y - best.h * (best.human ? 0.62 : 0.5) } : { x: p.x + p.face * 200, y: p.y - 11 };
  }

  /* ---------- loop ---------- */
  function fit() { const r = cv.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.max(1, r.width); H = Math.max(1, r.height); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  let last = 0, acc = 0, saveT = 0, hoofT = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    const G = SD.G;
    if (screen == null && playing && G) {
      acc += dt;
      while (acc >= K.DT) {
        const aim = aimPoint();
        SD.step(K.DT, {
          left: held.left, right: held.right, down: held.down, jump: edge.jump, sprint: held.sprint, roll: edge.sprint || edge.roll,
          fire: edge.fire, fireHeld: held.fire, reload: edge.reload, use: edge.use, call: edge.call, tonic: edge.tonic, knife: edge.knife,
          oc: held.oc, gun: edge.g1 ? 'revolver' : edge.g2 ? 'rifle' : edge.g3 ? 'shotgun' : null, aimX: aim.x, aimY: aim.y,
        });
        for (const k in edge) edge[k] = 0;
        acc -= K.DT;
        if (screen != null) break;
      }
      saveT += dt; if (saveT > 15) { saveT = 0; saveGame(); }
      const h = G.horse;
      if (G.p.mounted && Math.abs(h.vx) > 60 && h.onGround) { hoofT -= dt; if (hoofT <= 0) { SD.sfx('hoof'); hoofT = Math.max(0.12, 0.42 - Math.abs(h.vx) / 1600); } }
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').hidden = true; }
    } else if (G) { G.time += dt * 0.3; if (screen === 'title') { SD.cam.x += dt * 22; SD.save.hour = (SD.save.hour + dt * 0.05) % 24; SD.drawHeroPortrait(); } }
    if (G) { const cam = SD.cam; mouse.wx = cam.x + mouse.x / cam.z; mouse.wy = cam.y + mouse.y / cam.z; }
    SD.render(ctx, W, H, dpr, { x: mouse.x, y: mouse.y, wx: mouse.wx, inside: mouse.inside && screen == null && !coarse, active: mouse.active });
    if (playing && G && screen !== 'title') hudDraw();
  }
  SD.drawHeroPortrait = function () {
    const c = $('hero-cv').getContext('2d'), k = 160 / 44;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 160, 160);
    c.setTransform(k, 0, 0, k, 80, 134);
    SD.drawHero(c, { face: 1, anim: 'idle', t: performance.now() / 1000 });
    c.translate(4, -11); SD.drawGun(c, 'revolver', -0.5, 0);
  };

  SD.listen((n, d) => {
    if (n === 'door') openPlace(d);
    else if (n === 'playerDead') setTimeout(() => { const lost = SD.respawn(); $('dead-note').textContent = lost ? 'The doc took $' + lost + ' for his trouble.' : 'The doc did it for free. You were broke.'; show('dead'); }, 1300);
    else if (n === 'reward') toast('+$' + d.money, d.why + (d.rep ? '  ·  Rep ' + (d.rep > 0 ? '+' : '') + d.rep : ''));
    else if (n === 'missionDone') saveGame();
    else if (n === 'ending') setTimeout(() => { const sv = SD.save, row = (k, v) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>'; $('end-stats').innerHTML = row('Days', sv.day) + row('Money', '$' + sv.money) + row('Kills', sv.kills) + row('Reputation', sv.rep); saveGame(); show('ending'); }, 2600);
  });

  let saved = store.get('sd-save', null);
  $('b-continue').hidden = !saved;
  if (saved) $('b-continue').classList.add('primary'); else $('b-new').classList.add('primary');
  $('b-continue').addEventListener('click', () => startGame(Object.assign(SD.defaultSave(), saved)));
  let armed = false;
  $('b-new').addEventListener('click', () => {
    if (saved && !armed) { armed = true; $('b-new').textContent = 'Click again to erase your save'; return; }
    startGame(SD.defaultSave());
  });
  $('pl-leave').addEventListener('click', close);
  $('pa-resume').addEventListener('click', close);
  $('pa-title').addEventListener('click', () => { saveGame(); playing = false; saved = store.get('sd-save', null); $('b-continue').hidden = !saved; $('b-continue').classList.add('primary'); $('b-new').classList.remove('primary'); show('title'); });
  $('dead-go').addEventListener('click', close);
  $('end-go').addEventListener('click', close);
  $('b-pause').addEventListener('click', pauseOpen);
  $('b-mute').addEventListener('click', () => setMute(!muted));

  setMute(muted); fit();
  window.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(cv);
  SD.newGame(Object.assign(SD.defaultSave(), { x: 1300, hour: 18.6 }));
  show('title');
  requestAnimationFrame(frame);
})();
