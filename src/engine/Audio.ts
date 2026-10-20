// Fully procedural Web Audio: no audio assets. The car (engine, motor, road, wind) is in
// engineSound.ts and the background music in music.ts; this file owns the context, the mix and
// the short one-off sounds (near misses, combos, crashes, interface).
import { EngineSound, type EngineProfile, type EngineState } from './engineSound';
import { Music, type MusicStyle } from './music';

type Bus = 'music' | 'sfx';
export type UiSound = 'click' | 'select' | 'buy' | 'error';

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses!: Record<Bus, GainNode>;
  private noiseBuf!: AudioBuffer;
  private reverb!: ConvolverNode;
  private skidNodes: { gain: GainNode; f1: BiquadFilterNode; f2: BiquadFilterNode } | null = null;
  private car: EngineSound | null = null;
  private carProfile: EngineProfile | null = null;
  private music: Music | null = null;
  private wantMusic: MusicStyle | null = null;
  private musicLevel = 1;
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
    // a limiter at the end so stacked sounds never clip
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    limiter.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(limiter);
    this.buses = { music: ctx.createGain(), sfx: ctx.createGain() };
    for (const b of Object.values(this.buses)) b.connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // a soft room for the music
    this.reverb = ctx.createConvolver();
    const ir = ctx.createBuffer(2, ctx.sampleRate * 2.2, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 3);
    }
    this.reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    this.reverb.connect(wet).connect(this.buses.music);
    this.music = new Music(ctx, this.buses.music, this.reverb, this.noiseBuf);
    this.setVolumes(this.vol);
    this.ready = true;
    if (this.wantMusic) this.music.play(this.wantMusic);
  }

  setVolumes(v: { master: number; music: number; sfx: number; ambience: number }) {
    this.vol = { ...v };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(v.master, t, 0.05);
    this.buses.music.gain.setTargetAtTime(v.music * 0.45, t, 0.05);
    this.buses.sfx.gain.setTargetAtTime(v.sfx, t, 0.05);
  }

  private noise(loop = true) {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = loop;
    src.loopStart = Math.random();
    return src;
  }

  // ------------------------------------------------------------------ music
  /** the style for what is on screen (null: none); cheap to call every frame */
  setMusic(style: MusicStyle | null, level = 1) {
    this.wantMusic = style;
    this.music?.play(style);
    if (level !== this.musicLevel) {
      this.musicLevel = level;
      this.music?.setLevel(level);
    }
  }

  // ------------------------------------------------------------------ the car
  /** the engine of the car about to be driven */
  setCar(profile: EngineProfile) {
    if (this.carProfile === profile) return;
    this.engineStop();
    this.carProfile = profile;
  }

  engineStart() {
    if (!this.ctx || !this.carProfile) return;
    this.car?.stop(0.1);
    this.car = new EngineSound(this.ctx, this.buses.sfx, this.noiseBuf, this.carProfile);
    this.car.set({ rpm: 0.18, throttle: 0, speed: 0 });
  }

  engineStop() {
    this.car?.stop(0.25);
    this.car = null;
  }

  /** every frame while driving */
  engine(s: EngineState) {
    this.car?.set(s);
  }

  /** a car picked in the garage: the door, then it starts up (an electric car wakes up instead) */
  pick(profile: EngineProfile) {
    if (!this.ctx) return;
    this.carDoor();
    const e = new EngineSound(this.ctx, this.buses.sfx, this.noiseBuf, profile);
    const len = e.startUp();
    setTimeout(() => e.stop(0.5), len * 1000);
  }

  private carDoor() {
    this.burst(0.09, 260, 0.9, 0.3, 'lowpass');
    this.blip(85, 0.12, 'sine', 0.22, 48);
    this.burst(0.05, 2400, 1, 0.04, 'bandpass', 0.07);
  }

  // ------------------------------------------------------------------ one-offs
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

  /** interface: a soft tick for buttons, a two-note lift for picking, a till for buying */
  ui(kind: UiSound) {
    if (!this.ctx) return;
    switch (kind) {
      case 'click':
        this.blip(1500, 0.035, 'sine', 0.035);
        this.burst(0.012, 4200, 1.2, 0.02, 'bandpass');
        break;
      case 'select':
        this.blip(880, 0.08, 'sine', 0.04);
        this.blip(1319, 0.14, 'sine', 0.035, undefined, 'sfx', 0.06);
        break;
      case 'buy':
        this.blip(1319, 0.08, 'triangle', 0.05);
        this.blip(1760, 0.2, 'triangle', 0.05, undefined, 'sfx', 0.07);
        this.blip(2637, 0.16, 'sine', 0.02, undefined, 'sfx', 0.12);
        break;
      case 'error':
        this.blip(300, 0.16, 'triangle', 0.06);
        this.blip(240, 0.22, 'triangle', 0.06, undefined, 'sfx', 0.12);
        break;
    }
  }

  crash(intensity: number) {
    const i = Math.min(1, intensity);
    // the thump, the crunch of panels and a tinkle of glass
    this.blip(70, 0.35, 'sine', 0.35 * i + 0.1, 32);
    this.burst(0.35 + i * 0.35, 900, 0.6, 0.22 + i * 0.3, 'lowpass');
    this.burst(0.18 + i * 0.12, 2200, 1.4, 0.08 + 0.1 * i, 'bandpass', 0.02);
    for (let k = 0; k < 3 + Math.round(i * 4); k++) this.blip(3000 + Math.random() * 2500, 0.06 + Math.random() * 0.08, 'triangle', 0.012 * i, undefined, 'sfx', 0.05 + Math.random() * 0.25);
  }

  /** tire squeal while sliding: two resonant noise bands, intensity 0..1 */
  skid(intensity: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.skidNodes) {
      if (intensity <= 0.01) return;
      const src = this.noise(true);
      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.Q.value = 9;
      f1.frequency.value = 1350;
      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.Q.value = 12;
      f2.frequency.value = 2250;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(f1).connect(gain);
      src.connect(f2).connect(gain);
      gain.connect(this.buses.sfx);
      src.start();
      this.skidNodes = { gain, f1, f2 };
    }
    const n = this.skidNodes;
    const t = ctx.currentTime;
    const wobble = 1 + Math.sin(t * 23) * 0.03;
    n.gain.gain.setTargetAtTime(Math.min(1, intensity) * 0.32, t, 0.05);
    n.f1.frequency.setTargetAtTime((1200 + intensity * 400) * wobble, t, 0.05);
    n.f2.frequency.setTargetAtTime((2050 + intensity * 500) * wobble, t, 0.05);
  }

  /** air rushing past another car: a falling noise sweep, louder and brighter for closer passes */
  whoosh(tier: number, pan: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.noise(false);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.1;
    f.frequency.setValueAtTime(1800 + tier * 600, t);
    f.frequency.exponentialRampToValueAtTime(380, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1 + tier * 0.05, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
    p.pan.linearRampToValueAtTime(-pan * 0.4, t + 0.45);
    src.connect(f).connect(g).connect(p).connect(this.buses.sfx);
    src.start(t, Math.random());
    src.stop(t + 0.55);
  }

  /** a bright two-note chime that climbs with the combo multiplier (notes of a major scale) */
  combo(level: number) {
    const scale = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17];
    const n = 72 + scale[Math.min(level, scale.length - 1)];
    const f = 440 * Math.pow(2, (n - 69) / 12);
    this.blip(f, 0.1, 'triangle', 0.045);
    this.blip(f * 2, 0.16, 'sine', 0.025, undefined, 'sfx', 0.04);
  }

  /** combo banked: an arpeggio, longer for bigger banks */
  bank(size: number) {
    const n = size > 20000 ? 4 : size > 5000 ? 3 : 2;
    const notes = [1047, 1319, 1568, 2093];
    for (let i = 0; i < n; i++) this.blip(notes[i], 0.2, 'triangle', 0.05, undefined, 'sfx', i * 0.065);
  }

  /** combo lost after a scrape */
  comboLost() {
    this.blip(392, 0.14, 'triangle', 0.05);
    this.blip(311, 0.26, 'triangle', 0.05, undefined, 'sfx', 0.11);
  }

  countdown(go: boolean) {
    this.blip(go ? 1047 : 523, go ? 0.5 : 0.14, 'triangle', 0.07);
    if (go) this.blip(1568, 0.45, 'sine', 0.03, undefined, 'sfx', 0.02);
  }
}
