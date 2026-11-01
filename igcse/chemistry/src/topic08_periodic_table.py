"""Chemistry Topic 8 - The Periodic Table (Cambridge IGCSE 0620, Extended)."""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from notes import render, svg, text, INK  # noqa: E402

TITLE = "Chemistry 0620 - Topic 8: The Periodic Table"


# ---------------- diagrams ----------------

def fig_periodic_table():
    cw, ch = 30, 27
    x0, y0 = 34, 30
    rows = [
        ["H"] + [None] * 16 + ["He"],
        ["Li", "Be"] + [None] * 10 + ["B", "C", "N", "O", "F", "Ne"],
        ["Na", "Mg"] + [None] * 10 + ["Al", "Si", "P", "S", "Cl", "Ar"],
        ["K", "Ca", "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn",
         "Ga", "Ge", "As", "Se", "Br", "Kr"],
    ]
    nonmetal = {"H", "He", "C", "N", "O", "F", "Ne", "P", "S", "Cl", "Ar", "Se", "Br", "Kr"}
    between = {"B", "Si", "Ge", "As"}
    s = ""
    # group labels
    labels = {0: "I", 1: "II", 12: "III", 13: "IV", 14: "V", 15: "VI", 16: "VII", 17: "VIII"}
    for c, lab in labels.items():
        s += text(x0 + c * cw + cw / 2, y0 - 8, lab, 12, color="#1d3c8c", extra='font-weight="700"')
    # cells
    for r, row in enumerate(rows):
        s += text(x0 - 14, y0 + r * ch + ch / 2 + 4, str(r + 1), 12, color="#1d3c8c",
                  extra='font-weight="700"')
        for c, sym in enumerate(row):
            if not sym:
                continue
            if sym in nonmetal:
                fill = "#d6e4f7"
            elif sym in between:
                fill = "#e6e6e6"
            else:
                fill = "#ffe0b2"
            x, y = x0 + c * cw, y0 + r * ch
            s += (f'<rect x="{x}" y="{y}" width="{cw}" height="{ch}" fill="{fill}" '
                  f'stroke="{INK}" stroke-width="0.8"/>')
            s += text(x + cw / 2, y + ch / 2 + 4.5, sym, 12)
    # transition label in the gap
    gx = x0 + 2 * cw + 5 * cw
    s += text(gx, y0 + 1.5 * ch + 2, "transition elements", 13, color="#555")
    s += text(gx, y0 + 1.5 * ch + 17, "(the block in period 4 &#8595;)", 11, color="#777")
    # period label
    s += text(x0 - 26, y0 - 8, "Period", 10, anchor="start", color="#1d3c8c")
    # across-period arrow
    ya = y0 + 4 * ch + 20
    s += (f'<path d="M{x0},{ya} L{x0 + 18 * cw},{ya}" stroke="{INK}" stroke-width="1.6" '
          f'marker-end="url(#ah)"/>')
    s += text(x0 + 9 * cw, ya + 16, "across a period: metals on the left &#8594; non-metals on the right",
              12, color="#333")
    # legend
    ly = ya + 34
    for i, (fill, lab) in enumerate([("#ffe0b2", "metal"), ("#d6e4f7", "non-metal"),
                                     ("#e6e6e6", "near the metal / non-metal line")]):
        lx = x0 + 60 + i * 150
        s += f'<rect x="{lx}" y="{ly - 10}" width="14" height="12" fill="{fill}" stroke="{INK}" stroke-width="0.8"/>'
        s += text(lx + 20, ly, lab, 11, anchor="start")
    return svg(x0 + 18 * cw + 10, ly + 10, s, width_mm=150)


# ---------------- content ----------------

STYLE = """<style>
.swatch { display: inline-block; width: 11px; height: 11px; border: 1px solid #555;
          vertical-align: -1px; margin-right: 4px; border-radius: 2px; }
.eq { font-size: 10.4pt; margin: 2px 0; }
</style>"""

BODY = STYLE + f"""
<h1>Topic 8 &nbsp;The Periodic Table</h1>
<div class="meta">Cambridge IGCSE Chemistry 0620 &middot; Extended &middot; Sections 1&ndash;2 match
the SaveMyExams sub-topics, so you can do their questions after each one</div>

<h2><span class="num">1</span>The Periodic Table &amp; Trends</h2>
<h3>The Periodic Table</h3>
<div class="box def"><span class="lbl">Definition</span>
The Periodic Table is an <span class="hl">arrangement of elements in order of increasing proton
number</span> (atomic number), in <b>periods</b> and <b>groups</b>.<br>
<b>Group</b> = a vertical column &nbsp;&middot;&nbsp; <b>Period</b> = a horizontal row</div>

<figure>{fig_periodic_table()}
<figcaption>First four periods. Groups are numbered I&ndash;VIII; the transition elements sit between
Groups II and III.</figcaption></figure>

<table class="k">
<tr><th style="width:30%">Position</th><th>What it tells you</th><th style="width:28%">Example: Mg</th></tr>
<tr><td>Group number (I&ndash;VII)</td><td>number of electrons in the <b>outer shell</b></td><td>Group II &rarr; 2 outer electrons</td></tr>
<tr><td>Period number</td><td>number of <b>occupied electron shells</b></td><td>Period 3 &rarr; 3 shells</td></tr>
<tr><td>Group VIII</td><td>noble gases &mdash; <b>full outer shell</b></td><td>so Mg = <b>2,8,2</b></td></tr>
</table>

<h3>Periodic Trends</h3>
<div class="row">
<div>
<p><b>Across a period</b> the elements change from <span class="hl">metallic to non-metallic</span>
character: metals on the left (form positive ions), non-metals on the right (form negative ions or
share electrons).</p>
<p><b>Down a group</b> the elements have <span class="hl">similar chemical properties</span> because they
have the <b>same number of electrons in their outer shell</b>.</p>
</div>
<div style="flex:0 0 80mm">
<table class="c" style="margin-top:2px">
<tr><th>Group</th><th>I</th><th>II</th><th>III</th><th>IV</th><th>V</th><th>VI</th><th>VII</th><th>VIII</th></tr>
<tr><td class="k">Outer e&minus;</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td>8*</td></tr>
<tr><td class="k">Ion charge</td><td>+1</td><td>+2</td><td>+3</td><td>&mdash;</td><td>&minus;3</td><td>&minus;2</td><td>&minus;1</td><td>&mdash;</td></tr>
</table>
<p class="small">*helium has 2. Groups I&ndash;III lose electrons; V&ndash;VII gain them. Group IV and the
noble gases don&rsquo;t usually form ions.</p>
</div>
</div>
<div class="box exam"><span class="lbl">Exam wording</span>
&ldquo;Why do sodium and potassium react in a similar way?&rdquo; &rarr; <b>They both have one electron in
their outer shell</b> (same electronic configuration in the outer shell). Mention the
<i>outer shell</i> &mdash; &ldquo;same group&rdquo; alone doesn&rsquo;t score.</div>

<h2><span class="num">2</span>Group Properties &amp; Trends</h2>
<h3>Group I Properties &mdash; the alkali metals</h3>
<p>Lithium, sodium and potassium are <span class="hl">relatively soft metals</span> (they can be cut with a
knife). They react with air and water, so they are stored under oil.</p>
<div class="row">
<div>
<table class="k">
<tr><th>Trend down the group</th><th>Li &rarr; Na &rarr; K</th></tr>
<tr><td>Melting point</td><td><b>decreases</b> (Li 181&nbsp;&deg;C, Na 98&nbsp;&deg;C, K 63&nbsp;&deg;C)</td></tr>
<tr><td>Density</td><td>generally <b>increases</b></td></tr>
<tr><td>Reactivity</td><td><b>increases</b></td></tr>
</table>
</div>
<div>
<div class="box def" style="margin-top:2px"><span class="lbl">Why reactivity increases down Group I</span>
The outer electron is <b>further from the nucleus</b> and more <b>shielded</b> by inner shells, so it is
less strongly attracted and is <b>lost more easily</b>.</div>
</div>
</div>

<p><b>Reaction with cold water:</b> metal + water &rarr; metal hydroxide + hydrogen. The solution formed is
<b>alkaline</b> (hence &ldquo;alkali metals&rdquo;).</p>
<p class="eq">2Na + 2H<sub>2</sub>O &rarr; 2NaOH + H<sub>2</sub> &nbsp;&nbsp;&nbsp; (same pattern for Li and K: 2Li &rarr; 2LiOH, 2K &rarr; 2KOH)</p>
<table class="k">
<tr><th style="width:16%">Metal</th><th>What you see with water</th></tr>
<tr><td>Lithium</td><td>floats, fizzes steadily, slowly gets smaller</td></tr>
<tr><td>Sodium</td><td>floats, melts into a ball, fizzes quickly, moves around on the surface</td></tr>
<tr><td>Potassium</td><td>as sodium but more violent; the hydrogen ignites with a <b>lilac flame</b></td></tr>
</table>

<div class="box exam"><span class="lbl">Predicting the next element (common question)</span>
Use the trends: <b>rubidium</b> (below K) will have a <b>lower melting point</b> than potassium, a
<b>higher density</b>, and react <b>even more violently</b> with water to form rubidium hydroxide (RbOH)
and hydrogen. Always use the data you are given and quote the trend.</div>

<h3>Group VII Properties &mdash; the halogens</h3>
<p>Halogens are <span class="hl">diatomic non-metals</span>: Cl<sub>2</sub>, Br<sub>2</sub>,
I<sub>2</sub> &mdash; two atoms joined by a covalent bond.</p>
<div class="row">
<div>
<table class="k">
<tr><th>Halogen</th><th>Appearance at r.t.p.</th></tr>
<tr><td>Chlorine, Cl<sub>2</sub></td><td><span class="swatch" style="background:#dce775"></span><b>pale yellow-green gas</b></td></tr>
<tr><td>Bromine, Br<sub>2</sub></td><td><span class="swatch" style="background:#a0522d"></span><b>red-brown liquid</b></td></tr>
<tr><td>Iodine, I<sub>2</sub></td><td><span class="swatch" style="background:#37323e"></span><b>grey-black solid</b></td></tr>
</table>
<p class="small">Learn these three exactly &mdash; the colour words are what score.</p>
</div>
<div>
<table class="k">
<tr><th>Trend down the group</th><th>Cl &rarr; Br &rarr; I</th></tr>
<tr><td>Density</td><td><b>increases</b></td></tr>
<tr><td>Reactivity</td><td><b>decreases</b></td></tr>
<tr><td>Colour</td><td>gets darker</td></tr>
<tr><td>State</td><td>gas &rarr; liquid &rarr; solid (melting and boiling points increase)</td></tr>
</table>
</div>
</div>
<div class="box def"><span class="lbl">Why reactivity decreases down Group VII</span>
Halogens react by <b>gaining</b> an electron. Further down, the outer shell is <b>further from the
nucleus</b> and more shielded, so an extra electron is <b>attracted less strongly</b> and gained less
easily. (The opposite of Group I, which reacts by <i>losing</i> an electron.)</div>

<h3>Group VII Displacement Reactions</h3>
<p>A <span class="hl">more reactive halogen displaces a less reactive halogen from an aqueous solution of its
halide ions</span>.</p>
<table class="c">
<tr><th style="text-align:left">Halogen added &darr; / solution &rarr;</th><th>potassium chloride (Cl<sup>&minus;</sup>)</th>
<th>potassium bromide (Br<sup>&minus;</sup>)</th><th>potassium iodide (I<sup>&minus;</sup>)</th></tr>
<tr><td class="k" style="text-align:left">Chlorine</td><td>&mdash;</td><td class="green">turns <b>orange</b> (Br<sub>2</sub> formed)</td><td class="green">turns <b>brown</b> (I<sub>2</sub> formed)</td></tr>
<tr><td class="k" style="text-align:left">Bromine</td><td>no reaction</td><td>&mdash;</td><td class="green">turns <b>brown</b> (I<sub>2</sub> formed)</td></tr>
<tr><td class="k" style="text-align:left">Iodine</td><td>no reaction</td><td>no reaction</td><td>&mdash;</td></tr>
</table>
<div class="row">
<div>
<p style="margin-bottom:1px"><b>Symbol equations</b></p>
<p class="eq">Cl<sub>2</sub> + 2KBr &rarr; 2KCl + Br<sub>2</sub></p>
<p class="eq">Cl<sub>2</sub> + 2KI &rarr; 2KCl + I<sub>2</sub></p>
<p class="eq">Br<sub>2</sub> + 2KI &rarr; 2KBr + I<sub>2</sub></p>
</div>
<div>
<p style="margin-bottom:1px"><b>Ionic equations</b> (K<sup>+</sup> is a spectator ion)</p>
<p class="eq">Cl<sub>2</sub> + 2Br<sup>&minus;</sup> &rarr; 2Cl<sup>&minus;</sup> + Br<sub>2</sub></p>
<p class="eq">Cl<sub>2</sub> + 2I<sup>&minus;</sup> &rarr; 2Cl<sup>&minus;</sup> + I<sub>2</sub></p>
<p class="eq">Br<sub>2</sub> + 2I<sup>&minus;</sup> &rarr; 2Br<sup>&minus;</sup> + I<sub>2</sub></p>
</div>
</div>
<div class="box exam"><span class="lbl">These are redox reactions</span>
The halogen <b>gains electrons</b> &rarr; it is <b>reduced</b> (it is the oxidising agent):
Cl<sub>2</sub> + 2e<sup>&minus;</sup> &rarr; 2Cl<sup>&minus;</sup><br>
The halide ion <b>loses electrons</b> &rarr; it is <b>oxidised</b>: 2Br<sup>&minus;</sup> &rarr; Br<sub>2</sub> + 2e<sup>&minus;</sup><br>
Observation answer: &ldquo;the colourless solution turns orange / brown&rdquo; &mdash; give the colour
<i>change</i>, not just the final colour.</div>

<h3>Transition Elements</h3>
<p>The transition elements are <span class="hl">metals that have high densities, high melting points, form
coloured compounds, and often act as catalysts</span> (as the element or in compounds).</p>
<div class="row">
<div>
<table class="k">
<tr><th></th><th>Transition elements</th><th>Group I metals</th></tr>
<tr><td>Density</td><td>high</td><td>low</td></tr>
<tr><td>Melting point</td><td>high</td><td>low</td></tr>
<tr><td>Hardness</td><td>hard, strong</td><td>soft</td></tr>
<tr><td>Compounds</td><td><b>coloured</b></td><td>white / colourless solutions</td></tr>
<tr><td>Catalysts?</td><td><b>often</b></td><td>no</td></tr>
</table>
</div>
<div>
<p><b>Coloured compounds:</b> copper(II) sulfate solution is blue; iron(II) compounds are usually pale
green; iron(III) compounds are usually orange-brown.</p>
<p><b>Catalysts:</b> iron in the Haber process; vanadium(V) oxide in the Contact process.</p>
</div>
</div>
<div class="box def"><span class="lbl">Variable oxidation numbers</span>
Transition elements can form ions with <span class="hl">different oxidation numbers</span>. The Roman
numeral in the name gives it:<br>
<b>iron(II)</b> = Fe<sup>2+</sup>, e.g. FeCl<sub>2</sub>, FeO &nbsp;&middot;&nbsp; <b>iron(III)</b> =
Fe<sup>3+</sup>, e.g. FeCl<sub>3</sub>, Fe<sub>2</sub>O<sub>3</sub></div>

<h3>Noble Gases</h3>
<div class="box def"><span class="lbl">Definition</span>
The Group VIII noble gases are <span class="hl">unreactive, monatomic gases</span>. This is because they
have a <b>full outer shell</b> of electrons (a stable electronic configuration), so they don&rsquo;t need to
lose, gain or share electrons.</div>
<p><b>Monatomic</b> = they exist as single atoms (He, Ne, Ar), not molecules like Cl<sub>2</sub>. Because
they are unreactive, argon is used to fill light bulbs and helium to fill balloons.</p>

<div class="box warn"><span class="lbl">Watch out</span>
<ul>
<li>&ldquo;Noble gases have 8 outer electrons&rdquo; &mdash; helium has 2. Say <b>full outer shell</b>.</li>
<li>Chlorine vs chlorid<b>e</b>: chlorine is the element (Cl<sub>2</sub>); chloride is the ion
(Cl<sup>&minus;</sup>). Write Cl<sub>2</sub>, not Cl, for the halogen in equations.</li>
<li>Displacement only goes one way: a <b>less</b> reactive halogen can&rsquo;t displace a more reactive one
(iodine + potassium chloride = no reaction).</li>
<li>Reactivity goes <b>up</b> down Group I but <b>down</b> down Group VII &mdash; don&rsquo;t mix them up.</li>
<li>&ldquo;Group I reactivity increases because there are more electrons&rdquo; &mdash; no: it&rsquo;s because the
outer electron is <b>further from the nucleus</b> and more <b>shielded</b>.</li>
</ul></div>

<div class="keep">
<h3>Self-check before the topic questions</h3>
<ul class="check" style="columns:2; column-gap:18px; font-size:10pt">
<li>Describe how the Periodic Table is arranged (groups, periods, proton number)</li>
<li>Link group number to outer electrons and ion charge; period number to shells</li>
<li>Describe metallic &rarr; non-metallic character across a period</li>
<li>Explain why elements in the same group react similarly</li>
<li>Give the Group I trends and predict the properties of Rb or Cs</li>
<li>Write the equation and observations for Li, Na and K with water</li>
<li>State the appearance of Cl<sub>2</sub>, Br<sub>2</sub>, I<sub>2</sub> and the Group VII trends</li>
<li>Explain halogen displacement: observations, equations, what is oxidised / reduced</li>
<li>State the four properties of transition elements; explain iron(II) / iron(III)</li>
<li>Explain why the noble gases are unreactive and monatomic</li>
</ul>
</div>
"""

if __name__ == "__main__":
    preview = sys.argv[1] if len(sys.argv) > 1 else None
    render(TITLE, BODY, "/tmp/chem_parts/topic08.pdf", preview_dir=preview)
