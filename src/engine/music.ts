// Background music, made in code: a small step sequencer that schedules notes a little ahead of
// time (so timing stays tight however busy the page is), with a handful of synth instruments.
//
//  - garage: a slow, warm lo-fi groove (electric piano on a I-vi-ii-V in F, soft drums, round bass)
//  - drive:  driving synthwave in A minor at 118 BPM (four on the floor, pumping pads, octave
//            bass, an arpeggio and a lead that come and go so the loop never sits still)
//
// Sections change every 8 bars; the two styles cross-fade when you go from the garage to the road.

export type MusicStyle = 'garage' | 'drive';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface Song {
  bpm: number;
  swing: number; // 0.5 straight, ~0.6 lazy
  chords: number[][]; // one per bar, MIDI notes
  bass: number[]; // root per bar
  bar: (m: Music, bar: number, t: number, step: number) => void;
}

// F major lo-fi: Fmaj7 - Dm9 - Gm7 - C9
const GARAGE: Song = {
  bpm: 84,
  swing: 0.6,
  chords: [
    [53, 57, 60, 64],
    [50, 53, 57, 60, 64],
    [55, 58, 62, 65],
    [52, 55, 58, 62],
  ],
  bass: [41, 38, 43, 36],
  bar: (m, bar, t, sixteenth) => {
    const s = sixteenth;
    const c = GARAGE.chords[bar % 4];
    const section = Math.floor(bar / 8) % 3; // 0 sparse, 1 full, 2 full with melody
    // keys: the chord on 1, a softer stab on the "and" of 2
    for (let i = 0; i < 16; i++) {
      const at = t + m.stepTime(i, GARAGE);
      if (i === 0) c.forEach((n, k) => m.keys(at + k * 0.012, n, s * 7, 0.055));
      if (i === 6 && section > 0) c.slice(1).forEach((n, k) => m.keys(at + k * 0.01, n + 12, s * 3, 0.03));
      if (i === 0 || i === 10) m.bass(at, GARAGE.bass[bar % 4] + (i === 10 ? 12 : 0), s * (i === 0 ? 5 : 3), 0.15, 260);
      if (i === 0 || i === 7 || (i === 10 && section > 0)) m.kick(at, 0.32, 0.6);
      if (i === 4 || i === 12) m.snare(at, 0.07, true);
      if (i % 2 === 0) m.hat(at, i % 4 === 2 ? 0.022 : 0.012, false);
    }
    if (section === 2) {
      // a lazy melody over the top, one phrase per two bars
      const tune = bar % 2 === 0 ? [72, 69, 67, 65] : [64, 65, 67, 69];
      tune.forEach((n, k) => m.lead(t + m.stepTime(2 + k * 3, GARAGE), n, s * 2.4, 0.03, true));
    }
  },
};

// A minor synthwave: Am - F - C - G
const DRIVE: Song = {
  bpm: 118,
  swing: 0.5,
  chords: [
    [57, 60, 64],
    [57, 60, 65],
    [55, 60, 64],
    [55, 59, 62],
  ],
  bass: [33, 29, 36, 31],
  bar: (m, bar, t, s) => {
    const c = DRIVE.chords[bar % 4];
    const root = DRIVE.bass[bar % 4];
    const section = Math.floor(bar / 8) % 4; // build, full, breakdown, peak
    const drums = section !== 2;
    const fill = bar % 8 === 7;
    m.pad(t, c, s * 16, section === 2 ? 0.03 : 0.022);
    for (let i = 0; i < 16; i++) {
      const at = t + m.stepTime(i, DRIVE);
      if (drums && i % 4 === 0) {
        m.kick(at, 0.5, 1);
        m.duck(at);
      }
      if (drums && (i === 4 || i === 12)) m.snare(at, section === 0 ? 0.08 : 0.12, false);
      if (drums && fill && i >= 12) m.snare(at, 0.05 + (i - 12) * 0.015, false);
      if (drums && i % 4 === 2) m.hat(at, 0.03, true);
      if (section > 0 && i % 2 === 1) m.hat(at, 0.01, false);
      // octave bass on every eighth
      if (i % 2 === 0) m.bass(at, root + (i % 4 === 2 ? 12 : 0), s * 1.6, section === 2 ? 0.07 : 0.13, 520);
      // arpeggio up through the chord
      if (section === 1 || section === 3 || (section === 2 && bar % 2 === 1)) {
        const arp = [c[0], c[1], c[2], c[1] + 12, c[2] + 12, c[0] + 12, c[2], c[1]];
        m.pluck(at, arp[i % 8] + 12, s * 0.9, 0.028);
      }
    }
    if (section === 3) {
      // the hook: two bars call, two bars answer
      const hook = [
        [76, 0, 3],
        [74, 3, 1],
        [72, 4, 4],
        [69, 8, 6],
        [72, 14, 2],
      ];
      const answer = [
        [71, 0, 3],
        [72, 3, 1],
        [74, 4, 4],
        [76, 8, 6],
        [74, 14, 2],
      ];
      for (const [n, at, len] of bar % 4 < 2 ? hook : answer) m.lead(t + m.stepTime(at, DRIVE), n, s * len, 0.032, false);
    }
  },
};

const SONGS: Record<MusicStyle, Song> = { garage: GARAGE, drive: DRIVE };

export class Music {
  private style: MusicStyle | null = null;
  private song: Song | null = null;
  private bus: GainNode | null = null;
  private padBus: GainNode | null = null;
  private timer = 0;
  private bar = 0;
  private nextBar = 0;
  private pauseLevel = 1;

  constructor(
    private ctx: AudioContext,
    private out: AudioNode,
    private reverb: AudioNode,
    private noiseBuf: AudioBuffer,
  ) {}

  /** a sixteenth note in seconds */
  private get s() {
    return 60 / (this.song!.bpm * 4);
  }

  stepTime(i: number, song: Song) {
    const s = 60 / (song.bpm * 4);
    // swing pushes the off-beat sixteenths late
    const pair = Math.floor(i / 2);
    return pair * 2 * s + (i % 2 ? 2 * s * song.swing : 0);
  }

  play(style: MusicStyle | null) {
    if (style === this.style) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // fade the old one out
    if (this.bus) {
      const old = this.bus;
      old.gain.cancelScheduledValues(t);
      old.gain.setTargetAtTime(0, t, 0.5);
      setTimeout(() => old.disconnect(), 3000);
    }
    clearInterval(this.timer);
    this.style = style;
    this.song = style ? SONGS[style] : null;
    this.bus = null;
    if (!style) return;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, t);
    bus.gain.linearRampToValueAtTime(this.pauseLevel, t + 1.5);
    bus.connect(this.out);
    this.bus = bus;
    this.padBus = ctx.createGain();
    this.padBus.connect(bus);
    this.bar = 0;
    this.nextBar = t + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 50);
    this.schedule();
  }

  /** quieter while paused or on the results */
  setLevel(level: number) {
    this.pauseLevel = level;
    if (this.bus) this.bus.gain.setTargetAtTime(level, this.ctx.currentTime, 0.3);
  }

  private schedule() {
    const song = this.song;
    if (!song || !this.bus) return;
    const ahead = this.ctx.currentTime + 0.4;
    while (this.nextBar < ahead) {
      song.bar(this, this.bar, this.nextBar, this.s);
      this.nextBar += this.s * 16;
      this.bar++;
    }
  }

  stop() {
    this.play(null);
  }

  // ------------------------------------------------------------------ instruments
  private env(g: GainNode, t: number, peak: number, attack: number, dur: number, release = 0.08) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(peak * 0.7, t + attack, dur * 0.4);
    g.gain.setTargetAtTime(0, t + dur, release);
  }

  private osc(type: OscillatorType, f: number, t: number, end: number, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    o.start(t);
    o.stop(end);
    return o;
  }

  private send(node: AudioNode, wet: number) {
    if (!this.bus) return;
    node.connect(this.bus);
    if (wet > 0) {
      const g = this.ctx.createGain();
      g.gain.value = wet;
      node.connect(g).connect(this.reverb);
    }
  }

  kick(t: number, vol: number, punch: number) {
    const ctx = this.ctx;
    const o = this.osc('sine', 150, t, t + 0.5);
    o.frequency.setValueAtTime(140 + 30 * punch, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    o.connect(g);
    this.send(g, 0);
  }

  snare(t: number, vol: number, soft: boolean) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = soft ? 1400 : 1900;
    f.Q.value = soft ? 1.4 : 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (soft ? 0.12 : 0.2));
    src.connect(f).connect(g);
    src.start(t, Math.random());
    src.stop(t + 0.3);
    const body = this.osc('triangle', soft ? 330 : 190, t, t + 0.15);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(vol * 0.7, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    body.connect(bg);
    this.send(g, 0.25);
    this.send(bg, 0.1);
  }

  hat(t: number, vol: number, open: boolean) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + (open ? 0.22 : 0.045));
    src.connect(f).connect(g);
    src.start(t, Math.random());
    src.stop(t + 0.3);
    this.send(g, 0.08);
  }

  bass(t: number, note: number, dur: number, vol: number, cutoff: number) {
    const ctx = this.ctx;
    const f = midi(note);
    const saw = this.osc('sawtooth', f, t, t + dur + 0.2);
    const sub = this.osc('sine', f, t, t + dur + 0.2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 3;
    lp.frequency.setValueAtTime(cutoff * 2.2, t);
    lp.frequency.exponentialRampToValueAtTime(cutoff, t + Math.min(0.15, dur));
    const g = ctx.createGain();
    this.env(g, t, vol, 0.008, dur, 0.04);
    const sg = ctx.createGain();
    sg.gain.value = 0.7;
    saw.connect(lp).connect(g);
    sub.connect(sg).connect(g);
    this.send(g, 0);
  }

  /** soft electric piano: a little FM for the bell, slow tremolo */
  keys(t: number, note: number, dur: number, vol: number) {
    const ctx = this.ctx;
    const f = midi(note);
    const car = this.osc('sine', f, t, t + dur + 1.2);
    const mod = this.osc('sine', f, t, t + dur + 1.2);
    const idx = ctx.createGain();
    idx.gain.setValueAtTime(f * 1.6, t);
    idx.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.6);
    mod.connect(idx).connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.5);
    g.gain.setTargetAtTime(0, t + dur, 0.25);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    car.connect(lp).connect(g);
    this.send(g, 0.35);
  }

  /** three detuned saws, slow attack, through a gentle filter; ducks with the kick */
  pad(t: number, notes: number[], dur: number, vol: number) {
    const ctx = this.ctx;
    for (const n of notes) {
      const g = ctx.createGain();
      this.env(g, t, vol, 0.35, dur - 0.2, 0.5);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(700, t);
      lp.frequency.linearRampToValueAtTime(1500, t + dur * 0.6);
      for (const d of [-9, 0, 8]) this.osc('sawtooth', midi(n), t, t + dur + 1.5, d).connect(lp);
      lp.connect(g);
      if (this.padBus) {
        g.connect(this.padBus);
        const w = ctx.createGain();
        w.gain.value = 0.35;
        g.connect(w).connect(this.reverb);
      }
    }
  }

  /** the pumping: pads dip on every kick and swell back */
  duck(t: number) {
    const p = this.padBus?.gain;
    if (!p) return;
    p.setValueAtTime(0.3, t);
    p.linearRampToValueAtTime(1, t + this.s * 3.2);
  }

  pluck(t: number, note: number, dur: number, vol: number) {
    const ctx = this.ctx;
    const o = this.osc('square', midi(note), t, t + dur + 0.3);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 4;
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(600, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur + 0.15);
    o.connect(lp).connect(g);
    this.send(g, 0.45);
  }

  lead(t: number, note: number, dur: number, vol: number, mellow: boolean) {
    const ctx = this.ctx;
    const f = midi(note);
    const a = this.osc(mellow ? 'triangle' : 'sawtooth', f, t, t + dur + 0.6, -6);
    const b = this.osc(mellow ? 'sine' : 'sawtooth', f, t, t + dur + 0.6, 6);
    // vibrato that comes in on long notes
    const vib = this.osc('sine', 5.5, t, t + dur + 0.6);
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.5, dur));
    vib.connect(vg);
    vg.connect(a.frequency);
    vg.connect(b.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = mellow ? 1800 : 2600;
    const g = ctx.createGain();
    this.env(g, t, vol, mellow ? 0.04 : 0.015, dur, 0.18);
    a.connect(lp);
    b.connect(lp);
    lp.connect(g);
    this.send(g, 0.5);
  }
}
