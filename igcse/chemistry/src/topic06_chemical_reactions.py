"""Chemistry Topic 6 - Chemical Reactions (Cambridge IGCSE 0620, Extended)."""
import math
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from notes import render, svg, text, INK  # noqa: E402

TITLE = "Chemistry 0620 - Topic 6: Chemical Reactions"

EQ = "&#8652;"  # reversible arrow


# ---------------- diagrams ----------------

def axes(x0, y0, x1, y1, xlabel, ylabel):
    s = (f'<path d="M{x0},{y1} L{x0},{y0} L{x1},{y0}" fill="none" stroke="{INK}" '
         f'stroke-width="1.6" marker-end="url(#ah)"/>'
         f'<path d="M{x0},{y0} L{x0},{y1 - 6}" stroke="{INK}" stroke-width="1.6" '
         f'marker-end="url(#ah)"/>')
    s += text((x0 + x1) / 2, y0 + 22, xlabel, 13)
    s += text(x0 - 14, (y0 + y1) / 2, ylabel, 13,
              extra=f'transform="rotate(-90 {x0 - 14} {(y0 + y1) / 2})"')
    return s


def curve(x0, y0, vmax, k, x_end, color, dash=""):
    pts = []
    for i in range(0, x_end - x0 + 1, 3):
        y = vmax * (1 - math.exp(-k * i))
        pts.append(f"{x0 + i:.1f},{y0 - y:.1f}")
    d = 'stroke-dasharray="6,4"' if dash else ""
    return (f'<polyline points="{" ".join(pts)}" fill="none" stroke="{color}" '
            f'stroke-width="2.2" {d}/>')


def fig_rate_graph():
    x0, y0 = 50, 185
    s = axes(x0, y0, 320, 20, "time", "volume of gas / cm³")
    s += curve(x0, y0, 120, 0.06, 260, "#c62828")
    s += curve(x0, y0, 120, 0.022, 260, "#1d3c8c")
    s += curve(x0, y0, 60, 0.022, 260, "#2e7d32", dash=True)
    s += text(268, 60, "B", 15, anchor="start", color="#c62828")
    s += text(268, 74, "A", 15, anchor="start", color="#1d3c8c")
    s += text(268, 132, "C", 15, anchor="start", color="#2e7d32")
    s += text(82, 40, "steep = fast", 12, anchor="start", color="#555")
    s += text(255, 50, "flat = reaction finished", 12, anchor="end", color="#555")
    return svg(330, 215, s, width_mm=74)


def fig_energy_profile():
    x0, y0 = 45, 190
    s = axes(x0, y0, 340, 15, "progress of reaction", "energy")
    react, prod, peak, peak_cat = 115, 160, 40, 82
    s += f'<path d="M55,{react} L170,{react}" stroke="{INK}" stroke-width="2.2"/>'
    s += text(55, react + 16, "reactants", 12, anchor="start")
    s += (f'<path d="M170,{react} C205,{react} 212,{peak} 237,{peak} '
          f'C262,{peak} 270,{prod} 300,{prod} L335,{prod}" fill="none" stroke="{INK}" '
          f'stroke-width="2.2"/>')
    s += (f'<path d="M170,{react} C205,{react} 215,{peak_cat} 237,{peak_cat} '
          f'C259,{peak_cat} 270,{prod} 300,{prod}" fill="none" stroke="#2e7d32" '
          f'stroke-width="2.2" stroke-dasharray="6,4"/>')
    s += text(335, prod + 16, "products", 12, anchor="end")
    for y in (peak, peak_cat):
        s += f'<path d="M70,{y} L232,{y}" stroke="#999" stroke-width="1" stroke-dasharray="3,3"/>'
    s += (f'<path d="M85,{react} L85,{peak + 3}" stroke="#c62828" stroke-width="1.8" '
          f'marker-end="url(#ah)"/>')
    s += text(91, 66, "Ea", 13, anchor="start", color="#c62828")
    s += (f'<path d="M135,{react} L135,{peak_cat + 3}" stroke="#2e7d32" stroke-width="1.8" '
          f'marker-end="url(#ah)"/>')
    s += text(141, 104, "Ea", 13, anchor="start", color="#2e7d32")
    return svg(350, 215, s, width_mm=74)


def fig_gas_syringe():
    s = ""
    # conical flask
    s += ('<path d="M92,62 L92,82 L62,150 L148,150 L118,82 L118,62" fill="none" '
          f'stroke="{INK}" stroke-width="1.8"/>')
    s += ('<path d="M76,118 L134,118 L148,150 L62,150 Z" fill="#dbe9f7" stroke="none"/>')
    for x, y in ((85, 142), (98, 145), (112, 141), (124, 145), (104, 136)):
        s += f'<circle cx="{x}" cy="{y}" r="4" fill="#bbb" stroke="{INK}" stroke-width="0.8"/>'
    s += f'<rect x="88" y="52" width="34" height="12" rx="2" fill="#555"/>'
    # delivery tube to syringe
    s += f'<path d="M105,52 L105,32 L190,32" fill="none" stroke="{INK}" stroke-width="3"/>'
    # syringe barrel + plunger
    s += f'<rect x="190" y="20" width="120" height="24" fill="#fff" stroke="{INK}" stroke-width="1.6"/>'
    for i in range(1, 10):
        s += f'<path d="M{190 + i * 12},20 L{190 + i * 12},26" stroke="{INK}" stroke-width="1"/>'
    s += f'<rect x="240" y="23" width="6" height="18" fill="#888"/>'
    s += f'<path d="M246,32 L330,32" stroke="{INK}" stroke-width="2.2"/>'
    s += f'<path d="M330,24 L330,40" stroke="{INK}" stroke-width="3"/>'
    s += text(250, 62, "gas syringe", 13)
    s += text(250, 78, "(read volume every 10 s)", 11, color="#555")
    s += text(165, 130, "dilute acid", 12, anchor="start")
    s += text(165, 146, "+ marble chips", 12, anchor="start")
    return svg(340, 165, s, width_mm=72)


def fig_mass_loss():
    s = ""
    s += ('<path d="M72,40 L72,60 L42,128 L128,128 L98,60 L98,40" fill="none" '
          f'stroke="{INK}" stroke-width="1.8"/>')
    s += '<path d="M56,96 L114,96 L128,128 L42,128 Z" fill="#dbe9f7"/>'
    for x, y in ((62, 120), (78, 123), (92, 118), (105, 122)):
        s += f'<circle cx="{x}" cy="{y}" r="4" fill="#bbb" stroke="{INK}" stroke-width="0.8"/>'
    # cotton wool
    s += ('<path d="M70,40 q-6,-8 2,-12 q4,-9 12,-4 q8,-6 13,3 q8,3 1,13 Z" fill="#fff" '
          f'stroke="{INK}" stroke-width="1.2"/>')
    s += text(112, 30, "cotton wool", 12, anchor="start")
    s += text(112, 44, "(lets CO₂ out, keeps acid in)", 11, anchor="start", color="#555")
    # balance
    s += f'<rect x="20" y="128" width="130" height="30" rx="3" fill="#eee" stroke="{INK}" stroke-width="1.6"/>'
    s += f'<rect x="48" y="135" width="74" height="16" fill="#fff" stroke="{INK}" stroke-width="1"/>'
    s += text(85, 148, "152.36 g", 12)
    s += text(165, 140, "mass falls as", 12, anchor="start")
    s += text(165, 154, "CO₂ escapes", 12, anchor="start")
    return svg(270, 165, s, width_mm=56)


# ---------------- content ----------------

STYLE = """<style>
.eq { font-size: 10.8pt; white-space: nowrap; }
table.split { break-inside: auto; }
table.split tr { break-inside: avoid; }
</style>"""

BODY = STYLE + f"""
<h1>Topic 6 &nbsp;Chemical Reactions</h1>
<div class="meta">Cambridge IGCSE Chemistry 0620 &middot; Extended &middot; Sections 1&ndash;3 match
the SaveMyExams sub-topics, so you can do their questions after each one</div>

<h2><span class="num">1</span>Chemical Change &amp; Rate of Reaction</h2>
<h3>Physical and chemical changes</h3>
<table class="k">
<tr><th></th><th>Physical change</th><th>Chemical change</th></tr>
<tr><td>New substance?</td><td><b>No</b> new substance is made</td><td>A <b>new substance</b> is made</td></tr>
<tr><td>Reversing it</td><td>usually easy (cool it, evaporate the water&hellip;)</td><td>usually hard to reverse</td></tr>
<tr><td>Examples</td><td>melting ice, boiling water, dissolving salt</td><td>burning magnesium, rusting,
neutralisation</td></tr>
<tr><td>Signs</td><td>change of state or appearance only</td><td>gas given off (fizzing), colour change,
precipitate forms, temperature change</td></tr>
</table>
<div class="box warn"><span class="lbl">Watch out</span>
Dissolving is a <b>physical</b> change: the salt is still there and you get it back by evaporating the
water. Always justify your answer with &ldquo;a new substance is / is not formed&rdquo;.</div>

<h3>Rates of reaction factors</h3>
<p>The <b>rate of reaction</b> is how fast reactants are used up or products are made.</p>
<table class="k">
<tr><th style="width:26%">Change</th><th style="width:16%">Effect on rate</th><th>Notes</th></tr>
<tr><td>Increase concentration of a solution</td><td>faster</td><td></td></tr>
<tr><td>Increase pressure of a gas</td><td>faster</td><td>only matters for reactions involving gases</td></tr>
<tr><td>Increase surface area of a solid</td><td>faster</td><td>smaller pieces / powder instead of lumps</td></tr>
<tr><td>Increase temperature</td><td>faster</td><td>has the biggest effect of all the factors</td></tr>
<tr><td>Add a catalyst</td><td>faster</td><td>e.g. manganese(IV) oxide in 2H<sub>2</sub>O<sub>2</sub> &rarr;
2H<sub>2</sub>O + O<sub>2</sub>. <b>Enzymes</b> are biological catalysts.</td></tr>
</table>
<div class="box def"><span class="lbl">Definition</span>
A <b>catalyst</b> <span class="hl">increases the rate of a reaction and is unchanged in mass and chemical
composition at the end of the reaction.</span></div>

<h3>Collision theory</h3>
<div class="row">
<div>
<p>Particles can only react when they <b>collide</b>, and the collision must have
<span class="hl">at least the activation energy</span>. These are <b>successful collisions</b>.</p>
<div class="box def"><span class="lbl">Definition</span>
<b>Activation energy, E<sub>a</sub></b> &ndash; the minimum energy that colliding particles must have to
react.</div>
<p>The rate depends on <b>how often successful collisions happen</b>, which depends on:</p>
<ul>
<li>the number of particles per unit volume</li>
<li>the frequency of collisions</li>
<li>the kinetic energy of the particles</li>
<li>the activation energy</li>
</ul>
</div>
<figure style="flex:0 0 76mm">{fig_energy_profile()}
<figcaption>Solid: no catalyst. <span class="green">Dashed: with a catalyst</span> &mdash; an
alternative route with a <b>lower E<sub>a</sub></b>. The energy of reactants and products doesn&rsquo;t
change.</figcaption></figure>
</div>

<h3>Explaining rates using collision theory</h3>
<table class="k split">
<thead><tr><th style="width:22%">Change</th><th>Explanation (mark-scheme wording)</th></tr></thead>
<tr><td>Higher concentration</td><td><b>More particles per unit volume</b> &rarr; collisions are <b>more
frequent</b> &rarr; more successful collisions per second.</td></tr>
<tr><td>Higher gas pressure</td><td>Same particles in a smaller volume: <b>more particles per unit
volume</b> &rarr; more frequent collisions.</td></tr>
<tr><td>Larger surface area</td><td>More particles of the solid are <b>exposed</b> to the other reactant
&rarr; more frequent collisions.</td></tr>
<tr><td>Higher temperature</td><td>Particles have <b>more kinetic energy</b> and move faster, so (1) they
collide more often, and (2) <b>a greater proportion of collisions have energy &ge; E<sub>a</sub></b>.
Reason (2) is the main one.</td></tr>
<tr><td>Catalyst</td><td>Provides an alternative pathway with a <b>lower activation energy</b> &rarr; a
greater proportion of collisions are successful. The catalyst is not used up.</td></tr>
</table>
<div class="box warn"><span class="lbl">Watch out &mdash; easy marks lost</span>
&#10007; &ldquo;More collisions&rdquo; &rarr; say <b>more frequent collisions</b> or <b>more collisions per
second</b>.<br>
&#10007; A catalyst does not give particles more energy &mdash; it <b>lowers E<sub>a</sub></b>.<br>
&#10007; Concentration, pressure and surface area do <b>not</b> change E<sub>a</sub> or the energy of the
particles &mdash; only how often they collide.<br>
&#10007; For temperature, you must mention <b>energy</b> (collisions with energy above E<sub>a</sub>), not just
&ldquo;particles move faster&rdquo;.</div>

<h3>Investigating the rate of a reaction</h3>
<div class="row">
<figure>{fig_gas_syringe()}<figcaption>Method 1: volume of gas produced</figcaption></figure>
<figure style="flex:0 0 60mm">{fig_mass_loss()}<figcaption>Method 2: loss of mass</figcaption></figure>
</div>
<table class="k">
<tr><th style="width:20%">Method</th><th>How</th><th style="width:34%">Evaluation</th></tr>
<tr><td>Volume of gas</td><td>e.g. CaCO<sub>3</sub> + 2HCl &rarr; CaCl<sub>2</sub> + H<sub>2</sub>O +
CO<sub>2</sub> or Mg + 2HCl &rarr; MgCl<sub>2</sub> + H<sub>2</sub>. Measure the gas volume at regular time
intervals.</td><td>Gas syringe is accurate. Collecting over water (upturned measuring cylinder) is less
accurate &mdash; and CO<sub>2</sub> dissolves slightly in water. Some gas escapes before the bung goes in.</td></tr>
<tr><td>Loss of mass</td><td>Flask on a balance with a cotton wool plug; record the mass at regular
intervals.</td><td>Easy and precise for a <b>dense</b> gas like CO<sub>2</sub>. Useless for H<sub>2</sub>
&mdash; it is so light the mass change is tiny.</td></tr>
<tr><td>Precipitate (&ldquo;disappearing cross&rdquo;)</td><td>Na<sub>2</sub>S<sub>2</sub>O<sub>3</sub> +
2HCl &rarr; 2NaCl + SO<sub>2</sub> + S + H<sub>2</sub>O. Time how long until a cross under the flask
can&rsquo;t be seen.</td><td>Judging when the cross disappears is subjective. Shorter time = faster
rate.</td></tr>
</table>
<p class="small">For a fair test: change one variable only; keep the others the same (volume and
concentration of acid, mass and size of solid, temperature &mdash; use a water bath). Start the timer as
the reactants are mixed. Repeat and take a mean.</p>

<h3>Interpreting data</h3>
<div class="row">
<figure style="flex:0 0 78mm">{fig_rate_graph()}
<figcaption><span style="color:#1d3c8c">A</span> original &middot; <span style="color:#c62828">B</span>
faster (e.g. higher temperature or a catalyst), same amounts &middot;
<span style="color:#2e7d32">C</span> half the amount of the limiting reactant</figcaption></figure>
<div>
<ul>
<li>The <b>gradient</b> (steepness) = the rate.</li>
<li>Steepest at the <b>start</b>: most reactant particles, so collisions are most frequent.</li>
<li>The gradient falls as reactants are <b>used up</b>.</li>
<li>Line goes <b>flat</b>: reaction has stopped because one reactant (the <b>limiting</b> reactant) has run out.</li>
<li>A faster reaction has a <b>steeper</b> start and flattens <b>sooner</b> &mdash; but gives the <b>same
final volume</b> if the amounts of reactants are the same.</li>
<li>The final volume only changes if the <b>amount</b> of limiting reactant changes.</li>
</ul>
</div>
</div>
<div class="box exam"><span class="lbl">Calculating rate</span>
<b>Average rate</b> = amount of product formed (or reactant used) &divide; time taken.<br>
e.g. 48 cm<sup>3</sup> of gas in 40 s &rarr; 48 &divide; 40 = <b>1.2 cm<sup>3</sup>/s</b>.<br>
<b>Rate at one moment:</b> draw a tangent to the curve at that time and find its gradient
(change in y &divide; change in x).</div>

<h2><span class="num">2</span>Reversible Reactions &amp; Equilibrium</h2>
<h3>Reversible reactions</h3>
<p>Some reactions can go both ways. The symbol <b>{EQ}</b> shows a <b>reversible</b> reaction. Changing the
conditions can change the direction.</p>
<table>
<tr><th>Hydrated salt</th><th></th><th>Anhydrous salt + water</th><th>Use</th></tr>
<tr><td class="k">CuSO<sub>4</sub>&middot;5H<sub>2</sub>O <span class="small">blue</span></td><td class="eq">heat &rarr;<br>&larr; add water</td>
<td>CuSO<sub>4</sub> <span class="small">white</span> + 5H<sub>2</sub>O</td><td rowspan="2">The forward
direction needs heat; adding water to the anhydrous salt reverses it (and gives out heat). Both are used as
<b>tests for water</b>: white &rarr; blue, blue &rarr; pink.</td></tr>
<tr><td class="k">CoCl<sub>2</sub>&middot;6H<sub>2</sub>O <span class="small">pink</span></td><td class="eq">heat &rarr;<br>&larr; add water</td>
<td>CoCl<sub>2</sub> <span class="small">blue</span> + 6H<sub>2</sub>O</td></tr>
</table>

<h3>Equilibrium</h3>
<div class="box def"><span class="lbl">Definition</span>
A reversible reaction in a <b>closed system</b> (nothing can get in or out) is at <b>equilibrium</b> when:
<span class="hl">the rate of the forward reaction equals the rate of the reverse reaction, and the
concentrations of reactants and products are no longer changing.</span></div>
<p>The reactions haven&rsquo;t stopped &mdash; both are still happening at the same rate (<b>dynamic</b>
equilibrium). The <b>position of equilibrium</b> tells you whether there is more reactant (left) or more
product (right).</p>

<p><b>Rule:</b> if you change the conditions, the position of equilibrium shifts to <span class="hl">oppose
the change</span>.</p>
<table class="k">
<tr><th style="width:24%">Change</th><th style="width:34%">Equilibrium shifts&hellip;</th>
<th>Example: N<sub>2</sub> + 3H<sub>2</sub> {EQ} 2NH<sub>3</sub> (forward is exothermic)</th></tr>
<tr><td>Raise temperature</td><td>in the <b>endothermic</b> direction</td><td>left &rarr; less NH<sub>3</sub></td></tr>
<tr><td>Lower temperature</td><td>in the <b>exothermic</b> direction</td><td>right &rarr; more NH<sub>3</sub></td></tr>
<tr><td>Raise pressure</td><td>to the side with <b>fewer gas molecules</b></td><td>right (4 molecules &rarr; 2)
&rarr; more NH<sub>3</sub></td></tr>
<tr><td>Lower pressure</td><td>to the side with <b>more gas molecules</b></td><td>left &rarr; less NH<sub>3</sub></td></tr>
<tr><td>Add more reactant</td><td>to the <b>right</b>, using it up</td><td>add N<sub>2</sub> &rarr; more NH<sub>3</sub></td></tr>
<tr><td>Remove product</td><td>to the <b>right</b>, replacing it</td><td>remove NH<sub>3</sub> &rarr; more NH<sub>3</sub> made</td></tr>
<tr><td>Add a catalyst</td><td><b>no change</b> &mdash; equilibrium is just reached faster</td><td>same yield, sooner</td></tr>
</table>
<p class="small">If both sides have the same number of gas molecules, pressure has no effect on the position
of equilibrium.</p>

<div class="box exam"><span class="lbl">Worked example &mdash; &ldquo;predict and explain&rdquo;</span>
2NO<sub>2</sub>(g) <span class="small">brown</span> {EQ} N<sub>2</sub>O<sub>4</sub>(g) <span class="small">colourless</span>
&nbsp; The forward reaction is exothermic.<br>
<b>Temperature raised:</b> equilibrium shifts <b>left</b>, in the endothermic direction, to oppose the rise
in temperature &rarr; more NO<sub>2</sub>, so the mixture goes <b>darker brown</b>.<br>
<b>Pressure raised:</b> equilibrium shifts <b>right</b>, to the side with fewer gas molecules (2 &rarr; 1)
&rarr; more N<sub>2</sub>O<sub>4</sub>, so the colour gets <b>paler</b>.<br>
<span class="small">Answer pattern: direction of shift + reason (which side / which direction) + effect
on the amount or colour.</span></div>

<h3>The Haber process &mdash; making ammonia</h3>
<p style="font-size:11.5pt; text-align:center"><b>N<sub>2</sub>(g) + 3H<sub>2</sub>(g) {EQ} 2NH<sub>3</sub>(g)</b>
&nbsp;&nbsp; forward reaction exothermic</p>
<p><b>Sources:</b> nitrogen from <b>air</b>; hydrogen from <b>methane</b> (natural gas).
<b>Conditions:</b> <span class="hl">450 &deg;C, 20 000 kPa (200 atm), iron catalyst</span>.</p>
<table class="k">
<tr><th style="width:15%">Condition</th><th style="width:21%">Best for yield</th><th style="width:21%">Best for
rate</th><th>Why the chosen value is used</th></tr>
<tr><td>450 &deg;C</td><td>low (forward is exothermic)</td><td>high</td><td><b>Compromise:</b> a lower
temperature would give a higher yield but the rate would be too slow; 450 &deg;C gives a reasonable yield at a
reasonable rate.</td></tr>
<tr><td>200 atm</td><td>high (4 gas molecules &rarr; 2)</td><td>high</td><td>High pressure increases both
yield and rate, but even higher pressures are <b>too expensive</b> (strong equipment, energy for compressors)
and <b>too dangerous</b>.</td></tr>
<tr><td>Iron catalyst</td><td>no effect</td><td>faster</td><td>Equilibrium is reached faster, so more
ammonia per hour.</td></tr>
</table>
<p class="small">Only a small fraction (about 15%) of the gases react each time. The ammonia is removed by
cooling (it liquefies) and the unreacted N<sub>2</sub> and H<sub>2</sub> are recycled.</p>

<h3>The Contact process &mdash; making sulfur trioxide (for sulfuric acid)</h3>
<p style="font-size:11.5pt; text-align:center"><b>2SO<sub>2</sub>(g) + O<sub>2</sub>(g) {EQ} 2SO<sub>3</sub>(g)</b>
&nbsp;&nbsp; forward reaction exothermic</p>
<p><b>Sources:</b> SO<sub>2</sub> from <b>burning sulfur</b> (S + O<sub>2</sub> &rarr; SO<sub>2</sub>) or
<b>roasting sulfide ores</b>; oxygen from <b>air</b>.
<b>Conditions:</b> <span class="hl">450 &deg;C, 200 kPa (2 atm), vanadium(V) oxide catalyst
(V<sub>2</sub>O<sub>5</sub>)</span>.</p>
<table class="k">
<tr><th style="width:15%">Condition</th><th style="width:21%">Best for yield</th><th style="width:21%">Best for
rate</th><th>Why the chosen value is used</th></tr>
<tr><td>450 &deg;C</td><td>low (forward is exothermic)</td><td>high</td><td><b>Compromise</b> between a
reasonable yield and a reasonable rate.</td></tr>
<tr><td>2 atm</td><td>high (3 gas molecules &rarr; 2)</td><td>high</td><td>The yield is <b>already very
high</b> at low pressure, so the extra cost of high pressure isn&rsquo;t worth it.</td></tr>
<tr><td>V<sub>2</sub>O<sub>5</sub> catalyst</td><td>no effect</td><td>faster</td><td>Equilibrium reached
faster.</td></tr>
</table>
<div class="box warn"><span class="lbl">Watch out</span>
Know which conditions go with which process: <b>both 450 &deg;C</b>, but Haber is <b>200 atm + iron</b> and
Contact is <b>2 atm + V<sub>2</sub>O<sub>5</sub></b>. A catalyst never changes the yield.</div>

<h2><span class="num">3</span>Redox</h2>
<h3>Oxidation and reduction</h3>
<div class="box def"><span class="lbl">Definitions</span>
<b>Oxidation</b> &ndash; gain of oxygen, <b>loss of electrons</b>, or an <b>increase in oxidation number</b>.<br>
<b>Reduction</b> &ndash; loss of oxygen, <b>gain of electrons</b>, or a <b>decrease in oxidation number</b>.<br>
<b>Redox reaction</b> &ndash; <span class="hl">a reaction involving simultaneous oxidation and reduction.</span>
</div>
<p><b>OIL RIG:</b> <b>O</b>xidation <b>I</b>s <b>L</b>oss, <b>R</b>eduction <b>I</b>s <b>G</b>ain (of
electrons).</p>
<table>
<tr><th>Reaction</th><th>Oxidised</th><th>Reduced</th></tr>
<tr><td>CuO + H<sub>2</sub> &rarr; Cu + H<sub>2</sub>O</td><td>H<sub>2</sub> (gains oxygen)</td><td>CuO (loses oxygen)</td></tr>
<tr><td>Fe<sub>2</sub>O<sub>3</sub> + 3CO &rarr; 2Fe + 3CO<sub>2</sub></td><td>CO (gains oxygen)</td><td>Fe<sub>2</sub>O<sub>3</sub> (loses oxygen)</td></tr>
<tr><td>Zn + Cu<sup>2+</sup> &rarr; Zn<sup>2+</sup> + Cu</td><td>Zn &rarr; Zn<sup>2+</sup> + 2e<sup>&minus;</sup> (loses e<sup>&minus;</sup>)</td>
<td>Cu<sup>2+</sup> + 2e<sup>&minus;</sup> &rarr; Cu (gains e<sup>&minus;</sup>)</td></tr>
<tr><td>Cl<sub>2</sub> + 2Br<sup>&minus;</sup> &rarr; 2Cl<sup>&minus;</sup> + Br<sub>2</sub></td><td>Br<sup>&minus;</sup> (loses e<sup>&minus;</sup>)</td>
<td>Cl<sub>2</sub> (gains e<sup>&minus;</sup>)</td></tr>
</table>

<h3>Oxidation numbers</h3>
<div class="row">
<div>
<p><b>Rules:</b></p>
<ul>
<li>An <b>uncombined element</b> is <b>0</b> (Fe, O<sub>2</sub>, Cl<sub>2</sub>).</li>
<li>A <b>monatomic ion</b> = its charge (Na<sup>+</sup> = +1, O<sup>2&minus;</sup> = &minus;2).</li>
<li>In a <b>compound</b> they add up to <b>0</b>.</li>
<li>In an <b>ion</b> they add up to the <b>charge</b>.</li>
<li>Usually O = &minus;2 and H = +1 in compounds.</li>
</ul>
<p><b>Roman numerals</b> in names give the oxidation number: iron(II) = Fe<sup>2+</sup>, iron(III) =
Fe<sup>3+</sup>, copper(II) = Cu<sup>2+</sup>, manganate(VII) = Mn at +7.</p>
</div>
<div>
<table>
<tr><th>Worked examples</th><th></th></tr>
<tr><td>S in SO<sub>4</sub><sup>2&minus;</sup></td><td>S + 4(&minus;2) = &minus;2 &rarr; S = <b>+6</b></td></tr>
<tr><td>Mn in MnO<sub>4</sub><sup>&minus;</sup></td><td>Mn + 4(&minus;2) = &minus;1 &rarr; Mn = <b>+7</b></td></tr>
<tr><td>Fe in Fe<sub>2</sub>O<sub>3</sub></td><td>2Fe + 3(&minus;2) = 0 &rarr; Fe = <b>+3</b></td></tr>
<tr><td>N in NH<sub>4</sub><sup>+</sup></td><td>N + 4(+1) = +1 &rarr; N = <b>&minus;3</b></td></tr>
</table>
<p>In Zn + Cu<sup>2+</sup> &rarr; Zn<sup>2+</sup> + Cu: Zn goes 0 &rarr; +2 (<b>oxidised</b>), Cu goes
+2 &rarr; 0 (<b>reduced</b>).</p>
</div>
</div>

<h3>Redox and electron transfer: oxidising and reducing agents</h3>
<div class="box def"><span class="lbl">Definitions</span>
<b>Oxidising agent</b> &ndash; <span class="hl">a substance that oxidises another substance and is itself
reduced.</span><br>
<b>Reducing agent</b> &ndash; <span class="hl">a substance that reduces another substance and is itself
oxidised.</span></div>
<p>In Zn + Cu<sup>2+</sup> &rarr; Zn<sup>2+</sup> + Cu: <b>Zn is the reducing agent</b> (it is oxidised);
<b>Cu<sup>2+</sup> is the oxidising agent</b> (it is reduced).</p>
<table class="k">
<tr><th style="width:30%">Test</th><th>Colour change</th><th>What it shows</th></tr>
<tr><td>Acidified aqueous potassium manganate(VII)</td><td><b>purple &rarr; colourless</b></td><td>it is an
oxidising agent, so this happens when a <b>reducing agent</b> is present</td></tr>
<tr><td>Aqueous potassium iodide</td><td><b>colourless &rarr; brown</b> (iodine forms)</td><td>it is a reducing
agent, so this happens when an <b>oxidising agent</b> is present</td></tr>
</table>
<div class="box warn"><span class="lbl">Watch out</span>
The oxidising agent is the one that gets <b>reduced</b> (and vice versa) &mdash; the most common mix-up.
When asked to identify a species, give the actual particle (Cu<sup>2+</sup>, not &ldquo;copper&rdquo;).</div>

<div class="keep">
<h3>Self-check before the topic questions</h3>
<ul class="check">
<li>Tell physical and chemical changes apart and justify it</li>
<li>State the effect of concentration, pressure, surface area, temperature and catalysts on rate</li>
<li>Explain each one using collision theory (particles per unit volume, collision frequency, energy, E<sub>a</sub>)</li>
<li>Describe and evaluate the gas-volume and mass-loss methods</li>
<li>Read rate graphs: gradient, why it flattens, same/different final volume; calculate an average rate</li>
<li>Describe the reversible reactions of hydrated CuSO<sub>4</sub> and CoCl<sub>2</sub> with colours</li>
<li>Define equilibrium and predict + explain shifts for temperature, pressure, concentration, catalyst</li>
<li>State the Haber and Contact equations, sources, conditions, and explain the conditions</li>
<li>Define oxidation and reduction (oxygen, electrons, oxidation number) and work out oxidation numbers</li>
<li>Identify oxidising and reducing agents; know the KMnO<sub>4</sub> and KI colour changes</li>
</ul>
</div>
"""

if __name__ == "__main__":
    preview = sys.argv[1] if len(sys.argv) > 1 else None
    render(TITLE, BODY, "/tmp/chem_parts/topic06.pdf", preview_dir=preview)
