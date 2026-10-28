"""Generate the voiceover, one WAV per line, with Kokoro (open-weight neural TTS).

Usage: python vo.py <kokoro-v1.0.onnx> <voices-v1.0.bin> <out_dir>
Writes <out_dir>/<id>.wav and <out_dir>/vo.json with each clip's duration.
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

VOICE = "af_heart"
SPEED = 1.08
SR_OUT = 48000

model, voices, out_dir = sys.argv[1], sys.argv[2], Path(sys.argv[3])
out_dir.mkdir(parents=True, exist_ok=True)
lines = json.loads((Path(__file__).parent / "lines.json").read_text())
kokoro = Kokoro(model, voices)


def trim(x, sr, thresh=0.01, pad=0.04):
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(pad * sr))
    b = min(len(x), idx[-1] + int(pad * sr))
    return x[a:b]


meta = []
for line in lines:
    samples, sr = kokoro.create(line["text"], voice=VOICE, speed=SPEED, lang="en-us")
    samples = trim(np.asarray(samples, dtype=np.float32), sr)
    # resample to 48 kHz (linear is fine for speech at this ratio)
    n_out = int(round(len(samples) * SR_OUT / sr))
    samples = np.interp(np.linspace(0, len(samples) - 1, n_out), np.arange(len(samples)), samples)
    samples = samples / (np.max(np.abs(samples)) + 1e-9) * 0.89
    sf.write(out_dir / f"{line['id']}.wav", samples.astype(np.float32), SR_OUT)
    meta.append({**line, "dur": round(n_out / SR_OUT, 3)})
    print(f"{line['id']:8s} {n_out / SR_OUT:5.2f}s  {line['text']}")

(out_dir / "vo.json").write_text(json.dumps(meta, indent=2))
print("total speech:", round(sum(m["dur"] for m in meta), 2), "s")
