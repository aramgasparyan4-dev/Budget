#!/usr/bin/env python3
"""Builds Quickset.musicxml, a string quartet in 7/8, from the bar data below.

Durations are in divisions (4 per crotchet): quaver 2, crotchet 4, dotted
crotchet 6, minim 8, a full 7/8 bar 14.

Token syntax:  B4:6   [A3,D4]:4   r:4 (rest)   R (whole-bar rest)
               F#4~:8 tie start   F#4_:6 tie end
               ( ... ) slur       .  staccato   >  accent   ^  fermata
"""
import re
from xml.sax.saxutils import escape

DIV = 4
BAR = 14
KEY_FIFTHS = 1            # one sharp: D mixolydian, B minor middle section
KEY_ALTER = {"F": 1}
GROUP_223 = (0, 4, 8, 14)   # 2+2+3
GROUP_322 = (0, 6, 10, 14)  # 3+2+2

# --------------------------------------------------------------------------
# Building blocks
# --------------------------------------------------------------------------
def ost(root, fifth, octave, lead):
    """Cello ostinato: root, fifth, octave, then a quaver that leads on."""
    return f"{root}:4 {fifth}:4 {octave}:4 {lead}:2"

OST = {
    "D": ost("D2", "A2", "D3", "C3"),
    "C": ost("C2", "G2", "C3", "D3"),
    "G": ost("G2", "D3", "G3", "F#3"),
    "Em": ost("E2", "B2", "E3", "D3"),
    "Am": ost("A2", "E3", "A3", "G3"),
    "CD": "C2:4 D2:4 A2:4 D3:2",
}

def chop_vla(ch):
    return f"{ch}:4. {ch}:4. {ch}:6>"

def chop_v2(ch):
    return f"r:2 {ch}:2. r:2 {ch}:2. r:2 {ch}:2. r:2"

VLA_CH = {"D": "[A3,D4]", "C": "[G3,E4]", "G": "[G3,D4]", "Em": "[B3,E4]",
          "Am": "[C4,E4]", "A": "[A3,E4]"}
V2_CH = {"D": "[F#4,A4]", "C": "[G4,C5]", "G": "[G4,B4]", "Em": "[E4,B4]",
         "Am": "[E4,C5]", "A": "[E4,C#5]"}

def arp(a, b, c):
    """Viola figure for the 3+2+2 section."""
    return f"{a}:2 {b}:2 {c}:2 {b}:2 {a}:2 {c}:2 {b}:2"

HARMONY_A = ["D", "C", "D", "Am", "D", "G", "Em", "D"]   # bar 16 starts on C

TUNE = [
    "(D5:2 F#5:2) A5:4. (G5:2 F#5:2 E5:2)",
    "(D5:2 C5:2) D5:4. E5:6>",
    "(D5:2 F#5:2) A5:4. (B5:2 A5:2 G5:2)",
    "(G5:2 F#5:2) E5:4. A5:6>",
    "(D5:2 F#5:2) A5:4. (G5:2 F#5:2 E5:2)",
    "(D5:2 C5:2) B4:4. D5:6>",
    "(E5:2 F#5:2) G5:4. (A5:2 G5:2 F#5:2)",
    "(E5:2 C5:2) D5:4. D5:6>",
]

def octave_down(s):
    return re.sub(r"([A-G][#b]?)(\d)", lambda m: f"{m.group(1)}{int(m.group(2)) - 1}", s)

TUNE_8VB = [octave_down(b) for b in TUNE]

# --------------------------------------------------------------------------
# The parts, bar by bar (60 bars)
# --------------------------------------------------------------------------
VLN1 = (
    ["R"] * 6
    + ["r:4 r:4 D5:2 E5:2 F#5:2", "G5:2 A5:2 B5:2 C6:2 D6:6>"]
    + TUNE
    + ["(F#5:8 A5:6)", "(G5:8 E5:6)", "(F#5:8 D6:6)", "(C6:8 A5:6)",
       "(A5:8 F#5:6)", "(G5:8 B5:6)", "(E5:8 G5:6)", "(E5:4 F#5:4 D5:6)"]
    + ["(B4:6 C#5:2 D5:2 E5:2 F#5:2", "G5:6 F#5:4 E5:4",
       "D5:6 E5:2 D5:2 C#5:2 B4:2", "C#5:6 B4:4 A4:4)",
       "(B4:6 C#5:2 D5:2 E5:2 F#5:2", "G5:6 A5:4 B5:4",
       "A5:6 G5:2 F#5:2 E5:2 D5:2", "C#5:6 B4:4 A#4:4)"]
    + ["(D5:6 E5:2 F#5:2 G5:2 A5:2", "B5:6 A5:4 G5:4",
       "F#5:6 G5:2 F#5:2 E5:2 D5:2", "E5:6 D5:4 C#5:4)",
       "(B5:6 A5:2 G5:2 F#5:2 E5:2", "C#5:6 D5:2 E5:2 F#5:2 G5:2)",
       "G5:4> F#5:4 E5:2> F#5:2 G5:2", "A5:4> G5:4 E5:2> C#5:2 A4:2"]
    + TUNE
    + ["(D5:2 F#5:2) A5:4> r:6", "(C5:2 E5:2) G5:4> r:6", "(G5:2 B5:2) D6:4> r:6",
       "E5:2 F#5:2 G5:2 A5:2 B5:2 C6:2 D6:2"]
    + [TUNE[0], TUNE[1], "(B5:2 A5:2) G5:4. (F#5:2 E5:2 D5:2)", "C5:4> C5:4> C5:6>"]
    + ["[D5,A5]:2> r:2 [D5,A5]:2> r:2 [D5,A5]:2> r:2 r:2", "R", "R",
       "[D5,A5]:2 r:2 [D5,A5]:2 r:2 [D5,A5]:6^"]
)

VLN2 = (
    ["R"] * 4
    + [chop_v2(V2_CH["D"])] * 4
    + [chop_v2(V2_CH[h]) for h in HARMONY_A]
    + [chop_v2(V2_CH[h]) for h in HARMONY_A]
    + ["(F#4:8 D4:6", "D4:8 G4:6", "F#4:8 A4:6", "E4:8 C#4:6)",
       "(F#4:8 D4:6", "G4:8 B4:6", "G4:8 E4:6", "F#4~:8 F#4_:6)"]
    + ["(B4:6 C#5:2 D5:2 E5:2 F#5:2", "G5:6 F#5:4 E5:4",
       "D5:6 E5:2 D5:2 C#5:2 B4:2", "C#5:6 B4:4 A4:4)",
       "(G5:6 F#5:2 E5:2 D5:2 C#5:2", "A4:6 B4:2 C#5:2 D5:2 E5:2)",
       "E5:4> D5:4 C#5:2> D5:2 E5:2", "C#5:4> B4:4 G4:2> E4:2 C#4:2"]
    + TUNE_8VB
    + ["r:4 r:4 D4:2 F#4:2 A4:2", "r:4 r:4 C4:2 E4:2 G4:2", "r:4 r:4 G4:2 B4:2 D5:2",
       "E4:2 F#4:2 G4:2 A4:2 B4:2 C5:2 D5:2"]
    + [TUNE_8VB[0], TUNE_8VB[1], "(B4:2 A4:2) G4:4. (F#4:2 E4:2 D4:2)", "C4:4> C4:4> C4:6>"]
    + ["[F#4,D5]:2> r:2 [F#4,D5]:2> r:2 [F#4,D5]:2> r:2 r:2", "R", "R",
       "[F#4,D5]:2 r:2 [F#4,D5]:2 r:2 [F#4,D5]:6^"]
)

VIOLA = (
    ["R"] * 2
    + [chop_vla(VLA_CH["D"])] * 6
    + [chop_vla(VLA_CH[h]) for h in HARMONY_A[:7]] + ["[G3,E4]:4. [A3,D4]:4. [A3,D4]:6>"]
    + [octave_down(b) for b in TUNE]
    + [arp("B3", "D4", "F#4"), arp("B3", "D4", "G4"), arp("A3", "D4", "F#4"), arp("A3", "C#4", "E4"),
       arp("B3", "D4", "F#4"), arp("B3", "D4", "G4"), arp("B3", "E4", "G4"), arp("A#3", "C#4", "F#4"),
       arp("B3", "D4", "F#4"), arp("B3", "D4", "G4"), arp("A3", "D4", "F#4"), arp("A3", "C#4", "E4"),
       arp("B3", "E4", "G4"), arp("A3", "C#4", "G4"), chop_vla(VLA_CH["A"]), chop_vla(VLA_CH["A"])]
    + [chop_vla(VLA_CH[h]) for h in HARMONY_A[:7]] + ["[G3,E4]:4. [A3,D4]:4. [A3,D4]:6>"]
    + [chop_vla(VLA_CH["D"]), chop_vla(VLA_CH["C"]), chop_vla(VLA_CH["G"]),
       "E3:2 F#3:2 G3:2 A3:2 B3:2 C4:2 D4:2"]
    + [chop_vla(VLA_CH["D"]), chop_vla(VLA_CH["C"]), chop_vla(VLA_CH["G"]),
       "[G3,E4]:4> [G3,E4]:4> [G3,E4]:6>"]
    + ["[D3,A3,F#4]:2> r:2 [D3,A3,F#4]:2> r:2 [D3,A3,F#4]:2> r:2 r:2", "R",
       "[A3,D4]:4 [A3,D4]:4 [A3,D4]:6",
       "[D3,A3]:2 r:2 [D3,A3]:2 r:2 [D3,A3]:6^"]
)

CELLO_A = [OST[h] for h in HARMONY_A[:7]] + [OST["CD"]]
CELLO = (
    [OST["D"]] * 8
    + CELLO_A
    + CELLO_A
    + ["B2:8 F#2:6", "G2:8 D3:6", "D3:8 A2:6", "A2:8 E3:6",
       "B2:8 F#2:6", "G2:8 D3:6", "E2:8 B2:6", "F#2:8 C#3:6",
       "B2:8 F#2:6", "G2:8 D3:6", "D3:8 A2:6", "A2:8 E3:6",
       "E2:8 B2:6", "A2:8 E3:6", "A2:4> E3:4 A3:4> G3:2", "A2:4> E3:4 A2:4> G2:2"]
    + CELLO_A
    + [OST["D"], OST["C"], OST["G"], "E2:2 F#2:2 G2:2 A2:2 B2:2 C3:2 D3:2"]
    + [OST["D"], OST["C"], OST["G"], "C2:4> C2:4> C2:6>"]
    + ["[D2,A2]:2> r:2 [D2,A2]:2> r:2 [D2,A2]:2> r:2 r:2", OST["D"], OST["D"],
       "[D2,A2]:2 r:2 [D2,A2]:2 r:2 [D2,A2]:6^"]
)

for name, part in (("VLN1", VLN1), ("VLN2", VLN2), ("VIOLA", VIOLA), ("CELLO", CELLO)):
    assert len(part) == 60, (name, len(part))

GROUPING = {b: (GROUP_322 if 25 <= b <= 38 else GROUP_223) for b in range(1, 61)}

# --------------------------------------------------------------------------
# Directions. kinds: tempo, words, dyn, cresc, dim, wstop, pizz, arco
# --------------------------------------------------------------------------
def D(**kw):
    return kw

DIRS = {
    "vln1": {
        1: [(0, "tempo", ("Allegro ritmico  ", 150)), (0, "above", "(2+2+3)")],
        7: [(0, "dyn", "mf")], 9: [(0, "dyn", "mf")],
        17: [(0, "dyn", "p"), (0, "words", "sostenuto")],
        25: [(0, "above", "(3+2+2)"), (0, "dyn", "p"), (0, "words", "legato")],
        33: [(0, "dyn", "mp")], 37: [(0, "cresc", None)], 38: [(13, "wstop", None)],
        39: [(0, "above", "(2+2+3)"), (0, "dyn", "f"), (0, "words", "marcato")],
        41: [(0, "dyn", "f")], 49: [(0, "dyn", "f")],
        52: [(0, "cresc", None), (13, "wstop", None)], 53: [(0, "dyn", "ff")],
        60: [(0, "pizz", None), (0, "dyn", "p")],
    },
    "vln2": {
        5: [(0, "dyn", "mp")], 9: [(0, "dyn", "mf")],
        25: [(0, "dyn", "p")], 33: [(0, "dyn", "mp")],
        37: [(0, "cresc", None)], 38: [(13, "wstop", None)], 39: [(0, "dyn", "f")],
        41: [(0, "dyn", "f")], 49: [(0, "dyn", "f")],
        52: [(0, "cresc", None), (13, "wstop", None)], 53: [(0, "dyn", "ff")],
        60: [(0, "pizz", None), (0, "dyn", "p")],
    },
    "vla": {
        3: [(0, "dyn", "mp")], 9: [(0, "dyn", "mf")],
        17: [(0, "dyn", "mf"), (0, "words", "marcato, the tune")],
        25: [(0, "dyn", "p"), (0, "words", "legato")],
        37: [(0, "cresc", None)], 38: [(13, "wstop", None)], 39: [(0, "dyn", "f")],
        41: [(0, "dyn", "f")], 53: [(0, "dyn", "ff")],
        59: [(0, "pizz", None), (0, "dyn", "p")],
    },
    "vc": {
        1: [(0, "pizz", None), (0, "dyn", "p")], 3: [(0, "dyn", "mp")],
        9: [(0, "dyn", "mf")],
        25: [(0, "arco", None), (0, "dyn", "p")],
        37: [(0, "cresc", None)], 38: [(13, "wstop", None)],
        39: [(0, "dyn", "f"), (0, "words", "marcato")],
        41: [(0, "dyn", "f")], 53: [(0, "dyn", "ff")],
        58: [(0, "pizz", None), (0, "dyn", "p"), (0, "words", "subito")],
    },
}
DOUBLE_BAR_AFTER = {8, 24, 40, 48}

PARTS = [
    ("P1", "vln1", "Violin I", "Vln. I", ("G", 2), 41, VLN1),
    ("P2", "vln2", "Violin II", "Vln. II", ("G", 2), 41, VLN2),
    ("P3", "vla", "Viola", "Vla.", ("C", 3), 42, VIOLA),
    ("P4", "vc", "Cello", "Vc.", ("F", 4), 43, CELLO),
]

# --------------------------------------------------------------------------
# Parsing and XML
# --------------------------------------------------------------------------
TYPE_OF = {1: ("16th", 0), 2: ("eighth", 0), 3: ("eighth", 1), 4: ("quarter", 0),
           6: ("quarter", 1), 8: ("half", 0), 12: ("half", 1)}
TOKEN_RE = re.compile(r"^(\()?(R|r|\[[^\]]+\]|[A-G][#b]?\d[~_]?)(?::(\d+))?([>^.]*)(\))?$")
PITCH_RE = re.compile(r"^([A-G])([#b]?)(\d)([~_]?)$")


def parse_pitch(s):
    m = PITCH_RE.match(s)
    if not m:
        raise ValueError(f"bad pitch {s!r}")
    step, acc, octv, tie = m.groups()
    return {"step": step, "alter": {"#": 1, "b": -1, "": 0}[acc], "octave": int(octv), "tie": tie}


def parse_voice(s):
    notes = []
    for tok in s.split():
        m = TOKEN_RE.match(tok)
        if not m:
            raise ValueError(f"bad token {tok!r}")
        slur_start, body, dur, flags, slur_stop = m.groups()
        if body == "R":
            notes.append({"rest": True, "whole": True, "dur": BAR, "pitches": [],
                          "slur_start": False, "slur_stop": False, "accent": False,
                          "fermata": "^" in flags, "staccato": False})
            continue
        if dur is None:
            raise ValueError(f"missing duration in {tok!r}")
        n = {"rest": body == "r", "whole": False, "dur": int(dur),
             "slur_start": bool(slur_start), "slur_stop": bool(slur_stop),
             "accent": ">" in flags, "fermata": "^" in flags, "staccato": "." in flags}
        if body == "r":
            n["pitches"] = []
        elif body.startswith("["):
            n["pitches"] = [parse_pitch(p) for p in body[1:-1].split(",")]
        else:
            n["pitches"] = [parse_pitch(body)]
        notes.append(n)
    total = sum(n["dur"] for n in notes)
    if total != BAR:
        raise ValueError(f"voice {s!r} sums to {total}, expected {BAR}")
    return notes


def beat_index(pos, grouping):
    for i in range(len(grouping) - 1):
        if grouping[i] <= pos < grouping[i + 1]:
            return i
    raise ValueError(pos)


def assign_beams(notes, grouping):
    pos = 0
    groups, cur = [], []
    for n in notes:
        b = beat_index(pos, grouping)
        beamable = (not n["rest"]) and n["dur"] <= 3 and pos + n["dur"] <= grouping[b + 1]
        if beamable and (not cur or cur[-1][1] == b):
            cur.append((n, b))
        else:
            if len(cur) > 1:
                groups.append([c[0] for c in cur])
            cur = [(n, b)] if beamable else []
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
                b2 = ("continue" if p16 and n16 else "begin" if n16 else "end" if p16
                      else "backward hook" if i > 0 else "forward hook")
                n["beams"].append((2, b2))


class AccidentalState:
    def __init__(self):
        self.state = {}

    def needs(self, p):
        key = (p["step"], p["octave"])
        current = self.state.get(key, KEY_ALTER.get(p["step"], 0))
        self.state[key] = p["alter"]
        return p["alter"] != current


def note_xml(n, acc):
    if n["rest"]:
        if n["whole"]:
            ferm = '<notations><fermata type="upright"/></notations>' if n["fermata"] else ""
            return f'<note><rest measure="yes"/><duration>{BAR}</duration><voice>1</voice>{ferm}</note>'
        ntype, dots = TYPE_OF[n["dur"]]
        return (f"<note><rest/><duration>{n['dur']}</duration><voice>1</voice><type>{ntype}</type>"
                + "<dot/>" * dots + "</note>")
    out = []
    ntype, dots = TYPE_OF[n["dur"]]
    for i, p in enumerate(n["pitches"]):
        L = ["<note>"]
        if i > 0:
            L.append("<chord/>")
        alter = f"<alter>{p['alter']}</alter>" if p["alter"] else ""
        L.append(f"<pitch><step>{p['step']}</step>{alter}<octave>{p['octave']}</octave></pitch>")
        L.append(f"<duration>{n['dur']}</duration>")
        if p["tie"] == "~":
            L.append('<tie type="start"/>')
        if p["tie"] == "_":
            L.append('<tie type="stop"/>')
        L.append(f"<voice>1</voice><type>{ntype}</type>" + "<dot/>" * dots)
        if acc.needs(p):
            L.append(f"<accidental>{ {1: 'sharp', -1: 'flat', 0: 'natural'}[p['alter']] }</accidental>")
        if i == 0:
            for num, kind in n.get("beams", []):
                L.append(f'<beam number="{num}">{kind}</beam>')
        nots = []
        if p["tie"] == "~":
            nots.append('<tied type="start"/>')
        if p["tie"] == "_":
            nots.append('<tied type="stop"/>')
        if i == 0:
            if n["slur_start"]:
                nots.append('<slur type="start" number="1"/>')
            if n["slur_stop"]:
                nots.append('<slur type="stop" number="1"/>')
            arts = ("<accent/>" if n["accent"] else "") + ("<staccato/>" if n["staccato"] else "")
            if arts:
                nots.append(f"<articulations>{arts}</articulations>")
            if n["fermata"]:
                nots.append('<fermata type="upright"/>')
        if nots:
            L.append("<notations>" + "".join(nots) + "</notations>")
        L.append("</note>")
        out.append("".join(L))
    return "\n".join(out)


def direction_xml(offset, kind, payload):
    off = f"<offset>{offset}</offset>" if offset else ""
    if kind == "tempo":
        text, bpm = payload
        return (f'<direction placement="above"><direction-type><words font-weight="bold">{escape(text)}'
                f'</words></direction-type><direction-type><metronome parentheses="yes">'
                f'<beat-unit>quarter</beat-unit><per-minute>{bpm}</per-minute></metronome>'
                f'</direction-type>{off}<sound tempo="{bpm}"/></direction>')
    if kind == "above":
        return (f'<direction placement="above"><direction-type><words>{escape(payload)}</words>'
                f'</direction-type>{off}</direction>')
    if kind == "dyn":
        return (f'<direction placement="below"><direction-type><dynamics><{payload}/></dynamics>'
                f'</direction-type>{off}</direction>')
    if kind == "words":
        return (f'<direction placement="below"><direction-type><words font-style="italic">'
                f'{escape(payload)}</words></direction-type>{off}</direction>')
    if kind == "pizz":
        return ('<direction placement="above"><direction-type><words>pizz.</words></direction-type>'
                f'{off}<sound pizzicato="yes"/></direction>')
    if kind == "arco":
        return ('<direction placement="above"><direction-type><words>arco</words></direction-type>'
                f'{off}<sound pizzicato="no"/></direction>')
    if kind in ("cresc", "dim"):
        t = "crescendo" if kind == "cresc" else "diminuendo"
        return (f'<direction placement="below"><direction-type><wedge type="{t}" number="1"/>'
                f'</direction-type>{off}</direction>')
    if kind == "wstop":
        return (f'<direction placement="below"><direction-type><wedge type="stop" number="1"/>'
                f'</direction-type>{off}</direction>')
    raise ValueError(kind)


def build():
    part_xml = []
    for pid, key, name, abbrev, (clef_sign, clef_line), program, bars in PARTS:
        measures = []
        for i, bar in enumerate(bars, start=1):
            acc = AccidentalState()
            parts = [f'<measure number="{i}">']
            if i == 1:
                parts.append(
                    f"<attributes><divisions>{DIV}</divisions>"
                    f"<key><fifths>{KEY_FIFTHS}</fifths><mode>major</mode></key>"
                    "<time><beats>7</beats><beat-type>8</beat-type></time>"
                    f"<clef><sign>{clef_sign}</sign><line>{clef_line}</line></clef></attributes>")
            for off, kind, payload in sorted(DIRS[key].get(i, []), key=lambda d: d[0]):
                parts.append(direction_xml(off, kind, payload))
            notes = parse_voice(bar)
            assign_beams(notes, GROUPING[i])
            parts.extend(note_xml(n, acc) for n in notes)
            if i in DOUBLE_BAR_AFTER:
                parts.append('<barline location="right"><bar-style>light-light</bar-style></barline>')
            if i == len(bars):
                parts.append('<barline location="right"><bar-style>light-heavy</bar-style></barline>')
            parts.append("</measure>")
            measures.append("\n".join(parts))
        part_xml.append(f'<part id="{pid}">\n' + "\n".join(measures) + "\n</part>")

    score_parts = "\n".join(
        f'<score-part id="{pid}"><part-name>{name}</part-name><part-abbreviation>{abbrev}</part-abbreviation>'
        f'<score-instrument id="{pid}-I1"><instrument-name>{name}</instrument-name></score-instrument>'
        f'<midi-instrument id="{pid}-I1"><midi-channel>{n + 1}</midi-channel><midi-program>{program}</midi-program>'
        f'</midi-instrument></score-part>'
        for n, (pid, key, name, abbrev, clef, program, bars) in enumerate(PARTS))
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
<work><work-title>Quickset</work-title></work>
<movement-title>Quickset</movement-title>
<identification><encoding><software>build_quickset.py</software></encoding></identification>
<part-list>
<part-group type="start" number="1"><group-symbol>bracket</group-symbol><group-barline>yes</group-barline></part-group>
{score_parts}
<part-group type="stop" number="1"/>
</part-list>
{chr(10).join(part_xml)}
</score-partwise>
"""


if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "Quickset.musicxml"
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(build())
    print(f"wrote {out}")
