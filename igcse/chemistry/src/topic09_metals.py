"""Chemistry Topic 9 - Metals (Cambridge IGCSE 0620, Extended)."""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from notes import render, svg, text, INK  # noqa: E402

TITLE = "Chemistry 0620 - Topic 9: Metals"


# ---------------- diagrams ----------------

def fig_alloy():
    s = ""
    r, sp = 11, 24
    # pure metal: regular layers
    for row in range(4):
        for col in range(6):
            x, y = 22 + col * sp, 22 + row * sp
            s += (f'<circle cx="{x}" cy="{y}" r="{r}" fill="#ffe0b2" stroke="{INK}" '
                  f'stroke-width="1.2"/>')
    s += text(82, 132, "pure metal", 13, color="#333")
    s += text(82, 147, "layers slide easily", 12, color="#777")
    # alloy: same lattice with some larger atoms
    ox = 190
    big = {(1, 1), (2, 4), (0, 3), (3, 1)}
    for row in range(4):
        for col in range(6):
            x, y = ox + col * sp, 22 + row * sp
            if (row, col) in big:
                continue
            s += (f'<circle cx="{x}" cy="{y}" r="{r}" fill="#ffe0b2" stroke="{INK}" '
                  f'stroke-width="1.2"/>')
    for row, col in big:
        x, y = ox + col * sp, 22 + row * sp
        s += (f'<circle cx="{x}" cy="{y}" r="16" fill="#90a4ae" stroke="{INK}" '
              f'stroke-width="1.2"/>')
    s += text(ox + 60, 132, "alloy", 13, color="#333")
    s += text(ox + 60, 147, "different-sized atoms stop the layers sliding", 12, color="#777")
    return svg(370, 155, s, width_mm=86)


def tube(x, liquid_top=None, liquid="#bbdefb", oil=False, stopper=False, drier=False,
         rusty=False):
    s = ""
    top, bottom = 34, 150
    if stopper:
        s += f'<rect x="{x-19}" y="{top-14}" width="38" height="16" rx="3" fill="#8d6e63"/>'
    if liquid_top is not None:
        s += (f'<path d="M{x-17},{liquid_top} L{x-17},{bottom} A17,17 0 0 0 {x+17},{bottom} '
              f'L{x+17},{liquid_top} Z" fill="{liquid}"/>')
    if oil:
        s += f'<rect x="{x-17}" y="{liquid_top-9}" width="34" height="9" fill="#f6d365"/>'
    if drier:
        for i in range(9):
            cx = x - 11 + (i % 4) * 7 + (3 if (i // 4) % 2 else 0)
            cy = 158 - (i // 4) * 7
            s += f'<circle cx="{cx}" cy="{cy}" r="3.2" fill="#e0e0e0" stroke="#999" stroke-width="0.8"/>'
        s += f'<ellipse cx="{x}" cy="136" rx="16" ry="5" fill="#fff" stroke="#999" stroke-width="1"/>'
    # nail
    ny2 = 128 if drier else 150
    s += (f'<path d="M{x},{56} L{x},{ny2}" stroke="#78909c" stroke-width="4.5" '
          f'stroke-linecap="round"/>')
    s += f'<path d="M{x-6},{56} L{x+6},{56}" stroke="#78909c" stroke-width="4" stroke-linecap="round"/>'
    if rusty:
        for yy in (82, 96, 110, 124, 138):
            s += f'<circle cx="{x + (2 if yy % 28 else -2)}" cy="{yy}" r="3.4" fill="#d2691e"/>'
    s += (f'<path d="M{x-18},{top} L{x-18},{bottom} A18,18 0 0 0 {x+18},{bottom} '
          f'L{x+18},{top}" fill="none" stroke="{INK}" stroke-width="1.8"/>')
    return s


def fig_rust_tubes():
    s = ""
    s += tube(70, liquid_top=100, rusty=True)
    s += tube(220, liquid_top=100, oil=True)
    s += tube(370, stopper=True, drier=True)
    labels = [
        (70, "A: air + water", "rusts", "#c62828"),
        (220, "B: boiled water + oil layer", "no rust (no oxygen)", "#2e7d32"),
        (370, "C: dry air, drying agent", "no rust (no water)", "#2e7d32"),
    ]
    for x, a, b, c in labels:
        s += text(x, 192, a, 12.5, color="#333")
        s += text(x, 208, b, 12.5, color=c, extra='font-weight="700"')
    s += text(258, 92, "oil", 11, anchor="start", color="#8a6d00")
    s += text(408, 160, "anhydrous", 11, anchor="start", color="#555")
    s += text(408, 173, "calcium chloride", 11, anchor="start", color="#555")
    return svg(500, 215, s, width_mm=112)


def fig_blast_furnace():
    s = ""
    pts = "170,40 250,40 290,190 270,252 270,300 150,300 150,252 130,190"
    s += f'<polygon points="{pts}" fill="#eceff1" stroke="{INK}" stroke-width="2.5"/>'
    s += '<rect x="151" y="262" width="118" height="16" fill="#bcaaa4"/>'
    s += '<rect x="151" y="278" width="118" height="21" fill="#ff8a65"/>'
    s += text(210, 274, "slag", 11, color="#333")
    s += text(210, 293, "molten iron", 11, color="#333")
    # charge in
    s += ('<path d="M210,8 L210,36" stroke="#262626" stroke-width="1.8" marker-end="url(#ah)"/>')
    s += text(202, 14, "iron ore (hematite),", 12, anchor="end")
    s += text(202, 28, "coke, limestone", 12, anchor="end")
    # waste gases
    s += ('<path d="M262,78 L308,58" stroke="#262626" stroke-width="1.6" marker-end="url(#ah)"/>')
    s += text(312, 60, "waste gases", 12, anchor="start")
    # hot air
    s += ('<path d="M78,228 L136,228" stroke="#1d3c8c" stroke-width="2" marker-end="url(#ah)"/>')
    s += ('<path d="M342,228 L284,228" stroke="#1d3c8c" stroke-width="2" marker-end="url(#ah)"/>')
    s += text(76, 224, "hot air", 12, anchor="end", color="#1d3c8c")
    s += text(344, 224, "hot air", 12, anchor="start", color="#1d3c8c")
    # taps
    s += ('<path d="M150,270 L100,270" stroke="#262626" stroke-width="1.6" marker-end="url(#ah)"/>')
    s += text(96, 274, "slag out", 12, anchor="end")
    s += ('<path d="M270,290 L320,290" stroke="#262626" stroke-width="1.6" marker-end="url(#ah)"/>')
    s += text(324, 294, "iron out", 12, anchor="start")
    # zone hints
    s += text(210, 225, "1  C + O₂ → CO₂", 11, color="#555")
    s += text(210, 175, "2  C + CO₂ → 2CO", 11, color="#555")
    s += text(210, 125, "3  Fe₂O₃ + 3CO →", 11, color="#555")
    s += text(210, 139, "2Fe + 3CO₂", 11, color="#555")
    return svg(420, 310, s, width_mm=68)


def fig_aluminium_cell():
    s = ""
    # steel case + carbon lining
    s += f'<rect x="30" y="70" width="300" height="130" fill="#455a64" stroke="{INK}" stroke-width="1.5"/>'
    s += f'<rect x="42" y="70" width="276" height="118" fill="#fff3e0"/>'
    s += '<rect x="42" y="164" width="276" height="24" fill="#b0bec5"/>'
    s += text(180, 181, "molten aluminium", 12)
    s += text(180, 140, "aluminium oxide dissolved", 12)
    s += text(180, 154, "in molten cryolite", 12)
    # anodes
    for x in (90, 220):
        s += f'<rect x="{x}" y="28" width="50" height="80" fill="#424242"/>'
        for i, (bx, by) in enumerate(((x + 8, 116), (x + 25, 120), (x + 42, 114))):
            s += f'<circle cx="{bx}" cy="{by}" r="3" fill="none" stroke="#777" stroke-width="1"/>'
    s += f'<path d="M115,28 L115,18 L245,18 L245,28" fill="none" stroke="{INK}" stroke-width="2"/>'
    s += text(180, 13, "carbon anodes (+)", 12, color="#c62828", extra='font-weight="700"')
    s += text(180, 216, "carbon lining = cathode (−)", 12, color="#1d3c8c", extra='font-weight="700"')
    s += ('<path d="M330,180 L360,180" stroke="#262626" stroke-width="1.6" marker-end="url(#ah)"/>')
    s += text(364, 184, "Al out", 12, anchor="start")
    return svg(410, 222, s, width_mm=82)


# ---------------- content ----------------

STYLE = """<style>
.eq { font-size: 10.4pt; margin: 2px 0; }
.rs { display: flex; flex-wrap: wrap; gap: 3px; margin: 4px 0 6px; }
.rs span { padding: 1px 7px; border-radius: 4px; font-weight: 700; font-size: 10pt; }
.rs .m { background: #ffe0b2; } .rs .n { background: #d6e4f7; }
</style>"""

BODY = STYLE + f"""
<h1>Topic 9 &nbsp;Metals</h1>
<div class="meta">Cambridge IGCSE Chemistry 0620 &middot; Extended &middot; Sections 1&ndash;3 match
the SaveMyExams sub-topics, so you can do their questions after each one</div>

<h2><span class="num">1</span>Properties, Uses &amp; Alloys of Metals</h2>
<h3>Properties of Metals</h3>
<table class="k">
<tr><th style="width:24%">Physical property</th><th>Metals</th><th>Non-metals</th></tr>
<tr><td>Thermal conductivity</td><td><b>good</b></td><td>poor</td></tr>
<tr><td>Electrical conductivity</td><td><b>good</b></td><td>poor (except graphite)</td></tr>
<tr><td>Malleable and ductile?</td><td><b>yes</b> &mdash; can be hammered into shape and drawn into wires</td><td>no &mdash; brittle when solid</td></tr>
<tr><td>Melting and boiling points</td><td>usually <b>high</b></td><td>usually low (except e.g. diamond, graphite)</td></tr>
</table>

<p><b>Chemical properties</b> &mdash; how metals react:</p>
<table class="k">
<tr><th style="width:18%">With</th><th>General equation</th><th>Example</th></tr>
<tr><td>Oxygen</td><td>metal + oxygen &rarr; metal oxide</td><td>2Mg + O<sub>2</sub> &rarr; 2MgO (bright white flame)<br>2Cu + O<sub>2</sub> &rarr; 2CuO (black solid forms)</td></tr>
<tr><td>Cold water</td><td>metal + water &rarr; metal hydroxide + hydrogen</td><td>Ca + 2H<sub>2</sub>O &rarr; Ca(OH)<sub>2</sub> + H<sub>2</sub></td></tr>
<tr><td>Steam</td><td>metal + steam &rarr; metal oxide + hydrogen</td><td>Mg + H<sub>2</sub>O &rarr; MgO + H<sub>2</sub></td></tr>
<tr><td>Dilute acid</td><td>metal + acid &rarr; salt + hydrogen</td><td>Zn + 2HCl &rarr; ZnCl<sub>2</sub> + H<sub>2</sub></td></tr>
</table>

<h3>Uses of Metals</h3>
<p>A use is always explained by a <b>property</b> &mdash; learn them as pairs:</p>
<table class="k">
<tr><th style="width:26%">Use</th><th>Property that makes it suitable</th></tr>
<tr><td>Aluminium &mdash; aircraft</td><td><b>low density</b></td></tr>
<tr><td>Aluminium &mdash; overhead electrical cables</td><td><b>low density</b> and <b>good electrical conductivity</b></td></tr>
<tr><td>Aluminium &mdash; food containers</td><td><b>resistance to corrosion</b></td></tr>
<tr><td>Copper &mdash; electrical wiring</td><td><b>good electrical conductivity</b> and <b>ductile</b></td></tr>
</table>

<h3>Alloys</h3>
<div class="box def"><span class="lbl">Definition</span>
<b>Alloy</b> &ndash; <span class="hl">a mixture of a metal with other elements.</span></div>
<div class="row">
<div>
<table class="k">
<tr><th>Alloy</th><th>Made of</th></tr>
<tr><td>Brass</td><td>copper and zinc</td></tr>
<tr><td>Stainless steel</td><td>iron with other elements such as <b>chromium, nickel and carbon</b></td></tr>
</table>
<ul>
<li>Alloys can be <span class="hl">harder and stronger</span> than the pure metals, so they are often more useful.</li>
<li><b>Stainless steel &rarr; cutlery</b>, because it is <b>hard</b> and <b>resistant to rusting</b>.</li>
</ul>
</div>
<figure style="flex:0 0 88mm">{fig_alloy()}</figure>
</div>
<div class="box exam"><span class="lbl">Why alloys are harder (2&ndash;3 marks)</span>
In a pure metal the atoms are all the same size and arranged in regular layers that can slide over each
other. In an alloy, the <b>different sized atoms</b> disrupt the layers, so the <b>layers can no longer
slide over each other</b> easily.<br>
<b>Spotting an alloy in a diagram:</b> look for atoms of a <i>different size</i> mixed in among the
metal atoms.</div>

<h2><span class="num">2</span>Reactivity Series &amp; Corrosion of Metals</h2>
<h3>Reactivity Series</h3>
<p>Most reactive &rarr; least reactive (carbon and hydrogen are included as reference points):</p>
<div class="rs">
<span class="m">K</span><span class="m">Na</span><span class="m">Ca</span><span class="m">Mg</span>
<span class="m">Al</span><span class="n">C</span><span class="m">Zn</span><span class="m">Fe</span>
<span class="n">H</span><span class="m">Cu</span><span class="m">Ag</span><span class="m">Au</span>
</div>
<p class="small">Memory aid: <b>P</b>lease <b>S</b>end <b>C</b>ats, <b>M</b>onkeys <b>A</b>nd
<b>C</b>ute <b>Z</b>ebras <b>I</b>nto <b>H</b>ot <b>C</b>ountries <b>S</b>igned <b>G</b>ordon
(potassium, sodium, calcium, magnesium, aluminium, carbon, zinc, iron, hydrogen, copper, silver, gold).</p>

<table class="k">
<tr><th style="width:14%">Metal</th><th>Cold water</th><th>Steam</th><th>Dilute hydrochloric acid</th></tr>
<tr><td>Potassium</td><td>very vigorous; H<sub>2</sub> ignites (lilac flame)</td><td rowspan="3" style="vertical-align:middle">&mdash;</td><td rowspan="2" style="vertical-align:middle">dangerously violent &mdash; never done</td></tr>
<tr><td>Sodium</td><td>vigorous; melts into a ball, fizzes</td></tr>
<tr><td>Calcium</td><td>steady fizzing; solution goes cloudy</td><td>vigorous fizzing</td></tr>
<tr><td>Magnesium</td><td>very slow</td><td><b>reacts</b>: bright white glow &rarr; MgO + H<sub>2</sub></td><td>fizzes quickly</td></tr>
<tr><td>Zinc</td><td colspan="2" rowspan="2" style="vertical-align:middle" class="small">(not needed for the syllabus)</td><td>fizzes steadily</td></tr>
<tr><td>Iron</td><td>fizzes slowly &rarr; iron(II) chloride</td></tr>
<tr><td>Copper, silver, gold</td><td colspan="2"><b>no reaction</b></td><td><b>no reaction</b></td></tr>
</table>
<p class="eq">Mg + 2HCl &rarr; MgCl<sub>2</sub> + H<sub>2</sub> &nbsp;&nbsp;&middot;&nbsp;&nbsp; Fe + 2HCl &rarr;
FeCl<sub>2</sub> + H<sub>2</sub> &nbsp;&nbsp;&middot;&nbsp;&nbsp; 2K + 2H<sub>2</sub>O &rarr; 2KOH + H<sub>2</sub></p>
<div class="box exam"><span class="lbl">Explaining the acid reactions</span>
Metals <b>above hydrogen</b> in the reactivity series react with dilute acids, displacing hydrogen.
Metals <b>below hydrogen</b> (copper, silver, gold) do not react with dilute acids.</div>

<div class="box def"><span class="lbl">Deducing an order from results (common question)</span>
Rank the metals by how vigorously they react: more bubbles / faster fizzing / bigger temperature rise /
more displacement reactions = <b>more reactive</b>. Example: X fizzes rapidly in acid, Y fizzes slowly, Z
does nothing &rarr; order <b>X &gt; Y &gt; Z</b>, and Z is below hydrogen.</div>

<h3>Explaining Reactivity</h3>
<p>The reactivity of a metal is its <span class="hl">tendency to form positive ions</span> (to lose
electrons). The more easily a metal loses electrons, the more reactive it is.</p>
<p><b>Displacement:</b> a more reactive metal <span class="hl">displaces a less reactive metal from an aqueous
solution of its ions</span>.</p>
<table class="c">
<tr><th style="text-align:left">Metal added &darr; / solution &rarr;</th><th>MgSO<sub>4</sub></th><th>ZnSO<sub>4</sub></th><th>FeSO<sub>4</sub></th><th>CuSO<sub>4</sub></th></tr>
<tr><td class="k" style="text-align:left">Magnesium</td><td>&mdash;</td><td class="green">&#10003;</td><td class="green">&#10003;</td><td class="green">&#10003;</td></tr>
<tr><td class="k" style="text-align:left">Zinc</td><td>&#10007;</td><td>&mdash;</td><td class="green">&#10003;</td><td class="green">&#10003;</td></tr>
<tr><td class="k" style="text-align:left">Iron</td><td>&#10007;</td><td>&#10007;</td><td>&mdash;</td><td class="green">&#10003;</td></tr>
<tr><td class="k" style="text-align:left">Copper</td><td>&#10007;</td><td>&#10007;</td><td>&#10007;</td><td>&mdash;</td></tr>
</table>
<div class="row">
<div>
<p class="eq">Mg + CuSO<sub>4</sub> &rarr; MgSO<sub>4</sub> + Cu</p>
<p class="eq">Fe + CuSO<sub>4</sub> &rarr; FeSO<sub>4</sub> + Cu</p>
<p class="eq">Cu + 2AgNO<sub>3</sub> &rarr; Cu(NO<sub>3</sub>)<sub>2</sub> + 2Ag</p>
</div>
<div>
<p class="eq"><b>Ionic:</b> Mg + Cu<sup>2+</sup> &rarr; Mg<sup>2+</sup> + Cu</p>
<p class="eq"><b>Ionic:</b> Cu + 2Ag<sup>+</sup> &rarr; Cu<sup>2+</sup> + 2Ag</p>
<p class="small">The metal atom loses electrons (is <b>oxidised</b>); the metal ion gains them (is
<b>reduced</b>).</p>
</div>
</div>
<p class="small">What you see with CuSO<sub>4</sub>: the blue solution fades (turns pale green with iron) and a
pink-brown coating of copper forms on the metal.</p>

<div class="box def"><span class="lbl">Why aluminium seems unreactive</span>
Aluminium is high in the reactivity series, but it is covered by a thin <b>layer of aluminium oxide</b>
that stops water and acids reaching the metal underneath.</div>

<h3>Rusting of Iron</h3>
<div class="box def"><span class="lbl">Definition</span>
Iron and steel rust when they are in contact with <span class="hl">both water and oxygen</span>. Rust is
<b>hydrated iron(III) oxide</b>.<br>
iron + oxygen + water &rarr; hydrated iron(III) oxide</div>
<figure>{fig_rust_tubes()}
<figcaption>Only tube A has both water and oxygen, so only A rusts. Boiling removes dissolved oxygen; the
oil stops air dissolving back in.</figcaption></figure>
<p><b>Barrier methods</b> stop rusting by <span class="hl">excluding oxygen or water</span>:
<b>painting</b> (cars, bridges), <b>greasing / oiling</b> (moving parts, tools),
<b>coating with plastic</b> (garden furniture, wire fences).</p>

<h3>Galvanising &amp; Sacrificial Protection</h3>
<div class="row">
<div class="box def" style="margin-top:2px"><span class="lbl">Galvanising</span>
Coating iron or steel with a layer of <b>zinc</b>. It works in two ways:<br>
<b>1. Barrier:</b> the zinc keeps out oxygen and water.<br>
<b>2. Sacrificial protection:</b> even if the zinc is scratched, the iron still doesn&rsquo;t rust.</div>
<div class="box exam" style="margin-top:2px"><span class="lbl">Explaining sacrificial protection</span>
Zinc is <b>more reactive than iron</b>, so zinc <b>loses electrons / is oxidised in preference to
iron</b>:<br>Zn &rarr; Zn<sup>2+</sup> + 2e<sup>&minus;</sup><br>
The iron doesn&rsquo;t lose electrons, so it doesn&rsquo;t rust. Blocks of zinc (or magnesium) attached to
ships&rsquo; hulls work in the same way.</div>
</div>

<h2><span class="num">3</span>Extraction of Metals</h2>
<h3>Extraction of Metals</h3>
<p>The <span class="hl">more reactive the metal, the harder it is to extract</span> from its ore, because it
holds on to the other elements in its compounds more strongly.</p>
<table class="k">
<tr><th style="width:26%">Metals</th><th>Position</th><th>How they are extracted</th></tr>
<tr><td>K, Na, Ca, Mg, Al</td><td>above carbon</td><td><b>electrolysis</b> of the molten compound</td></tr>
<tr><td>Zn, Fe, Cu</td><td>below carbon</td><td><b>reduction by heating with carbon</b> (carbon takes the oxygen)</td></tr>
<tr><td>Au (and some Ag)</td><td>very unreactive</td><td>found <b>uncombined</b> as the element</td></tr>
</table>
<p class="eq">e.g. 2CuO + C &rarr; 2Cu + CO<sub>2</sub> &nbsp;&nbsp; (copper(II) oxide is reduced; carbon is
oxidised)</p>

<h3>Extraction of Iron from Hematite</h3>
<div class="row">
<figure style="flex:0 0 70mm; margin-top:0">{fig_blast_furnace()}<figcaption>The blast furnace</figcaption></figure>
<div>
<table class="k">
<tr><th>Raw material</th><th>Job</th></tr>
<tr><td>Hematite</td><td>iron ore: iron(III) oxide, Fe<sub>2</sub>O<sub>3</sub></td></tr>
<tr><td>Coke (carbon)</td><td>burns to give <b>heat</b>; makes the reducing agent CO</td></tr>
<tr><td>Limestone</td><td>CaCO<sub>3</sub>; removes the acidic impurity <b>silicon dioxide (sand)</b> as slag</td></tr>
<tr><td>Hot air</td><td>provides oxygen for the coke to burn</td></tr>
</table>
<p class="small">Molten iron sinks to the bottom; the slag is less dense and floats on top of it. Both are
tapped off separately.</p>
</div>
</div>
<table class="k">
<tr><th style="width:4%">#</th><th style="width:34%">Equation</th><th>What happens</th></tr>
<tr><td>1</td><td>C + O<sub>2</sub> &rarr; CO<sub>2</sub></td><td>coke <b>burns</b> in hot air, giving heat (exothermic) and carbon dioxide</td></tr>
<tr><td>2</td><td>C + CO<sub>2</sub> &rarr; 2CO</td><td>carbon dioxide is <b>reduced</b> to carbon monoxide by more coke</td></tr>
<tr><td>3</td><td>Fe<sub>2</sub>O<sub>3</sub> + 3CO &rarr; 2Fe + 3CO<sub>2</sub></td><td>iron(III) oxide is <b>reduced</b> to iron by carbon monoxide (the reducing agent)</td></tr>
<tr><td>4</td><td>CaCO<sub>3</sub> &rarr; CaO + CO<sub>2</sub></td><td><b>thermal decomposition</b> of limestone to calcium oxide</td></tr>
<tr><td>5</td><td>CaO + SiO<sub>2</sub> &rarr; CaSiO<sub>3</sub></td><td>calcium oxide (basic) reacts with silicon dioxide (acidic) to form <b>slag</b>, calcium silicate</td></tr>
</table>

<h3>Extraction of Aluminium from Bauxite</h3>
<div class="row">
<div>
<p>The main ore of aluminium is <b>bauxite</b>. Aluminium is above carbon, so it is extracted by
<span class="hl">electrolysis</span> of purified bauxite (aluminium oxide, Al<sub>2</sub>O<sub>3</sub>).</p>
<ul>
<li><b>Cryolite:</b> aluminium oxide is dissolved in molten cryolite. This <b>lowers the melting
point</b>, so less energy is needed (cheaper).</li>
<li><b>Electrodes:</b> both are carbon (graphite).</li>
<li><b>Anodes replaced regularly:</b> the oxygen made at the anode reacts with the carbon anode to form
carbon dioxide, so the anodes <b>burn away</b>: C + O<sub>2</sub> &rarr; CO<sub>2</sub></li>
</ul>
</div>
<figure style="flex:0 0 84mm; margin-top:0">{fig_aluminium_cell()}</figure>
</div>
<table class="k">
<tr><th style="width:24%">Electrode</th><th>Half-equation</th><th>Type</th></tr>
<tr><td>Cathode (&minus;)</td><td>Al<sup>3+</sup> + 3e<sup>&minus;</sup> &rarr; Al</td><td>reduction &mdash; molten aluminium collects at the bottom</td></tr>
<tr><td>Anode (+)</td><td>2O<sup>2&minus;</sup> &rarr; O<sub>2</sub> + 4e<sup>&minus;</sup></td><td>oxidation &mdash; oxygen gas forms</td></tr>
</table>

<div class="box warn"><span class="lbl">Watch out</span>
<ul>
<li>Rusting needs <b>both</b> water and oxygen. Only iron and steel &ldquo;rust&rdquo;; other metals
<i>corrode</i>.</li>
<li>Rust is <b>hydrated</b> iron(III) oxide &mdash; not just &ldquo;iron oxide&rdquo;.</li>
<li>Galvanised iron still works when scratched because of <b>sacrificial protection</b>, not because of the
barrier.</li>
<li>In the blast furnace, <b>carbon monoxide</b> reduces the iron(III) oxide. Limestone is there to
<b>remove impurities</b> as slag, not to make iron.</li>
<li>Cryolite <b>lowers the melting point</b> &mdash; it is not a catalyst. Anodes are replaced because they
<b>react with oxygen</b>, not because they melt.</li>
<li>Aluminium is a <b>reactive</b> metal; it only seems unreactive because of its oxide layer.</li>
<li>Uses questions: always give the <b>property</b> (e.g. &ldquo;low density&rdquo;), not just
&ldquo;it is light&rdquo; or &ldquo;it is strong&rdquo;.</li>
</ul></div>

<div class="keep">
<h3>Self-check before the topic questions</h3>
<ul class="check" style="columns:2; column-gap:18px; font-size:10pt">
<li>Compare the physical properties of metals and non-metals</li>
<li>Describe how metals react with oxygen, water / steam and dilute acids</li>
<li>Link the four uses of aluminium and copper to properties</li>
<li>Define an alloy; give brass and stainless steel</li>
<li>Explain why alloys are harder, and spot one in a diagram</li>
<li>Recite the reactivity series in order (with C and H)</li>
<li>Describe K, Na, Ca + water; Mg + steam; metals + dilute HCl</li>
<li>Deduce a reactivity order from experimental results</li>
<li>Explain reactivity as forming positive ions; write displacement equations</li>
<li>Explain why aluminium seems unreactive</li>
<li>State the conditions for rusting and three barrier methods</li>
<li>Explain galvanising and sacrificial protection with an equation</li>
<li>Link ease of extraction to the reactivity series</li>
<li>Write all five blast furnace equations and the job of each raw material</li>
<li>Explain the aluminium cell: cryolite, anodes, both half-equations</li>
</ul>
</div>
"""

if __name__ == "__main__":
    preview = sys.argv[1] if len(sys.argv) > 1 else None
    render(TITLE, BODY, "/tmp/chem_parts/topic09.pdf", preview_dir=preview)
