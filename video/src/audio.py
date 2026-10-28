"""Original soundtrack, sound effects and final mix for the Cooldown video.

Everything is synthesised here with numpy/scipy (no samples, so no licensing questions).
Reads build/cues.json (from render.js --cues) and build/vo_track.wav (from timeline.py).
Writes build/music.wav, build/sfx.wav and build/mix.wav (pre-loudness-normalisation).
"""
import json
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
SR = 48000
DUR = 60.0
N = int(DUR * SR)
BEAT = 0.5          # 120 BPM
BAR = 4 * BEAT
GRID = 0.1          # beat-grid offset so scene cuts land on beats
DROP = 14.1         # first bar of the main groove (frost wipe ends at 14.0)
OUTRO = 58.1        # groove stops, final chord rings out
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- dsp helpers
def tt(d):
    return np.arange(int(d * SR)) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def filt(x, f, kind="low", order=2):
    return sosfilt(butter(order, f, kind, fs=SR, output="sos"), x)


def layer(*xs):
    """sum signals of different lengths."""
    out = np.zeros(max(len(x) for x in xs))
    for x in xs:
        out[: len(x)] += x
    return out


def noise(d):
    return rng.standard_normal(int(d * SR))


def saw(f, d, detune=0.0):
    t = tt(d)
    ph = (f * 2 ** (detune / 1200) * t + rng.random()) % 1.0
    return 2 * ph - 1


def sine(f, d, phase=0.0):
    return np.sin(2 * np.pi * f * tt(d) + phase)


def sweep(f0, f1, d, curve=1.0):
    t = tt(d)
    f = f0 + (f1 - f0) * (t / d) ** curve
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def env(d, a=0.005, r=0.1, hold=None):
    """linear attack, exponential release starting after `hold` (default: straight away)."""
    t = tt(d)
    e = np.minimum(1, t / max(a, 1e-4))
    h = a if hold is None else hold
    return e * np.where(t > h, np.exp(-(t - h) / r), 1.0)


def reverb_ir(d=2.4, decay=0.55, tone=6000):
    t = tt(d)
    ir = np.stack([noise(d), noise(d)]) * np.exp(-t / decay)
    ir = np.stack([filt(ch, tone) for ch in ir])
    ir[:, : int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return ir / np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))


class Bus:
    def __init__(self):
        self.x = np.zeros((2, N))

    def add(self, sig, t, gain=1.0, pan=0.0):
        i = int(round(t * SR))
        if i >= N or len(sig) == 0:
            return
        if i < 0:
            sig, i = sig[-i:], 0
        sig = sig[: N - i]
        th = (pan + 1) * np.pi / 4
        self.x[0, i : i + len(sig)] += sig * gain * np.cos(th) * np.sqrt(2)
        self.x[1, i : i + len(sig)] += sig * gain * np.sin(th) * np.sqrt(2)

    def wet(self, ir, mix):
        w = np.stack([fftconvolve(self.x[c], ir[c])[:N] for c in range(2)])
        return self.x + w * mix


# ---------------------------------------------------------------- instruments
def kick(punch=1.0):
    d = 0.5
    t = tt(d)
    f = 44 + 90 * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    click = filt(noise(d), 2500, "high") * np.exp(-t / 0.004) * 0.25 * punch
    return layer(np.tanh(1.6 * body), click)


def clap():
    d = 0.4
    t = tt(d)
    n = filt(noise(d), [900, 4200], "band")
    e = sum(np.where(t >= o, np.exp(-(t - o) / 0.007), 0) for o in (0, 0.011, 0.022)) + 0.5 * np.where(t >= 0.03, np.exp(-(t - 0.03) / 0.11), 0)
    return n * e * 0.7


def hat(open_=False):
    d = 0.3 if open_ else 0.08
    n = filt(noise(d), 7500, "high", 4)
    return n * env(d, 0.001, 0.11 if open_ else 0.022)


def crash():
    d = 2.5
    return filt(noise(d), 4000, "high", 2) * env(d, 0.002, 0.7) * 0.6


def bass(m, d):
    s = layer(0.6 * saw(midi(m), d), np.sin(2 * np.pi * midi(m) * tt(d)) * 0.8)
    return filt(s, 520, "low", 4) * env(d, 0.004, 0.18, hold=d * 0.4)


def pad(notes, d, cutoff=1800):
    s = sum(saw(midi(m), d, det) for m in notes for det in (-9, 0, 8))
    s = filt(s / (3 * len(notes)), cutoff, "low", 2)
    return s * env(d, 0.25, 0.35, hold=d - 0.15)


def pluck(m, d=0.32, bright=3800):
    s = layer(saw(midi(m), d) * 0.7, saw(midi(m), d, 7) * 0.3)
    hi = filt(s, bright) * env(d, 0.002, 0.06)
    lo = filt(s, 900) * env(d, 0.002, 0.16)
    return hi * 0.6 + lo * 0.7


def bell(f, d=1.2, partials=((1, 1.0, 1.0), (2.0, 0.35, 0.5), (3.01, 0.18, 0.3), (5.4, 0.08, 0.15))):
    t = tt(d)
    return sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t / (dec * d * 0.5)) for k, a, dec in partials) * np.minimum(1, t / 0.002)


def sub_boom(d=1.4, f0=90, f1=38):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t / 0.08)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45)


# ---------------------------------------------------------------- music
def build_music():
    drums, inst, pads = Bus(), Bus(), Bus()
    beats = lambda a, b: [GRID + k * BEAT for k in range(int(np.ceil((a - GRID) / BEAT)), int((b - GRID) / BEAT) + 1) if a - 1e-6 <= GRID + k * BEAT < b - 1e-6]

    # --- hook (0 - 1.85): dark A-minor drone, clock ticks, rising tension
    am = [45, 52, 57, 60]
    hook = pad(am, 2.6, 700)
    hook *= np.linspace(0.6, 1.4, len(hook))
    pads.add(hook, 0, 0.9)
    inst.add(sub_boom(1.6), 0, 0.9)
    for k, b in enumerate(np.arange(0.5, 1.85, 0.25)):
        drums.add(hat() * (0.5 + 0.1 * k), b, 0.5, pan=0.3 if k % 2 else -0.3)

    # --- problem + stats (2.6 - 13.55): tense half-time groove, Am F Dm E Am F
    prog = [[45, 52, 57, 60], [41, 48, 53, 57], [38, 45, 50, 53], [40, 47, 52, 56], [45, 52, 57, 60], [41, 48, 53, 57]]
    roots = [33, 29, 26, 28, 33, 29]
    stop_b = 13.55
    for i, (ch, r) in enumerate(zip(prog, roots)):
        a = 2.6 + i * BAR
        if a >= stop_b:
            break
        d = min(BAR, stop_b - a)
        pads.add(pad(ch, d, 1100), a, 0.55)
        inst.add(bass(r + 12, d), a, 0.55)
        drums.add(kick(), a, 0.8)
        if a + 0.75 < stop_b:
            drums.add(kick(0.6), a + 0.75, 0.55)
        if a + 1.0 < stop_b:
            drums.add(clap(), a + 1.0, 0.55)
        for k, h in enumerate(np.arange(a, a + d, 0.25)):
            drums.add(hat(), h, 0.32 if k % 2 else 0.22, pan=0.25)
        for k, h in enumerate(np.arange(a, a + d - 0.1, 0.25)):
            if k % 3 != 2:
                inst.add(pluck(ch[(k * 2) % 4] + 12, 0.25, 2200), h, 0.13, pan=-0.35)

    # --- main groove (14.1 - 58.1): C G Am F, four on the floor, side-chained pads
    chords = [[60, 64, 67, 71], [59, 62, 67, 71], [57, 60, 64, 69], [57, 60, 65, 69]]
    broots = [36, 43, 45, 41]
    arp = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2]
    pump = np.ones(N)
    drums.add(crash(), DROP, 0.55)
    inst.add(sub_boom(1.8, 110, 36), DROP, 1.0)
    bar = 0
    while DROP + bar * BAR < OUTRO - 1e-6:
        a = DROP + bar * BAR
        ch, r = chords[bar % 4], broots[bar % 4]
        pads.add(pad(ch, BAR + 0.1, 2200), a, 0.5)
        for k in range(4):
            b = a + k * BEAT
            drums.add(kick(), b, 0.9)
            i = int(b * SR)
            seg = np.minimum(1, 0.25 + 0.75 * (tt(BEAT) / 0.16) ** 0.8)
            pump[i : i + len(seg)] = np.minimum(pump[i : i + len(seg)], seg[: N - i])
            drums.add(hat(True), b + BEAT / 2, 0.22, pan=0.2)
            inst.add(bass(r, BEAT / 2 - 0.02), b + BEAT / 2, 0.62)
            if k in (1, 3):
                drums.add(clap(), b, 0.62)
        for k in range(16):
            drums.add(hat(), a + k * BEAT / 4, 0.16 if k % 2 else 0.1, pan=-0.2)
            vel = 0.17 if k % 4 == 0 else 0.11
            inst.add(pluck(ch[arp[k]] + 12, 0.3), a + k * BEAT / 4, vel, pan=0.35 if k % 2 else -0.35)
            if a >= 37.5:  # benefit onwards: extra octave sparkle
                inst.add(pluck(ch[arp[(k + 2) % 16]] + 24, 0.22, 5000), a + k * BEAT / 4, vel * 0.45, pan=-0.5 if k % 2 else 0.5)
        if a >= 49.5:   # CTA: bell hook on top
            for k, m in enumerate([76, 79, 84, 83] if bar % 2 == 0 else [81, 79, 76, 74]):
                inst.add(bell(midi(m), 0.9), a + k * BEAT, 0.12, pan=0.1)
        bar += 1

    # --- outro: final chord rings out, with an impact
    inst.add(sub_boom(2.0, 100, 36), OUTRO, 0.9)
    pads.add(pad([60, 64, 67, 74], 1.9, 2600), OUTRO, 0.55)
    for k, m in enumerate([72, 76, 79, 84]):
        inst.add(bell(midi(m), 1.8), OUTRO + k * 0.04, 0.16)
    drums.add(crash(), OUTRO, 0.4)

    pads.x *= pump
    inst_pumped = inst.x.copy()
    inst_pumped[:, int(DROP * SR):] *= 0.65 + 0.35 * pump[int(DROP * SR):]
    inst.x = inst_pumped
    ir = reverb_ir()
    music = drums.wet(ir, 0.08) + inst.wet(ir, 0.22) + pads.wet(ir, 0.3)

    # tape-stop on the hook freeze, then silence until the problem scene
    f0, f1 = int(1.85 * SR), int(2.2 * SR)
    L = f1 - f0
    rate = np.linspace(1, 0, L) ** 1.5
    pos = f0 + np.cumsum(rate)
    for c in range(2):
        music[c, f0:f1] = np.interp(pos, np.arange(N), music[c]) * np.linspace(1, 0, L)
    music[:, f1 : int(2.6 * SR)] = 0
    # short gap before the drop for the frost wipe
    g0, g1 = int(13.55 * SR), int(DROP * SR)
    music[:, g0:g1] *= np.linspace(1, 0.15, g1 - g0)
    return music


# ---------------------------------------------------------------- sfx
def whoosh(d=0.45):
    t = tt(d)
    out = np.zeros(len(t))
    for (lo, hi), peak in [((250, 900), 0.35), ((900, 2800), 0.5), ((2800, 8000), 0.62)]:
        e = np.exp(-((t / d - peak) ** 2) / 0.03)
        out += filt(noise(d), [lo, hi], "band") * e
    return out * 0.9


def ding(f):
    return bell(f, 0.9, ((1, 1, 1), (2, 0.4, 0.5), (3, 0.15, 0.25)))


def alert():
    out = np.zeros(int(0.9 * SR))
    for k, f in enumerate([880, 698, 880, 698]):
        d = 0.16
        s = np.sign(sine(f, d)) * 0.5 + sine(f, d) * 0.5
        s = filt(s, 2500) * env(d, 0.004, 0.06, hold=0.08)
        i = int(k * 0.18 * SR)
        out[i : i + len(s)] += s
    return out * 0.6


def slam():
    return layer(sub_boom(0.8, 140, 45) * 0.9, filt(noise(0.5), 1800) * env(0.5, 0.001, 0.06) * 0.6)


def blip(f=900):
    return sweep(f, f * 1.35, 0.09) * env(0.09, 0.002, 0.03) * 0.6


def pop():
    return layer(sweep(620, 240, 0.08) * env(0.08, 0.001, 0.025) * 0.8, filt(noise(0.02), 3000, "high") * env(0.02, 0.0005, 0.003) * 0.3)


def tap():
    return layer(filt(noise(0.03), 2200, "high") * env(0.03, 0.0005, 0.004) * 0.7, sine(170, 0.05) * env(0.05, 0.001, 0.012) * 0.6)


def freeze():
    d = 1.4
    out = np.zeros(int(d * SR))
    for _ in range(46):
        o = rng.random() ** 1.8 * 0.7
        c = filt(noise(0.012), 3200, "high") * env(0.012, 0.0003, 0.002) * (0.4 + rng.random() * 0.6)
        i = int(o * SR)
        out[i : i + len(c)] += c
    t = tt(d)
    shimmer = sum(np.sin(2 * np.pi * f * (1 + 0.002 * rng.standard_normal()) * t) for f in (2093, 2637, 3136, 4186, 5274))
    shimmer *= np.exp(-t / 0.45) * (0.75 + 0.25 * np.sin(2 * np.pi * 11 * t)) * 0.12
    return layer(out * 0.8, shimmer, filt(noise(d), 6000, "high") * env(d, 0.01, 0.25) * 0.15)


def riser(d=2.2):
    t = tt(d)
    n = filt(noise(d), 1500, "high") * (t / d) ** 2 * 0.35
    return layer(n, sweep(180, 1400, d, 2) * (t / d) ** 2 * 0.25)


def sparkle():
    out = np.zeros(int(1.2 * SR))
    for k, m in enumerate([84, 88, 91, 96]):
        b = bell(midi(m), 0.8) * 0.35
        i = int(k * 0.045 * SR)
        out[i : i + len(b)] += b
    return out


def down():
    return sweep(520, 220, 0.32, 0.7) * env(0.32, 0.005, 0.12, hold=0.15) * 0.45


def timelapse(a, b):
    """clock ticks that speed up then slow down with the eased 24 h countdown, under a filtered swell."""
    d = b - a
    out = np.zeros(int((d + 0.5) * SR))
    t = np.arange(0, d, 1 / 600)
    k = np.clip(t / d, 0, 1)
    prog = np.where(k < 0.5, 4 * k ** 3, 1 - (-2 * k + 2) ** 3 / 2)
    steps = np.floor(prog * 48)
    for j in np.nonzero(np.diff(steps) > 0)[0]:
        c = filt(noise(0.01), 3000, "high") * env(0.01, 0.0003, 0.0015) * (0.5 if int(steps[j + 1]) % 2 else 0.35)
        i = int(t[j + 1] * SR)
        out[i : i + len(c)] += c
    sw = filt(noise(d), [400, 3000], "band") * np.sin(np.pi * tt(d) / d) ** 2 * 0.25
    out[: len(sw)] += sw
    return out


def chime():
    out = np.zeros(int(1.6 * SR))
    for k, m in enumerate([88, 95]):
        b = bell(midi(m), 1.3) * 0.5
        i = int(k * 0.11 * SR)
        out[i : i + len(b)] += b
    return out


def success():
    out = np.zeros(int(1.8 * SR))
    for k, m in enumerate([72, 76, 79, 84]):
        b = bell(midi(m), 1.2) * 0.45
        i = int(k * 0.075 * SR)
        out[i : i + len(b)] += b
    return out


def coin():
    f = 2300 + rng.random() * 900
    return bell(f, 0.45, ((1, 1, 0.7), (2.41, 0.6, 0.4), (3.93, 0.4, 0.25), (5.2, 0.25, 0.15))) * 0.3


def confetti():
    out = filt(noise(0.25), [900, 6000], "band") * env(0.25, 0.001, 0.05) * 0.8
    for _ in range(20):
        o = rng.random() * 0.4
        c = filt(noise(0.01), 4000, "high") * env(0.01, 0.0003, 0.002) * 0.4
        i = int(o * SR)
        out = np.pad(out, (0, max(0, i + len(c) - len(out))))
        out[i : i + len(c)] += c
    return out


def buzz():
    d = 0.16
    s = np.sign(sine(150, d)) * 0.4 + saw(150, d) * 0.4
    return filt(s, 1200) * env(d, 0.003, 0.05, hold=0.08) * 0.5


def impact():
    return layer(slam(), filt(noise(1.0), 3000, "high") * env(1.0, 0.002, 0.25) * 0.2)


def build_sfx(cues, lapse):
    bus = Bus()
    pitches = iter([1318.5, 1396.9, 1568.0, 1760.0])
    for c in cues:
        t, k = c["t"], c["type"]
        if k == "whoosh":
            bus.add(whoosh(), t, 0.5, pan=rng.uniform(-0.4, 0.4))
        elif k == "sheet":
            bus.add(filt(whoosh(0.35), 3000), t, 0.45)
        elif k == "ding":
            bus.add(ding(next(pitches)), t, 0.35, pan=0.2)
        elif k == "alert":
            bus.add(alert(), t, 0.55)
        elif k == "slam":
            bus.add(slam(), t, 0.6)
        elif k == "blip":
            bus.add(blip(800 + rng.random() * 500), t, 0.4, pan=rng.uniform(-0.5, 0.5))
        elif k == "pop":
            bus.add(pop(), t, 0.45, pan=rng.uniform(-0.3, 0.3))
        elif k == "tap":
            bus.add(tap(), t, 0.7)
        elif k in ("freeze", "frostWipe"):
            bus.add(freeze(), t, 0.75)
            if k == "frostWipe":
                bus.add(whoosh(0.5), t, 0.5)
        elif k == "riser":
            bus.add(riser(), t, 0.6)
        elif k == "sparkle":
            bus.add(sparkle(), t, 0.5)
        elif k == "down":
            bus.add(down(), t, 0.6)
        elif k == "timelapse":
            bus.add(timelapse(*lapse), lapse[0], 0.6)
        elif k == "chime":
            bus.add(chime(), t, 0.5)
        elif k == "success":
            bus.add(success(), t, 0.45)
        elif k == "coin":
            bus.add(coin(), t, 0.45, pan=rng.uniform(-0.4, 0.4))
        elif k == "confetti":
            bus.add(confetti(), t, 0.5)
        elif k == "buzz":
            bus.add(buzz(), t, 0.5)
        elif k == "ding2":
            bus.add(ding(2093.0), t, 0.3)
        elif k == "impact":
            bus.add(impact(), t, 0.7)
        elif k in ("tapeStop", "drop", "tick"):
            pass  # handled inside the music
        else:
            raise ValueError(k)
    return bus.wet(reverb_ir(1.6, 0.35), 0.18)


# ---------------------------------------------------------------- mix
def duck_gain(vo, depth_db=11.0):
    """music gain that dips while the voice is talking (attack 20 ms, release 300 ms)."""
    hop = SR // 200
    frames = len(vo) // hop
    rms = np.sqrt(np.mean(vo[: frames * hop].reshape(frames, hop) ** 2, axis=1))
    k = np.clip(rms / 0.04, 0, 1)
    sm = np.zeros(frames)
    a_up, a_dn = np.exp(-1 / (0.02 * 200)), np.exp(-1 / (0.30 * 200))
    for i in range(1, frames):
        a = a_up if k[i] > sm[i - 1] else a_dn
        sm[i] = a * sm[i - 1] + (1 - a) * k[i]
    g = 10 ** (-depth_db * sm / 20)
    return np.interp(np.arange(len(vo)), np.arange(frames) * hop, g)


def main():
    cues = json.loads((BUILD / "cues.json").read_text())
    vo, sr = sf.read(BUILD / "vo_track.wav", dtype="float64")
    assert sr == SR and len(vo) == N
    music = build_music()
    sfx = build_sfx(cues["cues"], cues["lapse"])
    music = np.stack([filt(ch, 32, "high", 2) for ch in music])  # trim sub rumble phones can't play anyway
    music /= np.max(np.abs(music)) + 1e-9
    sfx /= np.max(np.abs(sfx)) + 1e-9
    sf.write(BUILD / "music.wav", music.T.astype(np.float32), SR)
    sf.write(BUILD / "sfx.wav", sfx.T.astype(np.float32), SR)

    mix = music * 0.42 * duck_gain(vo) + sfx * 0.38 + np.stack([vo, vo]) * 0.95
    mix = np.tanh(mix * 1.1) / 1.1   # gentle safety saturation
    fade = int(0.02 * SR)
    mix[:, :fade] *= np.linspace(0, 1, fade)
    mix[:, -fade:] *= np.linspace(1, 0, fade)
    sf.write(BUILD / "mix.wav", mix.T.astype(np.float32), SR)
    print("mix peak", round(float(np.max(np.abs(mix))), 3))


if __name__ == "__main__":
    main()
