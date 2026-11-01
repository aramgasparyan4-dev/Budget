"""Chemistry Topic 4 - Electrochemistry (Cambridge IGCSE 0620, Extended)."""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from notes import render, svg, text, INK  # noqa: E402

TITLE = "Chemistry 0620 - Topic 4: Electrochemistry"

LIQ = "#dcecf7"


# ---------------- diagrams ----------------

def battery(cx, y, left_x, right_x):
    """DC supply: long thin plate (+) on the left, short thick plate (-) on the right."""
    s = f'<path d="M{left_x},{y} L{cx-7},{y}" stroke="{INK}" stroke-width="1.8" fill="none"/>'
    s += f'<path d="M{cx+7},{y} L{right_x},{y}" stroke="{INK}" stroke-width="1.8" fill="none"/>'
    s += f'<path d="M{cx-7},{y-16} L{cx-7},{y+16}" stroke="{INK}" stroke-width="2"/>'
    s += f'<path d="M{cx+7},{y-8} L{cx+7},{y+8}" stroke="{INK}" stroke-width="5"/>'
    s += text(cx - 18, y - 10, "+", 15) + text(cx + 18, y - 10, "−", 17)
    return s


def ion(x, y, sign, fill):
    return (f'<circle cx="{x}" cy="{y}" r="10" fill="{fill}" stroke="{INK}" stroke-width="1.2"/>'
            + text(x, y + 5, sign, 15))


def arrow(x1, y1, x2, y2, color=INK, width=1.6):
    return (f'<path d="M{x1},{y1} L{x2},{y2}" stroke="{color}" stroke-width="{width}" '
            f'fill="none" marker-end="url(#ah)"/>')


def fig_cell(anode_lbl="anode (+)", cathode_lbl="cathode (−)", sub_a="", sub_c="",
             anode_fill="#666", cathode_fill="#666", width_mm=78, show_ions=True,
             plated=False):
    s = f'<rect x="62" y="112" width="236" height="116" fill="{LIQ}"/>'
    s += (f'<path d="M60,80 L60,220 Q60,230 70,230 L290,230 Q300,230 300,220 L300,80" '
          f'fill="none" stroke="{INK}" stroke-width="2"/>')
    # electrodes
    s += f'<rect x="110" y="62" width="16" height="135" fill="{anode_fill}" stroke="{INK}"/>'
    s += f'<rect x="234" y="62" width="16" height="135" fill="{cathode_fill}" stroke="{INK}"/>'
    if plated:
        s += (f'<rect x="230" y="112" width="24" height="89" fill="none" stroke="#9e9e9e" '
              f'stroke-width="3" rx="3"/>')
    # wires + supply
    s += f'<path d="M118,62 L118,28" stroke="{INK}" stroke-width="1.8"/>'
    s += f'<path d="M242,62 L242,28" stroke="{INK}" stroke-width="1.8"/>'
    s += battery(180, 28, 118, 242)
    # electron flow in the external circuit
    s += arrow(100, 58, 100, 36, "#1d3c8c") + text(85, 52, "e⁻", 13, color="#1d3c8c")
    s += arrow(260, 36, 260, 58, "#1d3c8c") + text(277, 52, "e⁻", 13, color="#1d3c8c")
    if show_ions:
        s += ion(165, 150, "−", "#c8e6c9") + arrow(152, 150, 134, 150)
        s += ion(195, 185, "+", "#ffe0b2") + arrow(208, 185, 226, 185)
    s += text(118, 248, anode_lbl, 13) + text(242, 248, cathode_lbl, 13)
    if sub_a:
        s += text(118, 264, sub_a, 12, color="#555")
    if sub_c:
        s += text(242, 264, sub_c, 12, color="#555")
    return svg(360, 272, s, width_mm=width_mm)


def fig_gas_cell():
    """Dilute sulfuric acid: gas collected over each electrode, H2 : O2 = 2 : 1."""
    s = f'<rect x="52" y="62" width="256" height="136" fill="{LIQ}"/>'
    s += (f'<path d="M50,40 L50,190 Q50,200 60,200 L300,200 Q310,200 310,190 L310,40" '
          f'fill="none" stroke="{INK}" stroke-width="2"/>')
    # inverted test tubes (open end at the bottom): liquid inside, gas trapped at the top
    for x, gas_h in ((100, 28), (220, 56)):
        tube = (f"M{x},150 L{x},40 Q{x},20 {x+20},20 Q{x+40},20 {x+40},40 L{x+40},150")
        s += f'<path d="{tube} Z" fill="{LIQ}"/>'
        s += f'<clipPath id="tc{x}"><path d="{tube} Z"/></clipPath>'
        s += (f'<rect x="{x}" y="18" width="40" height="{gas_h + 4}" fill="#fff" '
              f'clip-path="url(#tc{x})"/>')
        s += f'<path d="{tube}" fill="none" stroke="{INK}" stroke-width="1.8"/>'
        s += (f'<path d="M{x+1},{22 + gas_h} L{x+39},{22 + gas_h}" stroke="#7aa6c8" '
              f'stroke-width="1.2"/>')
        for k in range(3):
            s += (f'<circle cx="{x + 14 + k*6}" cy="{104 - k*10}" r="2.6" fill="#fff" '
                  f'stroke="#7aa6c8"/>')
    # electrodes coming up through the base
    s += f'<rect x="114" y="110" width="12" height="100" fill="#666" stroke="{INK}"/>'
    s += f'<rect x="234" y="110" width="12" height="100" fill="#666" stroke="{INK}"/>'
    s += f'<path d="M120,210 L120,232" stroke="{INK}" stroke-width="1.8"/>'
    s += f'<path d="M240,210 L240,232" stroke="{INK}" stroke-width="1.8"/>'
    s += battery(180, 232, 120, 240)
    s += text(120, 13, "oxygen", 13) + text(240, 13, "hydrogen", 13)
    s += text(30, 120, "anode (+)", 12, anchor="middle", extra='transform="rotate(-90 30 120)"')
    s += text(330, 120, "cathode (−)", 12, anchor="middle", extra='transform="rotate(90 330 120)"')
    s += text(180, 186, "dilute sulfuric acid", 12, color="#555")
    return svg(360, 256, s, width_mm=74)


# ---------------- content ----------------

STYLE = """<style>
.eq { font-size: 10.6pt; white-space: nowrap; }
.big td { padding: 3px 6px; }
</style>"""

BODY = STYLE + f"""
<h1>Topic 4 &nbsp;Electrochemistry</h1>
<div class="meta">Cambridge IGCSE Chemistry 0620 &middot; Extended &middot; Sections 1&ndash;2 match
the SaveMyExams sub-topics, so you can do their questions after each one</div>

<h2><span class="num">1</span>Electrolysis</h2>
<h3>Electrolysis principles</h3>
<div class="box def"><span class="lbl">Definitions</span>
<b>Electrolysis</b> &ndash; <span class="hl">the decomposition of an ionic compound, when molten or in
aqueous solution, by the passage of an electric current.</span><br>
<b>Anode</b> &ndash; the <b>positive</b> electrode. &nbsp; <b>Cathode</b> &ndash; the <b>negative</b>
electrode.<br>
<b>Electrolyte</b> &ndash; the molten or aqueous substance that undergoes electrolysis.</div>

<div class="row">
<div>
<ul>
<li>The compound must be <b>molten or dissolved</b> so its <b>ions are free to move</b>. A solid ionic
compound doesn&rsquo;t conduct &mdash; its ions are fixed in the lattice.</li>
<li><b>Inert electrodes</b> (graphite/carbon or platinum) carry the current but don&rsquo;t react.</li>
<li><span class="hl">Metals or hydrogen</span> form at the <b>cathode</b>; <span class="hl">non-metals
(other than hydrogen)</span> form at the <b>anode</b>.</li>
<li>Memory aid: <b>PANIC</b> &ndash; <b>P</b>ositive is <b>A</b>node, <b>N</b>egative <b>I</b>s
<b>C</b>athode.</li>
</ul>
</div>
<figure style="flex:0 0 78mm">{fig_cell(sub_a="inert electrode", sub_c="inert electrode")}
<figcaption>Negative ions move to the anode, positive ions to the cathode. Electrons flow round the
wires.</figcaption></figure>
</div>

<div class="box exam"><span class="lbl">&ldquo;Describe the transfer of charge during electrolysis&rdquo;</span>
<b>1.</b> <b>Electrons</b> move through the external circuit (wires) from the anode to the cathode.<br>
<b>2.</b> <b>Ions</b> move through the electrolyte: positive ions to the cathode, negative ions to the
anode.<br>
<b>3.</b> At the <b>cathode</b>, positive ions <b>gain</b> electrons (reduction). At the
<b>anode</b>, negative ions <b>lose</b> electrons (oxidation).</div>
<p class="small">Oxidation is loss of electrons, reduction is gain (<b>OIL RIG</b>). Anode = oxidation,
cathode = reduction (&ldquo;<b>An Ox</b>, <b>Red Cat</b>&rdquo;).</p>

<h3>Electrolysis of molten compounds</h3>
<p><b>Lead(II) bromide, PbBr<sub>2</sub></b>, with inert electrodes. Heat the solid until it melts &mdash;
only then does the bulb light, because the ions can now move. Do it in a fume cupboard: bromine is
toxic.</p>
<table class="k">
<tr><th style="width:14%">Electrode</th><th style="width:16%">Product</th><th>Half-equation</th><th>What you see</th></tr>
<tr><td>Cathode (&minus;)</td><td>lead</td><td class="eq">Pb<sup>2+</sup> + 2e<sup>&minus;</sup> &rarr; Pb</td>
<td>silvery-grey molten metal forms at the cathode / collects at the bottom</td></tr>
<tr><td>Anode (+)</td><td>bromine</td><td class="eq">2Br<sup>&minus;</sup> &rarr; Br<sub>2</sub> + 2e<sup>&minus;</sup></td>
<td>red-brown vapour (fumes) at the anode</td></tr>
</table>
<p><b>Any molten binary compound</b> (two elements): <span class="hl">metal at the cathode, non-metal at
the anode.</span></p>
<table class="c">
<tr><th>Molten compound</th><th>NaCl</th><th>KI</th><th>ZnCl<sub>2</sub></th><th>Al<sub>2</sub>O<sub>3</sub> (Topic 9)</th></tr>
<tr><td class="k">Cathode</td><td>sodium</td><td>potassium</td><td>zinc</td><td>aluminium</td></tr>
<tr><td class="k">Anode</td><td>chlorine</td><td>iodine</td><td>chlorine</td><td>oxygen</td></tr>
</table>

<h3>Electrolysis of aqueous sodium chloride &amp; dilute sulfuric acid</h3>
<p>In a solution, water also provides some <b>H<sup>+</sup></b> and <b>OH<sup>&minus;</sup></b> ions. So
two kinds of positive ion compete at the cathode, and two kinds of negative ion at the anode.</p>

<div class="keep">
<p><b>Concentrated aqueous sodium chloride (brine)</b> &mdash; ions present: Na<sup>+</sup>,
H<sup>+</sup>, Cl<sup>&minus;</sup>, OH<sup>&minus;</sup></p>
<table class="k">
<tr><th style="width:14%">Electrode</th><th style="width:16%">Product</th><th>Half-equation</th><th>What you see</th></tr>
<tr><td>Cathode (&minus;)</td><td>hydrogen</td><td class="eq">2H<sup>+</sup> + 2e<sup>&minus;</sup> &rarr; H<sub>2</sub></td>
<td>bubbles of colourless gas (sodium is more reactive than hydrogen, so it stays as Na<sup>+</sup>)</td></tr>
<tr><td>Anode (+)</td><td>chlorine</td><td class="eq">2Cl<sup>&minus;</sup> &rarr; Cl<sub>2</sub> + 2e<sup>&minus;</sup></td>
<td>bubbles of pale yellow-green gas</td></tr>
<tr><td>Left in solution</td><td colspan="3">Na<sup>+</sup> and OH<sup>&minus;</sup> &rarr; <b>sodium
hydroxide</b> solution (it becomes alkaline)</td></tr>
</table>
</div>

<div class="row">
<div>
<p><b>Dilute sulfuric acid</b> &mdash; ions present: H<sup>+</sup>, SO<sub>4</sub><sup>2&minus;</sup>,
OH<sup>&minus;</sup></p>
<table class="k">
<tr><th>Electrode</th><th>Product</th><th>Half-equation</th></tr>
<tr><td>Cathode (&minus;)</td><td>hydrogen</td><td class="eq">2H<sup>+</sup> + 2e<sup>&minus;</sup> &rarr; H<sub>2</sub></td></tr>
<tr><td>Anode (+)</td><td>oxygen</td><td class="eq">4OH<sup>&minus;</sup> &rarr; O<sub>2</sub> + 2H<sub>2</sub>O + 4e<sup>&minus;</sup></td></tr>
</table>
<ul>
<li>Bubbles of colourless gas at both electrodes.</li>
<li><span class="hl">Twice as much hydrogen as oxygen</span> by volume: the 4 electrons that make
1 O<sub>2</sub> also make 2 H<sub>2</sub>.</li>
<li>Overall, <b>water</b> is broken down (2H<sub>2</sub>O &rarr; 2H<sub>2</sub> + O<sub>2</sub>), so the
acid gets more concentrated.</li>
</ul>
</div>
<figure style="flex:0 0 74mm">{fig_gas_cell()}<figcaption>Hydrogen : oxygen = 2 : 1 by volume</figcaption></figure>
</div>

<h3>Electrolysis of aqueous solutions</h3>
<div class="box def"><span class="lbl">Rules for predicting the products</span>
<b>Cathode:</b> the <b>metal</b> forms if it is <b>less reactive than hydrogen</b> (copper, silver, gold).
Otherwise <b>hydrogen</b> forms.<br>
<b>Anode:</b> a <b>halogen</b> forms from a <b>concentrated</b> halide (Cl<sup>&minus;</sup>,
Br<sup>&minus;</sup>, I<sup>&minus;</sup>). <b>Oxygen</b> forms from a <b>dilute</b> halide, or when there
is no halide (e.g. sulfate, nitrate).</div>
<p class="small">Reactivity: potassium &gt; sodium &gt; calcium &gt; magnesium &gt; aluminium &gt; zinc &gt;
iron &gt; <b class="red">hydrogen</b> &gt; copper &gt; silver &gt; gold</p>

<table class="k big">
<tr><th>Electrolyte (inert electrodes)</th><th>Cathode</th><th>Anode</th><th>Left in solution</th></tr>
<tr><td>Concentrated NaCl(aq)</td><td>hydrogen</td><td>chlorine</td><td>sodium hydroxide</td></tr>
<tr><td>Dilute NaCl(aq)</td><td>hydrogen</td><td>oxygen</td><td>&mdash;</td></tr>
<tr><td>Concentrated KBr(aq)</td><td>hydrogen</td><td>bromine</td><td>potassium hydroxide</td></tr>
<tr><td>Concentrated CuCl<sub>2</sub>(aq)</td><td>copper</td><td>chlorine</td><td>&mdash;</td></tr>
<tr><td>Dilute H<sub>2</sub>SO<sub>4</sub>(aq)</td><td>hydrogen</td><td>oxygen</td><td>sulfuric acid (more concentrated)</td></tr>
<tr><td>CuSO<sub>4</sub>(aq)</td><td>copper</td><td>oxygen</td><td>sulfuric acid</td></tr>
<tr><td>AgNO<sub>3</sub>(aq)</td><td>silver</td><td>oxygen</td><td>nitric acid</td></tr>
</table>

<div class="keep">
<p><b>Aqueous copper(II) sulfate &mdash; inert vs copper electrodes</b></p>
<table class="k">
<tr><th style="width:16%"></th><th>Carbon (graphite) electrodes</th><th>Copper electrodes</th></tr>
<tr><td>Cathode (&minus;)</td><td>pink-brown copper coats the electrode<br>
<span class="eq">Cu<sup>2+</sup> + 2e<sup>&minus;</sup> &rarr; Cu</span></td>
<td>pink-brown copper coats it; the cathode <b>gains mass</b><br>
<span class="eq">Cu<sup>2+</sup> + 2e<sup>&minus;</sup> &rarr; Cu</span></td></tr>
<tr><td>Anode (+)</td><td>bubbles of oxygen<br>
<span class="eq">4OH<sup>&minus;</sup> &rarr; O<sub>2</sub> + 2H<sub>2</sub>O + 4e<sup>&minus;</sup></span></td>
<td>no gas; the copper anode <b>dissolves</b> and <b>loses mass</b><br>
<span class="eq">Cu &rarr; Cu<sup>2+</sup> + 2e<sup>&minus;</sup></span></td></tr>
<tr><td>Solution</td><td>blue colour <b>fades</b> (Cu<sup>2+</sup> used up); becomes acidic</td>
<td>blue colour <b>stays the same</b> (Cu<sup>2+</sup> removed at the cathode = Cu<sup>2+</sup> made at
the anode)</td></tr>
</table>
<p class="small">The copper-electrode set-up is the idea behind purifying copper: impure copper as the
anode, pure copper as the cathode.</p>
</div>

<table class="k">
<tr><th style="width:20%">Gas</th><th>Test</th></tr>
<tr><td>Hydrogen</td><td>&lsquo;pops&rsquo; with a lighted splint</td></tr>
<tr><td>Oxygen</td><td>relights a glowing splint</td></tr>
<tr><td>Chlorine</td><td>bleaches damp litmus paper</td></tr>
</table>

<h3>Ionic half-equations</h3>
<div class="box exam"><span class="lbl">How to write one</span>
<b>1.</b> Write the ion on the left and the product on the right (halogens, hydrogen and oxygen are
<b>diatomic</b>: Cl<sub>2</sub>, H<sub>2</sub>, O<sub>2</sub>).<br>
<b>2.</b> Balance the atoms.<br>
<b>3.</b> Add electrons so the <b>charges balance</b>: on the <b>left</b> at the cathode (gained,
reduction), on the <b>right</b> at the anode (lost, oxidation).</div>
<div class="row">
<table>
<tr><th>Cathode &mdash; reduction</th></tr>
<tr><td class="eq">Na<sup>+</sup> + e<sup>&minus;</sup> &rarr; Na</td></tr>
<tr><td class="eq">Ag<sup>+</sup> + e<sup>&minus;</sup> &rarr; Ag</td></tr>
<tr><td class="eq">Cu<sup>2+</sup> + 2e<sup>&minus;</sup> &rarr; Cu</td></tr>
<tr><td class="eq">Pb<sup>2+</sup> + 2e<sup>&minus;</sup> &rarr; Pb</td></tr>
<tr><td class="eq">Al<sup>3+</sup> + 3e<sup>&minus;</sup> &rarr; Al</td></tr>
<tr><td class="eq">2H<sup>+</sup> + 2e<sup>&minus;</sup> &rarr; H<sub>2</sub></td></tr>
</table>
<table>
<tr><th>Anode &mdash; oxidation</th></tr>
<tr><td class="eq">2Cl<sup>&minus;</sup> &rarr; Cl<sub>2</sub> + 2e<sup>&minus;</sup></td></tr>
<tr><td class="eq">2Br<sup>&minus;</sup> &rarr; Br<sub>2</sub> + 2e<sup>&minus;</sup></td></tr>
<tr><td class="eq">2I<sup>&minus;</sup> &rarr; I<sub>2</sub> + 2e<sup>&minus;</sup></td></tr>
<tr><td class="eq">4OH<sup>&minus;</sup> &rarr; O<sub>2</sub> + 2H<sub>2</sub>O + 4e<sup>&minus;</sup></td></tr>
<tr><td class="eq">2O<sup>2&minus;</sup> &rarr; O<sub>2</sub> + 4e<sup>&minus;</sup> &nbsp;<span class="small">(molten oxide)</span></td></tr>
<tr><td class="eq">Cu &rarr; Cu<sup>2+</sup> + 2e<sup>&minus;</sup> &nbsp;<span class="small">(copper anode)</span></td></tr>
</table>
</div>
<div class="box warn"><span class="lbl">Watch out</span>
Write Cl<sub>2</sub>, not Cl, at the anode &middot; check the charges: 2Cl<sup>&minus;</sup> has a total
charge of &minus;2, so 2e<sup>&minus;</sup> must appear on the other side &middot; electrons go on the
<b>left</b> for the cathode and the <b>right</b> for the anode &middot; in solution, sodium, potassium
etc. are <b>never</b> formed at the cathode &mdash; it&rsquo;s hydrogen.</div>

<h2><span class="num">2</span>Applications of Electrolysis</h2>
<h3>Electroplating</h3>
<div class="row">
<div>
<p>Metal objects are electroplated to <span class="hl">improve their appearance and their resistance
to corrosion</span>. Examples: chromium-plated steel taps and car parts, silver-plated cutlery,
gold-plated jewellery, tin-plated steel cans.</p>
<div class="box exam"><span class="lbl">How to electroplate (3 marks)</span>
<b>1.</b> Make the <b>object the cathode</b> (&minus;).<br>
<b>2.</b> Make the <b>plating metal the anode</b> (+).<br>
<b>3.</b> The <b>electrolyte</b> is a solution containing <b>ions of the plating metal</b>
(e.g. silver nitrate for silver).</div>
<p>Silver plating: <span class="eq">Ag<sup>+</sup> + e<sup>&minus;</sup> &rarr; Ag</span> at the
cathode (silver coats the spoon); <span class="eq">Ag &rarr; Ag<sup>+</sup> + e<sup>&minus;</sup></span>
at the anode (it dissolves), so the concentration of Ag<sup>+</sup> stays the same.</p>
</div>
<figure style="flex:0 0 72mm">{fig_cell("silver anode (+)", "spoon = cathode (−)", "plating metal",
"object to be plated", anode_fill="#c9c9c9", cathode_fill="#8d6e63", width_mm=72, show_ions=False,
plated=True)}
<figcaption>Electrolyte: silver nitrate solution (contains Ag<sup>+</sup> ions)</figcaption></figure>
</div>

<h3>Hydrogen&ndash;oxygen fuel cells</h3>
<p>A hydrogen&ndash;oxygen fuel cell <span class="hl">uses hydrogen and oxygen to produce electricity,
with water as the only chemical product</span>: &nbsp; 2H<sub>2</sub> + O<sub>2</sub> &rarr;
2H<sub>2</sub>O</p>
<table>
<tr><th style="width:50%">Advantages vs petrol (gasoline) engines</th><th>Disadvantages</th></tr>
<tr><td>
<ul>
<li>Only product is <b>water</b> &mdash; no carbon dioxide (greenhouse gas), no toxic carbon monoxide and
no oxides of nitrogen from the vehicle</li>
<li>More efficient at producing useful energy</li>
<li>Hydrogen can be made by electrolysis of water (using renewable electricity)</li>
</ul></td>
<td>
<ul>
<li>Hydrogen is a gas: hard to <b>store</b> (needs high pressure or large tanks)</li>
<li>Hydrogen is <b>flammable / explosive</b></li>
<li>Few hydrogen filling stations</li>
<li>Most hydrogen is made from fossil fuels, or with electricity from fossil fuels, so CO<sub>2</sub> is
still produced somewhere</li>
<li>Fuel cells are expensive</li>
</ul></td></tr>
</table>

<div class="keep">
<h3>Self-check before the topic questions</h3>
<ul class="check">
<li>Define electrolysis, anode, cathode and electrolyte</li>
<li>Explain why an ionic compound must be molten or in solution</li>
<li>Describe the transfer of charge: electrons in the wires, ions in the electrolyte, gain/loss at the electrodes</li>
<li>Give the products and observations for molten PbBr<sub>2</sub>, concentrated NaCl(aq) and dilute H<sub>2</sub>SO<sub>4</sub></li>
<li>Predict the products for any molten binary compound and any halide solution (dilute or concentrated)</li>
<li>Compare CuSO<sub>4</sub>(aq) electrolysis with carbon electrodes and with copper electrodes</li>
<li>Write half-equations at both electrodes and say which is oxidation and which is reduction</li>
<li>Describe how to electroplate an object, and why it is done</li>
<li>State what a hydrogen&ndash;oxygen fuel cell produces and compare it with a petrol engine</li>
</ul>
</div>
"""

if __name__ == "__main__":
    preview = sys.argv[1] if len(sys.argv) > 1 else None
    render(TITLE, BODY, "/tmp/chem_parts/topic04.pdf", preview_dir=preview)
