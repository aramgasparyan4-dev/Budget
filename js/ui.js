/* Neural Kick — menus, HUD, input, sound, main loop. */
(function () {
  'use strict';
  const NK = window.NK, S = NK.S, C = NK.C;
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: play on without saving */ } },
  };
  const cv = $('cv'), ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, paused = false, best = store.get('nk-best', {}), muted = !!store.get('nk-mute', false);
  let coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  /* ---------- sound ---------- */
  let ac = null;
  function wake() {
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
  const SFX = {
    jump() { tone(380, 620, 0.1, 'square', 0.05); },
    kick() { tone(520, 940, 0.09, 'square', 0.05); tone(180, 90, 0.07, 'triangle', 0.09); },
    land() { tone(140, 70, 0.06, 'triangle', 0.07); },
    coin() { tone(988, 988, 0.06, 'square', 0.04); tone(1319, 1319, 0.14, 'square', 0.04, 0.06); },
    stomp() { tone(260, 70, 0.14, 'square', 0.07); },
    spring() { tone(240, 1100, 0.2, 'sawtooth', 0.04); },
    die() { tone(420, 50, 0.5, 'sawtooth', 0.06); },
    check() { [523, 659, 784].forEach((f, i) => tone(f, f, 0.1, 'triangle', 0.08, i * 0.08)); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.16, 'square', 0.045, i * 0.1)); },
  };
  NK.sfx = (n) => { if (SFX[n]) SFX[n](); };

  /* ---------- skins ---------- */
  function setSkin(id) {
    const sk = NK.SKINS.find((s) => s.id === id) || NK.SKINS[0];
    S.skin = sk; S.accent = sk.accent; store.set('nk-skin', sk.id);
    document.querySelectorAll('.skin').forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === sk.id ? 'true' : 'false'));
    $('skin-name').textContent = sk.name + ' · ' + sk.by;
  }
  function buildSkins() {
    const box = $('skins');
    for (const sk of NK.SKINS) {
      const b = document.createElement('button');
      b.className = 'skin'; b.type = 'button'; b.dataset.id = sk.id; b.title = sk.name;
      const c = document.createElement('canvas'); c.width = c.height = 120;
      const x = c.getContext('2d'); x.translate(60, 60); NK.paintSkin(x, sk, 108);
      const n = document.createElement('span'); n.textContent = sk.name;
      b.append(c, n);
      b.addEventListener('click', () => { wake(); setSkin(sk.id); NK.sfx('coin'); });
      box.append(b);
    }
  }

  /* ---------- menus ---------- */
  const fmt = (t) => Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60).toFixed(1);
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
  function buildLevels() {
    const box = $('levels'); box.textContent = '';
    const add = (key, num, name, sub, bestTxt, cls) => {
      const b = document.createElement('button');
      b.className = 'lvl' + (cls ? ' ' + cls : ''); b.type = 'button';
      b.innerHTML = '<span class="num"></span><span class="txt"><b></b><i></i></span><span class="best"></span>';
      b.querySelector('.num').textContent = num; b.querySelector('b').textContent = name;
      b.querySelector('i').textContent = sub; b.querySelector('.best').textContent = bestTxt;
      b.addEventListener('click', () => play(key));
      box.append(b);
    };
    NK.LEVELS.forEach((d, i) => {
      const r = best[d.id];
      add(i, String(i + 1), d.name, d.sub, r ? stars(r.stars) + ' ' + fmt(r.time) : 'Not cleared');
    });
    add('tower', '∞', 'The Tower', 'Endless climb. Fall off screen and it ends.', best.tower ? 'Best ' + best.tower + ' m' : 'No run yet', 'tower');
  }
  function show(id) {
    for (const s of ['menu', 'pause', 'result']) $(s).hidden = s !== id;
    const on = id == null;
    $('hud').hidden = !on; $('touch').hidden = !(on && coarse);
    if (id) { const f = $(id).querySelector('button.primary:not([hidden])'); if (f && !coarse) f.focus({ preventScroll: true }); }
    else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function menu() {
    paused = false;
    NK.startLevel(0); S.state = 'menu';
    buildLevels(); show('menu');
  }
  function play(which) {
    wake(); paused = false; keys.left = keys.right = keys.jump = false; jumpEdge = false;
    S.bestH = best.tower || 0;
    NK.startLevel(which);
    $('h-total').textContent = which === 'tower' ? '' : '/' + S.L.coinTotal;
    show(null);
  }
  function setPaused(on) {
    if (S.state !== 'play' && S.state !== 'dead') return;
    paused = on;
    if (on) { $('p-title').textContent = S.L.name; show('pause'); } else show(null);
  }
  function setMute(m) {
    muted = m; store.set('nk-mute', m);
    $('b-mute').setAttribute('aria-pressed', m ? 'true' : 'false');
    $('b-mute').textContent = m ? 'Sound off' : 'Sound on';
  }

  NK.onEnd = function (kind) {
    const row = (k, v) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>';
    const nx = $('r-next');
    if (kind === 'win') {
      const d = NK.LEVELS[S.which], all = S.coins >= S.L.coinTotal;
      const st = 1 + (all ? 1 : 0) + (S.deaths === 0 ? 1 : 0), old = best[d.id];
      if (!old || st > old.stars || (st === old.stars && S.t < old.time)) { best[d.id] = { stars: st, time: S.t, coins: S.coins, deaths: S.deaths }; store.set('nk-best', best); }
      $('r-kicker').textContent = d.name; $('r-title').textContent = 'Level clear';
      $('r-stars').textContent = stars(st); $('r-stars').hidden = false;
      $('r-stats').innerHTML = row('Time', fmt(S.t)) + row('Tokens', S.coins + ' / ' + S.L.coinTotal) + row('Retries', S.deaths);
      $('r-note').textContent = st === 3 ? 'Perfect run.' : !all ? 'Collect every token for another star.' : 'Finish without a retry for the third star.';
      const more = S.which + 1 < NK.LEVELS.length;
      nx.textContent = more ? 'Next level' : 'Climb the Tower'; nx.hidden = false;
      nx.onclick = () => play(more ? S.which + 1 : 'tower');
      $('r-again').textContent = 'Replay';
    } else {
      const rec = S.maxH > (best.tower || 0);
      if (rec) { best.tower = S.maxH; store.set('nk-best', best); }
      $('r-kicker').textContent = 'The Tower'; $('r-title').textContent = S.maxH + ' m';
      $('r-stars').hidden = true;
      $('r-stats').innerHTML = row('Height', S.maxH + ' m') + row('Best', (best.tower || 0) + ' m') + row('Tokens', S.coins);
      $('r-note').textContent = rec ? 'New best climb.' : 'The camera only moves up. Do not fall behind it.';
      nx.hidden = true;
      $('r-again').textContent = 'Climb again';
    }
    $('r-again').onclick = () => play(S.which);
    show('result');
  };

  /* ---------- input ---------- */
  const keys = { left: false, right: false, jump: false };
  let jumpEdge = false;
  function press(k, on) { if (k === 'jump' && on && !keys.jump) jumpEdge = true; keys[k] = on; }
  const MAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump', KeyX: 'jump' };
  window.addEventListener('keydown', (e) => {
    wake();
    const playing = $('hud').hidden === false;
    if (MAP[e.code] && playing) { if (!e.repeat) press(MAP[e.code], true); e.preventDefault(); return; }
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP') { if (playing) setPaused(true); else if (!$('pause').hidden) setPaused(false); }
    else if (e.code === 'KeyR' && playing) NK.retry();
    else if (e.code === 'KeyM') setMute(!muted);
  });
  window.addEventListener('keyup', (e) => { if (MAP[e.code]) press(MAP[e.code], false); });
  window.addEventListener('blur', () => { keys.left = keys.right = keys.jump = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.state === 'play' && !$('hud').hidden) setPaused(true); });

  for (const [id, k] of [['t-left', 'left'], ['t-right', 'right'], ['t-jump', 'jump']]) {
    const b = $(id);
    const down = (e) => { e.preventDefault(); wake(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } press(k, true); b.classList.add('on'); };
    const up = (e) => { e.preventDefault(); press(k, false); b.classList.remove('on'); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  window.addEventListener('touchstart', () => { if (!coarse) { coarse = true; if (!$('hud').hidden) $('touch').hidden = false; } }, { passive: true });

  $('b-pause').addEventListener('click', () => setPaused(true));
  $('b-mute').addEventListener('click', () => { wake(); setMute(!muted); });
  $('p-resume').addEventListener('click', () => setPaused(false));
  $('p-restart').addEventListener('click', () => play(S.which));
  $('p-quit').addEventListener('click', menu);
  $('r-menu').addEventListener('click', menu);

  /* ---------- loop ---------- */
  function fit() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  let last = 0, acc = 0, hudCoins = -1, hudMid = '';
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    if (!paused) {
      acc += dt;
      while (acc >= C.DT) {
        NK.step(C.DT, { left: keys.left, right: keys.right, jump: keys.jump, jumpPressed: jumpEdge });
        jumpEdge = false; acc -= C.DT;
      }
    }
    S.padB = coarse ? 128 / (S.view.z || 1) : 0;
    NK.render(ctx, W, H, dpr);
    if (!$('hud').hidden) {
      if (S.coins !== hudCoins) { hudCoins = S.coins; $('h-coins').textContent = S.coins; }
      const mid = S.L.mode === 'tower' ? S.maxH + ' m' : fmt(S.t);
      if (mid !== hudMid) { hudMid = mid; $('h-mid').textContent = mid; }
    }
  }

  NK.boot = function () {
    buildSkins(); setSkin(store.get('nk-skin', 'claude')); setMute(muted);
    fit();
    window.addEventListener('resize', fit);
    if (window.ResizeObserver) new ResizeObserver(fit).observe(cv);
    menu();
    requestAnimationFrame(frame);
  };
  NK.play = play; NK.menu = menu;
  NK.boot();
})();
