"""Chemistry Topic 10 - Chemistry of the Environment (Cambridge IGCSE 0620, Extended)."""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from notes import render, svg, text  # noqa: E402

TITLE = "Chemistry 0620 - Topic 10: Chemistry of the Environment"


def f(s):
    """Subscript the numbers inside chemical formulae (not leading coefficients)."""
    return re.sub(r"(?<=[A-Za-z\)])(\d+)", r"<sub>\1</sub>", s)


def eq(s):
    return f'<span class="eq">{f(s)}</span>'


# ---------------- diagrams ----------------

def fig_greenhouse():
    s = ""
    for mid, col in (("m_or", "#f9a825"), ("m_red", "#c62828")):
        s += (f'<defs><marker id="{mid}" markerUnits="userSpaceOnUse" markerWidth="12" '
              f'markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0,0 L11,6 L0,12" '
              f'fill="none" stroke="{col}" stroke-width="2"/></marker></defs>')
    s += '<rect x="0" y="62" width="400" height="34" fill="#e3f2fd"/>'
    for x, y in ((20, 74), (100, 86), (140, 70), (240, 84), (285, 72), (330, 86), (385, 72)):
        s += f'<circle cx="{x}" cy="{y}" r="3" fill="#90a4ae"/>'
    s += text(345, 55, "greenhouse gases (CO₂, CH₄)", 12, anchor="end", color="#1d3c8c")
    s += '<rect x="0" y="170" width="400" height="24" fill="#c5e1a5"/>'
    s += text(200, 187, "Earth’s surface absorbs energy and warms up", 12)
    s += '<circle cx="34" cy="24" r="16" fill="#ffd54f" stroke="#f9a825" stroke-width="1.5"/>'
    s += text(34, 54, "Sun", 12)
    s += '<path d="M52,34 L116,164" stroke="#f9a825" stroke-width="3" marker-end="url(#m_or)"/>'
    s += text(70, 120, "1", 14, color="#f57f17", extra='font-weight="700"')
    s += '<path d="M168,168 L188,102" stroke="#c62828" stroke-width="2.6" marker-end="url(#m_red)"/>'
    s += text(162, 140, "2", 14, color="#c62828", extra='font-weight="700"')
    s += ('<path d="M206,100 L232,164" stroke="#c62828" stroke-width="2.2" stroke-dasharray="5,3" '
          'marker-end="url(#m_red)"/>')
    s += text(236, 134, "3", 14, color="#c62828", extra='font-weight="700"')
    s += '<path d="M330,168 L372,16" stroke="#c62828" stroke-width="1.4" marker-end="url(#m_red)"/>'
    s += text(360, 18, "4  less escapes to space", 12, anchor="end", color="#c62828")
    return svg(400, 194, s, width_mm=82)


def flow(steps):
    cells = []
    for i, (name, what) in enumerate(steps):
        cells.append(f'<div class="fstep"><b>{name}</b><br><span class="small">{what}</span></div>')
        if i < len(steps) - 1:
            cells.append('<div class="farrow">&rarr;</div>')
    return f'<div class="flow">{"".join(cells)}</div>'


# ---------------- content ----------------

STYLE = """<style>
.eq { white-space: nowrap; }
.flow { display: flex; align-items: stretch; gap: 4px; margin: 6px 0 8px; break-inside: avoid; }
.fstep { flex: 1; border: 1.5px solid #1d3c8c; border-radius: 6px; padding: 4px 7px;
         background: #eef2fa; font-size: 10pt; line-height: 1.25; }
.farrow { align-self: center; color: #1d3c8c; font-size: 15pt; }
.air { display: flex; height: 22px; border-radius: 4px; overflow: hidden; margin: 4px 0 2px;
       font-size: 9.5pt; color: #fff; font-weight: 700; break-inside: avoid; }
.air div { display: flex; align-items: center; padding-left: 6px; white-space: nowrap; }
table.br { break-inside: auto; }
table.br tr { break-inside: avoid; }
ul.check.two { columns: 2; column-gap: 18px; }
ul.check.two li { break-inside: avoid; }
</style>"""

BODY = STYLE + f"""
<h1>Topic 10 &nbsp;Chemistry of the Environment</h1>
<div class="meta">Cambridge IGCSE Chemistry 0620 &middot; Extended &middot; Sections 1&ndash;2 match
the SaveMyExams sub-topics, so you can do their questions after each one</div>

<h2><span class="num">1</span>Water &amp; Water Pollution</h2>

<h3>Water: chemical tests</h3>
<div class="row">
<div>
<table class="k">
<tr><th>Test for water</th><th>Colour change if water is present</th></tr>
<tr><td>Anhydrous copper(II) sulfate</td><td><b>white &rarr; blue</b></td></tr>
<tr><td>Anhydrous cobalt(II) chloride</td><td><b>blue &rarr; pink</b></td></tr>
</table>
<p class="small">The copper(II) sulfate change is reversible:
{eq("CuSO4 + 5H2O ⇌ CuSO4·5H2O")} (anhydrous, white &rArr; hydrated, blue).</p>
</div>
<div>
<p><b>Testing purity:</b> pure water <span class="hl">melts at exactly 0&nbsp;&deg;C and boils at exactly
100&nbsp;&deg;C</span>. Impurities lower the melting point, raise the boiling point, and make it
melt or boil over a <b>range</b> of temperatures.</p>
</div>
</div>
<p><b>Why distilled water is used in practical chemistry:</b> it contains <b>fewer chemical
impurities</b> than tap water, so dissolved substances in tap water can&rsquo;t react with or
interfere with your results.</p>
<div class="box warn"><span class="lbl">Watch out</span>
Copper(II) sulfate and cobalt(II) chloride only show that water is <b>present</b>. They do not show
the water is <b>pure</b> &mdash; for purity, use the melting and boiling points.</div>

<h3>Substances in water from natural sources</h3>
<table class="k">
<tr><th style="width:24%">Substance</th><th style="width:16%">Good or bad?</th><th>Why</th></tr>
<tr><td>Dissolved oxygen</td><td class="green">beneficial</td><td>Needed by aquatic life (e.g. fish) to
respire.</td></tr>
<tr><td>Metal compounds</td><td>both</td><td>Some provide <b>essential minerals</b> for life; some are
<b>toxic</b>.</td></tr>
<tr><td>Plastics</td><td class="red">harmful</td><td>Harm aquatic life.</td></tr>
<tr><td>Sewage</td><td class="red">harmful</td><td>Contains <b>harmful microbes</b> which cause
disease.</td></tr>
<tr><td>Nitrates (from fertilisers)</td><td class="red">harmful</td><td rowspan="2">Lead to
<b>deoxygenation</b> of water and damage to aquatic life.</td></tr>
<tr><td>Phosphates (from fertilisers and detergents)</td><td class="red">harmful</td></tr>
</table>
<div class="box def"><span class="lbl">How nitrates and phosphates remove oxygen</span>
They make algae grow very fast (an algal bloom) &rarr; the algae block light, so plants underneath die
&rarr; bacteria decompose the dead material and <b>use up the dissolved oxygen</b> &rarr; fish and other
aquatic life die.</div>

<h3>Water treatment (domestic water supply)</h3>
{flow([("Sedimentation", "water stands still; large solid particles settle out"),
       ("Filtration", "water passes through sand / gravel; removes smaller solids"),
       ("Carbon", "removes tastes and odours"),
       ("Chlorination", "chlorine kills microbes")])}
<div class="box exam"><span class="lbl">Exam wording &mdash; one job per step</span>
Sedimentation and filtration <b>remove solids</b> &middot; carbon <b>removes tastes and odours</b>
&middot; chlorination <b>kills microbes</b>. Don&rsquo;t say chlorine &ldquo;cleans&rdquo; the water or that
filtration removes bacteria.</div>

<h3>Fertilisers</h3>
<div class="row">
<div>
<ul>
<li><span class="hl">Ammonium salts and nitrates</span> are used as fertilisers.</li>
<li><b>NPK fertilisers</b> provide the elements <b>nitrogen (N), phosphorus (P) and potassium (K)</b>
for improved plant growth.</li>
<li>Ammonium salts are made by reacting ammonia with an acid:<br>
{eq("NH3 + HNO3 → NH4NO3")}<br>{eq("2NH3 + H2SO4 → (NH4)2SO4")}</li>
</ul>
</div>
<div style="flex:0 0 76mm">
<table class="k" style="margin-top:0">
<tr><th>Fertiliser</th><th>Formula</th><th>Supplies</th></tr>
<tr><td>ammonium nitrate</td><td>{f("NH4NO3")}</td><td>N</td></tr>
<tr><td>ammonium sulfate</td><td>{f("(NH4)2SO4")}</td><td>N</td></tr>
<tr><td>ammonium phosphate</td><td>{f("(NH4)3PO4")}</td><td>N and P</td></tr>
<tr><td>potassium nitrate</td><td>{f("KNO3")}</td><td>K and N</td></tr>
</table>
<p class="small">Read the formula to see which of N, P, K it supplies.</p>
</div>
</div>

<h2><span class="num">2</span>Air Quality &amp; Climate</h2>

<h3>Air</h3>
<p>Clean, dry air is approximately <span class="hl">78% nitrogen, 21% oxygen</span>, and the remainder is
a mixture of <b>noble gases</b> (mainly argon) and <b>carbon dioxide</b>.</p>
<div class="air">
<div style="width:78%; background:#1d3c8c">nitrogen, N<sub>2</sub> &nbsp;78%</div>
<div style="width:21%; background:#2e7d32">oxygen, O<sub>2</sub> &nbsp;21%</div>
<div style="width:1%; background:#c77700"></div>
</div>
<p class="small" style="text-align:right">&uarr; about 1%: noble gases + carbon dioxide</p>

<h3>Air pollutants &mdash; source and effect</h3>
<table class="k br">
<tr><th style="width:17%">Pollutant</th><th style="width:38%">Source</th><th>Adverse effect</th></tr>
<tr><td>Carbon dioxide, {f("CO2")}</td><td><b>Complete</b> combustion of carbon-containing fuels</td>
<td>Higher levels &rarr; increased <b>global warming</b>, which leads to <b>climate change</b></td></tr>
<tr><td>Carbon monoxide, CO</td><td><b>Incomplete</b> combustion of carbon-containing fuels</td>
<td><b>Toxic</b> gas</td></tr>
<tr><td>Particulates (soot)</td><td><b>Incomplete</b> combustion of carbon-containing fuels</td>
<td>Increased risk of <b>respiratory problems and cancer</b></td></tr>
<tr><td>Methane, {f("CH4")}</td><td><b>Decomposition of vegetation</b> and <b>waste gases from digestion
in animals</b></td><td>Higher levels &rarr; increased <b>global warming</b> &rarr; climate change</td></tr>
<tr><td>Oxides of nitrogen, NO<sub>x</sub></td><td><b>Car engines</b></td><td><b>Acid rain</b>,
<b>photochemical smog</b> and <b>respiratory problems</b></td></tr>
<tr><td>Sulfur dioxide, {f("SO2")}</td><td>Combustion of <b>fossil fuels which contain sulfur
compounds</b></td><td><b>Acid rain</b></td></tr>
</table>

<div class="row">
<div class="box def"><span class="lbl">How oxides of nitrogen form in car engines</span>
The very high temperature inside the engine makes <b>nitrogen and oxygen from the air</b> react:<br>
{eq("N2 + O2 → 2NO")} &nbsp;then&nbsp; {eq("2NO + O2 → 2NO2")}</div>
<div class="box def"><span class="lbl">Acid rain</span>
SO<sub>2</sub> and NO<sub>2</sub> dissolve in rainwater to form acids, which damage limestone
buildings and harm trees and aquatic life.</div>
</div>

<div class="box warn"><span class="lbl">Watch out &mdash; don&rsquo;t mix them up</span>
<b>CO<sub>2</sub> and CH<sub>4</sub></b> &rarr; global warming / climate change &middot;
<b>SO<sub>2</sub> and NO<sub>x</sub></b> &rarr; acid rain &middot; <b>CO</b> &rarr; toxic &middot;
complete combustion gives CO<sub>2</sub>; <b>incomplete</b> gives CO and particulates.</div>

<h3>Effects of greenhouse gases</h3>
<div class="row">
<div>
<ol>
<li>Thermal energy from the Sun is <b>absorbed</b> by the Earth&rsquo;s surface, which warms up.</li>
<li>The surface <b>emits thermal energy</b> (infrared radiation).</li>
<li>CO<sub>2</sub> and CH<sub>4</sub> <b>absorb</b> it and <b>re-emit</b> it in all directions, some back
to Earth (some is also reflected back).</li>
<li>This <span class="hl">reduces thermal energy loss to space</span> &rarr; <b>global warming</b>
&rarr; <b>climate change</b>.</li>
</ol>
</div>
<figure style="flex:0 0 84mm">{fig_greenhouse()}</figure>
</div>
<div class="box warn"><span class="lbl">Watch out</span>
Say greenhouse gases <b>absorb and re-emit thermal energy</b> and <b>reduce heat loss to space</b>.
&ldquo;They trap the Sun&rsquo;s rays&rdquo; is too vague, and the ozone layer has nothing to do with
it.</div>

<h3>Reducing the effects of environmental issues</h3>
<table class="k br">
<tr><th style="width:15%">Problem</th><th style="width:33%">Strategy</th><th>Why it works</th></tr>
<tr><td rowspan="4">Climate change</td><td>Planting trees</td><td>Trees remove CO<sub>2</sub> from the air by
photosynthesis.</td></tr>
<tr><td>Reduction in livestock farming</td><td>Fewer animals &rarr; less methane from digestion.</td></tr>
<tr><td>Decreasing use of fossil fuels</td><td>Less CO<sub>2</sub> released by combustion.</td></tr>
<tr><td>Increasing use of hydrogen and renewable energy (e.g. wind, solar)</td><td>They release no
CO<sub>2</sub> when used &mdash; hydrogen burns to form only water.</td></tr>
<tr><td rowspan="3">Acid rain</td><td>Catalytic converters in vehicles</td><td>Convert oxides of nitrogen
into nitrogen (see below).</td></tr>
<tr><td>Using low-sulfur fuels</td><td>Less SO<sub>2</sub> is formed when the fuel burns.</td></tr>
<tr><td>Flue gas desulfurisation with calcium oxide</td><td>Calcium oxide (a base) removes SO<sub>2</sub>
from power station waste gases: {eq("CaO + SO2 → CaSO3")}</td></tr>
</table>

<div class="box exam"><span class="lbl">Catalytic converters</span>
Inside the converter, a catalyst (e.g. platinum or rhodium) turns <b>carbon monoxide and nitrogen
monoxide</b> into <b>carbon dioxide and nitrogen</b>:
&nbsp; <span style="font-size:11.5pt">{eq("2CO + 2NO → 2CO2 + N2")}</span><br>
So toxic CO and acid-rain-causing NO are removed together. (The N<sub>2</sub> goes back into the air,
where it came from.)</div>

<h3>Photosynthesis</h3>
<div class="box def"><span class="lbl">Definition</span>
<b>Photosynthesis</b> &ndash; <span class="hl">the reaction between carbon dioxide and water to produce
glucose and oxygen, in the presence of chlorophyll and using energy from light.</span></div>
<table class="k" style="width:auto">
<tr><td>Word equation</td><td>carbon dioxide + water &rarr; glucose + oxygen</td></tr>
<tr><td>Symbol equation</td><td>{eq("6CO2 + 6H2O → C6H12O6 + 6O2")}</td></tr>
</table>
<p class="small">Link: photosynthesis removes CO<sub>2</sub> from the air &mdash; that is why planting
trees helps against climate change.</p>

<div class="keep">
<h3>Self-check before the topic questions</h3>
<ul class="check">
<li>Describe the tests for water (copper(II) sulfate, cobalt(II) chloride) and how to test its purity</li>
<li>Explain why distilled water is used in practical chemistry</li>
<li>List substances found in natural water and say which are beneficial and which are harmful</li>
<li>Explain how nitrates and phosphates lead to deoxygenation</li>
<li>Describe the four stages of water treatment and what each one does</li>
<li>State that ammonium salts and nitrates are fertilisers; say which of N, P, K a fertiliser supplies</li>
<li>State the composition of clean, dry air</li>
<li>Give the source and effect of CO<sub>2</sub>, CO, particulates, CH<sub>4</sub>, NO<sub>x</sub> and SO<sub>2</sub></li>
<li>Explain how greenhouse gases cause global warming</li>
<li>Explain how NO<sub>x</sub> forms in engines and write the catalytic converter equation</li>
<li>Give strategies to reduce climate change and acid rain, and explain each one</li>
<li>Describe photosynthesis and write its word and symbol equations</li>
</ul>
</div>
"""

if __name__ == "__main__":
    out = "/tmp/chem_parts/topic10.pdf"
    preview = sys.argv[1] if len(sys.argv) > 1 else None
    render(TITLE, BODY, out, preview_dir=preview)
