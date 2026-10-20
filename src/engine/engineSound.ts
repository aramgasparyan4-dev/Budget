// Car sounds made from scratch with Web Audio: an engine for each kind of car, an electric motor,
// and road and wind noise. No recordings.
//
// A combustion engine is a periodic wave whose fundamental is the camshaft frequency (rpm / 120),
// so every firing pattern fits as whole harmonics: a four fires 4 times per cycle, a V8 8 times,
// and the uneven ones (a crossplane V8's burble, a three's thrum) get the in-between harmonics.
// Small speakers cannot play those low notes, so a band of noise pulsed at the firing rate gives
// the engine its bark. Throttle opens the "muffler" filter and drives a soft clipper. Diesels add
// a clatter, turbos a whistle and a blow-off, sporty ones crackle when you lift off.
//
// An electric car has none of that: two high, clean tones that rise with road speed (the motor and
// its inverter), a faint hum when stopped, and the same road and wind noise as everyone.

export interface EngineProfile {
  kind: 'combustion' | 'electric';
  /** firing pulses per engine cycle (= cylinders) */
  cylinders: number;
  idle: number;
  redline: number;
  /** harmonic amplitudes by multiple of the camshaft frequency (index 0 unused) */
  harmonics: number[];
  /** muffler cutoff at idle and with full throttle at the redline (Hz) */
  cutIdle: number;
  cutMax: number;
  /** body resonance (Hz) */
  body: number;
  /** pulsed-noise bark: centre (Hz) and level */
  barkHz: number;
  bark: number;
  /** overall level */
  level: number;
  /** lumpy idle (old engines) */
  rough: number;
  turbo: number;
  pops: number;
  clatter: number;
}

/** harmonics: the firing harmonic and its multiples, plus extra orders for uneven engines */
function wave(cyl: number, extra: Record<number, number>, tilt = 0.75, n = 64) {
  const h = new Array(n).fill(0);
  for (let k = cyl; k < n; k += cyl) h[k] = 1 / Math.pow(k / cyl, tilt);
  for (const [k, a] of Object.entries(extra)) for (let m = Number(k); m < n; m += cyl) if (!h[m] || m === Number(k)) h[m] = Math.max(h[m], a / Math.pow(m / Number(k), tilt));
  return h;
}

const base = (o: Partial<EngineProfile>): EngineProfile => ({
  kind: 'combustion',
  cylinders: 4,
  idle: 800,
  redline: 6500,
  harmonics: wave(4, { 2: 0.18 }),
  cutIdle: 420,
  cutMax: 2600,
  body: 160,
  barkHz: 900,
  bark: 0.5,
  level: 1,
  rough: 0,
  turbo: 0,
  pops: 0,
  clatter: 0,
  ...o,
});

/** by body model (VEHICLES[i].model ?? key) */
export const ENGINES: Record<string, EngineProfile> = {
  // a three-cylinder city car: thrummy, light, busy
  compact: base({ cylinders: 3, idle: 900, redline: 6400, harmonics: wave(3, { 1: 0.32, 2: 0.22 }, 0.7), cutIdle: 480, cutMax: 2400, body: 190, barkHz: 1100, bark: 0.55, level: 0.8 }),
  // a smooth four
  sedan: base({ idle: 750, redline: 6200, harmonics: wave(4, { 2: 0.12 }, 0.85), cutIdle: 380, cutMax: 2100, body: 150, bark: 0.35, level: 0.85 }),
  // a turbo V6: deep, even, a turbo you can hear
  exec: base({ cylinders: 6, idle: 700, redline: 6800, harmonics: wave(6, { 3: 0.28 }, 0.8), cutIdle: 360, cutMax: 2300, body: 130, barkHz: 800, bark: 0.4, turbo: 0.6, level: 0.95 }),
  // a crossplane V8: burble at idle, howl at the top, crackle on the overrun
  sports: base({ cylinders: 8, idle: 850, redline: 7600, harmonics: wave(8, { 4: 0.55, 2: 0.3, 1: 0.12, 6: 0.2 }, 0.65), cutIdle: 420, cutMax: 3600, body: 120, barkHz: 750, bark: 0.75, pops: 1, level: 1.1 }),
  // a turbo four tuned loud: rasp, whistle, blow-off and pops
  hatch: base({ idle: 900, redline: 7000, harmonics: wave(4, { 2: 0.28, 1: 0.1 }, 0.6), cutIdle: 520, cutMax: 3800, body: 210, barkHz: 1300, bark: 0.8, turbo: 1, pops: 0.7, level: 1 }),
  // the crossover's four: plain, a little gruff
  suv: base({ idle: 750, redline: 6000, harmonics: wave(4, { 2: 0.2 }, 0.8), cutIdle: 380, cutMax: 2200, body: 140, bark: 0.45, level: 0.9 }),
  // a big turbo-diesel six: low, clattery, runs out of revs early
  offroad: base({ cylinders: 6, idle: 650, redline: 4300, harmonics: wave(6, { 3: 0.25 }, 1.0), cutIdle: 300, cutMax: 1500, body: 95, barkHz: 650, bark: 0.6, clatter: 1, turbo: 0.45, level: 1.05 }),
  // a four-cylinder diesel
  pickup: base({ idle: 700, redline: 4400, harmonics: wave(4, { 2: 0.25 }, 1.0), cutIdle: 320, cutMax: 1600, body: 110, barkHz: 700, bark: 0.55, clatter: 0.8, turbo: 0.3, level: 1 }),
  // an old carburettor four: lumpy, raw, the odd backfire
  classic: base({ idle: 800, redline: 5600, harmonics: wave(4, { 2: 0.38, 1: 0.18 }, 0.7), cutIdle: 460, cutMax: 2600, body: 170, barkHz: 1000, bark: 0.7, rough: 1, pops: 0.35, level: 0.95 }),
  ev: base({ kind: 'electric', level: 1 }),
  // traffic bodies, should one ever be driven
  van: base({ idle: 700, redline: 4500, harmonics: wave(4, { 2: 0.25 }, 1.0), cutIdle: 320, cutMax: 1600, body: 110, clatter: 0.7, level: 1 }),
  truck: base({ cylinders: 6, idle: 600, redline: 3200, harmonics: wave(6, { 3: 0.3 }, 1.0), cutIdle: 260, cutMax: 1200, body: 80, barkHz: 550, clatter: 1, turbo: 0.5, level: 1.1 }),
  bus: base({ cylinders: 6, idle: 600, redline: 3000, harmonics: wave(6, { 3: 0.3 }, 1.0), cutIdle: 240, cutMax: 1100, body: 75, barkHz: 500, clatter: 0.9, level: 1.1 }),
};

export function engineFor(spec: { model?: string; key: string }): EngineProfile {
  return ENGINES[spec.model ?? spec.key] ?? ENGINES[spec.key.replace(/^g_/, '')] ?? ENGINES.sedan;
}

/** what the sound follows: normalised revs (0.18 idle .. 1 redline, a little over on boost), throttle 0-1, speed m/s */
export interface EngineState {
  rpm: number;
  throttle: number;
  speed: number;
  boost?: boolean;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export class EngineSound {
  readonly out: GainNode;
  private nodes: AudioScheduledSourceNode[] = [];
  private p: EngineProfile;
  // combustion
  private cam?: OscillatorNode;
  private fire?: OscillatorNode;
  private toneGain?: GainNode;
  private barkFilter?: BiquadFilterNode;
  private barkGain?: GainNode;
  private drive?: GainNode;
  private muffler?: BiquadFilterNode;
  private engGain?: GainNode;
  private turbo?: OscillatorNode;
  private turboGain?: GainNode;
  private clatterGain?: GainNode;
  // electric
  private motor?: OscillatorNode;
  private inverter?: OscillatorNode;
  private hum?: OscillatorNode;
  private motorGain?: GainNode;
  private inverterGain?: GainNode;
  // everyone
  private roadGain: GainNode;
  private windGain: GainNode;
  private last: EngineState = { rpm: 0.18, throttle: 0, speed: 0 };
  private popT = 0;

  constructor(
    private ctx: AudioContext,
    private dest: AudioNode,
    private noiseBuf: AudioBuffer,
    profile: EngineProfile,
  ) {
    this.p = profile;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
    if (profile.kind === 'electric') this.buildElectric();
    else this.buildCombustion();
    // tyres on the road and the air going past
    this.roadGain = ctx.createGain();
    this.roadGain.gain.value = 0;
    this.noiseThrough([this.filter('lowpass', 320, 0.7)], this.roadGain);
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.noiseThrough([this.filter('bandpass', 750, 0.5)], this.windGain);
    this.roadGain.connect(this.out);
    this.windGain.connect(this.out);
  }

  get profile() {
    return this.p;
  }

  private filter(type: BiquadFilterType, f: number, q = 0.7, gain = 0) {
    const n = this.ctx.createBiquadFilter();
    n.type = type;
    n.frequency.value = f;
    n.Q.value = q;
    n.gain.value = gain;
    return n;
  }

  private noiseThrough(chain: AudioNode[], end: AudioNode) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    let n: AudioNode = src;
    for (const c of chain) n = n.connect(c);
    n.connect(end);
    src.start(0, Math.random() * 1.5);
    this.nodes.push(src);
    return src;
  }

  private buildCombustion() {
    const ctx = this.ctx;
    const p = this.p;
    const n = p.harmonics.length;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    p.harmonics.forEach((a, i) => (imag[i] = i ? a : 0));
    const cam = ctx.createOscillator();
    cam.setPeriodicWave(ctx.createPeriodicWave(real, imag));
    this.toneGain = ctx.createGain();
    this.toneGain.gain.value = 0.7;
    cam.connect(this.toneGain);
    // the bark: noise pulsed at the firing rate (gain swings 0..1 with each firing)
    const fire = ctx.createOscillator();
    const pr = new Float32Array(16);
    const pi = new Float32Array(16);
    for (let k = 1; k < 16; k++) pr[k] = 1 / k; // a sharp pulse
    fire.setPeriodicWave(ctx.createPeriodicWave(pr, pi));
    const am = ctx.createGain();
    am.gain.value = 0.45;
    const depth = ctx.createGain();
    depth.gain.value = 0.45;
    fire.connect(depth).connect(am.gain);
    this.barkFilter = this.filter('bandpass', p.barkHz, 1.1);
    this.barkGain = ctx.createGain();
    this.barkGain.gain.value = 0;
    this.noiseThrough([this.barkFilter, am], this.barkGain);
    // drive -> soft clip -> body -> muffler
    this.drive = ctx.createGain();
    this.drive.gain.value = 1;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.8) / Math.tanh(1.8);
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    const body = this.filter('peaking', p.body, 1.4, 7);
    const presence = this.filter('peaking', p.barkHz * 1.6, 0.9, 3);
    this.muffler = this.filter('lowpass', p.cutIdle, 0.9);
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.toneGain.connect(this.drive);
    this.barkGain.connect(this.drive);
    this.drive.connect(shaper).connect(body).connect(presence).connect(this.muffler).connect(this.engGain).connect(this.out);
    // a turbo's whistle, after the muffler
    if (p.turbo > 0) {
      this.turbo = ctx.createOscillator();
      this.turbo.type = 'sine';
      this.turbo.frequency.value = 2500;
      this.turboGain = ctx.createGain();
      this.turboGain.gain.value = 0;
      this.turbo.connect(this.turboGain).connect(this.out);
      this.nodes.push(this.turbo);
    }
    // a diesel's clatter: bright ticks on every firing, loudest at idle
    if (p.clatter > 0) {
      const tick = ctx.createGain();
      tick.gain.value = 0;
      const tickDepth = ctx.createGain();
      tickDepth.gain.value = 1;
      fire.connect(tickDepth).connect(tick.gain);
      this.clatterGain = ctx.createGain();
      this.clatterGain.gain.value = 0;
      this.noiseThrough([this.filter('bandpass', 2600, 2.2), tick], this.clatterGain);
      this.clatterGain.connect(this.out);
    }
    cam.start();
    fire.start();
    this.cam = cam;
    this.fire = fire;
    this.nodes.push(cam, fire);
  }

  private buildElectric() {
    const ctx = this.ctx;
    const mk = (type: OscillatorType) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.start();
      this.nodes.push(o);
      return o;
    };
    this.motor = mk('sine');
    this.inverter = mk('sine');
    this.hum = mk('triangle');
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    this.inverterGain = ctx.createGain();
    this.inverterGain.gain.value = 0;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.006;
    const soft = this.filter('lowpass', 5200, 0.6);
    this.motor.connect(this.motorGain).connect(soft);
    this.inverter.connect(this.inverterGain).connect(soft);
    this.hum.connect(humGain).connect(soft);
    soft.connect(this.out);
  }

  /** follow the car: `at` schedules (for the start-up sequence), otherwise it glides there now */
  set(s: EngineState, at?: number, jump = false) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const p = this.p;
    const go = (param: AudioParam, v: number, tau = 0.05) => {
      if (at === undefined) param.setTargetAtTime(v, now, tau);
      else if (jump) param.setValueAtTime(v, at);
      else param.linearRampToValueAtTime(v, at);
    };
    const speed = Math.max(0, s.speed);
    const sp = Math.min(1, speed / 60);
    go(this.roadGain.gain, 0.05 * Math.min(1, speed / 8) * (0.4 + sp), 0.15);
    go(this.windGain.gain, 0.06 * sp * sp, 0.2);
    if (p.kind === 'electric') {
      const f = 210 + speed * 36;
      go(this.motor!.frequency, f, 0.04);
      go(this.inverter!.frequency, f * 2.93, 0.04);
      go(this.hum!.frequency, 100 + speed * 2, 0.1);
      const move = Math.min(1, speed / 2.5);
      const load = s.throttle > 0 ? 0.55 + 0.45 * s.throttle : 0.35; // regen when coasting
      go(this.motorGain!.gain, 0.05 * move * load * (s.boost ? 1.3 : 1), 0.06);
      go(this.inverterGain!.gain, 0.012 * move * load, 0.06);
      go(this.out.gain, p.level, 0.1);
      this.last = s;
      return;
    }
    const x = clamp((s.rpm - 0.18) / 0.82, 0, 1.25);
    const rpm = p.idle + x * (p.redline - p.idle);
    const cam = rpm / 120;
    // an old engine hunts at idle
    const lump = p.rough ? 1 + (Math.random() - 0.5) * 0.06 * p.rough * (1 - Math.min(1, x * 3)) : 1;
    go(this.cam!.frequency, cam * lump, 0.03);
    go(this.fire!.frequency, cam * p.cylinders * lump, 0.03);
    const thr = clamp(s.throttle, 0, 1);
    const load = 0.5 + 0.5 * thr;
    go(this.muffler!.frequency, p.cutIdle + (p.cutMax - p.cutIdle) * Math.min(1, x * 0.85 + thr * 0.25) * (0.55 + 0.45 * thr), 0.05);
    go(this.barkFilter!.frequency, p.barkHz * (0.8 + x * 0.9), 0.05);
    go(this.barkGain!.gain, p.bark * (0.25 + 0.75 * thr) * (0.5 + 0.5 * x), 0.05);
    go(this.drive!.gain, 0.8 + thr * 1.4, 0.05);
    go(this.engGain!.gain, 0.085 * load * (0.75 + 0.35 * x), 0.06);
    go(this.out.gain, p.level, 0.1);
    if (this.turbo) {
      go(this.turbo.frequency, 2200 + x * 3800 + (s.boost ? 900 : 0), 0.25);
      go(this.turboGain!.gain, 0.008 * p.turbo * thr * x * x * (s.boost ? 1.8 : 1), 0.35);
    }
    if (this.clatterGain) go(this.clatterGain.gain, 0.035 * p.clatter * (1 - 0.6 * x) * (0.6 + 0.4 * thr), 0.08);
    // lifting off high in the revs: a turbo dumps its pressure, a sporty exhaust crackles
    if (at === undefined) {
      const lifted = this.last.throttle > 0.6 && thr < 0.1 && x > 0.5;
      if (lifted && p.turbo > 0.4) this.blowOff();
      if (lifted && p.pops > 0) this.popT = 0.35 + 0.5 * p.pops;
      if (this.popT > 0) {
        this.popT -= 1 / 60;
        if (Math.random() < 0.22 * p.pops) this.pop();
      }
    }
    this.last = s;
  }

  private burst(dur: number, filter: BiquadFilterNode, vol: number, when = 0) {
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }

  private blowOff() {
    this.burst(0.45, this.filter('highpass', 1800, 0.8), 0.05 * this.p.turbo);
  }

  private pop() {
    this.burst(0.05 + Math.random() * 0.05, this.filter('lowpass', 500 + Math.random() * 900, 1.5), 0.12 + Math.random() * 0.1);
  }

  /** fade out and free everything */
  stop(fade = 0.2) {
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0, t, fade / 3);
    for (const n of this.nodes) {
      try {
        n.stop(t + fade + 0.1);
      } catch {
        /* already stopped */
      }
    }
    setTimeout(() => this.out.disconnect(), (fade + 0.3) * 1000);
  }

  /**
   * Getting in and starting it, for the garage: the starter cranks, it catches and settles, then a
   * blip of the throttle. An electric car just wakes up with a rising whine. Returns its length.
   */
  startUp(): number {
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.25;
    const idle: EngineState = { rpm: 0.18, throttle: 0, speed: 0 };
    if (this.p.kind === 'electric') {
      // wake chime, then the motor spins up and settles as if rolling off
      for (const [f, dt] of [
        [659, 0],
        [988, 0.12],
      ] as const) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t + dt);
        g.gain.linearRampToValueAtTime(0.05, t + dt + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.6);
        o.connect(g).connect(this.out);
        o.start(t + dt);
        o.stop(t + dt + 0.7);
      }
      this.out.gain.setValueAtTime(this.p.level, t);
      this.set({ rpm: 0.18, throttle: 0, speed: 0 }, t + 0.3, true);
      this.set({ rpm: 0.18, throttle: 1, speed: 12 }, t + 0.9);
      this.set({ rpm: 0.18, throttle: 0.2, speed: 4 }, t + 1.5);
      this.set({ rpm: 0.18, throttle: 0, speed: 0 }, t + 1.9);
      return 2.1;
    }
    // the starter: a fast chugging whirr
    const crank = 0.55 + Math.random() * 0.15;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const bp = this.filter('bandpass', 700, 1.2);
    const chug = ctx.createGain();
    chug.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.type = 'sawtooth';
    lfo.frequency.value = 11;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain).connect(chug.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.05);
    env.gain.setValueAtTime(1, t + crank - 0.05);
    env.gain.linearRampToValueAtTime(0, t + crank + 0.05);
    // straight out: the engine itself is silent until it catches
    src.connect(bp).connect(chug).connect(env).connect(this.dest);
    src.start(t, Math.random());
    lfo.start(t);
    src.stop(t + crank + 0.1);
    lfo.stop(t + crank + 0.1);
    // it catches, flares and settles; then a blip
    const c = t + crank;
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.setValueAtTime(0, c - 0.02);
    this.out.gain.linearRampToValueAtTime(this.p.level, c + 0.04);
    this.set(idle, c, true);
    this.set({ rpm: 0.5, throttle: 0.4, speed: 0 }, c + 0.18);
    this.set({ rpm: 0.24, throttle: 0, speed: 0 }, c + 0.7);
    this.set(idle, c + 1.1);
    this.set({ rpm: 0.72, throttle: 1, speed: 0 }, c + 1.32);
    this.set({ rpm: 0.2, throttle: 0, speed: 0 }, c + 1.75);
    this.set(idle, c + 2.1);
    return crank + 2.3;
  }
}
