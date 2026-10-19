// Fully procedural Web Audio: no audio assets required.

type Bus = 'music' | 'sfx' | 'amb';

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses!: Record<Bus, GainNode>;
  private noiseBuf!: AudioBuffer;
  private reverb!: ConvolverNode;
  private amb: {
    city: GainNode;
    rain: GainNode;
    wind: GainNode;
    windFilter: BiquadFilterNode;
    crowd: GainNode;
    muffle: BiquadFilterNode;
  } | null = null;
  private engineNodes: { o1: OscillatorNode; o2: OscillatorNode; filter: BiquadFilterNode; gain: GainNode; noiseGain: GainNode } | null = null;
  private music: { gain: GainNode; timer: number; step: number; kind: 'menu' | 'club' | 'radio' | 'none'; nextTime: number } | null = null;
  private birdTimer = 0;
  private hornNodes: { g: GainNode; o: OscillatorNode[] } | null = null;
  vol = { master: 0.8, music: 0.55, sfx: 0.8, ambience: 0.7 };
  ready = false;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.buses = { music: ctx.createGain(), sfx: ctx.createGain(), amb: ctx.createGain() };
    for (const b of Object.values(this.buses)) b.connect(this.master);
    // noise buffer
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // reverb impulse
    this.reverb = ctx.createConvolver();
    const ir = ctx.createBuffer(2, ctx.sampleRate * 2.6, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 2.6);
    }
    this.reverb.buffer = ir;
    const rvGain = ctx.createGain();
    rvGain.gain.value = 0.35;
    this.reverb.connect(rvGain).connect(this.buses.music);
    this.setVolumes(this.vol);
    this.startAmbience();
    this.ready = true;
  }

  setVolumes(v: { master: number; music: number; sfx: number; ambience: number }) {
    this.vol = { ...v };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(v.master, t, 0.05);
    this.buses.music.gain.setTargetAtTime(v.music * 0.6, t, 0.05);
    this.buses.sfx.gain.setTargetAtTime(v.sfx, t, 0.05);
    this.buses.amb.gain.setTargetAtTime(v.ambience, t, 0.05);
  }

  private noise(loop = true) {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = loop;
    src.loopStart = Math.random();
    return src;
  }

  private startAmbience() {
    const ctx = this.ctx!;
    const muffle = ctx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 18000;
    muffle.connect(this.buses.amb);
    // city rumble
    const city = ctx.createGain();
    city.gain.value = 0;
    const n1 = this.noise();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    n1.connect(lp).connect(city).connect(muffle);
    n1.start();
    // rain
    const rain = ctx.createGain();
    rain.gain.value = 0;
    const n2 = this.noise();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const lp2 = ctx.createBiquadFilter();
    lp2.type = 'lowpass';
    lp2.frequency.value = 7000;
    n2.connect(hp).connect(lp2).connect(rain).connect(muffle);
    n2.start();
    // wind
    const wind = ctx.createGain();
    wind.gain.value = 0;
    const n3 = this.noise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.8;
    n3.connect(bp).connect(wind).connect(muffle);
    n3.start();
    // crowd murmur
    const crowd = ctx.createGain();
    crowd.gain.value = 0;
    const n4 = this.noise();
    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.value = 650;
    bp2.Q.value = 1.6;
    const trem = ctx.createOscillator();
    trem.frequency.value = 3.1;
    const tg = ctx.createGain();
    tg.gain.value = 0.3;
    trem.connect(tg).connect(crowd.gain);
    trem.start();
    n4.connect(bp2).connect(crowd).connect(muffle);
    n4.start();
    this.amb = { city, rain, wind, windFilter: bp, crowd, muffle };
  }

  /** per-frame ambience mix */
  updateAmbience(dt: number, p: { traffic: number; rain: number; wind: number; crowd: number; day: number; interior: boolean; park: number }) {
    if (!this.ctx || !this.amb) return;
    const t = this.ctx.currentTime;
    const a = this.amb;
    a.city.gain.setTargetAtTime(0.08 + p.traffic * 0.22, t, 0.5);
    a.rain.gain.setTargetAtTime(p.rain * 0.38, t, 0.4);
    a.wind.gain.setTargetAtTime(p.wind * 0.22, t, 0.6);
    a.windFilter.frequency.setTargetAtTime(380 + Math.sin(t * 0.37) * 160 + p.wind * 500, t, 0.3);
    a.crowd.gain.setTargetAtTime(Math.min(0.18, p.crowd * 0.012), t, 0.6);
    a.muffle.frequency.setTargetAtTime(p.interior ? 700 : 18000, t, 0.2);
    // birds during the day near parks / quiet streets
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 1.5 + Math.random() * 5;
      if (!p.interior && p.day > 0.5 && p.rain < 0.2 && Math.random() < 0.3 + p.park * 0.6) this.chirp();
    }
  }

  private chirp() {
    const ctx = this.ctx!;
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2600 + Math.random() * 2400;
    let t = ctx.currentTime;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 2 - 1;
    pan.connect(this.buses.amb);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.5), t + 0.06);
      o.frequency.exponentialRampToValueAtTime(base * 0.8, t + 0.11);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.035, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g).connect(pan);
      o.start(t);
      o.stop(t + 0.14);
      t += 0.12 + Math.random() * 0.1;
    }
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, bus: Bus = 'sfx', when = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.buses[bus]);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = 'bandpass', when = 0, pan = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const src = this.noise(false);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(f).connect(g).connect(p).connect(this.buses.sfx);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  ui(kind: 'click' | 'notify' | 'money' | 'warn' | 'open' | 'close' | 'type') {
    if (!this.ctx) return;
    switch (kind) {
      case 'click':
        this.blip(880, 0.05, 'sine', 0.08);
        break;
      case 'type':
        this.blip(1400 + Math.random() * 300, 0.025, 'square', 0.012);
        break;
      case 'notify':
        this.blip(784, 0.12, 'sine', 0.08);
        this.blip(1175, 0.18, 'sine', 0.07, undefined, 'sfx', 0.09);
        break;
      case 'money':
        this.blip(1318, 0.09, 'triangle', 0.09);
        this.blip(1760, 0.22, 'triangle', 0.08, undefined, 'sfx', 0.07);
        this.blip(2637, 0.18, 'sine', 0.04, undefined, 'sfx', 0.13);
        break;
      case 'warn':
        this.blip(330, 0.18, 'triangle', 0.1);
        this.blip(262, 0.24, 'triangle', 0.1, undefined, 'sfx', 0.14);
        break;
      case 'open':
        this.burst(0.25, 2400, 0.6, 0.05, 'bandpass');
        this.blip(520, 0.12, 'sine', 0.05, 980);
        break;
      case 'close':
        this.blip(900, 0.1, 'sine', 0.05, 480);
        break;
    }
  }

  footstep(run: boolean) {
    this.burst(run ? 0.07 : 0.06, 900 + Math.random() * 600, 1.2, run ? 0.09 : 0.055, 'bandpass', 0, (Math.random() - 0.5) * 0.2);
  }

  carDoor() {
    this.burst(0.12, 300, 1, 0.25, 'lowpass');
    this.blip(90, 0.12, 'sine', 0.2, 50);
  }

  engineStart() {
    if (!this.ctx) return;
    this.burst(0.5, 600, 0.7, 0.12, 'bandpass');
    this.ensureEngine();
  }
  engineStop() {
    if (!this.engineNodes || !this.ctx) return;
    const e = this.engineNodes;
    e.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    e.noiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
  }
  private ensureEngine() {
    if (this.engineNodes || !this.ctx) return;
    const ctx = this.ctx;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 2.5);
    }
    shaper.curve = curve;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const g2 = ctx.createGain();
    g2.gain.value = 0.45;
    o1.connect(shaper);
    o2.connect(g2).connect(shaper);
    shaper.connect(filter).connect(gain).connect(this.buses.sfx);
    const n = this.noise();
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 1200;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    n.connect(nf).connect(noiseGain).connect(this.buses.sfx);
    n.start();
    o1.start();
    o2.start();
    this.engineNodes = { o1, o2, filter, gain, noiseGain };
  }
  engine(rpm: number, throttle: number, speed: number, heavy: boolean) {
    if (!this.ctx) return;
    this.ensureEngine();
    const e = this.engineNodes!;
    const t = this.ctx.currentTime;
    const base = heavy ? 28 : 42;
    const f = base + rpm * (heavy ? 90 : 150);
    e.o1.frequency.setTargetAtTime(f, t, 0.05);
    e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    e.filter.frequency.setTargetAtTime(350 + rpm * 2200 * (0.4 + throttle * 0.6), t, 0.06);
    e.gain.gain.setTargetAtTime(0.05 + throttle * 0.06 + rpm * 0.03, t, 0.08);
    e.noiseGain.gain.setTargetAtTime(Math.min(0.06, speed * 0.0015), t, 0.2);
  }

  horn(on: boolean) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (on && !this.hornNodes) {
      const g = ctx.createGain();
      g.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      const os = [415, 523].map((f) => {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = f;
        o.connect(lp);
        o.start();
        return o;
      });
      lp.connect(g).connect(this.buses.sfx);
      g.gain.setTargetAtTime(0.09, ctx.currentTime, 0.01);
      this.hornNodes = { g, o: os };
    } else if (!on && this.hornNodes) {
      const h = this.hornNodes;
      h.g.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      setTimeout(() => h.o.forEach((o) => o.stop()), 200);
      this.hornNodes = null;
    }
  }

  /** distant traffic horn, panned/attenuated by distance */
  honk(dist: number, pan: number) {
    if (!this.ctx || dist > 90) return;
    const vol = 0.06 * (1 - dist / 90);
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500 - dist * 8;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.setValueAtTime(vol, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    for (const f of [392, 494]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f + Math.random() * 20;
      o.connect(lp);
      o.start(t);
      o.stop(t + 0.55);
    }
    lp.connect(g).connect(p).connect(this.buses.sfx);
  }

  crash(intensity: number) {
    this.burst(0.5 + intensity * 0.4, 1200, 0.5, 0.25 + intensity * 0.35, 'lowpass');
    this.blip(70, 0.35, 'sine', 0.3 * intensity + 0.1, 35);
    this.burst(0.25, 4200, 2, 0.06 * intensity, 'bandpass', 0.05);
  }

  /** air rushing past another car: a falling noise sweep, louder and brighter for closer passes */
  whoosh(tier: number, pan: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.noise(false);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.3;
    f.frequency.setValueAtTime(2400 + tier * 700, t);
    f.frequency.exponentialRampToValueAtTime(420, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14 + tier * 0.07, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
    p.pan.linearRampToValueAtTime(-pan * 0.4, t + 0.5);
    src.connect(f).connect(g).connect(p).connect(this.buses.sfx);
    src.start(t, Math.random());
    src.stop(t + 0.6);
  }

  /** arcade chime that climbs with the combo multiplier */
  combo(level: number) {
    const f = 523 * Math.pow(2, Math.min(level, 10) / 8);
    this.blip(f, 0.12, 'triangle', 0.07);
    this.blip(f * 1.5, 0.18, 'sine', 0.05, undefined, 'sfx', 0.05);
  }

  /** combo banked: bigger banks ring longer */
  bank(size: number) {
    const n = size > 20000 ? 4 : size > 5000 ? 3 : 2;
    for (let i = 0; i < n; i++) this.blip(1047 * Math.pow(1.26, i), 0.22, 'triangle', 0.07, undefined, 'sfx', i * 0.07);
  }

  /** combo lost after a scrape */
  comboLost() {
    this.blip(420, 0.45, 'sawtooth', 0.05, 110);
  }

  countdown(go: boolean) {
    this.blip(go ? 988 : 494, go ? 0.55 : 0.18, 'square', 0.05);
  }

  thunder(delay: number, power: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = this.noise(false);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 2.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5 * power, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
    src.connect(f).connect(g).connect(this.buses.amb);
    src.start(t);
    src.stop(t + 3.8);
  }

  splash() {
    this.burst(0.6, 700, 0.6, 0.3, 'lowpass');
  }

  // ------------------------------------------------------------------ music
  playMusic(kind: 'menu' | 'club' | 'radio' | 'none') {
    if (!this.ctx) return;
    if (this.music?.kind === kind) return;
    if (this.music) {
      const m = this.music;
      m.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
      clearInterval(m.timer);
      setTimeout(() => m.gain.disconnect(), 2500);
      this.music = null;
    }
    if (kind === 'none') return;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(kind === 'menu' ? 0.9 : 0.7, this.ctx.currentTime, 1.2);
    gain.connect(this.buses.music);
    gain.connect(this.reverb);
    const m = { gain, timer: 0, step: 0, kind, nextTime: this.ctx.currentTime + 0.1 };
    this.music = m;
    const lookahead = () => {
      if (!this.ctx || this.music !== m) return;
      while (m.nextTime < this.ctx.currentTime + 0.3) {
        if (kind === 'menu') this.menuStep(m);
        else this.beatStep(m, kind);
      }
    };
    m.timer = window.setInterval(lookahead, 80);
    lookahead();
  }

  private menuStep(m: NonNullable<AudioEngine['music']>) {
    const ctx = this.ctx!;
    // slow evolving pad chords
    const chords = [
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [48, 55, 59, 64],
      [55, 59, 62, 66],
    ];
    const ch = chords[m.step % chords.length];
    const t = m.nextTime;
    const dur = 7.5;
    for (const note of ch) {
      for (const det of [-7, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 440 * Math.pow(2, (note - 69) / 12);
        o.detune.value = det;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(400, t);
        f.frequency.linearRampToValueAtTime(1100, t + dur * 0.5);
        f.frequency.linearRampToValueAtTime(500, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.018, t + 2.2);
        g.gain.linearRampToValueAtTime(0.0, t + dur + 1.5);
        o.connect(f).connect(g).connect(m.gain);
        o.start(t);
        o.stop(t + dur + 1.6);
      }
    }
    // sparse bell melody
    for (let k = 0; k < 3; k++) {
      if (Math.random() < 0.6) {
        const note = ch[Math.floor(Math.random() * ch.length)] + 12;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = 440 * Math.pow(2, (note - 69) / 12);
        const g = ctx.createGain();
        const tt = t + 1 + k * 2.2 + Math.random();
        g.gain.setValueAtTime(0, tt);
        g.gain.linearRampToValueAtTime(0.03, tt + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 2.5);
        o.connect(g).connect(m.gain);
        o.start(tt);
        o.stop(tt + 2.6);
      }
    }
    m.step++;
    m.nextTime += dur;
  }

  private beatStep(m: NonNullable<AudioEngine['music']>, kind: 'club' | 'radio') {
    const ctx = this.ctx!;
    const bpm = kind === 'club' ? 124 : 86;
    const sixteenth = 60 / bpm / 4;
    const t = m.nextTime;
    const s = m.step % 16;
    const bar = Math.floor(m.step / 16) % 4;
    // kick
    if ((kind === 'club' && s % 4 === 0) || (kind === 'radio' && (s === 0 || s === 7 || s === 10))) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      g.gain.setValueAtTime(kind === 'club' ? 0.5 : 0.35, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(m.gain);
      o.start(t);
      o.stop(t + 0.32);
    }
    // snare / clap
    if (s === 4 || s === 12) {
      const src = this.noise(false);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = kind === 'club' ? 1800 : 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      src.connect(f).connect(g).connect(m.gain);
      src.start(t, Math.random());
      src.stop(t + 0.2);
    }
    // hats
    if (s % 2 === 1 || kind === 'radio') {
      const src = this.noise(false);
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(kind === 'club' ? 0.06 : 0.03, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(f).connect(g).connect(m.gain);
      src.start(t, Math.random());
      src.stop(t + 0.07);
    }
    // bass
    const roots = kind === 'club' ? [45, 45, 48, 43] : [41, 45, 43, 40];
    if ((kind === 'club' && s % 4 === 2) || (kind === 'radio' && (s === 0 || s === 8 || s === 11))) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 440 * Math.pow(2, (roots[bar] - 69) / 12);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = kind === 'club' ? 500 : 350;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + sixteenth * 2.5);
      o.connect(f).connect(g).connect(m.gain);
      o.start(t);
      o.stop(t + sixteenth * 3);
    }
    // chord stab / keys
    if (kind === 'radio' && (s === 0 || s === 8)) {
      for (const iv of [12, 15, 19, 22]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = 440 * Math.pow(2, (roots[bar] + iv - 69) / 12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.025, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + sixteenth * 7);
        o.connect(g).connect(m.gain);
        o.start(t);
        o.stop(t + sixteenth * 8);
      }
    }
    m.step++;
    m.nextTime += sixteenth;
  }
}
