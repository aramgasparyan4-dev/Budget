"""Chemistry Topic 5 - Chemical Energetics (Cambridge IGCSE 0620, Extended)."""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from notes import render, svg, text, INK  # noqa: E402

TITLE = "Chemistry 0620 - Topic 5: Chemical Energetics"


# ---------------- diagrams ----------------

def arrow(x1, y1, x2, y2, color=INK, width=1.6):
    return (f'<path d="M{x1},{y1} L{x2},{y2}" stroke="{color}" stroke-width="{width}" '
            f'fill="none" marker-end="url(#ah)"/>')


def dashed(x1, y1, x2, y2):
    return (f'<path d="M{x1},{y1} L{x2},{y2}" stroke="#888" stroke-width="1.2" '
            f'stroke-dasharray="4,3"/>')


def fig_pathway(exo=True):
    """Reaction pathway diagram with Ea and ΔH arrows."""
    r_y, p_y, peak_y = (112, 160, 42) if exo else (160, 108, 42)
    s = arrow(46, 192, 46, 14) + arrow(46, 192, 318, 192)
    s += text(22, 105, "energy", 13, extra='transform="rotate(-90 22 105)"')
    s += text(182, 212, "progress of reaction", 13)
    curve = (f"M62,{r_y} L105,{r_y} C135,{r_y} 140,{peak_y} 165,{peak_y} "
             f"C190,{peak_y} 195,{p_y} 225,{p_y} L282,{p_y}")
    s += f'<path d="{curve}" fill="none" stroke="#1d3c8c" stroke-width="2.4"/>'
    s += text(84, r_y + 16, "reactants", 12) + text(254, p_y - 7, "products", 12)
    # activation energy
    s += dashed(165, peak_y, 82, peak_y)
    s += arrow(92, r_y - 2, 92, peak_y + 3, "#c62828")
    s += text(76, (r_y + peak_y) / 2 + 5, 'E<tspan font-size="10" dy="3">a</tspan>', 14,
              color="#c62828")
    # enthalpy change
    s += dashed(105, r_y, 300, r_y)
    s += arrow(292, r_y + (2 if exo else -2), 292, p_y + (-3 if exo else 3), "#2e7d32")
    lab = "ΔH negative" if exo else "ΔH positive"
    s += text(298, (r_y + p_y) / 2 + 5, lab, 12, anchor="start", color="#2e7d32")
    return svg(380, 220, s, width_mm=72)


# ---------------- content ----------------

STYLE = """<style>
.calc td { padding: 2px 6px; }
.calc td:last-child { text-align: right; white-space: nowrap; }
</style>"""

BODY = STYLE + f"""
<h1>Topic 5 &nbsp;Chemical Energetics</h1>
<div class="meta">Cambridge IGCSE Chemistry 0620 &middot; Extended &middot; Section 1 matches the
SaveMyExams sub-topic, so you can do their questions after it</div>

<h2><span class="num">1</span>Exothermic &amp; Endothermic Reactions</h2>
<h3>Endothermic &amp; exothermic reactions</h3>
<div class="box def"><span class="lbl">Definitions</span>
<b>Exothermic</b> reaction &ndash; <span class="hl">transfers thermal energy to the surroundings, leading
to an increase in the temperature of the surroundings.</span><br>
<b>Endothermic</b> reaction &ndash; <span class="hl">takes in thermal energy from the surroundings,
leading to a decrease in the temperature of the surroundings.</span></div>

<table class="k">
<tr><th style="width:20%"></th><th>Exothermic</th><th>Endothermic</th></tr>
<tr><td>Energy</td><td>given <b>out</b> to the surroundings</td><td>taken <b>in</b> from the surroundings</td></tr>
<tr><td>Temperature of surroundings</td><td><b>rises</b> &mdash; feels warm</td><td><b>falls</b> &mdash; feels cold</td></tr>
<tr><td>Products vs reactants</td><td>products have <b>less</b> energy</td><td>products have <b>more</b> energy</td></tr>
<tr><td>&Delta;H</td><td><b>negative</b></td><td><b>positive</b></td></tr>
<tr><td>Examples</td><td>combustion of fuels, respiration, neutralisation, displacement reactions</td>
<td>thermal decomposition (e.g. CaCO<sub>3</sub> &rarr; CaO + CO<sub>2</sub>), photosynthesis,
dissolving ammonium nitrate in water</td></tr>
<tr><td>Everyday uses</td><td>hand warmers, self-heating cans</td><td>instant cold packs for sports
injuries</td></tr>
</table>
<p><b>In an experiment</b>, the &ldquo;surroundings&rdquo; are the water/solution and the thermometer. Measure
the temperature before and after: <span class="green">a rise means exothermic</span>, a fall means
endothermic.</p>
<div class="box warn"><span class="lbl">Watch out</span>
An endothermic reaction gets <b>colder</b> because it is taking energy <b>in</b> from its surroundings
&mdash; not because it is &ldquo;giving out cold&rdquo;.</div>

<h3>Enthalpy change &amp; activation energy</h3>
<div class="box def"><span class="lbl">Definitions</span>
<b>Enthalpy change, &Delta;H</b> &ndash; <span class="hl">the transfer of thermal energy during a
reaction.</span> &Delta;H is <b>negative</b> for exothermic reactions and <b>positive</b> for endothermic
reactions. Units: kJ/mol.<br>
<b>Activation energy, E<sub>a</sub></b> &ndash; <span class="hl">the minimum energy that colliding
particles must have to react.</span></div>

<div class="row">
<figure>{fig_pathway(True)}<figcaption>Exothermic: products <b>below</b> reactants</figcaption></figure>
<figure>{fig_pathway(False)}<figcaption>Endothermic: products <b>above</b> reactants</figcaption></figure>
</div>

<div class="box exam"><span class="lbl">Drawing a reaction pathway diagram</span>
Axes: <b>energy</b> (up), <b>progress of reaction</b> (across) &middot; reactants and products as labelled
horizontal lines (exothermic: products lower; endothermic: products higher), joined by a curve rising to a
peak &middot; <b>E<sub>a</sub></b>: arrow from the <b>reactants</b> level <b>up</b> to the peak &middot;
<b>&Delta;H</b>: arrow from the <b>reactants</b> level to the <b>products</b> level &mdash; <b>down</b> for
exothermic, <b>up</b> for endothermic.</div>
<div class="box warn"><span class="lbl">Watch out</span>
Both arrows start at the <b>reactants</b> &middot; the E<sub>a</sub> arrow goes to the <b>peak</b>, not
from the products &middot; an endothermic reaction still has a hump above the products &middot;
&ldquo;activation energy&rdquo; is a minimum energy for <b>colliding particles</b> &mdash; use those
words.</div>

<h3>Bond breaking &amp; bond forming</h3>
<div class="row">
<div class="box def"><span class="lbl">Key facts</span>
<b>Breaking</b> bonds is <span class="hl">endothermic</span> &mdash; energy is taken in.<br>
<b>Making</b> bonds is <span class="hl">exothermic</span> &mdash; energy is released.</div>
<div class="box exam"><span class="lbl">Explaining &Delta;H</span>
<b>Exothermic:</b> more energy is released making the new bonds than is taken in breaking the old
bonds.<br>
<b>Endothermic:</b> more energy is taken in breaking bonds than is released making bonds.</div>
</div>

<p><span class="hl">&Delta;H = energy taken in to break bonds &minus; energy released making bonds</span>
&nbsp; (&ldquo;broken minus made&rdquo;). Bond energies are always given in the question.</p>

<div class="box exam"><span class="lbl">Method</span>
<b>1.</b> Write the balanced equation with <b>displayed formulae</b> so you can see every bond.<br>
<b>2.</b> Count each type of bond, <b>multiplied by the number of molecules</b>.<br>
<b>3.</b> Add up the energy for all bonds <b>broken</b> (reactants) and all bonds <b>made</b>
(products).<br>
<b>4.</b> &Delta;H = broken &minus; made. Give the sign (+ or &minus;) and units (kJ/mol).</div>

<div class="row">
<div class="keep">
<p><b>Worked example 1:</b> H<sub>2</sub> + Cl<sub>2</sub> &rarr; 2HCl<br>
<span class="small">H&ndash;H = 436, Cl&ndash;Cl = 242, H&ndash;Cl = 431 kJ/mol</span></p>
<table class="calc">
<tr><td>Broken</td><td>1 &times; H&ndash;H + 1 &times; Cl&ndash;Cl = 436 + 242</td><td>678</td></tr>
<tr><td>Made</td><td>2 &times; H&ndash;Cl = 2 &times; 431</td><td>862</td></tr>
<tr><td><b>&Delta;H</b></td><td>678 &minus; 862</td><td><b>&minus;184 kJ/mol</b></td></tr>
</table>
<p class="small">Negative, so exothermic.</p>
</div>
<div class="keep">
<p><b>Worked example 2:</b> CH<sub>4</sub> + 2O<sub>2</sub> &rarr; CO<sub>2</sub> + 2H<sub>2</sub>O<br>
<span class="small">C&ndash;H = 413, O=O = 498, C=O = 805, O&ndash;H = 464 kJ/mol</span></p>
<table class="calc">
<tr><td>Broken</td><td>4 &times; C&ndash;H + 2 &times; O=O = 1652 + 996</td><td>2648</td></tr>
<tr><td>Made</td><td>2 &times; C=O + 4 &times; O&ndash;H = 1610 + 1856</td><td>3466</td></tr>
<tr><td><b>&Delta;H</b></td><td>2648 &minus; 3466</td><td><b>&minus;818 kJ/mol</b></td></tr>
</table>
<p class="small">CO<sub>2</sub> is O=C=O (2 double bonds); each H<sub>2</sub>O has 2 O&ndash;H, so
2H<sub>2</sub>O has 4.</p>
</div>
</div>

<div class="row">
<div class="box def keep"><span class="lbl">Try it</span>
N<sub>2</sub> + 3H<sub>2</sub> &rarr; 2NH<sub>3</sub><br>
N&equiv;N = 945, H&ndash;H = 436, N&ndash;H = 391 kJ/mol<br>
<span class="small">Answer: broken 945 + 3 &times; 436 = 2253; made 6 &times; 391 = 2346;
&Delta;H = <b>&minus;93 kJ/mol</b></span></div>
<div class="box def keep"><span class="lbl">Try it (endothermic)</span>
2HBr &rarr; H<sub>2</sub> + Br<sub>2</sub><br>
H&ndash;Br = 366, H&ndash;H = 436, Br&ndash;Br = 193 kJ/mol<br>
<span class="small">Answer: broken 2 &times; 366 = 732; made 436 + 193 = 629;
&Delta;H = <b>+103 kJ/mol</b></span></div>
</div>

<div class="box warn"><span class="lbl">Watch out</span>
&ldquo;Breaking bonds releases energy&rdquo; is <b>wrong</b> &middot; do <b>broken &minus; made</b>, not
the other way round &middot; multiply by the coefficients in the equation &middot; C=O and C&ndash;O have
different bond energies &mdash; check which one is in the molecule &middot; always give the sign and
kJ/mol.</div>

<div class="keep">
<h3>Self-check before the topic questions</h3>
<ul class="check" style="columns:2; column-gap:16px; font-size:9.8pt">
<li>Define exothermic and endothermic reactions, including what happens to the temperature of the surroundings</li>
<li>Give examples of exothermic and endothermic reactions</li>
<li>State what &Delta;H is and its sign for exothermic and endothermic reactions</li>
<li>Define activation energy</li>
<li>Draw and label reaction pathway diagrams with reactants, products, &Delta;H and E<sub>a</sub></li>
<li>Read a pathway diagram and say whether the reaction is exothermic or endothermic</li>
<li>Explain &Delta;H in terms of bond breaking (endothermic) and bond making (exothermic)</li>
<li>Calculate &Delta;H from bond energies</li>
</ul>
</div>
"""

if __name__ == "__main__":
    preview = sys.argv[1] if len(sys.argv) > 1 else None
    render(TITLE, BODY, "/tmp/chem_parts/topic05.pdf", preview_dir=preview)
