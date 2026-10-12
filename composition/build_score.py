#!/usr/bin/env python3
"""Builds Hollowmere.musicxml from the bar-by-bar data below.

Notation used in the data strings (durations are in divisions, 4 per crotchet,
so a quaver is 2, a dotted crotchet 6 and a full 6/8 bar 12):

    B4:6         single note
    [G4,B4]:6    chord
    E5~:12       tie starts on this note / E5_:12 tie ends on this note
    (  ... )     slur start on the first token, slur end on the last token
    >            accent          ^  fermata
"""
import re
from xml.sax.saxutils import escape

DIV = 4          # divisions per crotchet
BAR = 12         # 6/8
KEY_FIFTHS = 1   # E minor
KEY_ALTER = {"F": 1}

# --------------------------------------------------------------------------
# Left-hand patterns (six quavers unless written out with durations)
# --------------------------------------------------------------------------
def q6(s):
    return " ".join(f"{p}:2" for p in s.split())

Em_a = q6("E2 B2 E3 G3 B3 G3")
Am_a = q6("A2 E3 A3 C4 E4 C4")
B7_a = q6("B2 D#3 F#3 B3 A3 F#3")
C_a = q6("C3 G3 C4 E4 G4 E4")
G_a = q6("G2 D3 G3 B3 D4 B3")
Am6_B7 = q6("A2 E3 C4 B2 F#3 A3")
Am_D7 = q6("A2 E3 C4 D3 F#3 C4")

G_b = "G2:2 [B3,D4]:4 D3:2 [B3,D4]:4"
D7G_b = "D3:2 [F#3,C4]:4 G2:2 [B3,D4]:4"
C_b = "C3:2 [E4,G4]:4 G3:2 [E4,G4]:4"
D7_b = "D3:2 [F#3,C4]:4 A2:2 [F#3,C4]:4"
Em_b = "E2:2 [G3,B3]:4 B2:2 [G3,B3]:4"
Am_b = "A2:2 [C4,E4]:4 E3:2 [C4,E4]:4"
Bm_b = "B2:2 [D4,F#4]:4 F#3:2 [D4,F#4]:4"

G_c = q6("G2 D3 G3 B3 G3 D3")
C_c = q6("C2 G2 C3 E3 G3 E3")
F6_c = q6("A2 C3 F3 A3 C4 A3")

Em_t = q6("G3 B3 E4 G4 E4 B3")
C_t = q6("E3 G3 C4 E4 C4 G3")
B7_t = q6("D#3 F#3 A3 D#4 A3 F#3")
AmE_t = q6("E3 A3 C4 E4 C4 A3")

# --------------------------------------------------------------------------
# The piece: (right hand, left hand voice 1, left hand voice 2 or None)
# --------------------------------------------------------------------------
BARS = [
    # A  (1-8)
    ("(B4:6 E5:2 D5:2 B4:2", Em_a, None),
    ("G4:4 A4:2 B4:6", Em_a, None),
    ("C5:6 B4:2 A4:2 G4:2", Am_a, None),
    ("A4:4 F#4:2 D#4:6)", B7_a, None),
    ("(B4:6 E5:2 F#5:2 G5:2", Em_a, None),
    ("A5:4 G5:2 E5:6", C_a, None),
    ("F#5:4 E5:2 D#5:6", B7_a, None),
    ("E5:12)", Em_a, None),
    # A' (9-16)
    ("([G4,B4]:6 E5:2 D5:2 B4:2", Em_a, None),
    ("[E4,G4]:4 A4:2 [G4,B4]:6", Em_a, None),
    ("[A4,C5]:6 B4:2 A4:2 G4:2", Am_a, None),
    ("[F#4,A4]:4 F#4:2 D#4:6)", Am6_B7, None),
    ("([G4,B4]:6 E5:2 F#5:2 G5:2", Em_a, None),
    ("A5:4 G5:2 F#5:2 E5:2 D5:2", C_a, None),
    ("[A4,C5]:4 B4:2 A4:4 F#4:2", Am_D7, None),
    ("G4:4 F#4:2 G4:2 A4:2 B4:2)", G_a, None),
    # B  (17-28)
    ("(D5:3 E5:1 D5:2 G5:4 B5:2", G_b, None),
    ("A5:3 G5:1 F#5:2 G5:6)", D7G_b, None),
    ("(E5:3 D5:1 E5:2 G5:4 C6:2", C_b, None),
    ("B5:3 A5:1 G5:2 F#5:6)", D7_b, None),
    ("(B4:3 C5:1 B4:2 E5:4 G5:2", Em_b, None),
    ("E5:3 F#5:1 E5:2 A5:4 C6:2)", Am_b, None),
    ("(F#5:3 G5:1 F#5:2 B5:4 D6:2", Bm_b, None),
    ("A5:3 B5:1 A5:2 C6:4 A5:2)", D7_b, None),
    ("([D4,D5]:6> [G4,G5]:2 [F#4,F#5]:2 [D4,D5]:2", G_c, None),
    ("[G4,G5]:6> [C5,C6]:2 [B4,B5]:2 [G4,G5]:2", C_c, None),
    ("[A4,A5]:4> [Bb4,Bb5]:2 [C5,C6]:6", F6_c, None),
    ("B5:4 A5:2 F#5:2 E5:2 D#5:2)", B7_a, None),
    # A'' (29-36)
    ("([E5,B5]:6 E6:2 D6:2 B5:2", Em_t, "E2:12"),
    ("G5:4 A5:2 B5:6", Em_t, "E2:12"),
    ("C6:6 B5:2 A5:2 G5:2", C_t, "C3:12"),
    ("A5:4 F#5:2 D#5:6)", B7_t, "B2:12"),
    ("(B4:6 E5:2 F#5:2 G5:2", Em_t, "E2:12"),
    ("A5:4 G5:2 E5:6", C_t, "C3:12"),
    ("F#5:4 E5:2 D#5:6", q6("E3 A3 C4 F#3 A3 D#4"), "A2:6 B2:6"),
    ("E5:12)", Em_t, "E2:12"),
    # Coda (37-44)
    ("(B4:6 E5:2 D5:2 B4:2", Em_t, "E2:12"),
    ("C5:4 B4:2 A4:6)", AmE_t, "E2:12"),
    ("(B4:6 E5:2 D5:2 B4:2", Em_t, "E2:12"),
    ("C5:4 B4:2 G4:6)", C_t, "E2:12"),
    ("(B4:6 A4:2 G4:2 F#4:2", Em_t, "E2:12"),
    ("E4:12)", "G3:6 B3:6", "E2:12"),
    ("[B4~,E5~]:12", q6("E2 B2 E3 G3 B3 E4"), None),
    ("[G4,B4_,E5_]:12^", "[E2,B2]:12^", None),
]
assert len(BARS) == 44

# --------------------------------------------------------------------------
# Directions: bar -> list of (offset_in_divisions, kind, payload)
#   kinds: words, tempo (words, dotted-crotchet bpm), dyn, cresc, dim, wstop
# Placement: everything goes between the staves (staff 1, below) except
# tempo marks, which sit above the top staff.
# --------------------------------------------------------------------------
DIRS = {
    1: [(0, "tempo", ("Andante, flowing  ", 54)), (0, "dyn", "p"),
        (0, "words", "legato, con Ped.")],
    5: [(0, "cresc", None)],
    7: [(0, "wstop", None), (0, "dim", None)],
    8: [(0, "wstop", None)],
    9: [(0, "dyn", "mp"), (0, "words", "espressivo")],
    13: [(0, "cresc", None)],
    16: [(11, "wstop", None)],
    17: [(0, "tempo", ("Poco più mosso  ", 63)), (0, "dyn", "mf")],
    21: [(0, "dyn", "p"), (0, "cresc", None)],
    24: [(11, "wstop", None)],
    25: [(0, "dyn", "f")],
    28: [(0, "dim", None), (0, "words", "poco rit."), (11, "wstop", None)],
    29: [(0, "tempo", ("Tempo I  ", 54)), (0, "dyn", "pp"), (0, "words", "dolce")],
    37: [(0, "words", "sempre pp")],
    41: [(0, "words", "rit.")],
    43: [(0, "dyn", "ppp")],
}
DOUBLE_BAR_AFTER = {16, 28}

TYPE_OF = {1: ("16th", 0), 2: ("eighth", 0), 3: ("eighth", 1), 4: ("quarter", 0),
           6: ("quarter", 1), 8: ("half", 0), 12: ("half", 1)}

TOKEN_RE = re.compile(r"^(\()?(\[[^\]]+\]|[A-G][#b]?\d[~_]?)(?::(\d+))([>^]*)(\))?$")
PITCH_RE = re.compile(r"^([A-G])([#b]?)(\d)([~_]?)$")


def parse_pitch(s):
    m = PITCH_RE.match(s)
    if not m:
        raise ValueError(f"bad pitch {s!r}")
    step, acc, octv, tie = m.groups()
    alter = {"#": 1, "b": -1, "": 0}[acc]
    return {"step": step, "alter": alter, "octave": int(octv), "tie": tie}


def parse_voice(s):
    notes = []
    for tok in s.split():
        m = TOKEN_RE.match(tok)
        if not m:
            raise ValueError(f"bad token {tok!r}")
        slur_start, body, dur, flags, slur_stop = m.groups()
        if body.startswith("["):
            pitches = [parse_pitch(p) for p in body[1:-1].split(",")]
        else:
            pitches = [parse_pitch(body)]
        notes.append({
            "pitches": pitches, "dur": int(dur),
            "slur_start": bool(slur_start), "slur_stop": bool(slur_stop),
            "accent": ">" in flags, "fermata": "^" in flags,
        })
    total = sum(n["dur"] for n in notes)
    if total != BAR:
        raise ValueError(f"voice {s!r} sums to {total}, expected {BAR}")
    return notes


def assign_beams(notes):
    """Beam quavers and shorter within each dotted-crotchet beat."""
    pos = 0
    groups, cur = [], []
    for n in notes:
        beat = pos // 6
        beamable = n["dur"] <= 3 and (pos + n["dur"]) <= (beat + 1) * 6
        if beamable and (not cur or cur[-1][1] == beat):
            cur.append((n, beat))
        else:
            if len(cur) > 1:
                groups.append([c[0] for c in cur])
            cur = [(n, beat)] if beamable else []
        pos += n["dur"]
    if len(cur) > 1:
        groups.append([c[0] for c in cur])
    for g in groups:
        for i, n in enumerate(g):
            b1 = "begin" if i == 0 else ("end" if i == len(g) - 1 else "continue")
            n["beams"] = [(1, b1)]
            if n["dur"] == 1:
                p16 = i > 0 and g[i - 1]["dur"] == 1
                n16 = i < len(g) - 1 and g[i + 1]["dur"] == 1
                if p16 and n16:
                    b2 = "continue"
                elif n16:
                    b2 = "begin"
                elif p16:
                    b2 = "end"
                else:
                    b2 = "backward hook" if i > 0 else "forward hook"
                n["beams"].append((2, b2))


class AccidentalState:
    def __init__(self):
        self.state = {}

    def reset(self):
        self.state = {}

    def needs(self, p):
        key = (p["step"], p["octave"])
        current = self.state.get(key, KEY_ALTER.get(p["step"], 0))
        self.state[key] = p["alter"]
        return p["alter"] != current


def note_xml(n, staff, voice, acc, stem=None):
    out = []
    ntype, dots = TYPE_OF[n["dur"]]
    for i, p in enumerate(n["pitches"]):
        lines = ["<note>"]
        if i > 0:
            lines.append("<chord/>")
        alter = f"<alter>{p['alter']}</alter>" if p["alter"] else ""
        lines.append(f"<pitch><step>{p['step']}</step>{alter}<octave>{p['octave']}</octave></pitch>")
        lines.append(f"<duration>{n['dur']}</duration>")
        if p["tie"] == "~":
            lines.append('<tie type="start"/>')
        if p["tie"] == "_":
            lines.append('<tie type="stop"/>')
        lines.append(f"<voice>{voice}</voice>")
        lines.append(f"<type>{ntype}</type>")
        lines.extend("<dot/>" for _ in range(dots))
        if acc.needs(p):
            name = {1: "sharp", -1: "flat", 0: "natural"}[p["alter"]]
            lines.append(f"<accidental>{name}</accidental>")
        if stem:
            lines.append(f"<stem>{stem}</stem>")
        lines.append(f"<staff>{staff}</staff>")
        if i == 0:
            for num, kind in n.get("beams", []):
                lines.append(f'<beam number="{num}">{kind}</beam>')
        notations = []
        if p["tie"] == "~":
            notations.append('<tied type="start"/>')
        if p["tie"] == "_":
            notations.append('<tied type="stop"/>')
        if i == 0:
            if n["slur_start"]:
                notations.append('<slur type="start" number="1"/>')
            if n["slur_stop"]:
                notations.append('<slur type="stop" number="1"/>')
            if n["accent"]:
                notations.append("<articulations><accent/></articulations>")
            if n["fermata"]:
                notations.append('<fermata type="upright"/>')
        if notations:
            lines.append("<notations>" + "".join(notations) + "</notations>")
        lines.append("</note>")
        out.append("".join(lines))
    return "\n".join(out)


def direction_xml(offset, kind, payload):
    off = f"<offset>{offset}</offset>" if offset else ""
    if kind == "tempo":
        text, bpm = payload
        return (f'<direction placement="above"><direction-type><words font-weight="bold">'
                f'{escape(text)}</words></direction-type>'
                f'<direction-type><metronome parentheses="yes"><beat-unit>quarter</beat-unit>'
                f'<beat-unit-dot/><per-minute>{bpm}</per-minute></metronome></direction-type>'
                f'{off}<staff>1</staff><sound tempo="{bpm * 1.5:g}"/></direction>')
    if kind == "dyn":
        return (f'<direction placement="below"><direction-type><dynamics><{payload}/></dynamics>'
                f'</direction-type>{off}<staff>1</staff></direction>')
    if kind == "words":
        return (f'<direction placement="below"><direction-type><words font-style="italic">'
                f'{escape(payload)}</words></direction-type>{off}<staff>1</staff></direction>')
    if kind in ("cresc", "dim"):
        t = "crescendo" if kind == "cresc" else "diminuendo"
        return (f'<direction placement="below"><direction-type><wedge type="{t}" number="1"/>'
                f'</direction-type>{off}<staff>1</staff></direction>')
    if kind == "wstop":
        return (f'<direction placement="below"><direction-type><wedge type="stop" number="1"/>'
                f'</direction-type>{off}<staff>1</staff></direction>')
    raise ValueError(kind)


def build():
    acc_rh, acc_lh = AccidentalState(), AccidentalState()
    measures = []
    for i, (rh, lh1, lh2) in enumerate(BARS, start=1):
        acc_rh.reset()
        acc_lh.reset()
        parts = [f'<measure number="{i}">']
        if i == 1:
            parts.append(
                f"<attributes><divisions>{DIV}</divisions>"
                f"<key><fifths>{KEY_FIFTHS}</fifths><mode>minor</mode></key>"
                "<time><beats>6</beats><beat-type>8</beat-type></time>"
                "<staves>2</staves>"
                '<clef number="1"><sign>G</sign><line>2</line></clef>'
                '<clef number="2"><sign>F</sign><line>4</line></clef>'
                "</attributes>")
        for off, kind, payload in sorted(DIRS.get(i, []), key=lambda d: d[0]):
            parts.append(direction_xml(off, kind, payload))
        rh_notes = parse_voice(rh)
        assign_beams(rh_notes)
        parts.extend(note_xml(n, 1, 1, acc_rh) for n in rh_notes)
        parts.append(f"<backup><duration>{BAR}</duration></backup>")
        lh_notes = parse_voice(lh1)
        assign_beams(lh_notes)
        parts.extend(note_xml(n, 2, 2, acc_lh, stem="up" if lh2 else None) for n in lh_notes)
        if lh2:
            parts.append(f"<backup><duration>{BAR}</duration></backup>")
            lh2_notes = parse_voice(lh2)
            assign_beams(lh2_notes)
            parts.extend(note_xml(n, 2, 3, acc_lh, stem="down") for n in lh2_notes)
        if i in DOUBLE_BAR_AFTER:
            parts.append('<barline location="right"><bar-style>light-light</bar-style></barline>')
        if i == len(BARS):
            parts.append('<barline location="right"><bar-style>light-heavy</bar-style></barline>')
        parts.append("</measure>")
        measures.append("\n".join(parts))

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
<work><work-title>Hollowmere</work-title></work>
<movement-title>Hollowmere</movement-title>
<identification>
<encoding><software>build_score.py</software></encoding>
</identification>
<part-list>
<score-part id="P1">
<part-name>Piano</part-name>
<part-abbreviation>Pno.</part-abbreviation>
<score-instrument id="P1-I1"><instrument-name>Piano</instrument-name></score-instrument>
<midi-instrument id="P1-I1"><midi-channel>1</midi-channel><midi-program>1</midi-program></midi-instrument>
</score-part>
</part-list>
<part id="P1">
{chr(10).join(measures)}
</part>
</score-partwise>
"""


if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "Hollowmere.musicxml"
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(build())
    print(f"wrote {out}")
