# AI tools: what was used, and optional upgrades

## What made the current video

| Part | Tool | Notes |
|---|---|---|
| Concept, script, storyboard, pitch | Claude (Anthropic) | Iterated from the project brief |
| Voiceover | **Kokoro TTS** (open-weight neural text-to-speech, voice `af_heart`) | `src/vo.py`, lines in `src/lines.json` |
| Animation and UI mock-ups | Code written by Claude: HTML/CSS + GSAP, rendered frame by frame in headless Chromium | `src/index.html`, `src/render.js` |
| Music and sound effects | Synthesised from code (no samples), written by Claude | `src/audio.py` |
| Captions | Word timing estimated from the AI voice's pauses | `src/timeline.py` |
| Edit and encode | ffmpeg (two-pass loudness to −14 LUFS) | `build.sh` |

Write it in your submission like this: *"Concept, script and motion design generated with Claude; voiceover generated with Kokoro TTS; soundtrack and animation generated programmatically by AI-written code."*

## Optional upgrades with generative-video tools

The current cut is a polished motion-graphics app ad. If your lecturer expects **text-to-video** footage, swap or overlay the shots below. Each slot is self-contained, so you can replace it in CapCut without touching the rest.

All prompts assume **vertical 9:16, 1080×1920**. Paste them into Sora, Veo, Kling, Runway or Pika (whichever you have access to). Generate 3–4 variations and keep the best.

### Slot A: live-action hook (0:00–0:02.6)
Put it behind the "STOP." text, or as a 1-second cold open before it.
> Vertical 9:16 close-up, a young woman lying in bed at night, face lit only by the cold glow of her phone, thumb hovering over the screen about to tap, sleepy eyes widening, shallow depth of field, cinematic, subtle handheld movement, dark bedroom with warm red bokeh from fairy lights, 3 seconds, photorealistic.

### Slot B: problem montage (0:02.6–0:08.6)
Use as a half-transparent background behind the notifications, or as quick 0.5 s cuts.
> Vertical 9:16, a pile of delivery parcels growing on an apartment doorstep in a stop-motion time-lapse, boxes stacking higher and higher, late evening light, slightly comedic, photorealistic, 4 seconds.

> Vertical 9:16, extreme close-up of a banking app screen showing a low balance warning in red, the phone resting on a messy desk with shopping bags, moody lighting, slow push-in, 3 seconds.

### Slot C: emotional payoff (insert at 0:37.6 for ~1.5 s, before the dashboard)
> Vertical 9:16, a young woman walking through a neon-lit Tokyo street crossing at night, smiling, holding a phone, rain reflections, cinematic slow motion, warm and hopeful, 3 seconds.

### Slot D: product shot for the end card (0:49.5–1:00, behind the logo)
> Vertical 9:16, a smartphone floating and slowly rotating in a frosty icy-blue studio, crystals forming on its edges, soft volumetric light, premium tech commercial style, clean background, 5 seconds.

## Other AI swaps

**Different voice** (ElevenLabs, or TikTok's built-in text-to-speech for a native feel): paste the lines from `src/lines.json`. Direction: *friendly, upbeat, slightly playful Gen Z narrator, fast pace, ~150 words per minute.* Keep each line's start time from `build/timing.json`, or just re-run `timeline.py`.

**AI music** (Suno or Udio):
> Upbeat future-house instrumental, 120 BPM, icy synth plucks, bright pads, punchy four-on-the-floor kick, tense minor-key intro for the first 14 seconds, then a big uplifting drop at 0:14, catchy and modern, no vocals, 60 seconds.

**AI images** (Midjourney, Firefly or DALL·E) for a slide deck or app-store style mock-ups:
> App icon, glossy ice cube with a pause symbol inside, icy blue gradient, soft 3D, minimal, rounded square, white background.

> Flat illustration of an oversized lavender hoodie, soft shadows, e-commerce product image, peach background.

## Swapping a slot in CapCut (5 minutes)

1. Import `out/cooldown_tiktok_60s.mp4` into CapCut (9:16 project).
2. Drag the generated clip onto an overlay track at the slot's timecode. Trim it to the slot length.
3. For slots A and B, set the overlay to ~60% opacity, or put it *under* the main video with blend mode "Screen", so the text and UI stay readable.
4. Mute the generated clip's audio, because the original mix already has the voice, music and sound effects.
5. Export at 1080p, 30 fps.

When posting, turn on TikTok's **AI-generated content** label.
