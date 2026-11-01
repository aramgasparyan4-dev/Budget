"""Chemistry - Chemical bonding (Cambridge IGCSE 0620 topic 2.4-2.7)."""
import math
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from notes import (render, svg, shell, pair_on_circle, electron, dot, cross, text,  # noqa: E402
                   brackets, INK)

TITLE = "Chemistry - Chemical Bonding"


# ---------------- diagrams ----------------

def fig_nacl():
    s = ""
    # Na atom: outer shell has 1 electron
    s += shell(70, 92, 40, "Na") + cross(70, 52)
    s += text(70, 160, "Na  (2,8,1)", 15)
    # Cl atom: 7 outer electrons, gap on the left
    s += shell(205, 92, 40, "Cl")
    s += pair_on_circle(205, 92, 40, -90, "dd") + pair_on_circle(205, 92, 40, 90, "dd")
    s += pair_on_circle(205, 92, 40, 0, "dd") + dot(165, 92)
    s += text(205, 160, "Cl  (2,8,7)", 15)
    # transfer arrow
    s += ('<path d="M78,47 Q125,10 160,82" fill="none" stroke="#262626" stroke-width="1.6" '
          'marker-end="url(#ah)"/>')
    s += text(122, 22, "1 electron moves", 13, color="#555")
    # big arrow
    s += ('<path d="M268,92 L322,92" stroke="#262626" stroke-width="2.2" '
          'marker-end="url(#ah)"/>')
    # Na+ ion
    s += shell(410, 92, 40, "Na")
    for ang in (-90, 0, 90, 180):
        s += pair_on_circle(410, 92, 40, ang, "xx")
    s += brackets(358, 462, 40, 144, "+")
    s += text(410, 168, "Na⁺  (2,8)", 15)
    # Cl- ion
    s += shell(570, 92, 40, "Cl")
    for ang in (-90, 0, 90):
        s += pair_on_circle(570, 92, 40, ang, "dd")
    s += pair_on_circle(570, 92, 40, 180, "dx")
    s += brackets(518, 622, 40, 144, "−")
    s += text(570, 168, "Cl⁻  (2,8,8)", 15)
    return svg(650, 178, s, width_mm=150)


def fig_h2o():
    s = shell(122, 85, 28, "H", 18) + shell(182, 85, 40, "O") + shell(242, 85, 28, "H", 18)
    # shared pairs in the overlaps
    s += dot(146, 79) + cross(146, 92) + dot(218, 79) + cross(218, 92)
    # lone pairs on O
    s += pair_on_circle(182, 85, 40, -90, "dd") + pair_on_circle(182, 85, 40, 90, "dd")
    return svg(364, 140, s, width_mm=68)


def fig_co2():
    s = shell(115, 80, 40, "O") + shell(180, 80, 40, "C") + shell(245, 80, 40, "O")
    for x in (147.5, 212.5):
        for i, y in enumerate((66.5, 75.5, 84.5, 93.5)):
            s += electron("d" if i % 2 == 0 else "x", x, y)
    for cx in (115, 245):
        s += pair_on_circle(cx, 80, 40, -90, "xx") + pair_on_circle(cx, 80, 40, 90, "xx")
    return svg(360, 135, s, width_mm=68)


def fig_lattice():
    s = ""
    for r in range(4):
        for c in range(6):
            x, y = 34 + c * 46, 30 + r * 46
            if (r + c) % 2 == 0:
                s += (f'<circle cx="{x}" cy="{y}" r="19" fill="#c8e6c9" stroke="{INK}" '
                      f'stroke-width="1.3"/>') + text(x, y + 6, "−", 20)
            else:
                s += (f'<circle cx="{x}" cy="{y}" r="11" fill="#e0e0e0" stroke="{INK}" '
                      f'stroke-width="1.3"/>') + text(x, y + 5, "+", 16)
    return svg(300, 190, s, width_mm=62)


def fig_metal():
    s = ""
    for r in range(3):
        for c in range(5):
            x, y = 36 + c * 54, 32 + r * 54
            s += (f'<circle cx="{x}" cy="{y}" r="18" fill="#ffe0b2" stroke="{INK}" '
                  f'stroke-width="1.3"/>') + text(x, y + 6, "+", 20)
    import random
    random.seed(4)
    for r in range(3):
        for c in range(4):
            x = 63 + c * 54 + random.uniform(-6, 6)
            y = 32 + r * 54 + random.uniform(-14, 14)
            s += text(x, y + 4, 'e<tspan font-size="10" dy="-6">−</tspan>', 15,
                      color="#1d3c8c")
    for r in range(2):
        for c in range(5):
            x = 36 + c * 54 + random.uniform(-8, 8)
            y = 59 + r * 54
            s += text(x, y + 4, 'e<tspan font-size="10" dy="-6">−</tspan>', 15,
                      color="#1d3c8c")
    return svg(290, 170, s, width_mm=60)


def hex_layer(ox, oy, cols=7, rows=2, size=13):
    """Flat honeycomb patch, sheared so it looks like a tilted sheet."""
    path = ""
    h = math.sqrt(3) * size
    for c in range(cols):
        for r in range(rows):
            cx = c * 1.5 * size
            cy = r * h + (h / 2 if c % 2 else 0)
            pts = []
            for k in range(6):
                a = math.radians(60 * k)
                pts.append(f"{cx + size*math.cos(a):.1f},{cy + size*math.sin(a):.1f}")
            path += f'<polygon points="{" ".join(pts)}" fill="none" stroke="{INK}" ' \
                    f'stroke-width="1.3"/>'
    return f'<g transform="matrix(1,0,0.75,0.32,{ox},{oy})">{path}</g>'


def fig_graphite():
    s = ""
    ys = (18, 72, 126)
    for y in ys:
        s += hex_layer(20, y)
    for x in (60, 120, 170):
        for y1, y2 in ((40, 70), (94, 124)):
            s += f'<path d="M{x},{y1} L{x},{y2}" stroke="#c62828" stroke-width="1.5" ' \
                 f'stroke-dasharray="4,4"/>'
    s += text(232, 64, "weak forces", 14, anchor="start", color="#c62828")
    s += text(232, 80, "between layers", 14, anchor="start", color="#c62828")
    s += text(232, 112, "layers slide", 14, anchor="start", color="#555")
    s += ('<path d="M232,124 L282,124" stroke="#555" stroke-width="1.5" '
          'marker-end="url(#ah)"/>')
    return svg(330, 160, s, width_mm=74)


def fig_diamond():
    s = ""
    cx, cy = 80, 78
    others = [(80, 22, False), (28, 108, False), (132, 108, False), (100, 134, True)]
    for x, y, back in others:
        dash = 'stroke-dasharray="5,4"' if back else ""
        s += f'<path d="M{cx},{cy} L{x},{y}" stroke="{INK}" stroke-width="2" {dash}/>'
    for x, y, back in others:
        s += (f'<circle cx="{x}" cy="{y}" r="13" fill="#fffef9" stroke="{INK}" '
              f'stroke-width="1.4"/>') + text(x, y + 5, "C", 15)
    s += (f'<circle cx="{cx}" cy="{cy}" r="14" fill="#e3f2fd" stroke="{INK}" '
          f'stroke-width="1.6"/>') + text(cx, cy + 5, "C", 16)
    return svg(160, 150, s, width_mm=34)


# ---------------- content ----------------

BODY = f"""
<h1>Chemical Bonding</h1>
<div class="meta">Cambridge IGCSE Chemistry 0620 &middot; Topic 2.4&ndash;2.7 &nbsp;|&nbsp;
 <span class="tag ext">EXTENDED</span> = Supplement (Extended paper only)
 &nbsp; <span class="tag edx">EDEXCEL</span> = only if you sit Edexcel</div>

<h2>The big idea</h2>
<p>Atoms bond to get a <span class="hl">full outer shell</span> (the same electron arrangement as a
noble gas). There are three ways to do it:</p>
<table>
<tr><th>Bond</th><th>Between</th><th>What the electrons do</th><th>Structures it makes</th></tr>
<tr><td>Ionic</td><td>metal + non-metal</td><td><b>transferred</b> from metal to non-metal</td>
    <td>giant ionic lattice</td></tr>
<tr><td>Covalent</td><td>non-metal + non-metal</td><td><b>shared</b> in pairs</td>
    <td>simple molecules <i>or</i> giant covalent</td></tr>
<tr><td>Metallic</td><td>metal atoms</td><td>outer electrons <b>delocalised</b> (free to move)</td>
    <td>giant metallic lattice</td></tr>
</table>
<p class="small">The structure (not just the bond) decides the properties. The summary table on the
last page puts all four structures side by side.</p>

<h2>1 &nbsp;Ions and ionic bonding</h2>
<div class="box def"><span class="lbl">Definitions</span>
<b>Ion</b> &ndash; an atom or group of atoms with a charge, because it has lost or gained electrons.<br>
<b>Ionic bond</b> &ndash; <span class="hl">the strong electrostatic attraction between oppositely
charged ions.</span></div>

<div class="row">
<div>
<ul>
<li>Metals <b>lose</b> electrons &rarr; <span class="blue">positive ions</span> (cations)</li>
<li>Non-metals <b>gain</b> electrons &rarr; <span class="red">negative ions</span> (anions)</li>
<li>The charge = number of electrons lost or gained to reach a full shell.</li>
</ul>
</div>
<div style="flex:0 0 72mm">
<table class="plain" style="margin-top:0; text-align:center">
<tr><th>Group</th><th>I</th><th>II</th><th>III</th><th>V</th><th>VI</th><th>VII</th></tr>
<tr><td>Ion charge</td><td>+1</td><td>+2</td><td>+3</td><td>&minus;3</td><td>&minus;2</td><td>&minus;1</td></tr>
</table>
</div>
</div>

<h3>Example: sodium + chlorine &rarr; sodium chloride</h3>
<figure>{fig_nacl()}
<figcaption>Dot-and-cross diagram. Na gives its 1 outer electron to Cl. Both ions now have a full
outer shell. (Showing the Na<sup>+</sup> shell empty instead of with 8 &times; is also common &mdash;
ask your teacher which they want.)</figcaption></figure>

<div class="box exam"><span class="lbl">How to draw ionic dot-and-cross diagrams</span>
<ol style="margin:0">
<li>Dots for one atom&rsquo;s electrons, crosses for the other&rsquo;s.</li>
<li>Outer shell only, unless the question asks for all shells.</li>
<li>Square brackets round each ion, charge outside at the top right.</li>
<li>Check: every ion has a full outer shell and the charges cancel out overall.</li>
</ol></div>

<div class="box ext"><span class="lbl">Any metal + non-metal <span class="tag ext">EXTENDED</span></span>
<b>Magnesium oxide:</b> Mg (2,8,2) gives 2 electrons to O (2,6) &rarr; Mg<sup>2+</sup> (2,8) and
O<sup>2&minus;</sup> (2,8).<br>
<b>Magnesium chloride:</b> Mg gives 1 electron to <i>each</i> of two Cl atoms &rarr; Mg<sup>2+</sup>
and 2 Cl<sup>&minus;</sup> &rarr; MgCl<sub>2</sub>.
</div>

<h3>Working out ionic formulas</h3>
<p>The charges must add up to <span class="hl">zero</span>.</p>
<table class="plain">
<tr><td>Na<sup>+</sup> and Cl<sup>&minus;</sup></td><td>+1 &minus;1 = 0</td><td>&rarr; <b>NaCl</b></td></tr>
<tr><td>Mg<sup>2+</sup> and Cl<sup>&minus;</sup></td><td>need 2 Cl<sup>&minus;</sup> to cancel +2</td><td>&rarr; <b>MgCl<sub>2</sub></b></td></tr>
<tr><td>Al<sup>3+</sup> and O<sup>2&minus;</sup></td><td>2 Al<sup>3+</sup> = +6, 3 O<sup>2&minus;</sup> = &minus;6</td><td>&rarr; <b>Al<sub>2</sub>O<sub>3</sub></b></td></tr>
</table>
<p class="small"><span class="green">Shortcut:</span> swap the charge numbers and drop the signs
(Al<sup>3+</sup> O<sup>2&minus;</sup> &rarr; Al<sub>2</sub>O<sub>3</sub>), then simplify if you can
(Mg<sup>2+</sup> O<sup>2&minus;</sup> &rarr; Mg<sub>2</sub>O<sub>2</sub> &rarr; MgO).</p>

<div class="row">
<div>
<h3>Giant ionic lattice <span class="tag ext">EXTENDED</span></h3>
<p>A <span class="hl">regular arrangement of alternating positive and negative ions</span>, repeating
in 3D in all directions.</p>
<p>There are no molecules. The formula NaCl just tells you the <b>ratio</b> of ions (1 : 1).</p>
</div>
<figure style="flex:0 0 64mm">{fig_lattice()}
<figcaption>Sodium chloride lattice (one layer)</figcaption></figure>
</div>

<h3>Properties of ionic compounds</h3>
<table>
<tr><th style="width:30%">Property</th><th>Why <span class="tag ext">EXTENDED</span></th></tr>
<tr><td>High melting and boiling points</td><td>Giant lattice with lots of <b>strong electrostatic
attractions between oppositely charged ions</b>. A lot of energy is needed to overcome them.</td></tr>
<tr><td>Conduct electricity when molten or dissolved in water</td><td>The <b>ions are free to move</b>
and carry the charge.</td></tr>
<tr><td>Don&rsquo;t conduct when solid</td><td>The ions are held in fixed positions in the lattice, so
they can&rsquo;t move.</td></tr>
</table>

<div class="box warn"><span class="lbl">Watch out</span>
&#10007; &ldquo;Electrons move&rdquo; in a molten ionic compound &rarr; it&rsquo;s the <b>ions</b> that move.<br>
&#10007; Calling NaCl a &ldquo;molecule&rdquo;, or talking about &ldquo;intermolecular forces&rdquo; in ionic compounds.<br>
&#10007; &ldquo;Ionic bonds are weak&rdquo; &rarr; they are strong.
</div>

<h2>2 &nbsp;Covalent bonds and simple molecules</h2>
<div class="box def"><span class="lbl">Definition</span>
<b>Covalent bond</b> &ndash; <span class="hl">a pair of electrons shared between two atoms</span>.
It forms between non-metals, and each atom ends up with a full outer shell.
</div>
<div class="box exam" style="margin-top:4px"><span class="lbl">Exam wording</span>
Cambridge: &ldquo;a shared pair of electrons between two atoms, giving noble gas electronic
configurations&rdquo;.<br>
<span class="tag edx">EDEXCEL</span> &ldquo;the strong electrostatic attraction between a shared
pair of electrons and the nuclei of the bonded atoms&rdquo;.
</div>

<div class="row">
<div>
<ul>
<li><b>Single bond</b> = 1 shared pair (&ndash;)</li>
<li><b>Double bond</b> = 2 shared pairs (=)</li>
<li><b>Triple bond</b> = 3 shared pairs (&equiv;)</li>
<li>Electrons not used in bonds sit in pairs: <b>lone pairs</b>.</li>
</ul>
</div>
<div>
<p style="margin-top:2px"><span class="hl">Number of bonds an atom makes</span> = electrons it needs
to fill its outer shell:</p>
<p>H &rarr; 1 &nbsp; Cl (Grp VII) &rarr; 1 &nbsp; O (Grp VI) &rarr; 2<br>
N (Grp V) &rarr; 3 &nbsp; C (Grp IV) &rarr; 4</p>
</div>
</div>

<div class="row">
<figure>{fig_h2o()}<figcaption>Water, H<sub>2</sub>O: 2 single bonds, 2 lone pairs on O</figcaption></figure>
<figure>{fig_co2()}<figcaption>Carbon dioxide, CO<sub>2</sub>: 2 double bonds <span class="tag ext">EXTENDED</span></figcaption></figure>
</div>

<div class="box exam"><span class="lbl">How to draw covalent dot-and-cross diagrams</span>
<ol style="margin:0">
<li>Overlap the outer shells of atoms that are bonded.</li>
<li>Put the shared electrons in the overlap: one dot + one cross for each bond.</li>
<li>Draw the leftover electrons in pairs (lone pairs).</li>
<li>Check: every atom has 8 in its outer shell (H has 2). Count each atom&rsquo;s own electrons
too: O must have 6 of its own symbol, C 4, N 5, H 1.</li>
</ol></div>

<h3>Molecules you must be able to draw</h3>
<table>
<tr><th>Molecule</th><th>Displayed</th><th>Shared pairs</th><th>Lone pairs</th></tr>
<tr><td>Hydrogen, H<sub>2</sub></td><td>H&ndash;H</td><td>1</td><td>0</td></tr>
<tr><td>Chlorine, Cl<sub>2</sub></td><td>Cl&ndash;Cl</td><td>1</td><td>3 on each Cl</td></tr>
<tr><td>Hydrogen chloride, HCl</td><td>H&ndash;Cl</td><td>1</td><td>3 on Cl</td></tr>
<tr><td>Water, H<sub>2</sub>O</td><td>H&ndash;O&ndash;H</td><td>2</td><td>2 on O</td></tr>
<tr><td>Ammonia, NH<sub>3</sub></td><td>N with 3 N&ndash;H</td><td>3</td><td>1 on N</td></tr>
<tr><td>Methane, CH<sub>4</sub></td><td>C with 4 C&ndash;H</td><td>4</td><td>0</td></tr>
<tr><td colspan="4" style="font-family:'HeadHand';font-weight:700;color:#7b3fa0;border-bottom:1px dashed #7b3fa0">
  <span class="tag ext">EXTENDED</span> also these</td></tr>
<tr><td>Oxygen, O<sub>2</sub></td><td>O=O</td><td>2 (double)</td><td>2 on each O</td></tr>
<tr><td>Nitrogen, N<sub>2</sub></td><td>N&equiv;N</td><td>3 (triple)</td><td>1 on each N</td></tr>
<tr><td>Carbon dioxide, CO<sub>2</sub></td><td>O=C=O</td><td>4 (2 doubles)</td><td>2 on each O</td></tr>
<tr><td>Ethene, C<sub>2</sub>H<sub>4</sub></td><td>H<sub>2</sub>C=CH<sub>2</sub></td><td>6 (1 double + 4 C&ndash;H)</td><td>0</td></tr>
<tr><td>Methanol, CH<sub>3</sub>OH</td><td>H<sub>3</sub>C&ndash;O&ndash;H</td><td>5</td><td>2 on O</td></tr>
</table>

<h3>Properties of simple molecular substances</h3>
<table>
<tr><th style="width:30%">Property</th><th>Why <span class="tag ext">EXTENDED</span></th></tr>
<tr><td>Low melting and boiling points (often gases or liquids at room temperature)</td>
<td>There are only <b>weak intermolecular forces</b> between the molecules, so little energy is
needed to overcome them. The covalent bonds <i>inside</i> the molecules are strong and do
<span class="red">not</span> break.</td></tr>
<tr><td>Don&rsquo;t conduct electricity</td><td>Molecules have no overall charge: there are
<b>no ions or free electrons</b> to carry charge.</td></tr>
</table>
<p class="small"><span class="tag edx">EDEXCEL</span> Bigger molecules (higher relative molecular
mass) &rarr; stronger intermolecular forces &rarr; higher boiling point.</p>

<div class="box warn"><span class="lbl">Watch out &mdash; the most common lost mark in this topic</span>
&#10007; &ldquo;When water boils, the covalent bonds break.&rdquo; &rarr; No. The <b>intermolecular
forces</b> are overcome. Steam is still H<sub>2</sub>O.<br>
&#10007; &ldquo;Covalent bonds are weak.&rdquo; &rarr; Covalent bonds are strong. The forces
<i>between</i> molecules are weak.
</div>

<h2>3 &nbsp;Giant covalent structures</h2>
<p>A huge network of atoms <span class="hl">all joined by strong covalent bonds</span>. No separate
molecules. So they have <b>very high melting points</b> (you must break lots of strong covalent
bonds), are insoluble, and don&rsquo;t conduct &mdash; except graphite.</p>

<div class="row">
<figure style="flex:0 0 40mm">{fig_diamond()}<figcaption>Diamond: each C bonded to 4 others</figcaption></figure>
<figure>{fig_graphite()}<figcaption>Graphite: layers of hexagons, each C bonded to 3 others</figcaption></figure>
</div>

<table>
<tr><th></th><th>Diamond</th><th>Graphite</th></tr>
<tr><td>Bonds per C atom</td><td>4</td><td>3</td></tr>
<tr><td>Structure</td><td>rigid 3D network (tetrahedral)</td><td>flat layers of hexagons; weak forces between layers</td></tr>
<tr><td>Free electrons?</td><td>none &mdash; all 4 outer electrons used in bonds</td><td>1 <b>delocalised electron</b> per C atom</td></tr>
<tr><td>Hardness</td><td>very hard</td><td>soft and slippery</td></tr>
<tr><td>Conducts electricity?</td><td>no</td><td>yes</td></tr>
<tr><td>Melting point</td><td>very high</td><td>very high</td></tr>
<tr><td>Uses</td><td><b>cutting tools</b> (drill tips, saw blades)</td><td><b>lubricant</b>, <b>electrodes</b> (and pencils)</td></tr>
</table>

<div class="box exam"><span class="lbl">Link structure to use (common 2&ndash;3 mark question)</span>
<b>Diamond &rarr; cutting tools:</b> each C is bonded to 4 others by strong covalent bonds in a rigid
3D structure, so it is very hard.<br>
<b>Graphite &rarr; lubricant:</b> the layers are held together by weak forces, so they slide over each
other easily.<br>
<b>Graphite &rarr; electrodes:</b> it has delocalised electrons that can move through the structure,
so it conducts electricity; it also has a very high melting point.
</div>

<div class="box ext"><span class="lbl">Silicon(IV) oxide, SiO<sub>2</sub> (sand) <span class="tag ext">EXTENDED</span></span>
Giant covalent: each <b>Si is bonded to 4 O</b> atoms and each <b>O is bonded to 2 Si</b> atoms
(that 1 : 2 ratio is why the formula is SiO<sub>2</sub>).<br>
It is like diamond: hard, very high melting point, doesn&rsquo;t conduct (no free electrons or
ions) &mdash; because both are giant networks of strong covalent bonds.
</div>
<p class="small"><span class="tag edx">EDEXCEL</span> C<sub>60</sub> fullerene is a <i>simple
molecule</i> (a ball of 60 C atoms): weak intermolecular forces, so a much lower melting point than
diamond or graphite, and soft.</p>

<h2>4 &nbsp;Metallic bonding <span class="tag ext">EXTENDED</span></h2>
<div class="row">
<div>
<div class="box def" style="margin-top:2px"><span class="lbl">Definition</span>
<b>Metallic bonding</b> &ndash; <span class="hl">the electrostatic attraction between positive metal
ions in a giant lattice and a &ldquo;sea&rdquo; of delocalised electrons.</span></div>
<p>Each metal atom lets go of its outer electrons. The electrons are shared by the whole structure
and can move anywhere in it.</p>
</div>
<figure style="flex:0 0 62mm">{fig_metal()}<figcaption>Positive ions in a sea of delocalised electrons</figcaption></figure>
</div>

<table>
<tr><th style="width:30%">Property</th><th>Why</th></tr>
<tr><td>Good conductors of electricity (and heat)</td><td>The <b>delocalised electrons can move</b>
through the structure and carry charge.</td></tr>
<tr><td>Malleable (hammered into shape) and ductile (drawn into wires)</td><td>The <b>layers of
positive ions can slide</b> over each other. The sea of electrons keeps holding them together, so
the metal changes shape instead of breaking.</td></tr>
<tr><td>Usually high melting points</td><td>Strong attraction between the positive ions and the
delocalised electrons.</td></tr>
</table>

<div class="pb"></div>
<h2>5 &nbsp;Putting it together</h2>
<table>
<tr><th>Structure</th><th>Examples</th><th>What&rsquo;s overcome when it melts</th><th>Melting point</th>
<th>Conducts as solid?</th><th>Conducts molten / dissolved?</th></tr>
<tr><td>Giant ionic</td><td>NaCl, MgO</td><td>strong attraction between oppositely charged ions</td>
<td>high</td><td>no</td><td><span class="green">yes</span> (ions move)</td></tr>
<tr><td>Simple molecular</td><td>H<sub>2</sub>O, CO<sub>2</sub>, CH<sub>4</sub>, Cl<sub>2</sub></td>
<td>weak intermolecular forces</td><td>low</td><td>no</td><td>no</td></tr>
<tr><td>Giant covalent</td><td>diamond, graphite, SiO<sub>2</sub></td><td>many strong covalent
bonds</td><td>very high</td><td>no <span class="small">(graphite yes)</span></td><td>&mdash;
<span class="small">(insoluble)</span></td></tr>
<tr><td>Giant metallic</td><td>Cu, Fe, Al</td><td>strong attraction between positive ions and
delocalised electrons</td><td>usually high</td><td><span class="green">yes</span> (electrons move)</td>
<td><span class="green">yes</span></td></tr>
</table>

<h3>Identify the structure from data (classic exam question)</h3>
<div class="box def">
<b>1.</b> Conducts when solid? &rarr; <span class="green">yes</span>: <b>metal</b> (or graphite)<br>
<b>2.</b> If not &mdash; conducts when molten or dissolved? &rarr; <span class="green">yes</span>: <b>giant ionic</b><br>
<b>3.</b> If not &mdash; look at the melting point: <b>low</b> &rarr; simple molecular; <b>very high</b> &rarr; giant covalent
</div>

<h3>Answer templates</h3>
<div class="box exam"><span class="lbl">&ldquo;Explain why X has a high / low melting point&rdquo; &mdash; 3 steps</span>
<b>1. Name the structure:</b> &ldquo;X has a giant ionic lattice / simple molecular structure /
giant covalent structure / giant metallic lattice.&rdquo;<br>
<b>2. Name what must be overcome:</b> &ldquo;strong electrostatic attraction between oppositely
charged ions&rdquo; / &ldquo;weak intermolecular forces&rdquo; / &ldquo;many strong covalent
bonds&rdquo; / &ldquo;strong attraction between positive ions and delocalised electrons&rdquo;.<br>
<b>3. Energy:</b> &ldquo;so a lot of / only a little energy is needed to overcome them.&rdquo;
</div>
<div class="box exam"><span class="lbl">&ldquo;Explain whether X conducts electricity&rdquo;</span>
Say <b>which charged particles</b> there are and <b>whether they can move</b>: &ldquo;ions are free
to move&rdquo; / &ldquo;delocalised electrons are free to move&rdquo; / &ldquo;there are no ions or
free electrons, so nothing can carry the charge&rdquo;.
</div>

<h3>Self-check before you do the topic questions</h3>
<ul class="check">
<li>I can define ion, ionic bond, covalent bond and metallic bonding <span class="small">(metallic = Extended)</span></li>
<li>I can draw the dot-and-cross diagram for NaCl <span class="small">(Extended: MgO, MgCl<sub>2</sub>, any metal + non-metal)</span></li>
<li>I can work out the formula of an ionic compound from the charges</li>
<li>I can describe a giant ionic lattice <span class="tag ext">EXTENDED</span></li>
<li>I can draw H<sub>2</sub>, Cl<sub>2</sub>, HCl, H<sub>2</sub>O, NH<sub>3</sub>, CH<sub>4</sub>
 <span class="small">(Extended: O<sub>2</sub>, N<sub>2</sub>, CO<sub>2</sub>, C<sub>2</sub>H<sub>4</sub>, CH<sub>3</sub>OH)</span></li>
<li>I can explain the melting point and conductivity of each of the 4 structures</li>
<li>I can compare diamond and graphite and link each to its uses</li>
<li>I can describe SiO<sub>2</sub> and say why it is like diamond <span class="tag ext">EXTENDED</span></li>
<li>I can identify a structure from melting point and conductivity data</li>
</ul>
"""

if __name__ == "__main__":
    out = ROOT / "chemistry" / "02 Chemical Bonding.pdf"
    preview = sys.argv[1] if len(sys.argv) > 1 else None
    render(TITLE, BODY, out, preview_dir=preview)
