"""Place the voiceover clips on the 60 s timeline and work out caption timings.

Reads build/vo/*.wav + vo.json, writes:
  build/timing.json  - clip/phrase/word times shared by the HTML animation and the audio mix
  build/vo_track.wav - the full-length voiceover track
"""
import json
import re
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
DURATION = 60.0
SR = 48000

# When each voiceover clip starts (seconds). Scenes in index.html are cut around these.
SCHEDULE = {
    "hook": 0.30,
    "problem": 2.80,
    "stats": 9.00,
    "reveal": 14.50,
    "price_a": 19.80,
    "price_b": 22.50,
    "cool_a": 26.00,
    "cool_b": 30.70,
    "cool_c": 33.50,
    "benefit": 38.00,
    "social": 44.20,
    "cta": 49.80,
}

SCENES = {
    "hook": [0.0, 2.6],
    "problem": [2.6, 8.6],
    "stats": [8.6, 14.0],
    "reveal": [14.0, 19.3],
    "price": [19.3, 25.6],
    "cool": [25.6, 37.6],
    "benefit": [37.6, 43.9],
    "social": [43.9, 49.5],
    "cta": [49.5, DURATION],
}


def pauses(x, sr, thresh=0.012, min_len=0.08):
    hop = int(0.01 * sr)
    n = len(x) // hop
    rms = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1))
    silent = rms < thresh
    out, i = [], 0
    while i < n:
        if silent[i]:
            j = i
            while j < n and silent[j]:
                j += 1
            if (j - i) * 0.01 >= min_len and i > 0 and j < n:
                out.append((i * 0.01, j * 0.01))
            i = j
        else:
            i += 1
    return out


def phrase_times(text, dur, gaps):
    """Split text at punctuation and snap phrase boundaries to detected pauses."""
    phrases = [p.strip() for p in re.findall(r"[^.,?!]+[.,?!]*\.*", text) if p.strip()]
    weights = np.array([len(p) for p in phrases], dtype=float)
    edges = np.concatenate([[0], np.cumsum(weights)]) / weights.sum() * dur
    starts, ends = [0.0], []
    for k in range(1, len(phrases)):
        guess = edges[k]
        near = [g for g in gaps if abs((g[0] + g[1]) / 2 - guess) < 0.45]
        if near:
            # prefer long pauses close to the guess: sentence breaks are longer than word gaps
            g = min(near, key=lambda g: abs((g[0] + g[1]) / 2 - guess) - 2 * (g[1] - g[0]))
            gaps = [x for x in gaps if x != g]
            ends.append(g[0])
            starts.append(g[1])
        else:
            ends.append(guess)
            starts.append(guess)
    ends.append(dur)
    return [(p, s, e) for p, s, e in zip(phrases, starts, ends)]


def word_times(phrase, t0, t1):
    words = phrase.split()
    w = np.array([len(re.sub(r"\W", "", x)) + 2 for x in words], dtype=float)
    edges = t0 + np.concatenate([[0], np.cumsum(w)]) / w.sum() * (t1 - t0)
    return [(x, edges[i], edges[i + 1]) for i, x in enumerate(words)]


def write_srt(phrases, path):
    """phrase-level subtitles, for platforms that take a caption file."""
    def ts(x):
        ms = int(round(x * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    rows = sorted((s, e, p) for ph in phrases.values() for p, s, e in ph)
    ends = [min(e + 0.2, nxt[0]) for (s, e, p), nxt in zip(rows, rows[1:] + [(1e9,)])]
    path.parent.mkdir(exist_ok=True)
    path.write_text("".join(f"{i}\n{ts(s)} --> {ts(end)}\n{p}\n\n" for i, ((s, e, p), end) in enumerate(zip(rows, ends), 1)))


def main():
    meta = {m["id"]: m for m in json.loads((BUILD / "vo" / "vo.json").read_text())}
    track = np.zeros(int(DURATION * SR), dtype=np.float32)
    clips, phrases, groups = [], {}, []
    for cid, start in SCHEDULE.items():
        x, sr = sf.read(BUILD / "vo" / f"{cid}.wav", dtype="float32")
        assert sr == SR
        a = int(start * SR)
        track[a : a + len(x)] += x
        dur = len(x) / SR
        clips.append({"id": cid, "start": start, "end": round(start + dur, 3)})
        ph = phrase_times(meta[cid]["text"], dur, pauses(x, sr))
        phrases[cid] = [[p, round(start + s, 3), round(start + e, 3)] for p, s, e in ph]
        # captions: at most 3 words on screen, never spanning a phrase break
        for p, s, e in ph:
            words = word_times(p, start + s, start + e)
            for i in range(0, len(words), 3):
                chunk = words[i : i + 3]
                if len(chunk) == 1 and groups and i > 0:
                    groups[-1]["words"] += [[w, round(a, 3), round(b, 3)] for w, a, b in chunk]
                    groups[-1]["t1"] = round(chunk[-1][2], 3)
                    continue
                groups.append({
                    "t0": round(chunk[0][1], 3),
                    "t1": round(chunk[-1][2], 3),
                    "words": [[w, round(a, 3), round(b, 3)] for w, a, b in chunk],
                })
    # hold each caption until the next one starts (or 0.35 s after its last word)
    for g, nxt in zip(groups, groups[1:] + [None]):
        g["hold"] = round(min(g["t1"] + 0.35, nxt["t0"]) if nxt else g["t1"] + 0.35, 3)

    sf.write(BUILD / "vo_track.wav", track, SR)
    write_srt(phrases, ROOT / "out" / "captions.srt")
    timing = {"duration": DURATION, "scenes": SCENES, "clips": clips, "phrases": phrases, "captions": groups}
    (BUILD / "timing.json").write_text(json.dumps(timing, indent=1))
    for cid, ph in phrases.items():
        print(cid, [(p, s, e) for p, s, e in ph])


if __name__ == "__main__":
    main()
