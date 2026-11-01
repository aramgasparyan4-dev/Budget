"""Chemistry Topic 3 - Stoichiometry (Cambridge IGCSE 0620, Extended)."""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from notes import render, svg, text, INK  # noqa: E402

TITLE = "Chemistry 0620 - Topic 3: Stoichiometry"


# ---------------- diagrams ----------------

def triangle(ox, top, left, right, caption):
    """Formula triangle: top / (left x right)."""
    w, h = 150, 112
    x0, y0 = ox, 10
    s = (f'<path d="M{x0 + w/2},{y0} L{x0 + w},{y0 + h} L{x0},{y0 + h} Z" fill="#eef2fa" '
         f'stroke="{INK}" stroke-width="1.6" stroke-linejoin="round"/>')
    ymid = y0 + h * 0.55
    half = (w / 2) * (ymid - y0) / h
    s += (f'<path d="M{x0 + w/2 - half:.1f},{ymid:.1f} L{x0 + w/2 + half:.1f},{ymid:.1f}" '
          f'stroke="{INK}" stroke-width="1.4"/>')
    s += (f'<path d="M{x0 + w/2},{ymid:.1f} L{x0 + w/2},{y0 + h}" stroke="{INK}" stroke-width="1.4"/>')
    s += text(x0 + w / 2, y0 + h * 0.46, top, 14)
    s += text(x0 + w * 0.3, y0 + h * 0.86, left, 13)
    s += text(x0 + w * 0.7, y0 + h * 0.86, right, 13)
    s += text(x0 + w / 2, y0 + h + 24, caption, 13, color="#1d3c8c")
    return s


def fig_triangles():
    s = triangle(10, "mass", "moles", "Mr", "moles = mass (g) ÷ Mr")
    s += triangle(200, "moles", "conc.", "vol (dm³)", "moles = conc. × volume (dm³)")
    s += triangle(390, "volume", "moles", "24", "gas volume (dm³) = moles × 24")
    return svg(550, 160, s, width_mm=140)


# ---------------- content ----------------

STYLE = """<style>
.no { font-family: 'DejaVu Sans', sans-serif; color: #c62828; font-size: 90%; }
.we { border: 1.5px solid #2e7d32; border-radius: 6px; padding: 4px 10px 5px; margin: 6px 0;
      break-inside: avoid; }
.we .lbl { font-family: 'Hand'; color: #2e7d32; font-size: 10.5pt; display: block; }
.we p { margin: 1px 0; }
.ans { font-weight: 700; color: #000; background: #eef6ee; padding: 0 4px; border-radius: 3px; }
.eq { font-size: 11pt; margin: 3px 0 3px 10px; }
table.steps td:first-child { width: 4%; color: #1d3c8c; font-weight: 700; }
.ion td, .ion th { text-align: center; }
</style>"""

BODY = STYLE + f"""
<h1>Topic 3 &nbsp;Stoichiometry</h1>
<div class="meta">Cambridge IGCSE Chemistry 0620 &middot; Extended &middot; Sections 1&ndash;2 match the
SaveMyExams sub-topics, so you can do their questions after each one &middot; A<sub>r</sub> values from the
Periodic Table: H 1, C 12, N 14, O 16, Na 23, Mg 24, S 32, Cl 35.5, Ca 40, Fe 56</div>

<h2><span class="num">1</span>Formulae &amp; Relative Masses</h2>

<h3>Formulae</h3>
<div class="box def"><span class="lbl">Definition</span>
<b>Molecular formula</b> &ndash; <span class="hl">the number and type of different atoms in one
molecule.</span></div>
<div class="row">
<div>
<p><b>Reading a formula</b></p>
<ul>
<li>H<sub>2</sub>SO<sub>4</sub> &rarr; 2 H, 1 S, 4 O</li>
<li>Ca(OH)<sub>2</sub> &rarr; the 2 multiplies everything in the bracket: 1 Ca, 2 O, 2 H</li>
<li>2H<sub>2</sub>O &rarr; the big number multiplies the whole formula: 4 H, 2 O</li>
</ul>
<p><b>Elements:</b> these exist as <span class="hl">diatomic molecules</span>: H<sub>2</sub>,
N<sub>2</sub>, O<sub>2</sub>, F<sub>2</sub>, Cl<sub>2</sub>, Br<sub>2</sub>, I<sub>2</sub>. Most other
elements are just written as the symbol (Fe, C, Na, He).</p>
<p><b>From a model or diagram:</b> count each type of atom in <i>one</i> molecule (2 C, 6 H, 1 O &rarr;
C<sub>2</sub>H<sub>6</sub>O). For a giant structure, give the ratio (SiO<sub>2</sub>).</p>
</div>
<div style="flex:0 0 72mm">
<table class="k" style="margin-top:0">
<tr><th>Compound</th><th>Formula</th></tr>
<tr><td>water</td><td>H<sub>2</sub>O</td></tr>
<tr><td>carbon dioxide / monoxide</td><td>CO<sub>2</sub> / CO</td></tr>
<tr><td>methane</td><td>CH<sub>4</sub></td></tr>
<tr><td>ammonia</td><td>NH<sub>3</sub></td></tr>
<tr><td>sulfur dioxide</td><td>SO<sub>2</sub></td></tr>
<tr><td>hydrochloric acid</td><td>HCl</td></tr>
<tr><td>sulfuric acid</td><td>H<sub>2</sub>SO<sub>4</sub></td></tr>
<tr><td>nitric acid</td><td>HNO<sub>3</sub></td></tr>
<tr><td>sodium hydroxide</td><td>NaOH</td></tr>
<tr><td>calcium carbonate</td><td>CaCO<sub>3</sub></td></tr>
<tr><td>ethanol</td><td>C<sub>2</sub>H<sub>5</sub>OH</td></tr>
</table>
</div>
</div>

<h3>Empirical formulae &amp; formulae of ionic compounds</h3>
<div class="box def"><span class="lbl">Definition</span>
<b>Empirical formula</b> &ndash; <span class="hl">the simplest whole number ratio of the different atoms or
ions in a compound.</span></div>
<div class="row">
<div>
<table class="c">
<tr><th>Molecular</th><th>C<sub>2</sub>H<sub>4</sub></th><th>C<sub>2</sub>H<sub>6</sub></th>
<th>H<sub>2</sub>O<sub>2</sub></th><th>C<sub>6</sub>H<sub>12</sub>O<sub>6</sub></th><th>CH<sub>4</sub></th></tr>
<tr><td class="k">Empirical</td><td>CH<sub>2</sub></td><td>CH<sub>3</sub></td><td>HO</td>
<td>CH<sub>2</sub>O</td><td>CH<sub>4</sub></td></tr>
</table>
<p>Divide every number by the biggest number that goes into all of them. Ionic compounds and giant covalent
structures are <b>always</b> written as empirical formulae (NaCl, MgCl<sub>2</sub>, SiO<sub>2</sub>).</p>
</div>
</div>

<p><b>Ionic formulae from charges</b> &mdash; the charges must add up to zero (see Topic 2). Learn these
ions:</p>
<table class="ion">
<tr><th>+1</th><th>+2</th><th>+3</th><th>&minus;1</th><th>&minus;2</th></tr>
<tr><td>H<sup>+</sup> Li<sup>+</sup> Na<sup>+</sup> K<sup>+</sup> Ag<sup>+</sup>
<b>NH<sub>4</sub><sup>+</sup></b></td>
<td>Mg<sup>2+</sup> Ca<sup>2+</sup> Ba<sup>2+</sup> Zn<sup>2+</sup> Cu<sup>2+</sup> Fe<sup>2+</sup></td>
<td>Al<sup>3+</sup> Fe<sup>3+</sup> Cr<sup>3+</sup></td>
<td>Cl<sup>&minus;</sup> Br<sup>&minus;</sup> I<sup>&minus;</sup> <b>OH<sup>&minus;</sup></b>
<b>NO<sub>3</sub><sup>&minus;</sup></b></td>
<td>O<sup>2&minus;</sup> S<sup>2&minus;</sup> <b>SO<sub>4</sub><sup>2&minus;</sup></b>
<b>CO<sub>3</sub><sup>2&minus;</sup></b></td></tr>
</table>
<p class="small">Bold = compound ions (a group of atoms with one overall charge). Roman numerals give the
charge: iron(II) = Fe<sup>2+</sup>, iron(III) = Fe<sup>3+</sup>, copper(II) = Cu<sup>2+</sup>.</p>

<table class="k">
<tr><th>Compound</th><th>Ions</th><th>Balance the charges</th><th>Formula</th></tr>
<tr><td>calcium hydroxide</td><td>Ca<sup>2+</sup>, OH<sup>&minus;</sup></td><td>1 &times; (+2), 2 &times; (&minus;1)</td><td>Ca(OH)<sub>2</sub></td></tr>
<tr><td>iron(III) oxide</td><td>Fe<sup>3+</sup>, O<sup>2&minus;</sup></td><td>2 &times; (+3), 3 &times; (&minus;2)</td><td>Fe<sub>2</sub>O<sub>3</sub></td></tr>
<tr><td>copper(II) nitrate</td><td>Cu<sup>2+</sup>, NO<sub>3</sub><sup>&minus;</sup></td><td>1 &times; (+2), 2 &times; (&minus;1)</td><td>Cu(NO<sub>3</sub>)<sub>2</sub></td></tr>
<tr><td>ammonium sulfate</td><td>NH<sub>4</sub><sup>+</sup>, SO<sub>4</sub><sup>2&minus;</sup></td><td>2 &times; (+1), 1 &times; (&minus;2)</td><td>(NH<sub>4</sub>)<sub>2</sub>SO<sub>4</sub></td></tr>
<tr><td>aluminium sulfate</td><td>Al<sup>3+</sup>, SO<sub>4</sub><sup>2&minus;</sup></td><td>2 &times; (+3), 3 &times; (&minus;2)</td><td>Al<sub>2</sub>(SO<sub>4</sub>)<sub>3</sub></td></tr>
</table>
<p class="small">Put <b>brackets</b> round a compound ion only when you need more than one of it.</p>

<h3>Writing equations</h3>
<div class="row">
<div>
<table class="steps">
<tr><td>1</td><td>Write the <b>word equation</b>.</td></tr>
<tr><td>2</td><td>Write the correct <b>formula</b> for every substance.</td></tr>
<tr><td>3</td><td><b>Balance</b>: same number of each type of atom on both sides. Only change the
<b>big numbers in front</b>, never the small ones in a formula.</td></tr>
<tr><td>4</td><td>Add <b>state symbols</b>.</td></tr>
</table>
</div>
<div style="flex:0 0 62mm">
<table class="k" style="margin-top:0">
<tr><th>Symbol</th><th>Meaning</th></tr>
<tr><td>(s)</td><td>solid</td></tr>
<tr><td>(l)</td><td>liquid</td></tr>
<tr><td>(g)</td><td>gas</td></tr>
<tr><td>(aq)</td><td>aqueous &mdash; dissolved in water</td></tr>
</table>
</div>
</div>

<div class="we"><span class="lbl">Worked example &mdash; balancing</span>
<p>methane + oxygen &rarr; carbon dioxide + water</p>
<p class="eq">CH<sub>4</sub> + O<sub>2</sub> &rarr; CO<sub>2</sub> + H<sub>2</sub>O &nbsp;&nbsp;
<span class="small">4 H on the left, 2 on the right &rarr; put 2 in front of H<sub>2</sub>O</span></p>
<p class="eq">CH<sub>4</sub> + O<sub>2</sub> &rarr; CO<sub>2</sub> + 2H<sub>2</sub>O &nbsp;&nbsp;
<span class="small">now 4 O on the right, 2 on the left &rarr; put 2 in front of O<sub>2</sub></span></p>
<p class="eq"><span class="ans">CH<sub>4</sub>(g) + 2O<sub>2</sub>(g) &rarr; CO<sub>2</sub>(g) +
2H<sub>2</sub>O(l)</span></p>
</div>
<p>More balanced examples: &nbsp; 2Mg(s) + O<sub>2</sub>(g) &rarr; 2MgO(s) &nbsp;&middot;&nbsp;
2Na(s) + 2H<sub>2</sub>O(l) &rarr; 2NaOH(aq) + H<sub>2</sub>(g) &nbsp;&middot;&nbsp;
CaCO<sub>3</sub>(s) + 2HCl(aq) &rarr; CaCl<sub>2</sub>(aq) + H<sub>2</sub>O(l) + CO<sub>2</sub>(g)</p>

<h3 style="margin-top:12px">Ionic equations</h3>
<p>An ionic equation shows only the particles that actually change. <b>Spectator ions</b> are in the
solution but don&rsquo;t change, so they are left out.</p>
<div class="we"><span class="lbl">Worked example &mdash; hydrochloric acid + sodium hydroxide</span>
<p><b>1.</b> Full equation with states: HCl(aq) + NaOH(aq) &rarr; NaCl(aq) + H<sub>2</sub>O(l)</p>
<p><b>2.</b> Split everything that is <b>(aq) and ionic</b> into ions: H<sup>+</sup> + Cl<sup>&minus;</sup> +
Na<sup>+</sup> + OH<sup>&minus;</sup> &rarr; Na<sup>+</sup> + Cl<sup>&minus;</sup> + H<sub>2</sub>O</p>
<p><b>3.</b> Cross out ions that are the same on both sides (Na<sup>+</sup>, Cl<sup>&minus;</sup>):
<span class="ans">H<sup>+</sup>(aq) + OH<sup>&minus;</sup>(aq) &rarr; H<sub>2</sub>O(l)</span></p>
</div>
<table class="k">
<tr><th style="width:24%">Must-know ionic equation</th><th style="width:44%">Equation</th><th>Reaction</th></tr>
<tr><td>Neutralisation</td><td>H<sup>+</sup>(aq) + OH<sup>&minus;</sup>(aq) &rarr; H<sub>2</sub>O(l)</td><td>any acid + alkali</td></tr>
<tr><td>Precipitation</td><td>Ag<sup>+</sup>(aq) + Cl<sup>&minus;</sup>(aq) &rarr; AgCl(s)</td><td>silver nitrate + a chloride</td></tr>
<tr><td>Displacement</td><td>Zn(s) + Cu<sup>2+</sup>(aq) &rarr; Zn<sup>2+</sup>(aq) + Cu(s)</td><td>zinc + copper(II) sulfate</td></tr>
</table>

<div class="box warn"><span class="lbl">Watch out</span>
<span class="no">&#10007;</span> Changing small numbers to balance (H<sub>2</sub>O &rarr; H<sub>2</sub>O<sub>2</sub>) &mdash;
that makes a different substance.<br>
<span class="no">&#10007;</span> Forgetting diatomic elements: oxygen gas is O<sub>2</sub>, not O.<br>
<span class="no">&#10007;</span> Splitting solids, liquids or gases into ions in an ionic equation &mdash; only (aq) ionic
compounds are split.<br>
<span class="no">&#10007;</span> Ionic equations must balance <b>charge</b> as well as atoms (Zn + Cu<sup>2+</sup>: +2 on
each side).</div>

<h3>A<sub>r</sub> &amp; M<sub>r</sub></h3>
<div class="box def"><span class="lbl">Definitions</span>
<b>Relative atomic mass, A<sub>r</sub></b> &ndash; <span class="hl">the average mass of the isotopes of an
element compared to 1/12th of the mass of an atom of carbon-12.</span><br>
<b>Relative molecular mass, M<sub>r</sub></b> &ndash; <span class="hl">the sum of the relative atomic
masses</span> of all the atoms in the formula. For ionic compounds it is called relative
<b>formula</b> mass (still M<sub>r</sub>). No units.</div>
<table class="k">
<tr><th>Substance</th><th>Working</th><th>M<sub>r</sub></th></tr>
<tr><td>H<sub>2</sub>O</td><td>(2 &times; 1) + 16</td><td>18</td></tr>
<tr><td>CO<sub>2</sub></td><td>12 + (2 &times; 16)</td><td>44</td></tr>
<tr><td>CaCO<sub>3</sub></td><td>40 + 12 + (3 &times; 16)</td><td>100</td></tr>
<tr><td>Ca(OH)<sub>2</sub></td><td>40 + 2 &times; (16 + 1)</td><td>74</td></tr>
<tr><td>(NH<sub>4</sub>)<sub>2</sub>SO<sub>4</sub></td><td>2 &times; (14 + 4) + 32 + (4 &times; 16)</td><td>132</td></tr>
</table>
<div class="row">
<div class="we"><span class="lbl">Percentage composition by mass</span>
<p>% of element = (A<sub>r</sub> &times; number of atoms) &divide; M<sub>r</sub> &times; 100</p>
<p>% N in ammonium nitrate, NH<sub>4</sub>NO<sub>3</sub> (M<sub>r</sub> = 80):<br>
(2 &times; 14) &divide; 80 &times; 100 = <span class="ans">35%</span></p>
</div>
<div class="we"><span class="lbl">Reacting masses by simple proportion</span>
<p>2.4 g of magnesium makes 4.0 g of magnesium oxide. What mass of oxide does 6.0 g of magnesium make?</p>
<p>Scale up: 6.0 &divide; 2.4 = 2.5 times as much &rarr; 4.0 &times; 2.5 = <span class="ans">10.0 g</span></p>
</div>
</div>

<h2><span class="num">2</span>The Mole &amp; the Avogadro Constant</h2>

<h3>The mole</h3>
<div class="box def"><span class="lbl">Definition</span>
The <b>mole</b> (mol) is the unit of amount of substance. <span class="hl">One mole contains
6.02 &times; 10<sup>23</sup> particles</span> (atoms, ions or molecules). This number is the
<b>Avogadro constant</b>.</div>
<ul>
<li>One mole of a substance has a mass equal to its A<sub>r</sub> or M<sub>r</sub> <b>in grams</b> (its
molar mass, g/mol): 1 mol C = 12 g; 1 mol H<sub>2</sub>O = 18 g; 1 mol CO<sub>2</sub> = 44 g.</li>
<li><b>Number of particles = moles &times; 6.02 &times; 10<sup>23</sup></b>. e.g. 0.5 mol CO<sub>2</sub> =
3.01 &times; 10<sup>23</sup> molecules. Each molecule has 3 atoms, so that is 9.03 &times;
10<sup>23</sup> atoms.</li>
</ul>

<figure>{fig_triangles()}
<figcaption>The three equations for the whole topic. Cover the one you want: side by side means multiply,
one above the other means divide.</figcaption></figure>

<h3>Linking moles, mass &amp; M<sub>r</sub></h3>
<table class="k">
<tr><th style="width:36%">Find</th><th>Working</th></tr>
<tr><td>Moles in 22 g of CO<sub>2</sub></td><td>22 &divide; 44 = <span class="ans">0.5 mol</span></td></tr>
<tr><td>Mass of 0.25 mol of CaCO<sub>3</sub></td><td>0.25 &times; 100 = <span class="ans">25 g</span></td></tr>
<tr><td>M<sub>r</sub> of a gas: 0.050 mol has a mass of 3.2 g</td><td>3.2 &divide; 0.050 = <span class="ans">64</span>
(matches SO<sub>2</sub>: 32 + 32)</td></tr>
</table>

<h3>Moles and gas volumes</h3>
<p><span class="hl">One mole of any gas occupies 24 dm<sup>3</sup> at room temperature and pressure
(r.t.p.)</span> &mdash; that is 24 000 cm<sup>3</sup>. (1 dm<sup>3</sup> = 1000 cm<sup>3</sup>.)</p>
<table class="k">
<tr><th style="width:36%">Find</th><th>Working</th></tr>
<tr><td>Volume of 0.25 mol of O<sub>2</sub></td><td>0.25 &times; 24 = <span class="ans">6.0 dm<sup>3</sup></span></td></tr>
<tr><td>Moles in 480 cm<sup>3</sup> of CO<sub>2</sub></td><td>480 &divide; 24 000 = <span class="ans">0.020 mol</span></td></tr>
<tr><td>Volume of 8.8 g of CO<sub>2</sub></td><td>8.8 &divide; 44 = 0.20 mol &rarr; 0.20 &times; 24 = <span class="ans">4.8 dm<sup>3</sup></span></td></tr>
</table>
<p>For gases, the <b>volume ratio = the mole ratio</b> in the equation. CH<sub>4</sub> + 2O<sub>2</sub>
&rarr; CO<sub>2</sub> + 2H<sub>2</sub>O, so 50 cm<sup>3</sup> of methane needs 100 cm<sup>3</sup> of
oxygen.</p>

<h3>Reacting masses</h3>
<div class="box exam"><span class="lbl">The 3-step method (works for every reacting-mass question)</span>
<b>1.</b> Moles of the substance you know (mass &divide; M<sub>r</sub>). &nbsp;
<b>2.</b> Use the <b>balanced equation</b> to get moles of the one you want. &nbsp;
<b>3.</b> Convert: mass = moles &times; M<sub>r</sub>, or gas volume = moles &times; 24.</div>
<div class="row">
<div class="we"><span class="lbl">Worked example 1</span>
<p>Heating 50 g of CaCO<sub>3</sub>: CaCO<sub>3</sub> &rarr; CaO + CO<sub>2</sub>. Mass of CaO? Volume of
CO<sub>2</sub>?</p>
<p><b>1.</b> 50 &divide; 100 = 0.50 mol CaCO<sub>3</sub><br>
<b>2.</b> ratio 1 : 1 : 1 &rarr; 0.50 mol CaO and 0.50 mol CO<sub>2</sub><br>
<b>3.</b> 0.50 &times; 56 = <span class="ans">28 g CaO</span>; 0.50 &times; 24 = <span class="ans">12 dm<sup>3</sup>
CO<sub>2</sub></span></p>
</div>
<div class="we"><span class="lbl">Worked example 2 &mdash; ratio not 1 : 1</span>
<p>Mass of iron from 80 g of Fe<sub>2</sub>O<sub>3</sub>: Fe<sub>2</sub>O<sub>3</sub> + 3CO &rarr; 2Fe +
3CO<sub>2</sub></p>
<p><b>1.</b> M<sub>r</sub> = 160 &rarr; 80 &divide; 160 = 0.50 mol<br>
<b>2.</b> 1 Fe<sub>2</sub>O<sub>3</sub> : 2 Fe &rarr; 1.0 mol Fe<br>
<b>3.</b> 1.0 &times; 56 = <span class="ans">56 g</span></p>
</div>
</div>

<p><b>Limiting reactant</b> &mdash; the reactant that is <span class="hl">used up first</span>. It decides how
much product forms; the other reactant is <b>in excess</b> (some is left over).</p>
<div class="we"><span class="lbl">Worked example &mdash; limiting reactant</span>
<p>5.6 g of iron is heated with 4.0 g of sulfur: Fe + S &rarr; FeS. Which is limiting? Mass of FeS?</p>
<p>Fe: 5.6 &divide; 56 = 0.10 mol &nbsp;&middot;&nbsp; S: 4.0 &divide; 32 = 0.125 mol. The ratio is 1 : 1,
so 0.10 mol Fe needs only 0.10 mol S &rarr; <span class="ans">iron is limiting</span>, sulfur is in excess
(0.025 mol = 0.8 g left over).<br>
FeS formed = 0.10 mol &times; 88 = <span class="ans">8.8 g</span></p>
<p class="small">Tip: divide each reactant&rsquo;s moles by its number in the equation &mdash; the smaller
answer is the limiting reactant.</p>
</div>

<h3>Calculating concentration</h3>
<p>Concentration can be measured in <b>mol/dm<sup>3</sup></b> or <b>g/dm<sup>3</sup></b>.</p>
<div class="box def">
concentration (mol/dm<sup>3</sup>) = moles &divide; volume (dm<sup>3</sup>) &nbsp;&middot;&nbsp;
concentration (g/dm<sup>3</sup>) = mass &divide; volume (dm<sup>3</sup>)<br>
g/dm<sup>3</sup> = mol/dm<sup>3</sup> &times; M<sub>r</sub> &nbsp;&middot;&nbsp;
<b>cm<sup>3</sup> &rarr; dm<sup>3</sup>: divide by 1000</b> (250 cm<sup>3</sup> = 0.250 dm<sup>3</sup>)</div>
<table class="k">
<tr><th style="width:40%">Find</th><th>Working</th></tr>
<tr><td>Conc. of 0.50 mol NaOH in 250 cm<sup>3</sup></td><td>0.50 &divide; 0.250 = <span class="ans">2.0 mol/dm<sup>3</sup></span>
= 2.0 &times; 40 = <span class="ans">80 g/dm<sup>3</sup></span></td></tr>
<tr><td>Moles in 25.0 cm<sup>3</sup> of 0.100 mol/dm<sup>3</sup> HCl</td><td>0.100 &times; 0.0250 =
<span class="ans">0.00250 mol</span></td></tr>
<tr><td>Mass of NaCl to make 500 cm<sup>3</sup> of 0.200 mol/dm<sup>3</sup></td><td>0.200 &times; 0.500 = 0.100 mol
&rarr; &times; 58.5 = <span class="ans">5.85 g</span></td></tr>
</table>

<h3>Titration calculations</h3>
<p>A titration finds the exact volume of one solution that reacts with a known volume of another. Use the
<b>mean of the concordant titres</b> (results within 0.10 cm<sup>3</sup> of each other) and ignore the
rough one. e.g. titres 21.00 (rough), 20.40, 20.30, 20.35 &rarr; mean = 20.35 cm<sup>3</sup>.</p>
<div class="row">
<div class="we"><span class="lbl">Worked example 1 (1 : 1)</span>
<p>25.0 cm<sup>3</sup> of NaOH is neutralised by 20.0 cm<sup>3</sup> of 0.150 mol/dm<sup>3</sup> HCl.
Concentration of the NaOH? &nbsp; NaOH + HCl &rarr; NaCl + H<sub>2</sub>O</p>
<p><b>1.</b> moles HCl = 0.150 &times; 0.0200 = 0.00300 mol<br>
<b>2.</b> ratio 1 : 1 &rarr; 0.00300 mol NaOH<br>
<b>3.</b> 0.00300 &divide; 0.0250 = <span class="ans">0.120 mol/dm<sup>3</sup></span></p>
</div>
<div class="we"><span class="lbl">Worked example 2 (2 : 1)</span>
<p>25.0 cm<sup>3</sup> of 0.100 mol/dm<sup>3</sup> NaOH is neutralised by 12.50 cm<sup>3</sup> of
H<sub>2</sub>SO<sub>4</sub>. &nbsp; 2NaOH + H<sub>2</sub>SO<sub>4</sub> &rarr; Na<sub>2</sub>SO<sub>4</sub> +
2H<sub>2</sub>O</p>
<p><b>1.</b> moles NaOH = 0.100 &times; 0.0250 = 0.00250 mol<br>
<b>2.</b> 2 : 1 &rarr; 0.00250 &divide; 2 = 0.00125 mol H<sub>2</sub>SO<sub>4</sub><br>
<b>3.</b> 0.00125 &divide; 0.01250 = <span class="ans">0.100 mol/dm<sup>3</sup></span></p>
</div>
</div>

<h3>Empirical &amp; molecular formula</h3>
<div class="we"><span class="lbl">Worked example &mdash; from percentages</span>
<p>A compound is 40.0% C, 6.7% H and 53.3% O by mass. Its M<sub>r</sub> is 180. Find the empirical and
molecular formulae.</p>
<table class="c" style="width:auto; margin:3px 0">
<tr><th style="text-align:left">Step</th><th>C</th><th>H</th><th>O</th></tr>
<tr><td class="k" style="text-align:left">mass (or %)</td><td>40.0</td><td>6.7</td><td>53.3</td></tr>
<tr><td class="k" style="text-align:left">&divide; A<sub>r</sub></td><td>40.0 &divide; 12 = 3.33</td><td>6.7 &divide; 1 = 6.7</td><td>53.3 &divide; 16 = 3.33</td></tr>
<tr><td class="k" style="text-align:left">&divide; smallest (3.33)</td><td>1</td><td>2.01 &asymp; 2</td><td>1</td></tr>
</table>
<p>Empirical formula = <span class="ans">CH<sub>2</sub>O</span> (mass 12 + 2 + 16 = 30).
Molecular: 180 &divide; 30 = 6 &rarr; <span class="ans">C<sub>6</sub>H<sub>12</sub>O<sub>6</sub></span></p>
</div>
<div class="row">
<div class="we"><span class="lbl">From experiment masses</span>
<p>2.4 g Mg burns to give 4.0 g of oxide, so oxygen = 4.0 &minus; 2.4 = 1.6 g.<br>
Mg: 2.4 &divide; 24 = 0.10 &nbsp; O: 1.6 &divide; 16 = 0.10 &rarr; 1 : 1 &rarr;
<span class="ans">MgO</span></p>
</div>
<div class="we"><span class="lbl">When the ratio ends in .5</span>
<p>Iron oxide: 70% Fe, 30% O. Fe: 70 &divide; 56 = 1.25 &nbsp; O: 30 &divide; 16 = 1.875<br>
&divide; 1.25 &rarr; 1 : 1.5 &rarr; &times; 2 &rarr; 2 : 3 &rarr; <span class="ans">Fe<sub>2</sub>O<sub>3</sub></span></p>
</div>
</div>

<h3>Percentage yield &amp; purity</h3>
<div class="row">
<div class="box def" style="margin-top:2px">
<b>% yield</b> = actual yield &divide; theoretical yield &times; 100<br>
<b>% purity</b> = mass of pure product &divide; total mass of sample &times; 100</div>
<div>
<p style="margin-top:2px"><b>Why the yield is below 100%:</b> the reaction may not go to completion (e.g.
reversible reactions); some product is lost when transferring, filtering or purifying; other (side)
reactions may happen.</p>
</div>
</div>
<div class="row">
<div class="we"><span class="lbl">Worked example &mdash; % yield</span>
<p>From 50 g CaCO<sub>3</sub> the theoretical yield of CaO is 28 g (worked example 1 above). Only
22.4 g is made.</p>
<p>22.4 &divide; 28 &times; 100 = <span class="ans">80%</span></p>
</div>
<div class="we"><span class="lbl">Worked example &mdash; % purity</span>
<p>12.5 g of impure CaCO<sub>3</sub> reacts with excess acid and gives 2.64 dm<sup>3</sup> of
CO<sub>2</sub>. CaCO<sub>3</sub> + 2HCl &rarr; CaCl<sub>2</sub> + H<sub>2</sub>O + CO<sub>2</sub></p>
<p>CO<sub>2</sub>: 2.64 &divide; 24 = 0.110 mol &rarr; 0.110 mol CaCO<sub>3</sub> &times; 100 = 11.0 g<br>
11.0 &divide; 12.5 &times; 100 = <span class="ans">88%</span></p>
</div>
</div>

<div class="box warn"><span class="lbl">Watch out &mdash; where calculation marks are lost</span>
<span class="no">&#10007;</span> Not converting cm<sup>3</sup> to dm<sup>3</sup> (&divide; 1000) before using
concentration or the 24 dm<sup>3</sup> rule.<br>
<span class="no">&#10007;</span> Skipping the equation ratio in step 2 &mdash; always check the big numbers.<br>
<span class="no">&#10007;</span> Using A<sub>r</sub> of O (16) for oxygen gas: O<sub>2</sub> has M<sub>r</sub> 32.<br>
<span class="no">&#10007;</span> Rounding in the middle of a calculation &mdash; keep full numbers, round only the final answer
(usually 3 significant figures).<br>
<span class="no">&#10007;</span> Using the reactant in excess instead of the limiting one to work out the product.<br>
<span class="no">&#10007;</span> Percentage yield the wrong way up &mdash; actual goes on top, so the answer is never over 100%.
</div>

<div class="keep">
<h3>Self-check before the topic questions</h3>
<ul class="check">
<li>Define molecular formula, empirical formula, A<sub>r</sub>, M<sub>r</sub>, the mole and the Avogadro constant</li>
<li>Write formulae of ionic compounds from the ions, including compound ions and brackets</li>
<li>Write and balance symbol equations with state symbols, and write ionic equations</li>
<li>Calculate M<sub>r</sub> and percentage composition by mass</li>
<li>Convert between mass, moles, number of particles and gas volume (24 dm<sup>3</sup> at r.t.p.)</li>
<li>Calculate reacting masses and gas volumes, and find the limiting reactant</li>
<li>Calculate concentrations in mol/dm<sup>3</sup> and g/dm<sup>3</sup>, converting cm<sup>3</sup> to dm<sup>3</sup></li>
<li>Use titration results to find a concentration or volume</li>
<li>Calculate empirical and molecular formulae from data</li>
<li>Calculate percentage yield and percentage purity</li>
</ul>
</div>
"""

if __name__ == "__main__":
    preview = sys.argv[1] if len(sys.argv) > 1 else None
    render(TITLE, BODY, "/tmp/chem_parts/topic03.pdf", preview_dir=preview)
