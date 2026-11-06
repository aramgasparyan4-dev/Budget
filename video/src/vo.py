"""Generate the voiceover with Kokoro (open-weight neural TTS), one WAV per line.

Each sentence is synthesised on its own and joined with deliberate pauses, because Kokoro
squeezes the gap between sentences in a single read ("Stop.Don't tap..."). Default pauses:
0.30 s after . ? !, 0.50 s after an ellipsis; a line can override them with "gaps" in lines.json.

Usage: python vo.py <kokoro-v1.0.onnx> <voices-v1.0.bin> <out_dir>
Writes <out_dir>/<id>.wav and <out_dir>/vo.json (duration + exact phrase times per line).
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

VOICE = "af_heart"
SPEED = 1.08
SR_OUT = 48000
GAP_SENTENCE = 0.30
GAP_ELLIPSIS = 0.50

model, voices, out_dir = sys.argv[1], sys.argv[2], Path(sys.argv[3])
out_dir.mkdir(parents=True, exist_ok=True)
lines = json.loads((Path(__file__).parent / "lines.json").read_text())
kokoro = Kokoro(model, voices)


def trim(x, sr, thresh=0.01, pad=0.03):
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    return x[max(0, idx[0] - int(pad * sr)) : min(len(x), idx[-1] + int(pad * sr))]


def sentences(text):
    """split after . ? ! or an ellipsis, keeping the punctuation with its sentence."""
    parts = re.findall(r".+?(?:\.\.\.|…|[.?!])(?=\s|$)|.+$", text.strip())
    return [p.strip() for p in parts if p.strip()]


def synth(text):
    samples, sr = kokoro.create(text, voice=VOICE, speed=SPEED, lang="en-us")
    x = trim(np.asarray(samples, dtype=np.float32), sr)
    n = int(round(len(x) * SR_OUT / sr))
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)


meta = []
for line in lines:
    parts = sentences(line["text"])
    gaps = line.get("gaps") or [GAP_ELLIPSIS if p.endswith(("...", "…")) else GAP_SENTENCE for p in parts[:-1]]
    assert len(gaps) == len(parts) - 1, (line["id"], parts, gaps)
    chunks, phrases, t = [], [], 0.0
    for i, p in enumerate(parts):
        x = synth(p)
        phrases.append([p, round(t, 3), round(t + len(x) / SR_OUT, 3)])
        chunks.append(x)
        t += len(x) / SR_OUT
        if i < len(gaps):
            chunks.append(np.zeros(int(gaps[i] * SR_OUT)))
            t += gaps[i]
    y = np.concatenate(chunks)
    y = y / (np.max(np.abs(y)) + 1e-9) * 0.89
    sf.write(out_dir / f"{line['id']}.wav", y.astype(np.float32), SR_OUT)
    meta.append({"id": line["id"], "text": line["text"], "dur": round(len(y) / SR_OUT, 3), "phrases": phrases})
    print(f"{line['id']:8s} {len(y) / SR_OUT:5.2f}s  " + " | ".join(f"{p} [{a:.2f}-{b:.2f}]" for p, a, b in phrases))

(out_dir / "vo.json").write_text(json.dumps(meta, indent=2))
print("total:", round(sum(m["dur"] for m in meta), 2), "s")
