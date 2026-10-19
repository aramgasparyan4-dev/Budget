import { RNG } from '../core/rng';
import { clamp, damp } from '../core/math';
import type { WeatherParams } from '../render/Environment';

export type WeatherKind = 'sunny' | 'cloudy' | 'rainy' | 'foggy' | 'stormy';

const TARGETS: Record<WeatherKind, Omit<WeatherParams, 'wet' | 'flash'>> = {
  sunny: { cloud: 0.18, rain: 0, fog: 0, wind: 0.2, storm: 0 },
  cloudy: { cloud: 0.68, rain: 0, fog: 0.08, wind: 0.35, storm: 0.05 },
  rainy: { cloud: 0.88, rain: 0.65, fog: 0.22, wind: 0.5, storm: 0.25 },
  foggy: { cloud: 0.55, rain: 0, fog: 0.85, wind: 0.08, storm: 0.1 },
  stormy: { cloud: 1, rain: 1, fog: 0.3, wind: 0.95, storm: 0.85 },
};

const NEXT: Record<WeatherKind, [WeatherKind, number][]> = {
  sunny: [['sunny', 5], ['cloudy', 3], ['foggy', 0.6]],
  cloudy: [['sunny', 3], ['cloudy', 2], ['rainy', 2.4], ['foggy', 0.8], ['stormy', 0.4]],
  rainy: [['cloudy', 3], ['rainy', 2], ['stormy', 1], ['sunny', 0.8]],
  foggy: [['sunny', 2], ['cloudy', 2], ['foggy', 1]],
  stormy: [['rainy', 3], ['cloudy', 1.5]],
};

export const WEATHER_LABEL: Record<WeatherKind, string> = {
  sunny: 'Clear',
  cloudy: 'Cloudy',
  rainy: 'Rain',
  foggy: 'Fog',
  stormy: 'Storm',
};

export class WeatherSystem {
  kind: WeatherKind = 'sunny';
  until = 0; // game minute when the next change happens
  p: WeatherParams = { cloud: 0.2, rain: 0, fog: 0, wet: 0, wind: 0.2, storm: 0, flash: 0 };
  temp = 18;
  private rng: RNG;
  private flashT = 0;
  private nextFlash = 5;
  onThunder: ((delay: number, power: number) => void) | null = null;
  onChange: ((k: WeatherKind) => void) | null = null;
  forecast: WeatherKind[] = [];

  constructor(seed: number) {
    this.rng = new RNG(seed ^ 0x3ea7);
  }

  set(kind: WeatherKind, now: number, instant = false) {
    this.kind = kind;
    this.until = now + (120 + this.rng.next() * 300) * (kind === 'stormy' ? 0.5 : 1);
    if (instant) {
      Object.assign(this.p, TARGETS[kind]);
      this.p.wet = kind === 'rainy' || kind === 'stormy' ? 0.8 : 0;
    }
    this.onChange?.(kind);
    this.buildForecast();
  }

  private buildForecast() {
    this.forecast = [];
    let k = this.kind;
    for (let i = 0; i < 3; i++) {
      const opts = NEXT[k];
      k = this.rng.weighted(
        opts.map((o) => o[0]),
        opts.map((o) => o[1]),
      );
      this.forecast.push(k);
    }
  }

  update(realDt: number, now: number, hour: number) {
    if (now >= this.until) {
      const next = this.forecast.length ? this.forecast.shift()! : this.kind;
      this.set(next, now);
    }
    const t = TARGETS[this.kind];
    const rate = 0.05;
    this.p.cloud = damp(this.p.cloud, t.cloud, rate, realDt);
    this.p.rain = damp(this.p.rain, t.rain, rate * 1.3, realDt);
    this.p.fog = damp(this.p.fog, t.fog, rate, realDt);
    this.p.wind = damp(this.p.wind, t.wind, rate, realDt);
    this.p.storm = damp(this.p.storm, t.storm, rate, realDt);
    // surfaces get wet quickly and dry slowly (faster in sun)
    if (this.p.rain > 0.1) this.p.wet = Math.min(1, this.p.wet + realDt * 0.05 * this.p.rain);
    else this.p.wet = Math.max(0, this.p.wet - realDt * (hour > 9 && hour < 17 && this.kind === 'sunny' ? 0.006 : 0.003));
    // lightning
    if (this.kind === 'stormy' && this.p.storm > 0.5) {
      this.nextFlash -= realDt;
      if (this.nextFlash <= 0) {
        this.nextFlash = 6 + this.rng.next() * 16;
        this.flashT = 0.35;
        this.onThunder?.(0.5 + this.rng.next() * 2.5, 0.5 + this.rng.next() * 0.5);
      }
    }
    if (this.flashT > 0) {
      this.flashT -= realDt;
      const k = this.flashT > 0.25 ? 1 : this.flashT > 0.15 ? 0.2 : this.flashT > 0.08 ? 0.9 : 0;
      this.p.flash = clamp(k, 0, 1);
    } else this.p.flash = 0;
    // temperature: daily curve + weather
    const base = 14 + 8 * Math.sin(((hour - 9) / 24) * Math.PI * 2);
    const wTemp = this.kind === 'sunny' ? 2 : this.kind === 'stormy' ? -4 : this.kind === 'rainy' ? -3 : 0;
    this.temp = damp(this.temp, base + wTemp, 0.1, realDt);
  }

  serialize() {
    return { kind: this.kind, until: this.until, p: { ...this.p }, forecast: [...this.forecast] };
  }
  restore(d: ReturnType<WeatherSystem['serialize']>) {
    this.kind = d.kind;
    this.until = d.until;
    Object.assign(this.p, d.p);
    this.forecast = d.forecast;
  }
}
