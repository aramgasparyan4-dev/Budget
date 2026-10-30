# Cooldown: business concept prototype

**Cooldown is the pause button for impulse buys.** It steps in at checkout, shows the real price of a purchase (hours of your work, days added to your goals) and holds the item for 24 hours. If you still want it tomorrow, you buy it guilt-free. If you don't, the money moves into your savings automatically.

> *Cool down before you check out.*

## Deliverables

| File | What it is |
|---|---|
| [`video/out/cooldown_tiktok_60s.mp4`](video/out/cooldown_tiktok_60s.mp4) | **The 1-minute vertical video prototype** (1080×1920, 60.0 s, AI voiceover, original music) |
| [`video/out/cooldown_presentation_16x9.mp4`](video/out/cooldown_presentation_16x9.mp4) | **Stage version** for a projector or big screen (1920×1080): the vertical video framed on a printed-paper backdrop with the brand and tagline either side |
| [`video/out/voiceover_read_along.mp4`](video/out/voiceover_read_along.mp4) | **Read-along teleprompter** (16:9): video + music on the left, the script lighting up word by word on the right, 3 s count-in. Record your voice over this |
| [`video/out/voiceover_read_along_practice.mp4`](video/out/voiceover_read_along_practice.mp4) | Same, with the AI guide voice, for rehearsing |
| [`video/out/cooldown_tiktok_60s_no_voice.mp4`](video/out/cooldown_tiktok_60s_no_voice.mp4) | Same video with music and sound effects but **no voice**, for recording your own voiceover |
| [`video/out/music_sfx_no_voice.wav`](video/out/music_sfx_no_voice.wav) | That music + sound-effects track on its own (60 s WAV) |
| [`video/voiceover-script.md`](video/voiceover-script.md) | **Voiceover script** with start times, deadlines, delivery notes and how to record and send your voice |
| [`video/out/cover.jpg`](video/out/cover.jpg) | TikTok cover frame |
| [`video/out/captions.srt`](video/out/captions.srt) | Subtitle file (captions are also burned into the video) |
| [`concept/pitch.md`](concept/pitch.md) | Concept one-pager: problem, sourced market data, solution, target customer, competition, business model, go-to-market, roadmap, risks |
| [`video/script.md`](video/script.md) | Timecoded storyboard (visual / voiceover / text / sound), how it covers the brief, posting kit (caption, hashtags, settings) |
| [`video/ai-prompts.md`](video/ai-prompts.md) | AI tools used, plus ready-to-paste prompts for Sora/Veo/Kling/Runway, Suno and ElevenLabs if you want to add generative footage |

## Brief checklist

- Strong opening hook: frame 1 is **"STOP." / "DON'T TAP BUY NOW."** with a freeze-frame cliffhanger
- Clear visuals: hot-to-cool colour story, a single phone UI walkthrough, karaoke captions
- Simple explanation of benefits: real price → 24 h cooldown → auto-save, plus benefit stickers
- Suitable music: original 120 BPM track that drops on the product reveal, with synced sound effects. Trend hook: #UnspentChallenge (anti-haul)
- Direct call to action: *Join the free waitlist, link in bio*
- 1 minute, vertical, made with AI tools: 60.0 s, 9:16. See [`video/ai-prompts.md`](video/ai-prompts.md)

## Rebuilding the video

Everything under `video/src` is source. `video/build.sh` regenerates the voiceover, timing, sound, frames and the final MP4 (about 5 minutes).

```bash
cd video
npm install                                # GSAP
python3 -m pip install -r requirements.txt # kokoro-onnx, soundfile, numpy, scipy
# Kokoro model files: https://github.com/thewh1teagle/kokoro-onnx/releases (kokoro-v1.0.onnx, voices-v1.0.bin)
KOKORO_DIR=/path/to/models ./build.sh
```

You also need Node with Playwright's Chromium and ffmpeg. To change words, edit `src/lines.json`. To change timing, edit `SCHEDULE`/`SCENES` in `src/timeline.py`. To change visuals, edit `src/index.html`. You can preview any moment with `node src/render.js --stills 12.5,30`.
