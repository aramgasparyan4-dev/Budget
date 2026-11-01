"""Chemistry Topic 2 - Atoms, Elements and Compounds (Cambridge IGCSE 0620, Extended)."""
import math
import pathlib
import random
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from notes import (render, svg, shell, pair_on_circle, electron, dot, cross, text,  # noqa: E402
                   brackets, atom, INK)

TITLE = "Chemistry 0620 - Topic 2: Atoms, Elements and Compounds"


def nuc(mass, num, sym, charge=""):
    """Nuclide notation like 23/11 Na."""
    ch = f"<sup>{charge}</sup>" if charge else ""
    return (f'<span class="nuc"><span class="ms"><span>{mass}</span><span>{num}</span></span>'
            f'{sym}{ch}</span>')


# ---------------- diagrams ----------------

def fig_sodium_atom():
    cx, cy = 75, 72
    s = atom(cx, cy, [2, 8, 1], r0=22, step=17)
    s += text(cx, cy - 1, "11p", 10) + text(cx, cy + 10, "12n", 10)
    s += f'<path d="M{cx+10},{cy-6} L170,30" stroke="#777" stroke-width="1"/>'
    s += text(174, 34, "nucleus: protons + neutrons", 12, anchor="start")
    s += f'<path d="M{cx+56},{cy+4} L170,96" stroke="#777" stroke-width="1"/>'
    s += text(174, 100, "electrons in shells", 12, anchor="start")
    s += text(174, 116, "2, 8, 1", 12, anchor="start", color="#1d3c8c")
    return svg(330, 145, s, width_mm=70)


def fig_nacl():
    s = ""
    s += shell(70, 92, 40, "Na") + cross(70, 52)
    s += text(70, 160, "Na  (2,8,1)", 15)
    s += shell(205, 92, 40, "Cl")
    s += pair_on_circle(205, 92, 40, -90, "dd") + pair_on_circle(205, 92, 40, 90, "dd")
    s += pair_on_circle(205, 92, 40, 0, "dd") + dot(165, 92)
    s += text(205, 160, "Cl  (2,8,7)", 15)
    s += ('<path d="M78,47 Q125,10 160,82" fill="none" stroke="#262626" stroke-width="1.6" '
          'marker-end="url(#ah)"/>')
    s += text(122, 22, "1 electron moves", 13, color="#555")
    s += ('<path d="M268,92 L322,92" stroke="#262626" stroke-width="2.2" '
          'marker-end="url(#ah)"/>')
    s += shell(410, 92, 40, "Na")
    for ang in (-90, 0, 90, 180):
        s += pair_on_circle(410, 92, 40, ang, "xx")
    s += brackets(358, 462, 40, 144, "+")
    s += text(410, 168, "Na⁺  (2,8)", 15)
    s += shell(570, 92, 40, "Cl")
    for ang in (-90, 0, 90):
        s += pair_on_circle(570, 92, 40, ang, "dd")
    s += pair_on_circle(570, 92, 40, 180, "dx")
    s += brackets(518, 622, 40, 144, "−")
    s += text(570, 168, "Cl⁻  (2,8,8)", 15)
    return svg(650, 178, s, width_mm=135)


def fig_h2o():
    s = shell(122, 75, 28, "H", 17) + shell(182, 75, 40, "O") + shell(242, 75, 28, "H", 17)
    s += dot(146, 69) + cross(146, 82) + dot(218, 69) + cross(218, 82)
    s += pair_on_circle(182, 75, 40, -90, "dd") + pair_on_circle(182, 75, 40, 90, "dd")
    return svg(364, 125, s, width_mm=62)


def fig_co2():
    s = shell(115, 70, 40, "O") + shell(180, 70, 40, "C") + shell(245, 70, 40, "O")
    for x in (147.5, 212.5):
        for i, y in enumerate((56.5, 65.5, 74.5, 83.5)):
            s += electron("d" if i % 2 == 0 else "x", x, y)
    for cx in (115, 245):
        s += pair_on_circle(cx, 70, 40, -90, "xx") + pair_on_circle(cx, 70, 40, 90, "xx")
    return svg(360, 125, s, width_mm=62)


def fig_lattice():
    s = ""
    for r in range(4):
        for c in range(6):
            x, y = 34 + c * 46, 30 + r * 46
            if (r + c) % 2 == 0:
                s += (f'<circle cx="{x}" cy="{y}" r="19" fill="#c8e6c9" stroke="{INK}" '
                      f'stroke-width="1.3"/>') + text(x, y + 7, "−", 22)
            else:
                s += (f'<circle cx="{x}" cy="{y}" r="11" fill="#e0e0e0" stroke="{INK}" '
                      f'stroke-width="1.3"/>') + text(x, y + 6, "+", 17)
    s += text(150, 212, "Cl⁻ (large)   Na⁺ (small)", 14, color="#555")
    return svg(300, 220, s, width_mm=52)


def fig_metal():
    s = ""
    sp, r0 = 58, 17
    for r in range(3):
        for c in range(5):
            x, y = 30 + c * sp, 30 + r * sp
            s += (f'<circle cx="{x}" cy="{y}" r="{r0}" fill="#ffe0b2" stroke="{INK}" '
                  f'stroke-width="1.3"/>') + text(x, y + 6, "+", 19)
    random.seed(3)
    e = 'e<tspan font-size="10" dy="-6">−</tspan>'
    for r in range(2):
        for c in range(4):
            x = 30 + sp / 2 + c * sp + random.uniform(-5, 5)
            y = 30 + sp / 2 + r * sp + random.uniform(-4, 4)
            s += text(round(x, 1), round(y + 5, 1), e, 14, color="#1d3c8c")
    for r in range(3):
        for c in range(4):
            if (r + c) % 2:
                continue
            x = 30 + sp / 2 + c * sp
            y = 30 + r * sp + random.uniform(-3, 3)
            s += text(round(x, 1), round(y + 5, 1), e, 14, color="#1d3c8c")
    return svg(296, 180, s, width_mm=56)


def hex_layer(ox, oy, cols=6, rows=2, size=14):
    h = math.sqrt(3) * size
    polys = ""
    for c in range(cols):
        for r in range(rows):
            cx = c * 1.5 * size
            cy = r * h + (h / 2 if c % 2 else 0)
            pts = " ".join(f"{cx + size*math.cos(math.radians(60*k)):.1f},"
                           f"{cy + size*math.sin(math.radians(60*k)):.1f}" for k in range(6))
            polys += f'<polygon points="{pts}" fill="#fafafa" stroke="{INK}" stroke-width="1.2"/>'
    return f'<g transform="matrix(1,0,0.45,0.62,{ox},{oy})">{polys}</g>'


def fig_graphite():
    s = ""
    ys = (14, 84, 154)
    for y in reversed(ys):
        s += hex_layer(14, y)
    for x in (55, 100, 145):
        for y1, y2 in ((62, 92), (132, 162)):
            s += (f'<path d="M{x},{y1} L{x},{y2}" stroke="#c62828" stroke-width="1.6" '
                  f'stroke-dasharray="3,3"/>')
    s += text(225, 74, "weak forces", 13, anchor="start", color="#c62828")
    s += text(225, 89, "between layers", 13, anchor="start", color="#c62828")
    s += text(225, 140, "layers slide", 13, anchor="start", color="#555")
    s += ('<path d="M225,150 L280,150" stroke="#555" stroke-width="1.5" '
          'marker-end="url(#ah)"/>')
    return svg(310, 210, s, width_mm=64)


def fig_diamond():
    s = ""
    cx, cy = 80, 75
    others = [(80, 20, False), (28, 105, False), (132, 105, False), (100, 132, True)]
    for x, y, back in others:
        dash = 'stroke-dasharray="5,4"' if back else ""
        s += f'<path d="M{cx},{cy} L{x},{y}" stroke="{INK}" stroke-width="2" {dash}/>'
    for x, y, back in others:
        s += (f'<circle cx="{x}" cy="{y}" r="13" fill="#fff" stroke="{INK}" '
              f'stroke-width="1.4"/>') + text(x, y + 5, "C", 14)
    s += (f'<circle cx="{cx}" cy="{cy}" r="14" fill="#e3f2fd" stroke="{INK}" '
          f'stroke-width="1.6"/>') + text(cx, cy + 5, "C", 15)
    return svg(160, 150, s, width_mm=32)


# ---------------- content ----------------

STYLE = """<style>
.nuc { white-space: nowrap; }
.nuc .ms { display: inline-block; vertical-align: -0.42em; font-size: 64%; line-height: 1.02;
           text-align: right; margin-right: 1px; }
.nuc .ms span { display: block; }
</style>"""

BODY = STYLE + f"""
<h1>Topic 2 &nbsp;Atoms, Elements and Compounds</h1>
<div class="meta">Cambridge IGCSE Chemistry 0620 &middot; Extended &middot; Sections 1&ndash;4 match
the SaveMyExams sub-topics, so you can do their questions after each one</div>

<h2><span class="num">1</span>Atomic Structure &amp; the Periodic Table</h2>
<h3>Elements, compounds and mixtures</h3>
<table class="k">
<tr><th></th><th>Element</th><th>Compound</th><th>Mixture</th></tr>
<tr><td>What it is</td><td>only <b>one type of atom</b></td>
    <td>two or more elements <b>chemically bonded</b> together</td>
    <td>two or more substances <b>not chemically combined</b></td></tr>
<tr><td>Examples</td><td>Fe, He, O<sub>2</sub>, Cl<sub>2</sub></td><td>H<sub>2</sub>O, NaCl, CO<sub>2</sub></td>
    <td>air, sea water, crude oil</td></tr>
<tr><td>Proportions</td><td>&mdash;</td><td><b>fixed</b> (shown by the formula)</td><td>can vary</td></tr>
<tr><td>Properties</td><td>&mdash;</td><td><b>different</b> from the elements in it</td>
    <td>same as the substances in it</td></tr>
<tr><td>Separate by</td><td>can&rsquo;t be split into anything simpler</td>
    <td>only a <b>chemical reaction</b></td>
    <td><b>physical methods</b> (filtering, distillation, chromatography&hellip;)</td></tr>
</table>
<p><b>Example that makes it click:</b> iron filings + sulfur powder is a <i>mixture</i> &mdash; a magnet
pulls the iron out. Heat them and they react to make iron(II) sulfide, FeS, a <i>compound</i>: it
isn&rsquo;t magnetic and you can&rsquo;t get the iron back with a magnet.</p>
<div class="box warn"><span class="lbl">Watch out</span>
O<sub>2</sub> and Cl<sub>2</sub> are <b>elements</b> even though they are molecules &mdash; only one type
of atom. &ldquo;Molecule&rdquo; and &ldquo;compound&rdquo; don&rsquo;t mean the same thing.</div>

<h3>Atomic structure</h3>
<div class="row">
<div>
<p>An atom has a tiny central <b>nucleus</b> containing <b>protons</b> and <b>neutrons</b>, surrounded by
<b>electrons</b> in <b>shells</b>.</p>
<table class="c">
<tr><th style="text-align:left">Particle</th><th>Relative charge</th><th>Relative mass</th><th>Where</th></tr>
<tr><td class="k" style="text-align:left">proton</td><td>+1</td><td>1</td><td>nucleus</td></tr>
<tr><td class="k" style="text-align:left">neutron</td><td>0</td><td>1</td><td>nucleus</td></tr>
<tr><td class="k" style="text-align:left">electron</td><td>&minus;1</td><td>1/1840</td><td>shells</td></tr>
</table>
<p>Atoms are neutral: <b>number of electrons = number of protons</b>.</p>
</div>
<figure style="flex:0 0 72mm">{fig_sodium_atom()}<figcaption>Sodium atom, {nuc(23, 11, "Na")}</figcaption></figure>
</div>

<div class="box def"><span class="lbl">Definitions</span>
<b>Proton number</b> (atomic number) &ndash; the number of protons in the nucleus of an atom.<br>
<b>Mass number</b> (nucleon number) &ndash; the total number of protons and neutrons in the nucleus.</div>

<div class="row">
<div>
<h3>Reading an atom symbol</h3>
<p>In {nuc(23, 11, "Na")} the <b>top</b> number is the mass number and the <b>bottom</b> is the proton
number.</p>
<p>protons = <b>11</b> &nbsp;&middot;&nbsp; electrons = <b>11</b> &nbsp;&middot;&nbsp;
neutrons = 23 &minus; 11 = <b>12</b></p>
<p><span class="hl">Neutrons = mass number &minus; proton number</span></p>
</div>
<div>
<h3>Electronic configuration (elements 1&ndash;20)</h3>
<p>Shells fill in order: <b>2</b> in the 1st, <b>8</b> in the 2nd, <b>8</b> in the 3rd, then the 4th
(K, Ca).</p>
<ul>
<li>outer-shell electrons = <b>group number</b> (Groups I&ndash;VII)</li>
<li>number of occupied shells = <b>period number</b></li>
<li>Group VIII (noble gases): <b>full outer shell</b></li>
</ul>
</div>
</div>

<table class="c">
<tr><th style="text-align:left">Atom / ion</th><th>H</th><th>C</th><th>O</th><th>Na</th><th>Cl</th><th>Ar</th><th>Ca</th>
<th>Na<sup>+</sup></th><th>O<sup>2&minus;</sup></th><th>Cl<sup>&minus;</sup></th><th>Ca<sup>2+</sup></th></tr>
<tr><td class="k" style="text-align:left">Proton number</td><td>1</td><td>6</td><td>8</td><td>11</td><td>17</td><td>18</td><td>20</td>
<td>11</td><td>8</td><td>17</td><td>20</td></tr>
<tr><td class="k" style="text-align:left">Configuration</td><td>1</td><td>2,4</td><td>2,6</td><td>2,8,1</td><td>2,8,7</td><td>2,8,8</td>
<td>2,8,8,2</td><td>2,8</td><td>2,8</td><td>2,8,8</td><td>2,8,8</td></tr>
</table>
<div class="box warn"><span class="lbl">Watch out</span>
Work out electrons from the <b>proton number</b>, never the mass number. For ions: a <b>positive</b>
charge means electrons <b>removed</b>, a <b>negative</b> charge means electrons <b>added</b>
(O<sup>2&minus;</sup> has 8 + 2 = 10 electrons).</div>

<h3>Isotopes</h3>
<div class="box def"><span class="lbl">Definition</span>
<b>Isotopes</b> &ndash; <span class="hl">different atoms of the same element that have the same number
of protons but different numbers of neutrons.</span></div>
<div class="row">
<div>
<table class="c">
<tr><th></th><th>{nuc(35, 17, "Cl")}</th><th>{nuc(37, 17, "Cl")}</th><th>{nuc(35, 17, "Cl", "&minus;")}</th></tr>
<tr><td class="k">protons</td><td>17</td><td>17</td><td>17</td></tr>
<tr><td class="k">neutrons</td><td>18</td><td>20</td><td>18</td></tr>
<tr><td class="k">electrons</td><td>17</td><td>17</td><td>18</td></tr>
</table>
</div>
<div>
<p><b>Isotopes have the same chemical properties</b> because they have the same number of electrons,
so the same electronic configuration. (Chemistry is decided by electrons, not neutrons.)</p>
</div>
</div>

<h3>Relative atomic mass, A<sub>r</sub></h3>
<p>A<sub>r</sub> = the average mass of the isotopes of an element, compared to 1/12 of the mass of a
carbon-12 atom. It&rsquo;s an average weighted by how common each isotope is (its
<b>abundance</b>).</p>
<div class="box exam"><span class="lbl">Calculation</span>
<p style="margin:0">A<sub>r</sub> = (mass<sub>1</sub> &times; %<sub>1</sub> + mass<sub>2</sub> &times; %<sub>2</sub>) &divide; 100
&nbsp;&nbsp;&nbsp; e.g. chlorine: 75% Cl-35 and 25% Cl-37</p>
<p style="margin:0">A<sub>r</sub> = (35 &times; 75 + 37 &times; 25) &divide; 100 = (2625 + 925) &divide; 100 =
<b>35.5</b></p>
<p class="small" style="margin:0">Sense check: the answer must lie between the isotope masses, and nearer the more
common one.</p></div>

<h2><span class="num">2</span>Ions &amp; Ionic Bonds</h2>
<p>Atoms bond to get a <span class="hl">full outer shell</span>. Three ways: <b>ionic</b> (metal +
non-metal, electrons transferred), <b>covalent</b> (non-metals, electrons shared), <b>metallic</b>
(metal atoms, outer electrons delocalised).</p>
<div class="box def"><span class="lbl">Definitions</span>
<b>Ion</b> &ndash; an atom or group of atoms with a charge, because it has lost or gained electrons.<br>
<b>Ionic bond</b> &ndash; <span class="hl">the strong electrostatic attraction between oppositely
charged ions.</span></div>

<div class="row">
<div>
<ul>
<li>Metals <b>lose</b> electrons &rarr; positive ions</li>
<li>Non-metals <b>gain</b> electrons &rarr; negative ions</li>
<li>Charge = electrons lost or gained to reach a full shell</li>
</ul>
</div>
<div style="flex:0 0 78mm">
<table class="c" style="margin-top:0">
<tr><th>Group</th><th>I</th><th>II</th><th>III</th><th>V</th><th>VI</th><th>VII</th></tr>
<tr><td class="k">Ion charge</td><td>+1</td><td>+2</td><td>+3</td><td>&minus;3</td><td>&minus;2</td><td>&minus;1</td></tr>
</table>
</div>
</div>

<figure>{fig_nacl()}
<figcaption>Sodium + chlorine &rarr; sodium chloride. Na gives its 1 outer electron to Cl; both ions now
have a full outer shell.</figcaption></figure>

<div class="box exam"><span class="lbl">Drawing ionic dot-and-cross diagrams</span>
Dots for one atom&rsquo;s electrons, crosses for the other&rsquo;s &middot; outer shell only unless asked
&middot; square brackets round each ion with the charge outside, top right &middot; check every ion has a
full outer shell.</div>
<p><b>Other examples:</b> Mg (2,8,2) gives 2 electrons to O (2,6) &rarr; Mg<sup>2+</sup> O<sup>2&minus;</sup>
(MgO). Mg gives 1 electron to <i>each</i> of two Cl atoms &rarr; Mg<sup>2+</sup> 2Cl<sup>&minus;</sup>
(MgCl<sub>2</sub>).</p>

<div class="row">
<div>
<h3>Working out ionic formulas</h3>
<p>The charges must add up to <span class="hl">zero</span>.</p>
<table>
<tr><td>Mg<sup>2+</sup> + Cl<sup>&minus;</sup></td><td>need 2 Cl<sup>&minus;</sup></td><td>&rarr; <b>MgCl<sub>2</sub></b></td></tr>
<tr><td>Al<sup>3+</sup> + O<sup>2&minus;</sup></td><td>2 &times; (+3) = +6, 3 &times; (&minus;2) = &minus;6</td><td>&rarr; <b>Al<sub>2</sub>O<sub>3</sub></b></td></tr>
</table>
<p class="small">Shortcut: swap the charge numbers and drop the signs, then simplify
(Mg<sup>2+</sup> O<sup>2&minus;</sup> &rarr; Mg<sub>2</sub>O<sub>2</sub> &rarr; MgO).</p>
<h3>Giant ionic lattice</h3>
<p>A <span class="hl">regular arrangement of alternating positive and negative ions</span> in 3D. There
are no molecules &mdash; NaCl just gives the <b>ratio</b> of ions (1 : 1).</p>
</div>
<figure style="flex:0 0 54mm">{fig_lattice()}<figcaption>NaCl lattice (one layer)</figcaption></figure>
</div>

<table>
<tr><th style="width:32%">Property of ionic compounds</th><th>Why</th></tr>
<tr><td class="k">High melting and boiling points</td><td>Giant lattice with many <b>strong electrostatic
attractions between oppositely charged ions</b>; a lot of energy is needed to overcome them.</td></tr>
<tr><td class="k">Conduct when molten or in aqueous solution</td><td>The <b>ions are free to move</b> and
carry the charge.</td></tr>
<tr><td class="k">Don&rsquo;t conduct when solid</td><td>Ions are held in fixed positions in the lattice and
can&rsquo;t move.</td></tr>
</table>
<div class="box warn"><span class="lbl">Watch out</span>
In ionic compounds it&rsquo;s the <b>ions</b> that move, not electrons &middot; NaCl is not a
&ldquo;molecule&rdquo; and has no &ldquo;intermolecular forces&rdquo; &middot; ionic bonds are strong.</div>

<h2><span class="num">3</span>Simple Molecules &amp; Covalent Bonds</h2>
<div class="box def"><span class="lbl">Definition</span>
<b>Covalent bond</b> &ndash; <span class="hl">a pair of electrons shared between two atoms</span>, giving
each atom a noble gas electronic configuration (full outer shell). Forms between non-metals.</div>

<div class="row">
<div>
<p><b>Single</b> bond = 1 shared pair (&ndash;) &middot; <b>double</b> = 2 pairs (=) &middot;
<b>triple</b> = 3 pairs (&equiv;). Electrons not in bonds sit in pairs: <b>lone pairs</b>.</p>
<p>Bonds an atom makes = electrons it needs to fill its outer shell:</p>
<table class="c" style="width:auto">
<tr><th>Atom</th><th>H</th><th>Cl</th><th>O</th><th>N</th><th>C</th></tr>
<tr><td class="k">Bonds</td><td>1</td><td>1</td><td>2</td><td>3</td><td>4</td></tr>
</table>
</div>
<div style="flex:0 0 66mm">
<figure style="margin-top:0">{fig_h2o()}<figcaption>H<sub>2</sub>O: 2 single bonds, 2 lone pairs on O</figcaption></figure>
<figure>{fig_co2()}<figcaption>CO<sub>2</sub>: 2 double bonds</figcaption></figure>
</div>
</div>

<div class="box exam"><span class="lbl">Drawing covalent dot-and-cross diagrams</span>
Overlap the outer shells of bonded atoms &middot; one dot + one cross in the overlap for each bond
&middot; leftover electrons in pairs &middot; check every atom has 8 in its outer shell (H has 2), and each
atom still shows its own number of outer electrons (O = 6, N = 5, C = 4, H = 1).</div>

<div class="keep">
<h3>Molecules you must be able to draw</h3>
<table>
<tr><th>Molecule</th><th>Displayed</th><th>Shared pairs</th><th>Lone pairs</th>
    <th>Molecule</th><th>Displayed</th><th>Shared pairs</th><th>Lone pairs</th></tr>
<tr><td class="k">H<sub>2</sub></td><td>H&ndash;H</td><td>1</td><td>0</td>
    <td class="k">O<sub>2</sub></td><td>O=O</td><td>2</td><td>2 on each O</td></tr>
<tr><td class="k">Cl<sub>2</sub></td><td>Cl&ndash;Cl</td><td>1</td><td>3 on each Cl</td>
    <td class="k">N<sub>2</sub></td><td>N&equiv;N</td><td>3</td><td>1 on each N</td></tr>
<tr><td class="k">HCl</td><td>H&ndash;Cl</td><td>1</td><td>3 on Cl</td>
    <td class="k">CO<sub>2</sub></td><td>O=C=O</td><td>4</td><td>2 on each O</td></tr>
<tr><td class="k">H<sub>2</sub>O</td><td>H&ndash;O&ndash;H</td><td>2</td><td>2 on O</td>
    <td class="k">C<sub>2</sub>H<sub>4</sub></td><td>H<sub>2</sub>C=CH<sub>2</sub></td><td>6</td><td>0</td></tr>
<tr><td class="k">NH<sub>3</sub></td><td>3 &times; N&ndash;H</td><td>3</td><td>1 on N</td>
    <td class="k">CH<sub>3</sub>OH</td><td>H<sub>3</sub>C&ndash;O&ndash;H</td><td>5</td><td>2 on O</td></tr>
<tr><td class="k">CH<sub>4</sub></td><td>4 &times; C&ndash;H</td><td>4</td><td>0</td>
    <td></td><td></td><td></td><td></td></tr>
</table>
</div>

<table>
<tr><th style="width:32%">Property of simple molecular substances</th><th>Why</th></tr>
<tr><td class="k">Low melting and boiling points (often gases or liquids at room temperature)</td>
<td>Only <b>weak intermolecular forces</b> between molecules; little energy is needed to overcome
them. The covalent bonds <i>inside</i> the molecules are strong and do <b>not</b> break.</td></tr>
<tr><td class="k">Poor electrical conductivity</td><td>Molecules have no overall charge: <b>no ions or
free electrons</b> to carry charge.</td></tr>
</table>
<div class="box warn"><span class="lbl">Watch out &mdash; most common lost mark in this topic</span>
&ldquo;When water boils, the covalent bonds break&rdquo; is <b>wrong</b>: the intermolecular forces are
overcome and steam is still H<sub>2</sub>O. Covalent bonds are strong; the forces <i>between</i>
molecules are weak.</div>

<h2><span class="num">4</span>Giant Structures</h2>
<h3>Diamond and graphite</h3>
<p>A huge network of atoms <span class="hl">all joined by strong covalent bonds</span> &mdash; no
separate molecules. So: <b>very high melting points</b> (many strong covalent bonds to break),
insoluble, and they don&rsquo;t conduct &mdash; except graphite.</p>
<div class="row">
<figure style="flex:0 0 38mm">{fig_diamond()}<figcaption>Diamond: each C bonded to 4 others</figcaption></figure>
<figure>{fig_graphite()}<figcaption>Graphite: layers of hexagons, each C bonded to 3 others</figcaption></figure>
</div>
<table class="k">
<tr><th></th><th>Diamond</th><th>Graphite</th></tr>
<tr><td>Structure</td><td>each C bonded to <b>4</b> others; rigid 3D (tetrahedral) network</td>
    <td>each C bonded to <b>3</b> others in flat layers of hexagons; weak forces between layers</td></tr>
<tr><td>Free electrons</td><td>none &mdash; all 4 outer electrons used in bonds</td>
    <td>1 <b>delocalised electron</b> per C atom</td></tr>
<tr><td>Properties</td><td>very hard &middot; no conductivity &middot; very high m.p.</td>
    <td>soft, slippery &middot; conducts &middot; very high m.p.</td></tr>
<tr><td>Uses</td><td><b>cutting tools</b> (drill tips)</td><td><b>lubricant</b>, <b>electrodes</b></td></tr>
</table>
<div class="box exam"><span class="lbl">Link structure to use (common 2&ndash;3 mark question)</span>
<b>Diamond &rarr; cutting:</b> each C bonded to 4 others by strong covalent bonds in a rigid structure, so
it is very hard.<br>
<b>Graphite &rarr; lubricant:</b> weak forces between the layers, so the layers slide over each other.<br>
<b>Graphite &rarr; electrodes:</b> delocalised electrons can move through the structure, so it conducts;
very high melting point too.</div>
<h3>Silicon(IV) oxide</h3>
<p><b>SiO<sub>2</sub></b> (sand): giant covalent &mdash; each <b>Si bonded to 4 O</b>,
each <b>O bonded to 2 Si</b> (hence the 1 : 2 formula). <span class="hl">Similar to diamond</span>: hard, very
high melting point, doesn&rsquo;t conduct &mdash; because both are giant networks of strong covalent bonds
with no free electrons.</p>

<h3>Metallic bonding</h3>
<div class="row">
<div>
<div class="box def" style="margin-top:2px"><span class="lbl">Definition</span>
<b>Metallic bonding</b> &ndash; <span class="hl">the electrostatic attraction between the positive ions in a
giant metallic lattice and a &ldquo;sea&rdquo; of delocalised electrons.</span></div>
<table>
<tr><th style="width:38%">Property</th><th>Why</th></tr>
<tr><td class="k">Good electrical conductivity</td><td><b>Delocalised electrons can move</b> through
the structure and carry charge.</td></tr>
<tr><td class="k">Malleable and ductile</td><td><b>Layers of positive ions can slide</b> over each
other; the sea of electrons keeps holding them together, so the metal bends instead of
breaking.</td></tr>
</table>
</div>
<figure style="flex:0 0 58mm">{fig_metal()}<figcaption>Positive ions in a sea of delocalised electrons</figcaption></figure>
</div>

<h2><span class="num">&#9733;</span>Putting it together</h2>
<table class="k">
<tr><th>Structure</th><th>Examples</th><th>Melting point</th><th>Conducts as solid?</th>
<th>Conducts molten / dissolved?</th></tr>
<tr><td>Giant ionic</td><td>NaCl, MgO</td><td>high</td><td>no</td><td class="green">yes (ions move)</td></tr>
<tr><td>Simple molecular</td><td>H<sub>2</sub>O, CO<sub>2</sub>, CH<sub>4</sub></td><td>low</td><td>no</td><td>no</td></tr>
<tr><td>Giant covalent</td><td>diamond, graphite, SiO<sub>2</sub></td><td>very high</td>
<td>no (graphite <span class="green">yes</span>)</td><td>&mdash; (insoluble)</td></tr>
<tr><td>Giant metallic</td><td>Cu, Fe, Al</td><td>usually high</td><td class="green">yes (electrons move)</td>
<td class="green">yes</td></tr>
</table>

<div class="row">
<div class="box def"><span class="lbl">Identify the structure from data</span>
<b>1.</b> Conducts as a solid? <span class="green">Yes</span> &rarr; metal (or graphite)<br>
<b>2.</b> Conducts only when molten / dissolved? &rarr; giant ionic<br>
<b>3.</b> Neither: <b>low</b> m.p. &rarr; simple molecular; <b>very high</b> m.p. &rarr; giant covalent</div>
<div class="box exam"><span class="lbl">&ldquo;Explain the melting point&rdquo; in 3 steps</span>
<b>1.</b> Name the structure. <b>2.</b> Name what must be overcome (attraction between oppositely
charged ions / weak intermolecular forces / many strong covalent bonds / attraction between positive
ions and delocalised electrons). <b>3.</b> &ldquo;so a lot of / little energy is needed.&rdquo;</div>
</div>

<div class="keep">
<h3>Self-check before the topic questions</h3>
<ul class="check">
<li>Tell elements, compounds and mixtures apart, with examples</li>
<li>Give the relative charge, relative mass and position of protons, neutrons and electrons</li>
<li>Work out protons, neutrons and electrons from a symbol like {nuc(23, 11, "Na")} or {nuc(35, 17, "Cl", "&minus;")}</li>
<li>Write electronic configurations for elements 1&ndash;20 and their ions</li>
<li>Define isotopes and explain why they have the same chemical properties</li>
<li>Calculate A<sub>r</sub> from isotope masses and abundances</li>
<li>Draw dot-and-cross diagrams for NaCl, MgO, MgCl<sub>2</sub>; work out ionic formulas</li>
<li>Draw H<sub>2</sub>, Cl<sub>2</sub>, HCl, H<sub>2</sub>O, NH<sub>3</sub>, CH<sub>4</sub>, O<sub>2</sub>,
N<sub>2</sub>, CO<sub>2</sub>, C<sub>2</sub>H<sub>4</sub>, CH<sub>3</sub>OH</li>
<li>Explain melting point and conductivity for all four structures</li>
<li>Compare diamond, graphite and SiO<sub>2</sub> and link to uses</li>
</ul>
</div>
"""

if __name__ == "__main__":
    out = ROOT / "chemistry" / "Topic 2 - Atoms, Elements and Compounds.pdf"
    preview = sys.argv[1] if len(sys.argv) > 1 else None
    render(TITLE, BODY, out, preview_dir=preview)
