"""Chemistry Topic 12 - Experimental Techniques and Chemical Analysis (Cambridge IGCSE 0620, Extended)."""
import math
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from notes import render, svg, text, INK  # noqa: E402

TITLE = "Chemistry 0620 - Topic 12: Experimental Techniques and Chemical Analysis"

GLASS = "#262626"
WATER = "#cfe3f7"
LBL = "#444"


def line(x1, y1, x2, y2, color=GLASS, w=1.6, extra=""):
    return (f'<path d="M{x1:.1f},{y1:.1f} L{x2:.1f},{y2:.1f}" stroke="{color}" '
            f'stroke-width="{w}" fill="none" {extra}/>')


def label(x, y, s, lx, ly, anchor="start", size=12):
    """Text at (x, y) with a thin leader line to the point (lx, ly)."""
    return (line(lx, ly, x - (3 if anchor == "start" else -3), y - 4, "#888", 1)
            + text(x, y, s, size, anchor=anchor, color=LBL))


# ---------------- diagrams ----------------

def fig_filtration():
    s = ""
    # funnel cone and stem
    s += (f'<path d="M50,20 L170,20 L118,92 L118,140 M102,140 L102,92 L50,20" '
          f'fill="none" stroke="{GLASS}" stroke-width="1.8"/>')
    # filter paper (dashed, inside the cone)
    s += (f'<path d="M58,24 L162,24 L110,88 Z" fill="#fbfbf4" stroke="#999" '
          f'stroke-width="1.2" stroke-dasharray="4,3"/>')
    # liquid + residue in the paper
    s += '<path d="M78,48 L142,48 L110,86 Z" fill="#e7f0fa" stroke="none"/>'
    for x, y in [(104, 78), (112, 80), (108, 72), (116, 74), (100, 70), (120, 68),
                 (110, 64), (96, 62), (124, 61)]:
        s += f'<circle cx="{x}" cy="{y}" r="2.6" fill="#8d6e63"/>'
    # drips
    s += '<path d="M110,150 q-3,6 0,8 q3,-2 0,-8" fill="#90b8e0"/>'
    # conical flask
    s += (f'<path d="M96,152 L96,170 L54,240 L166,240 L124,170 L124,152" fill="none" '
          f'stroke="{GLASS}" stroke-width="1.8"/>')
    s += f'<path d="M66,220 L154,220 L166,240 L54,240 Z" fill="{WATER}" stroke="none"/>'
    s += label(196, 34, "filter paper", 150, 30)
    s += label(196, 74, "residue (insoluble", 122, 70)
    s += text(196, 89, "solid left on paper)", 12, anchor="start", color=LBL)
    s += label(196, 226, "filtrate (liquid that", 150, 230)
    s += text(196, 241, "passes through)", 12, anchor="start", color=LBL)
    return svg(360, 255, s, width_mm=74)


def condenser(x1, y1, x2, y2):
    """Liebig condenser along the line (x1,y1)->(x2,y2) with water jacket."""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    nx, ny = -uy, ux
    s = ""
    # inner tube (extends beyond the jacket at both ends)
    for o in (-3.5, 3.5):
        s += line(x1 + nx * o, y1 + ny * o, x2 + nx * o, y2 + ny * o, w=1.4)
    # jacket from 15% to 85% of the length
    a, b = 0.12, 0.88
    jx1, jy1 = x1 + dx * a, y1 + dy * a
    jx2, jy2 = x1 + dx * b, y1 + dy * b
    pts = [(jx1 + nx * 12, jy1 + ny * 12), (jx2 + nx * 12, jy2 + ny * 12),
           (jx2 - nx * 12, jy2 - ny * 12), (jx1 - nx * 12, jy1 - ny * 12)]
    poly = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    s = (f'<polygon points="{poly}" fill="{WATER}" stroke="{GLASS}" stroke-width="1.6"/>' + s)
    # water in at the lower end, underneath (+n side); out at the upper end, on top (-n side)
    inx, iny = jx2 + nx * 12 - ux * 14, jy2 + ny * 12 - uy * 14
    outx, outy = jx1 - nx * 12 + ux * 14, jy1 - ny * 12 + uy * 14
    s += line(inx, iny, inx + nx * 14, iny + ny * 14, w=3, color="#5b8fc7")
    s += line(outx, outy, outx - nx * 14, outy - ny * 14, w=3, color="#5b8fc7")
    return s, (inx + nx * 14, iny + ny * 14), (outx - nx * 14, outy - ny * 14)


def flame(cx, cy):
    return (f'<path d="M{cx},{cy} q-9,-14 0,-30 q9,16 0,30 Z" fill="#ffb74d" stroke="#e65100" '
            f'stroke-width="1.2"/>' + f'<rect x="{cx-7}" y="{cy}" width="14" height="22" '
            f'fill="#bdbdbd" stroke="{GLASS}" stroke-width="1.2"/>')


def fig_distillation(fractional=False):
    s = ""
    cx, cy, r = 100, 200, 38
    # flask with liquid
    s += f'<path d="M{cx-r+6},{cy+12} A{r},{r} 0 0 0 {cx+r-6},{cy+12} Z" fill="{WATER}"/>'
    if fractional:
        top = 62
        s += (f'<path d="M{cx-8},{cy-r+3} L{cx-8},{145} L{cx-12},{141} L{cx-12},{top} '
              f'M{cx+8},{cy-r+3} L{cx+8},{145} L{cx+12},{141} L{cx+12},{top}" fill="none" '
              f'stroke="{GLASS}" stroke-width="1.6"/>')
        for i in range(9):
            for j in (-5, 0, 5):
                yy = 82 + i * 6.5 + (2 if j == 0 else 0)
                s += f'<circle cx="{cx + j}" cy="{yy:.1f}" r="2.6" fill="#eee" stroke="#777" stroke-width=".8"/>'
        arm_y = top + 8
        neck_r = 12
    else:
        top = 112
        s += (f'<path d="M{cx-8},{cy-r+3} L{cx-8},{top} M{cx+8},{cy-r+3} L{cx+8},{top}" '
              f'fill="none" stroke="{GLASS}" stroke-width="1.6"/>')
        arm_y = top + 10
        neck_r = 8
    s += (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{GLASS}" stroke-width="1.8"/>')
    # stopper + thermometer with bulb level with the side arm
    s += f'<rect x="{cx-neck_r-2}" y="{top-8}" width="{2*neck_r+4}" height="9" fill="#9e9e9e"/>'
    s += line(cx, top - 34, cx, arm_y, w=2.2)
    s += f'<circle cx="{cx}" cy="{arm_y+2}" r="3.4" fill="#c62828"/>'
    # side arm into condenser
    ex, ey = cx + neck_r + 210, arm_y + 92
    cs, win, wout = condenser(cx + neck_r, arm_y, ex, ey)
    s += cs
    # receiver beaker with distillate
    bx = ex - 18
    s += (f'<path d="M{bx},{ey+8} L{bx+4},{ey+66} L{bx+56},{ey+66} L{bx+60},{ey+8}" fill="none" '
          f'stroke="{GLASS}" stroke-width="1.8"/>')
    s += f'<path d="M{bx+2.6},{ey+46} L{bx+57.4},{ey+46} L{bx+56},{ey+66} L{bx+4},{ey+66} Z" fill="{WATER}"/>'
    # heat
    s += flame(cx, cy + r + 34)
    s += text(cx + 24, cy + r + 30, "heat", 12, anchor="start", color=LBL)
    # labels
    s += text(cx + 10, top - 40, "thermometer: bulb level", 11.5, anchor="start", color=LBL)
    s += text(cx + 10, top - 27, "with the side arm", 11.5, anchor="start", color=LBL)
    s += text(win[0], win[1] + 13, "cold water in", 11.5, anchor="middle", color="#1d3c8c")
    s += text(wout[0], wout[1] - 5, "water out", 11.5, anchor="middle", color="#1d3c8c")
    s += text(bx + 30, ey + 82, "distillate", 12, color=LBL)
    s += text(cx + 46, cy + 34, "solution" if not fractional else "mixture of", 11.5,
              anchor="start", color=LBL)
    if fractional:
        s += text(cx + 46, cy + 48, "liquids", 11.5, anchor="start", color=LBL)
        s += text(cx - 18, 105, "fractionating", 11.5, anchor="end", color=LBL)
        s += text(cx - 18, 118, "column with", 11.5, anchor="end", color=LBL)
        s += text(cx - 18, 131, "glass beads", 11.5, anchor="end", color=LBL)
    s += text((cx + ex) / 2 + 30, (arm_y + ey) / 2 - 26, "condenser", 12, color=LBL)
    return svg(400, 315, s, width_mm=86)


def fig_chromatogram():
    s = ""
    x0, x1, base, front = 30, 200, 222, 52
    s += f'<rect x="{x0}" y="16" width="{x1-x0}" height="234" fill="#fff" stroke="{GLASS}" stroke-width="1.6"/>'
    s += line(x0, base, x1, base, "#777", 1.2, 'stroke-dasharray="5,3"')
    s += line(x0, front, x1, front, "#1d3c8c", 1.2, 'stroke-dasharray="5,3"')
    s += text(x1 + 6, front + 4, "solvent front", 11.5, anchor="start", color="#1d3c8c")
    s += text(x1 + 6, base + 4, "baseline (pencil)", 11.5, anchor="start", color=LBL)
    unit = (base - front) / 8.0          # pixels per cm, solvent moved 8.0 cm
    yA = base - 3.2 * unit
    yB = base - 6.0 * unit
    lanes = {"A": (70, [(yA, "#e53935")]), "B": (115, [(yB, "#1e88e5")]),
             "X": (160, [(yA, "#e53935"), (yB, "#1e88e5")])}
    for name, (x, spots) in lanes.items():
        s += f'<circle cx="{x}" cy="{base}" r="3" fill="none" stroke="#999"/>'
        for y, c in spots:
            s += f'<ellipse cx="{x}" cy="{y:.1f}" rx="8" ry="6" fill="{c}" opacity=".75"/>'
        s += text(x, base + 20, name, 14)
    # measurement arrows for A
    ax = 46
    s += (f'<path d="M{ax},{base} L{ax},{front+3}" stroke="#2e7d32" stroke-width="1.4" '
          f'marker-end="url(#ah)"/>')
    s += (f'<path d="M{ax+10},{base} L{ax+10},{yA+3:.1f}" stroke="#c62828" stroke-width="1.4" '
          f'marker-end="url(#ah)"/>')
    s += text(x1 + 6, 110, "solvent: 8.0 cm", 11.5, anchor="start", color="#2e7d32")
    s += text(x1 + 6, 126, "spot A: 3.2 cm", 11.5, anchor="start", color="#c62828")
    s += text(x1 + 6, 142, "spot B: 6.0 cm", 11.5, anchor="start", color="#1e88e5")
    return svg(320, 260, s, width_mm=70)


# ---------------- content ----------------

STYLE = """<style>
.long { break-inside: auto; }
.long tr { break-inside: avoid; }
.qa td:nth-child(1) { width: 17%; font-weight: 700; }
.qa td:nth-child(2), .qa td:nth-child(3) { width: 41.5%; }
.pp { color: #1d3c8c; font-weight: 700; }
</style>"""

BODY = STYLE + f"""
<h1>Topic 12 &nbsp;Experimental Techniques and Chemical Analysis</h1>
<div class="meta">Cambridge IGCSE Chemistry 0620 &middot; Extended &middot; Sections 1&ndash;3 match
the SaveMyExams sub-topics, so you can do their questions after each one</div>

<h2><span class="num">1</span>Experimental Techniques</h2>
<h3>Measuring apparatus</h3>
<table class="k">
<tr><th style="width:15%">Measure</th><th style="width:30%">Apparatus</th><th>Notes</th></tr>
<tr><td>Time</td><td>stopwatch / stop-clock</td><td>units: seconds (s) or minutes</td></tr>
<tr><td>Temperature</td><td>thermometer</td><td>units: &deg;C</td></tr>
<tr><td>Mass</td><td>(top-pan) balance</td><td>units: g</td></tr>
<tr><td rowspan="4">Volume <span class="small">(cm<sup>3</sup>)</span></td><td><b>measuring cylinder</b></td>
    <td>quick, but the <b>least precise</b>; fine when an approximate volume is enough</td></tr>
<tr><td><b>volumetric pipette</b></td><td>delivers <b>one fixed volume</b> (e.g. 25.0 cm<sup>3</sup>) very precisely; use
    a pipette filler, never your mouth</td></tr>
<tr><td><b>burette</b></td><td>delivers <b>variable</b> volumes precisely (0&ndash;50 cm<sup>3</sup>); used in titrations</td></tr>
<tr><td><b>gas syringe</b></td><td>measures the volume of a gas (usually up to 100 cm<sup>3</sup>)</td></tr>
</table>

<div class="box exam"><span class="lbl">Advantages and disadvantages &mdash; what examiners look for</span>
<b>Pipette or burette vs measuring cylinder:</b> pipette/burette are more precise; measuring cylinder is
quicker but less precise.<br>
<b>Gas syringe vs collecting gas over water:</b> the syringe gives a more precise reading and works for
gases that dissolve in water (e.g. NH<sub>3</sub>, HCl, SO<sub>2</sub>); collecting over water can&rsquo;t be used for
soluble gases.<br>
<b>Beakers</b> only give a rough volume &mdash; never choose one to <i>measure</i> volume.</div>

<h3>Acid&ndash;base titration</h3>
<p>Used to find the exact volume of one solution that reacts with a known volume of another (e.g. to find a
concentration, or to make a pure salt).</p>
<ol>
<li>Rinse the burette with the acid, then fill it. Remove the air bubble from the tip and record the
<b>initial reading</b> (read the bottom of the meniscus at eye level).</li>
<li>Use a <b>volumetric pipette</b> (with a pipette filler) to put 25.0 cm<sup>3</sup> of alkali into a
<b>conical flask</b>.</li>
<li>Add a few drops of a <b>suitable indicator</b>. Stand the flask on a white tile so the colour change is
easy to see.</li>
<li>Add acid from the burette while swirling the flask. Near the end, add it <b>drop by drop</b>.</li>
<li>Stop at the <b>end-point</b>: the indicator <span class="hl">just changes colour permanently</span>.
Record the <b>final reading</b>. Titre = final reading &minus; initial reading.</li>
<li>Do a rough titration first, then repeat accurately until you get <b>concordant results</b> (titres that
agree closely, e.g. within 0.10 cm<sup>3</sup>). Use the mean of the concordant titres.</li>
</ol>
<table class="c">
<tr><th style="text-align:left">Indicator</th><th>Colour in acid</th><th>Colour in alkali</th></tr>
<tr><td class="k" style="text-align:left">methyl orange</td><td>red</td><td>yellow</td></tr>
<tr><td class="k" style="text-align:left">thymolphthalein</td><td>colourless</td><td>blue</td></tr>
<tr><td class="k" style="text-align:left">litmus</td><td>red</td><td>blue</td></tr>
</table>
<div class="box warn"><span class="lbl">Watch out</span>
Don&rsquo;t use <b>universal indicator</b> in a titration: it changes colour gradually through many colours, so there
is no sharp end-point. &middot; The burette scale reads <b>downwards</b> (0.0 at the top). &middot; A
<b>volumetric</b> pipette, not a measuring cylinder, for the fixed volume.</div>

<h2><span class="num">2</span>Separation &amp; Purification</h2>
<div class="box def"><span class="lbl">Definitions</span>
<b>Solvent</b> &ndash; a substance that dissolves a solute.<br>
<b>Solute</b> &ndash; a substance that is dissolved in a solvent.<br>
<b>Solution</b> &ndash; a mixture of one or more solutes dissolved in a solvent.<br>
<b>Saturated solution</b> &ndash; a solution containing the maximum concentration of a solute dissolved in the solvent
at a specified temperature.<br>
<b>Residue</b> &ndash; a substance that remains after evaporation, distillation, filtration or any similar process.<br>
<b>Filtrate</b> &ndash; a liquid or solution that has passed through a filter.</div>

<table class="k long">
<thead><tr><th style="width:18%">Method</th><th style="width:26%">Separates</th><th>How it works</th>
<th style="width:19%">Example</th></tr></thead>
<tr><td>Filtration</td><td>an <b>insoluble solid</b> from a liquid</td><td>The solid stays on the filter paper as the
<b>residue</b>; the liquid passes through as the <b>filtrate</b>.</td><td>sand from water</td></tr>
<tr><td>Dissolving + filtration</td><td>a <b>soluble</b> solid from an <b>insoluble</b> one</td><td>Add a solvent that
dissolves only one of them, stir, filter, then crystallise the filtrate.</td><td>salt from sand</td></tr>
<tr><td>Crystallisation</td><td>a <b>dissolved solid</b> from its solution</td><td>Heat to evaporate some solvent until
the solution is saturated (crystals form on a glass rod dipped in and taken out). Leave to cool &rarr;
crystals form. Filter, wash with a little cold solvent, dry between filter papers.</td>
<td>copper(II) sulfate crystals</td></tr>
<tr><td>Simple distillation</td><td>a <b>solvent</b> from a solution</td><td>The solvent boils, the vapour is cooled in
the condenser and collected as the <b>distillate</b>. The solute stays in the flask.</td><td>pure water from
sea water</td></tr>
<tr><td>Fractional distillation</td><td><b>liquids that mix</b> but have <b>different boiling points</b></td>
<td>The liquid with the <b>lowest boiling point</b> reaches the top of the fractionating column first and
distils over while the thermometer reads its boiling point. The column gives a large surface area for repeated
condensing and boiling.</td><td>ethanol from water; crude oil</td></tr>
<tr><td>Chromatography</td><td>a mixture of <b>soluble</b> substances (e.g. dyes)</td><td>Substances move up the
paper different distances depending on their solubility in the solvent and attraction to the paper.</td>
<td>colours in ink</td></tr>
</table>


<div class="row">
<div>
<h3>Choosing a method</h3>
<table class="k">
<tr><th style="width:50%">If you have&hellip;</th><th>Use</th></tr>
<tr><td>an insoluble solid in a liquid</td><td>filtration</td></tr>
<tr><td>a solid dissolved in a liquid, and you want the solid</td><td>crystallisation</td></tr>
<tr><td>a solid dissolved in a liquid, and you want the liquid</td><td>simple distillation</td></tr>
<tr><td>two (or more) liquids that mix, with different boiling points</td><td>fractional distillation</td></tr>
<tr><td>two solids, one soluble in a solvent and one not</td><td>dissolve, filter, crystallise</td></tr>
<tr><td>several soluble coloured (or colourless) substances</td><td>chromatography</td></tr>
</table>
</div>
<figure style="flex:0 0 64mm">{fig_filtration()}<figcaption>Filtration</figcaption></figure>
</div>
<div class="box exam" style="margin-top:14px"><span class="lbl">Why crystallise, not evaporate to dryness?</span>
Heating to dryness can decompose the product or drive off its water of crystallisation, and any soluble
impurities would be left in the solid. Crystallising leaves most impurities behind in the solution.</div>

<div class="row">
<figure>{fig_distillation(False)}<figcaption>Simple distillation</figcaption></figure>
<figure>{fig_distillation(True)}<figcaption>Fractional distillation</figcaption></figure>
</div>
<div class="box warn"><span class="lbl">Watch out &mdash; labelled-diagram marks</span>
Thermometer bulb <b>level with the side arm</b> (it measures the vapour, not the liquid) &middot; condenser water
goes <b>in at the bottom, out at the top</b>, so the jacket stays full of cold water &middot; the condenser must
not be sealed at the end.</div>


<h3>Chromatography</h3>
<div class="row">
<div>
<ol>
<li>Draw a <b>baseline in pencil</b> (pencil doesn&rsquo;t dissolve in the solvent and run).</li>
<li>Put small spots of each sample on the line.</li>
<li>Stand the paper in a beaker with solvent <b>below the baseline</b> (so the spots don&rsquo;t dissolve into the
solvent in the beaker). Put a lid on.</li>
<li>Remove the paper when the solvent is near the top; mark the <b>solvent front</b> and let it dry.</li>
<li><b>Colourless</b> substances: spray with a <b>locating agent</b>, which makes the spots visible.</li>
</ol>
<p><b>Reading a chromatogram:</b></p>
<ul>
<li>A <b>pure</b> substance gives <b>one spot</b>; an <b>impure</b> one gives more than one.</li>
<li>An unknown matches a known substance if its spot travels the <b>same distance</b> (same R<sub>f</sub>) in the
same solvent.</li>
<li>A spot left on the baseline did not dissolve in that solvent.</li>
</ul>
</div>
<figure style="flex:0 0 72mm">{fig_chromatogram()}<figcaption>X contains A and B</figcaption></figure>
</div>

<div class="box exam"><span class="lbl">R<sub>f</sub> value</span>
<p style="margin:0">R<sub>f</sub> = <span class="hl">distance travelled by substance &divide; distance travelled by solvent</span>
&nbsp;(both measured from the baseline)</p>
<p style="margin:0">Spot A: R<sub>f</sub> = 3.2 &divide; 8.0 = <b>0.40</b> &nbsp;&middot;&nbsp; Spot B: R<sub>f</sub> = 6.0 &divide; 8.0 =
<b>0.75</b></p>
<p class="small" style="margin:0">R<sub>f</sub> has no units and is always less than 1. Measure to the centre of the spot.</p></div>

<h3>Purity</h3>
<ul>
<li>A pure substance has a <b>sharp, fixed</b> melting point and boiling point (pure water: melts at 0 &deg;C,
boils at 100 &deg;C).</li>
<li>Impurities <b>lower</b> the melting point (and make it melt over a <b>range</b> of temperatures) and
<b>raise</b> the boiling point.</li>
<li>So: compare the measured melting/boiling point with the data-book value to identify a substance and to
judge how pure it is.</li>
<li>Purity matters for foods and medicines, where impurities could be harmful.</li>
</ul>

<h2><span class="num">3</span>Identification of Ions &amp; Gases</h2>
<p>The practical papers print these tests at the back as &ldquo;Notes for use in qualitative analysis&rdquo;, but
<b>the theory papers don&rsquo;t</b> &mdash; so learn them. They are also the fastest marks in the exam once you
know them.</p>

<div class="keep">
<h3>Tests for aqueous cations</h3>
<p class="small">Add a few drops of the reagent, then <b>excess</b>. &ldquo;Soluble in excess&rdquo; = the
precipitate dissolves when more reagent is added.</p>
<table class="qa long">
<thead><tr><th>Cation</th><th>Aqueous sodium hydroxide</th><th>Aqueous ammonia</th></tr></thead>
<tr><td>aluminium, Al<sup>3+</sup></td><td>white ppt., <b>soluble in excess</b>, giving a colourless solution</td>
<td>white ppt., insoluble in excess</td></tr>
<tr><td>ammonium, NH<sub>4</sub><sup>+</sup></td><td>ammonia produced on warming</td><td>&mdash;</td></tr>
<tr><td>calcium, Ca<sup>2+</sup></td><td>white ppt., insoluble in excess</td><td>no ppt. or very slight white ppt.</td></tr>
<tr><td>chromium(III), Cr<sup>3+</sup></td><td>green ppt., soluble in excess</td><td>green ppt., insoluble in excess</td></tr>
<tr><td>copper(II), Cu<sup>2+</sup></td><td>light blue ppt., insoluble in excess</td><td>light blue ppt.,
<b>soluble in excess, giving a dark blue solution</b></td></tr>
<tr><td>iron(II), Fe<sup>2+</sup></td><td>green ppt., insoluble in excess, ppt. turns brown near the surface on
standing</td><td>green ppt., insoluble in excess, ppt. turns brown near the surface on standing</td></tr>
<tr><td>iron(III), Fe<sup>3+</sup></td><td>red-brown ppt., insoluble in excess</td><td>red-brown ppt., insoluble in excess</td></tr>
<tr><td>zinc, Zn<sup>2+</sup></td><td>white ppt., <b>soluble in excess</b>, giving a colourless solution</td>
<td>white ppt., <b>soluble in excess</b>, giving a colourless solution</td></tr>
</table>
</div>

<div class="box exam"><span class="lbl">Telling the white precipitates apart (common question)</span>
<table class="c" style="margin:2px 0 0; background:transparent">
<tr><th></th><th>Al<sup>3+</sup></th><th>Ca<sup>2+</sup></th><th>Zn<sup>2+</sup></th></tr>
<tr><td class="k">excess NaOH(aq)</td><td>dissolves</td><td>stays</td><td>dissolves</td></tr>
<tr><td class="k">excess NH<sub>3</sub>(aq)</td><td>stays</td><td>(little or no ppt.)</td><td>dissolves</td></tr>
</table>
<p style="margin:2px 0 0">So: <b>Zn<sup>2+</sup></b> dissolves in excess of <i>both</i>; <b>Al<sup>3+</sup></b> only in NaOH;
<b>Ca<sup>2+</sup></b> in neither (and gives little or no precipitate with ammonia). The flame test also confirms
calcium (orange-red).</p></div>

<div class="row">
<div style="flex:0 0 74mm">
<h3>Flame tests</h3>
<table class="k c">
<tr><th style="text-align:left">Cation</th><th>Flame colour</th></tr>
<tr><td style="text-align:left">lithium, Li<sup>+</sup></td><td>red</td></tr>
<tr><td style="text-align:left">sodium, Na<sup>+</sup></td><td>yellow</td></tr>
<tr><td style="text-align:left">potassium, K<sup>+</sup></td><td>lilac</td></tr>
<tr><td style="text-align:left">calcium, Ca<sup>2+</sup></td><td>orange-red</td></tr>
<tr><td style="text-align:left">barium, Ba<sup>2+</sup></td><td>light green</td></tr>
<tr><td style="text-align:left">copper(II), Cu<sup>2+</sup></td><td>blue-green</td></tr>
</table>
</div>
<div>
<h3>Doing a flame test</h3>
<p>Clean a wire loop (nichrome or platinum) by dipping it in acid and holding it in a hot Bunsen flame until it
gives no colour. Dip it in the sample, then hold it in the hot (blue) part of the flame and observe the colour.</p>
<div class="box warn"><span class="lbl">Watch out</span>
Lithium = <b>red</b>, calcium = <b>orange-red</b>: don&rsquo;t swap them. A dirty loop gives a false colour
(sodium&rsquo;s yellow can hide other colours).</div>
</div>
</div>

<h3>Tests for anions</h3>
<table class="k long">
<thead><tr><th style="width:16%">Anion</th><th style="width:44%">Test</th><th>Result</th></tr></thead>
<tr><td>carbonate, CO<sub>3</sub><sup>2&minus;</sup></td><td>add dilute acid, then test for carbon dioxide gas</td>
<td>effervescence; carbon dioxide produced (turns limewater milky)</td></tr>
<tr><td>chloride, Cl<sup>&minus;</sup></td><td rowspan="3">acidify with dilute <b>nitric acid</b>, then add
aqueous <b>silver nitrate</b></td><td><b>white</b> ppt.</td></tr>
<tr><td>bromide, Br<sup>&minus;</sup></td><td><b>cream</b> ppt.</td></tr>
<tr><td>iodide, I<sup>&minus;</sup></td><td><b>yellow</b> ppt.</td></tr>
<tr><td>nitrate, NO<sub>3</sub><sup>&minus;</sup></td><td>add aqueous sodium hydroxide, then aluminium foil; warm
carefully</td><td>ammonia produced (turns damp red litmus paper blue)</td></tr>
<tr><td>sulfate, SO<sub>4</sub><sup>2&minus;</sup></td><td>acidify with dilute <b>nitric acid</b>, then add aqueous
<b>barium nitrate</b></td><td><b>white</b> ppt.</td></tr>
<tr><td>sulfite, SO<sub>3</sub><sup>2&minus;</sup></td><td>add a small volume of acidified aqueous potassium
manganate(VII)</td><td>potassium manganate(VII) changes from <b>purple to colourless</b></td></tr>
</table>
<div class="box exam"><span class="lbl">Reasons examiners ask for</span>
<b>Why acidify first?</b> To remove carbonate ions, which would also give a precipitate with silver or barium ions.<br>
<b>Why nitric acid?</b> Hydrochloric acid would add Cl<sup>&minus;</sup> ions (false positive in the halide test); sulfuric
acid would add SO<sub>4</sub><sup>2&minus;</sup> ions (false positive in the sulfate test).<br>
<b>Nitrate test:</b> first check there&rsquo;s no NH<sub>4</sub><sup>+</sup>, which gives ammonia with NaOH on its own.</div>

<div class="keep">
<h3>Tests for gases</h3>
<table class="k">
<tr><th style="width:22%">Gas</th><th style="width:40%">Test</th><th>Result</th></tr>
<tr><td>ammonia, NH<sub>3</sub></td><td>damp red litmus paper</td><td>turns <b>blue</b></td></tr>
<tr><td>carbon dioxide, CO<sub>2</sub></td><td>bubble through limewater</td><td>limewater turns <b>milky</b></td></tr>
<tr><td>chlorine, Cl<sub>2</sub></td><td>damp litmus paper</td><td><b>bleached</b></td></tr>
<tr><td>hydrogen, H<sub>2</sub></td><td>lighted splint</td><td><b>&lsquo;pops&rsquo;</b></td></tr>
<tr><td>oxygen, O<sub>2</sub></td><td>glowing splint</td><td><b>relights</b></td></tr>
<tr><td>sulfur dioxide, SO<sub>2</sub></td><td>acidified aqueous potassium manganate(VII)</td><td>turns from
<b>purple to colourless</b></td></tr>
</table>
<div class="box warn"><span class="lbl">Watch out</span>
Litmus must be <b>damp</b> (gases need to dissolve to act on it) &middot; hydrogen: <b>lighted</b> splint;
oxygen: <b>glowing</b> splint &middot; say &ldquo;limewater turns milky/cloudy&rdquo;, not &ldquo;CO<sub>2</sub> turns
milky&rdquo; &middot; tests for <b>water</b> (cobalt(II) chloride and copper(II) sulfate) are in Topic 10.</div>
</div>

<div class="keep">
<h3>Self-check before the topic questions</h3>
<ul class="check">
<li>Name the apparatus for measuring time, temperature, mass and volume, and compare pipette, burette, measuring cylinder and gas syringe</li>
<li>Describe an acid&ndash;base titration step by step, including the end-point and concordant results</li>
<li>Define solvent, solute, solution, saturated solution, residue and filtrate</li>
<li>Describe filtration, crystallisation, simple and fractional distillation, and choose the right method for a mixture</li>
<li>Label a distillation apparatus (thermometer position, condenser water flow)</li>
<li>Run and interpret a chromatogram, including locating agents, and calculate R<sub>f</sub></li>
<li>Use melting and boiling points to identify a substance and judge its purity</li>
<li>Give the results for all 8 cations with NaOH(aq) and NH<sub>3</sub>(aq), and all 6 flame colours</li>
<li>Describe the tests for carbonate, chloride, bromide, iodide, nitrate, sulfate and sulfite</li>
<li>Describe the tests for ammonia, carbon dioxide, chlorine, hydrogen, oxygen and sulfur dioxide</li>
</ul>
</div>
"""

if __name__ == "__main__":
    preview = sys.argv[1] if len(sys.argv) > 1 else None
    render(TITLE, BODY, "/tmp/chem_parts/topic12.pdf", preview_dir=preview)
