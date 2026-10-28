#!/usr/bin/env bash
# Rebuilds video/out/cooldown_tiktok_60s.mp4 from source.
# Needs: node + playwright (Chromium), ffmpeg, Python with kokoro-onnx, soundfile, numpy, scipy
# and the Kokoro model files (kokoro-v1.0.onnx, voices-v1.0.bin) in $KOKORO_DIR.
set -euo pipefail
cd "$(dirname "$0")"
PY=${PY:-python3}
KOKORO_DIR=${KOKORO_DIR:?set KOKORO_DIR to the folder holding kokoro-v1.0.onnx and voices-v1.0.bin}
mkdir -p build out

"$PY" src/vo.py "$KOKORO_DIR/kokoro-v1.0.onnx" "$KOKORO_DIR/voices-v1.0.bin" build/vo   # AI voiceover
"$PY" src/timeline.py                                                                   # place lines, captions
node src/render.js --cues                                                               # sound cue times
"$PY" src/audio.py                                                                      # music, sfx, mix
node src/render.js                                                                      # 1800 frames

# loudness: two-pass EBU R128 to -14 LUFS (TikTok/Reels norm), true peak -1.5 dBTP
read -r I TP LRA THRESH < <(ffmpeg -hide_banner -nostats -i build/mix.wav \
  -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 |
  "$PY" -c "import sys,json; t=sys.stdin.read(); j=json.loads(t[t.rindex('{'):]); print(j['input_i'], j['input_tp'], j['input_lra'], j['input_thresh'])")
ffmpeg -hide_banner -loglevel error -y -i build/mix.wav \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$I:measured_TP=$TP:measured_LRA=$LRA:measured_thresh=$THRESH:linear=true,aresample=48000" \
  build/mix_norm.wav

ffmpeg -hide_banner -loglevel error -y -framerate 30 -i build/frames/f%05d.jpg -i build/mix_norm.wav \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -level 4.2 -r 30 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest out/cooldown_tiktok_60s.mp4
ffmpeg -hide_banner -loglevel error -y -i build/frames/f00045.jpg -q:v 3 out/cover.jpg
echo "done: out/cooldown_tiktok_60s.mp4"
