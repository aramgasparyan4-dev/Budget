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
  -c:v libx264 -preset slow -crf 19 -maxrate 12M -bufsize 24M -pix_fmt yuv420p -profile:v high -level 4.2 -r 30 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest out/cooldown_tiktok_60s.mp4
ffmpeg -hide_banner -loglevel error -y -i build/frames/f00045.jpg -q:v 3 out/cover.jpg

# no-voice version (music + sound effects) for recording your own voiceover; same picture, same gain as the full mix
ffmpeg -hide_banner -loglevel error -y -i build/bed.wav -af "volume=2.6dB,alimiter=limit=0.84:level=false" \
  -c:a pcm_s16le out/music_sfx_no_voice.wav
ffmpeg -hide_banner -loglevel error -y -i out/cooldown_tiktok_60s.mp4 -i out/music_sfx_no_voice.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -movflags +faststart -shortest out/cooldown_tiktok_60s_no_voice.mp4
echo "done: out/cooldown_tiktok_60s.mp4"

# 16:9 master for projecting on stage: the vertical video framed on a printed-paper backdrop (src/stage.html)
"$PY" src/present.py
OUT=build/stage PAGE=stage.html SIZE=1920x1080 node src/render.js --stills 0
ffmpeg -hide_banner -loglevel error -y -loop 1 -i build/stage/t00.00.png -i out/cooldown_tiktok_60s.mp4 -loop 1 -i build/present_mask.png \
  -filter_complex "[1:v]scale=562:1000,format=rgba[fg0];[2:v]format=gray[m];[fg0][m]alphamerge[fg];[0:v][fg]overlay=679:40,format=yuv420p[v]" \
  -map "[v]" -map 1:a -t 60 -c:v libx264 -preset slow -crf 19 -maxrate 12M -bufsize 24M -r 30 -c:a copy -movflags +faststart out/cooldown_presentation_16x9.mp4
echo "done: out/cooldown_presentation_16x9.mp4"

# read-along teleprompter (16:9) for recording your own voice: 3 s count-in, then the video + music/SFX with the script beside it
PAGE=prompter.html SIZE=1920x1080 T0=-3 T1=60 OUT=build/pframes node src/render.js
prompter() {  # $1 = audio for the 60 s body, $2 = output
  ffmpeg -hide_banner -loglevel error -y -framerate 30 -i build/pframes/f%05d.jpg -i out/cooldown_tiktok_60s_no_voice.mp4 -loop 1 -i build/present_mask.png \
    -f lavfi -i "aevalsrc=0.25*sin(2*PI*if(lt(t\,2)\,880\,1320)*t)*lt(mod(t\,1)\,0.12):d=3:s=48000:c=stereo" -i "$1" \
    -filter_complex "[1:v]tpad=start_duration=3:start_mode=clone,scale=562:1000,format=rgba[v0];[2:v]format=gray[m];[v0][m]alphamerge[fg];\
[0:v][fg]overlay=70:40:shortest=1,format=yuv420p[v];[4:a]aformat=sample_rates=48000:channel_layouts=stereo[b];[3:a][b]concat=n=2:v=0:a=1[a]" \
    -map "[v]" -map "[a]" -t 63 -c:v libx264 -preset medium -crf 20 -r 30 -c:a aac -b:a 192k -movflags +faststart "$2"
}
prompter out/music_sfx_no_voice.wav out/voiceover_read_along.mp4         # record with this one (headphones!)
prompter build/mix_norm.wav out/voiceover_read_along_practice.mp4       # same, with the AI guide voice, for rehearsing
echo "done: read-along videos"
