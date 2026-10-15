# Two compositions for Cambridge IGCSE Music (0410), Component 3

Two contrasting pieces. Together they run about 3 min 05 s, inside the
combined-duration range the syllabus asks for. Check the exact limits for the
syllabus year you are entered for.

| | Hollowmere | Quickset |
|---|---|---|
| Medium | Solo piano | String quartet |
| Key / mode | E minor | D mixolydian, B minor middle section |
| Metre, tempo | 6/8, Andante | 7/8 (2+2+3, then 3+2+2), Allegro |
| Length | 44 bars, about 1:40 | 60 bars, about 1:25 |
| Character | Lyrical, one theme developed | Rhythmic dance, layered ostinato |

## Files

| File | Use |
|---|---|
| `Hollowmere.musicxml`, `Quickset.musicxml` | The scores. Import these into Noteflight. |
| `Hollowmere.mxl`, `Quickset.mxl` | Same scores, compressed. Use if the upload dialog only accepts `.mxl`/`.xml`. |
| `preview/*.png` | Rendered pages to check against the import. |
| `build_score.py`, `build_quickset.py` | Generate the MusicXML from bar-by-bar data. Edit and re-run to change notes. |

## Importing into Noteflight

1. In Noteflight choose **New Score → Import MusicXML** (or **Scores → Import**).
2. Upload the `.musicxml` file (or the `.mxl`).
3. Put your name in the composer field. Nothing else needs changing.

Things to check after import. Hollowmere: 6/8, one sharp, two voices in the
left hand from bar 29, the tie into the last bar, hairpins in bars 5–8, 13–16,
21–24 and 28. Quickset: 7/8, one sharp, four bracketed staves, pizz. in the
cello from bar 1 and arco from bar 25, quaver beams grouped 3+2+2 in bars
25–38 and 2+2+3 elsewhere.

---

## Hollowmere, for solo piano

| Bars | Section | Key | What happens |
|---|---|---|---|
| 1–8 | A | E minor | Main theme, two four-bar phrases (half close on B7, full close). Flowing quaver accompaniment. |
| 9–16 | A' | E minor → G major | Theme with added inner voice. Bar 12 re-harmonised (Am6 → B7). Second phrase diverted through Am → D7 to arrive in G major. |
| 17–24 | B | G major | New dotted-rhythm idea over a lilting bass-and-chord accompaniment. Bar 20 deceptive cadence (D7 → Em). Bars 21–24 rising sequence Em – Am – Bm – D7 from *p* to *f*. |
| 25–28 | Climax | G – C – F/A – B7 | Main theme in right-hand octaves, sequenced up a fourth, landing on the Neapolitan chord (F major, bar 27) before the dominant. `poco rit.` |
| 29–36 | A'' | E minor | Theme an octave higher, *pp*, three-layer texture: held bass, middle-register arpeggio, singing top line. Second phrase answers in the original register. |
| 37–44 | Coda | E minor | Head of the theme over a tonic pedal, alternating Em with Am/E and C/E. Line descends to E; the third of the final chord arrives last. |

Why it is built this way:

- One motif (B–E–D–B, bar 1) drives the whole piece. It is re-harmonised,
  given an inner voice, sequenced in octaves at the climax and fragmented in
  the coda.
- Harmony is mostly diatonic with specific colour chords: Am6, the deceptive
  cadence at bar 20, the Neapolitan at bar 27, and pedal-point harmonies in
  the coda. Every phrase cadences somewhere definite.
- The piano writing changes texture at every section and stays within a
  comfortable range for an intermediate player.

---

## Quickset, for string quartet

Quickset is a hawthorn hedge planted from cuttings: something fast-growing,
spiky and tightly woven. The piece is a dance in 7/8 built from layers.

| Bars | Section | Key | What happens |
|---|---|---|---|
| 1–8 | Intro | D mixolydian | Layers enter two bars apart: cello pizzicato ostinato, viola on-beat double stops, second violin off-beat chops, then a first-violin scale run up to a held D. |
| 9–16 | A | D mixolydian | The tune in violin I. Harmony moves D – C – D – Am – D – G – Em – C→D; the C natural and the C→D cadence are what make it mixolydian rather than D major. |
| 17–24 | A, second time | D mixolydian | Tune handed to the viola in its own register; violin I floats a slow descant above; rhythm section unchanged. |
| 25–32 | B | B minor | Metre regroups to 3+2+2. Legato melody in violin I, sustained second violin, flowing viola quavers, cello arco for the first time. Phrase 2 ends on F♯ major (A♯) as the dominant. |
| 33–40 | B, second time | B minor → A7 | Melody in parallel thirds between the violins, then sixths. Bars 37–40 crescendo over Em – A7 with the 2+2+3 grouping snapping back at bar 39. |
| 41–48 | A, tutti | D mixolydian | Tune in violin octaves, *f*, full rhythm section. |
| 49–56 | Coda | D – C – G, then D – C – G – C | Head of the tune thrown between the violins, a unison scale for the whole quartet, then the tune *ff* ending on hammered C naturals. |
| 57–60 | Ending | D | Three *ff* stabs, a bar of silence except the opening cello pizzicato at *p*, and a final *p* pizzicato chord. The piece ends as it began. |

Why it is built this way:

- Contrast with Hollowmere in every dimension the examiner looks at: medium,
  tempo, metre, mode, texture and mood.
- Idiomatic string writing: all double and triple stops are on adjacent
  strings, pizzicato and arco changes have time to happen, each instrument
  gets the tune or a solo role (viola at 17, cello at 58), and nothing sits
  outside a school ensemble's range.
- Rhythm is the main idea. The 2+2+3 cell is in the ostinato, the chops, the
  tune's accents and the stabs; the switch to 3+2+2 for the B section is the
  structural contrast, and its return at bar 39 is the signal for the recap.
- Two structural tricks worth being able to explain: the layered intro
  (texture built up by addition), and the ending that quotes the opening at
  the opposite dynamic.
