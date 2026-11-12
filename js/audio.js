/* Sundown Protocol — all sound is synthesized: effects, ambience that follows where you are and
   what time it is, and a sparse plucked-guitar score that tightens up in a fight. Off until switched on. */
(function () {
  'use strict';
  const SD = window.SD;
  let ac = null, out = null, echo = null, noise = null, muted = true, beds = null;
  const pluck = {}, NOTES = { A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, G3: 196, A3: 220, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440 };
  const SCALE = ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'G3', 'E3'];

  function ks(freq, dur) { // Karplus-Strong plucked string
    const sr = ac.sampleRate, n = Math.round(sr / freq), len = Math.floor(sr * dur), buf = ac.createBuffer(1, len, sr), d = buf.getChannelData(0), ring = new Float32Array(n);
    for (let i = 0; i < n; i++) ring[i] = Math.random() * 2 - 1;
    for (let i = 0; i < len; i++) { const k = i % n, v = ring[k]; d[i] = v * Math.min(1, (len - i) / (sr * 0.3)); ring[k] = 0.4975 * (v + ring[(k + 1) % n]); }
    return buf;
  }
  function bed(type, freq, q) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain();
    s.buffer = noise; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; gn.gain.value = 0;
    s.connect(f); f.connect(gn); gn.connect(out); s.start();
    return gn;
  }
  function init() {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      out = ac.createGain(); out.gain.value = 0.9; out.connect(ac.destination);
      const dl = ac.createDelay(1), fb = ac.createGain(), lp = ac.createBiquadFilter();
      dl.delayTime.value = 0.27; fb.gain.value = 0.34; lp.type = 'lowpass'; lp.frequency.value = 1400;
      echo = ac.createGain(); echo.gain.value = 0.5; echo.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(out);
      const n = ac.sampleRate * 1.5; noise = ac.createBuffer(1, n, ac.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      for (const k in NOTES) pluck[k] = ks(NOTES[k], 2.4);
      beds = { wind: bed('bandpass', 420, 0.7), rain: bed('highpass', 2400, 0.5), river: bed('bandpass', 950, 0.9) };
    } catch (e) { ac = null; }
  }
  function tone(f0, f1, dur, type, vol, delay, wet) {
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), gn = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(out); if (wet) gn.connect(echo); o.start(t); o.stop(t + dur + 0.03);
  }
  function burst(dur, freq, vol, delay, wet) {
    const t = ac.currentTime + (delay || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain();
    s.buffer = noise; f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.15), t + dur);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(gn); gn.connect(out); if (wet) gn.connect(echo); s.start(t); s.stop(t + dur + 0.03);
  }
  function note(name, delay, vol) {
    const s = ac.createBufferSource(), gn = ac.createGain();
    s.buffer = pluck[name]; gn.gain.value = vol; s.connect(gn); gn.connect(out); gn.connect(echo); s.start(ac.currentTime + (delay || 0));
  }
  const SFX = {
    shot_revolver() { burst(0.3, 3400, 0.5, 0, 1); tone(170, 55, 0.14, 'triangle', 0.22); },
    shot_rifle() { burst(0.45, 4400, 0.55, 0, 1); tone(120, 40, 0.22, 'triangle', 0.26); },
    shot_shotgun() { burst(0.55, 2000, 0.7, 0, 1); tone(90, 35, 0.28, 'sine', 0.32); },
    eshot() { burst(0.24, 2300, 0.24, 0, 1); }, eshot2() { burst(0.34, 2800, 0.3, 0, 1); },
    dry() { tone(1800, 1800, 0.03, 'square', 0.05); },
    reload() { [0, 0.14, 0.32].forEach((d) => tone(950, 950, 0.03, 'square', 0.05, d)); },
    hit() { burst(0.06, 900, 0.18); }, hurt() { tone(220, 80, 0.2, 'sawtooth', 0.1); }, ric() { tone(2800, 900, 0.14, 'sine', 0.05, 0, 1); },
    jump() { tone(330, 520, 0.07, 'square', 0.02); }, roll() { burst(0.16, 700, 0.14); },
    whistle() { tone(1400, 2100, 0.16, 'sine', 0.08, 0, 1); tone(1500, 2400, 0.26, 'sine', 0.08, 0.22, 1); },
    neigh() { tone(700, 1100, 0.15, 'sawtooth', 0.035); tone(1100, 480, 0.35, 'sawtooth', 0.035, 0.12); },
    hoof() { tone(150, 85, 0.05, 'triangle', 0.09); burst(0.03, 500, 0.05); },
    coin() { tone(1319, 1319, 0.05, 'square', 0.035); tone(1760, 1760, 0.1, 'square', 0.035, 0.05); },
    glass() { tone(2600, 3400, 0.06, 'triangle', 0.08); burst(0.14, 6000, 0.12); },
    boom() { burst(1, 900, 0.85, 0, 1); tone(80, 28, 0.6, 'sine', 0.45); }, fuse() { burst(0.3, 5000, 0.04); },
    thunder() { burst(2.2, 500, 0.5, 0.15, 1); burst(1.2, 220, 0.5, 0.5); },
    job() { ['A3', 'E4', 'A4'].forEach((k, i) => note(k, i * 0.16, 0.5)); },
    draw() { tone(880, 880, 0.8, 'triangle', 0.16, 0, 1); },
    ocOn() { tone(200, 70, 0.4, 'sine', 0.3); }, ocOff() { tone(70, 220, 0.2, 'sine', 0.22); }, mark() { tone(1250, 1250, 0.04, 'square', 0.05); },
    swing() { burst(0.08, 1800, 0.12); }, bite() { burst(0.08, 700, 0.2); }, rope() { burst(0.22, 1300, 0.09); }, skin() { burst(0.15, 900, 0.1); },
    drink() { tone(400, 700, 0.25, 'sine', 0.08); }, equip() { tone(600, 900, 0.06, 'square', 0.04); },
  };
  SD.sfx = (n) => { if (!muted && ac && SFX[n]) SFX[n](); };

  let musicT = 3, cricketT = 0, pianoT = 0, birdT = 4, step = 0;
  SD.audio = {
    wake() { if (muted) return; if (!ac) init(); if (ac && ac.state === 'suspended') ac.resume(); },
    setMute(m) { muted = m; if (!m) this.wake(); if (ac) out.gain.value = m ? 0 : 0.9; },
    /* called once a frame with real seconds */
    tick(dt, playing) {
      if (muted || !ac) return;
      const G = SD.G, p = G.p, T = SD.tod(SD.save.hour), now = ac.currentTime, w = G.weather;
      const set = (gn, v) => gn.gain.setTargetAtTime(v, now, 0.4);
      const region = SD.regionAt(p.x).id;
      set(beds.wind, 0.035 + (region === 'gulch' || region === 'plains' ? 0.02 : 0) + (w.kind === 'dust' ? 0.09 * w.amt : 0) + Math.sin(G.time * 0.3) * 0.012);
      set(beds.rain, w.kind === 'rain' ? 0.11 * w.amt : 0);
      set(beds.river, Math.max(0, 1 - Math.abs(p.x - 6800) / 700) * 0.09);
      if (!playing) return;
      cricketT -= dt;
      if (T.dark > 0.3 && cricketT <= 0) { cricketT = 0.5 + Math.random() * 0.5; for (let i = 0; i < 3; i++) tone(4300, 4300, 0.03, 'sine', 0.012, i * 0.07); }
      birdT -= dt;
      if (T.dark < 0.2 && !SD.inTown(p.x) && birdT <= 0) { birdT = 3 + Math.random() * 7; const f = 2200 + Math.random() * 1400; tone(f, f * 1.3, 0.08, 'sine', 0.02); tone(f * 1.2, f * 0.9, 0.1, 'sine', 0.02, 0.12); }
      const ds = Math.abs(p.x - SD.SPOTS.saloon), hr = SD.save.hour;
      pianoT -= dt;
      if (ds < 460 && (hr > 15 || hr < 2) && pianoT <= 0) {
        pianoT = 0.17; step++;
        const v = 0.05 * (1 - ds / 460), RAG = [523, 659, 784, 880, 1047, 880, 784, 659];
        if (step % 2 === 0 || Math.random() < 0.6) { const f = RAG[(step + ((Math.random() * 3) | 0)) % 8]; tone(f, f, 0.16, 'triangle', v); tone(f * 1.006, f * 1.006, 0.16, 'triangle', v * 0.7); }
        if (step % 4 === 0) tone(step % 8 ? 196 : 131, step % 8 ? 196 : 131, 0.22, 'triangle', v * 1.4);
      }
      // the score
      musicT -= dt;
      if (musicT <= 0) {
        const fight = G.actors.some((a) => !a.dead && a.alert && (a.team === 'gang' || a.team === 'law') && Math.abs(a.x - p.x) < 800);
        if (G.duel) { note('A2', 0, 0.5); musicT = 1.2; }
        else if (fight) { ['A2', 'A2', 'E3', 'A2', 'G3', 'A2', 'E3', 'C3'].forEach((k, i) => note(k, i * 0.19, 0.42)); if (Math.random() < 0.5) note(Math.random() < 0.5 ? 'E4' : 'G4', 0.76, 0.3); musicT = 1.55; }
        else if (ds < 460) musicT = 4;
        else {
          let i = (Math.random() * 5) | 0, t = 0; const n = 3 + ((Math.random() * 4) | 0);
          note('A2', 0, 0.42);
          for (let k = 0; k < n; k++) { t += 0.38 + Math.random() * 0.5; note(SCALE[i], t, 0.3); i = Math.max(0, Math.min(SCALE.length - 1, i + ((Math.random() * 3) | 0) - 1)); }
          if (Math.random() < 0.4) note('E3', t + 0.7, 0.32);
          musicT = t + 4 + Math.random() * (T.dark > 0.3 ? 11 : 7);
        }
      }
    },
  };
})();
