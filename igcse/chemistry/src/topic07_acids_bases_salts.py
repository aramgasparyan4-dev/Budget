"""Chemistry Topic 7 - Acids, Bases and Salts (Cambridge IGCSE 0620, Extended)."""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from notes import render, svg, text, INK  # noqa: E402

TITLE = "Chemistry 0620 - Topic 7: Acids, Bases and Salts"

EQ = "&#8652;"  # reversible arrow


# ---------------- diagrams ----------------

def fig_ph_scale():
    cols = ["#d32f2f", "#e53935", "#f4511e", "#fb8c00", "#ffa726", "#fdd835", "#d4e157",
            "#43a047", "#26a69a", "#1e88e5", "#1565c0", "#3949ab", "#5e35b1", "#6a1b9a",
            "#4a148c"]
    w, x0 = 40, 10
    s = ""
    for i, c in enumerate(cols):
        x = x0 + i * w
        s += f'<rect x="{x}" y="22" width="{w}" height="34" fill="{c}"/>'
        tc = "#fff" if i in (0, 1, 2, 9, 10, 11, 12, 13, 14) else "#222"
        s += text(x + w / 2, 45, str(i), 15, color=tc)
    s += f'<rect x="{x0}" y="22" width="{w * 15}" height="34" fill="none" stroke="{INK}" stroke-width="1.2"/>'
    s += text(x0 + w * 15 / 2, 15, "pH (universal indicator colour)", 13, color="#555")
    labels = [(0, 3, "very acidic"), (3, 7, "slightly acidic"), (7, 8, "neutral"),
              (8, 11, "slightly alkaline"), (11, 15, "very alkaline")]
    for a, b, lab in labels:
        xa, xb = x0 + a * w + 3, x0 + b * w - 3
        s += f'<path d="M{xa},64 L{xb},64" stroke="#555" stroke-width="1.4"/>'
        s += text((xa + xb) / 2, 80, lab, 12)
    s += ('<path d="M20,98 L290,98" stroke="#c62828" stroke-width="1.6" marker-end="url(#ah)" '
          'transform="rotate(180 155 98)"/>')
    s += text(155, 114, "more H⁺ ions (higher H⁺ concentration)", 12, color="#c62828")
    s += ('<path d="M330,98 L600,98" stroke="#1d3c8c" stroke-width="1.6" marker-end="url(#ah)"/>')
    s += text(465, 114, "more OH⁻ ions", 12, color="#1d3c8c")
    return svg(615, 122, s, width_mm=150)


def fig_titration():
    s = ""
    # stand
    s += f'<rect x="20" y="215" width="120" height="8" fill="#777"/>'
    s += f'<rect x="30" y="10" width="6" height="205" fill="#777"/>'
    s += f'<rect x="36" y="60" width="44" height="6" fill="#777"/>'
    # burette
    s += f'<rect x="80" y="10" width="14" height="140" fill="#fff" stroke="{INK}" stroke-width="1.4"/>'
    s += f'<rect x="81" y="40" width="12" height="109" fill="#f8d7da"/>'
    for i in range(8):
        y = 18 + i * 16
        s += f'<path d="M80,{y} L86,{y}" stroke="{INK}" stroke-width="1"/>'
    s += f'<path d="M87,150 L87,166" stroke="{INK}" stroke-width="3"/>'
    s += f'<rect x="78" y="152" width="18" height="5" fill="#555"/>'
    # flask
    s += ('<path d="M80,172 L80,184 L60,214 L114,214 L94,184 L94,172" fill="none" '
          f'stroke="{INK}" stroke-width="1.6"/>')
    s += '<path d="M70,199 L104,199 L114,214 L60,214 Z" fill="#cfe3f7"/>'
    s += text(104, 30, "burette", 13, anchor="start")
    s += text(104, 46, "(acid)", 12, anchor="start", color="#555")
    s += text(122, 196, "conical flask: 25.0 cm³ alkali", 12, anchor="start")
    s += text(122, 211, "(pipette) + a few drops of indicator", 12, anchor="start", color="#555")
    s += text(104, 160, "tap: add acid drop by drop near the end-point", 11, anchor="start", color="#555")
    return svg(345, 230, s, width_mm=74)


# ---------------- content ----------------

STYLE = """<style>
.steps li { margin: 2px 0; }
.flow { border: 1.5px solid #1d3c8c; border-radius: 6px; padding: 6px 10px; margin: 6px 0;
        break-inside: avoid; background: #fafbfe; }
.flow .q { font-weight: 700; color: #1d3c8c; }
</style>"""

BODY = STYLE + f"""
<h1>Topic 7 &nbsp;Acids, Bases and Salts</h1>
<div class="meta">Cambridge IGCSE Chemistry 0620 &middot; Extended &middot; Sections 1&ndash;2 match
the SaveMyExams sub-topics, so you can do their questions after each one</div>

<h2><span class="num">1</span>The Characteristic Properties of Acids &amp; Bases</h2>
<h3>Properties of acids and bases</h3>
<div class="box def"><span class="lbl">Definitions</span>
<b>Bases</b> &ndash; <span class="hl">oxides or hydroxides of metals</span> (e.g. CuO, MgO, NaOH).<br>
<b>Alkalis</b> &ndash; <span class="hl">soluble bases</span> (e.g. NaOH, KOH, Ca(OH)<sub>2</sub>; aqueous
ammonia is also an alkali).</div>

<h3 style="margin-top:6px">Reactions of acids &mdash; learn the word patterns</h3>
<table>
<tr><th style="width:36%">Pattern</th><th>Example</th><th style="width:27%">What you see</th></tr>
<tr><td class="k">acid + metal &rarr; salt + hydrogen</td><td>Mg + 2HCl &rarr; MgCl<sub>2</sub> + H<sub>2</sub></td>
<td>fizzing; metal disappears. Only metals above hydrogen in the reactivity series (not Cu, Ag, Au).</td></tr>
<tr><td class="k">acid + base &rarr; salt + water</td><td>CuO + H<sub>2</sub>SO<sub>4</sub> &rarr; CuSO<sub>4</sub> + H<sub>2</sub>O</td>
<td>black solid dissolves, blue solution</td></tr>
<tr><td class="k">acid + alkali &rarr; salt + water</td><td>NaOH + HCl &rarr; NaCl + H<sub>2</sub>O</td>
<td>no visible change; temperature rises</td></tr>
<tr><td class="k">acid + carbonate &rarr; salt + water + carbon dioxide</td><td>CaCO<sub>3</sub> + 2HCl &rarr;
CaCl<sub>2</sub> + H<sub>2</sub>O + CO<sub>2</sub></td><td>fizzing; the gas turns limewater milky</td></tr>
</table>

<h3>Reactions of bases</h3>
<table>
<tr><th style="width:36%">Pattern</th><th>Example</th><th style="width:27%">Notes</th></tr>
<tr><td class="k">base + acid &rarr; salt + water</td><td>(see above) &mdash; this is <b>neutralisation</b></td><td></td></tr>
<tr><td class="k">base + ammonium salt &rarr; salt + water + ammonia</td><td>NH<sub>4</sub>Cl + NaOH &rarr; NaCl +
H<sub>2</sub>O + NH<sub>3</sub></td><td>needs warming; ammonia turns damp red litmus blue</td></tr>
</table>

<h3>Indicators</h3>
<div class="row">
<table class="k c" style="flex:0 0 92mm">
<tr><th style="text-align:left">Indicator</th><th>In acid</th><th>In alkali</th></tr>
<tr><td style="text-align:left">Litmus</td><td class="red">red</td><td class="blue">blue</td></tr>
<tr><td style="text-align:left">Thymolphthalein</td><td>colourless</td><td class="blue">blue</td></tr>
<tr><td style="text-align:left">Methyl orange</td><td class="red">red</td><td style="color:#b8860b">yellow</td></tr>
</table>
<div class="box warn" style="margin-top:4px"><span class="lbl">Watch out</span>
Thymolphthalein is <b>colourless</b> in acid (not &ldquo;clear&rdquo; &mdash; clear means
see-through, and a coloured solution can be clear).</div>
</div>
<figure>{fig_ph_scale()}
<figcaption>Universal indicator paper: compare the colour with the chart to find the pH. pH 7 is neutral.
The lower the pH, the higher the H<sup>+</sup> ion concentration.</figcaption></figure>

<h3>The ions in acids and alkalis</h3>
<ul>
<li>Aqueous solutions of acids contain <span class="hl">H<sup>+</sup> ions</span>.</li>
<li>Aqueous solutions of alkalis contain <span class="hl">OH<sup>&minus;</sup> ions</span>.</li>
<li><b>Neutralisation</b> (acid + alkali) is these ions making water:
<b>H<sup>+</sup>(aq) + OH<sup>&minus;</sup>(aq) &rarr; H<sub>2</sub>O(l)</b></li>
</ul>

<h3>Proton transfer, strong and weak acids</h3>
<div class="box def"><span class="lbl">Definitions</span>
<b>Acid</b> &ndash; <span class="hl">a proton donor</span>. &nbsp; <b>Base</b> &ndash; <span class="hl">a proton
acceptor</span>. &nbsp; (A proton is an H<sup>+</sup> ion.)<br>
<b>Strong acid</b> &ndash; <span class="hl">an acid that is completely dissociated in aqueous solution</span>.<br>
<b>Weak acid</b> &ndash; <span class="hl">an acid that is partially dissociated in aqueous solution</span>.</div>
<p>Example of proton transfer: HCl + NH<sub>3</sub> &rarr; NH<sub>4</sub>Cl &mdash; HCl <b>donates</b> H<sup>+</sup>
(acid), NH<sub>3</sub> <b>accepts</b> it (base).</p>
<table class="k">
<tr><th style="width:24%"></th><th>Strong acid: hydrochloric acid</th><th>Weak acid: ethanoic acid</th></tr>
<tr><td>Equation</td><td>HCl(aq) &rarr; H<sup>+</sup>(aq) + Cl<sup>&minus;</sup>(aq)</td>
<td>CH<sub>3</sub>COOH(aq) {EQ} H<sup>+</sup>(aq) + CH<sub>3</sub>COO<sup>&minus;</sup>(aq)</td></tr>
<tr><td>Dissociation</td><td>completely (one-way arrow)</td><td>partially (reversible arrow &mdash; most
molecules stay as CH<sub>3</sub>COOH)</td></tr>
<tr><td>Same concentration:</td><td>more H<sup>+</sup> ions &rarr; <b>lower pH</b>; reacts <b>faster</b> with
Mg or carbonates (more vigorous fizzing)</td><td>fewer H<sup>+</sup> ions &rarr; <b>higher pH</b>; reacts
<b>more slowly</b></td></tr>
</table>
<div class="box warn"><span class="lbl">Watch out</span>
<b>Strong &ne; concentrated.</b> <i>Strong/weak</i> is about how completely the acid dissociates.
<i>Concentrated/dilute</i> is about how much acid is dissolved per dm<sup>3</sup>. You can have a dilute
strong acid or a concentrated weak acid.</div>

<h3>Classifying oxides</h3>
<table class="k">
<tr><th style="width:17%">Type</th><th style="width:22%">Which elements</th><th style="width:20%">Examples</th>
<th>Behaviour</th></tr>
<tr><td>Basic</td><td><b>metal</b> oxides</td><td>CuO, CaO, MgO</td><td>react with acids to form a salt + water,
e.g. CaO + 2HCl &rarr; CaCl<sub>2</sub> + H<sub>2</sub>O. Soluble ones make alkalis (CaO + H<sub>2</sub>O
&rarr; Ca(OH)<sub>2</sub>).</td></tr>
<tr><td>Acidic</td><td><b>non-metal</b> oxides</td><td>CO<sub>2</sub>, SO<sub>2</sub></td><td>react with bases /
alkalis, e.g. CO<sub>2</sub> + 2NaOH &rarr; Na<sub>2</sub>CO<sub>3</sub> + H<sub>2</sub>O. Dissolve in water to
make acidic solutions.</td></tr>
<tr><td>Amphoteric</td><td>a few metals</td><td><b>Al<sub>2</sub>O<sub>3</sub>, ZnO</b></td><td>
<span class="hl">react with acids <i>and</i> with bases to produce a salt and water</span>, e.g. ZnO + 2HCl
&rarr; ZnCl<sub>2</sub> + H<sub>2</sub>O, and ZnO also reacts with aqueous sodium hydroxide.</td></tr>
</table>
<p class="small">The link: metallic character &rarr; basic oxide; non-metallic character &rarr; acidic oxide.
(A few oxides, such as carbon monoxide, are neutral.)</p>

<h2><span class="num">2</span>Preparation of Salts</h2>
<p>A <b>salt</b> is made when the H<sup>+</sup> of an acid is replaced by a metal ion (or ammonium ion).
The acid decides the second half of the name:</p>
<table class="c" style="width:auto">
<tr><th>Acid</th><th>Hydrochloric acid, HCl</th><th>Sulfuric acid, H<sub>2</sub>SO<sub>4</sub></th><th>Nitric acid, HNO<sub>3</sub></th></tr>
<tr><td class="k">Salt</td><td>chloride</td><td>sulfate</td><td>nitrate</td></tr>
</table>

<div class="flow"><span class="q">Which method?</span><br>
<b>1.</b> Is the salt <b>insoluble</b>? &rarr; <b>precipitation</b> (Method C).<br>
<b>2.</b> Soluble, and a <b>sodium, potassium or ammonium</b> salt? &rarr; <b>titration</b> (Method B) &mdash;
both reactants are soluble, so you can&rsquo;t add an excess and filter it off.<br>
<b>3.</b> Any other soluble salt? &rarr; acid + <b>excess</b> insoluble base, carbonate or metal, then filter
(Method A).</div>

<h3>Preparing soluble salts</h3>
<div class="row" style="break-inside:auto">
<div>
<p><b>Method A &mdash; excess insoluble solid</b><br>
<span class="small">e.g. copper(II) sulfate from copper(II) oxide + dilute sulfuric acid</span></p>
<ol class="steps">
<li>Warm the dilute acid (speeds up the reaction).</li>
<li>Add the solid a little at a time, stirring, until <b>no more dissolves</b> (some is left over &mdash; it
is in <b>excess</b>). This makes sure <b>all the acid is used up</b>.</li>
<li><b>Filter</b> to remove the excess solid. Keep the filtrate (the salt solution).</li>
<li><b>Heat</b> the filtrate to evaporate some of the water until it is <b>saturated</b> (crystals form on a
glass rod dipped in and taken out).</li>
<li>Leave to <b>cool</b> so crystals form.</li>
<li>Filter off the crystals, wash with a little cold distilled water, and <b>dry</b> between filter
papers.</li>
</ol>
<p class="small">With a carbonate (e.g. ZnCO<sub>3</sub> + H<sub>2</sub>SO<sub>4</sub> &rarr; ZnSO<sub>4</sub> +
H<sub>2</sub>O + CO<sub>2</sub>) add it until the fizzing stops. With a metal (e.g. Zn + H<sub>2</sub>SO<sub>4</sub>
&rarr; ZnSO<sub>4</sub> + H<sub>2</sub>) use a moderately reactive metal &mdash; not sodium or potassium
(dangerous) and not copper (doesn&rsquo;t react).</p>
</div>
<div>
<p><b>Method B &mdash; titration</b> (acid + alkali)<br>
<span class="small">e.g. sodium sulfate: 2NaOH + H<sub>2</sub>SO<sub>4</sub> &rarr; Na<sub>2</sub>SO<sub>4</sub> +
2H<sub>2</sub>O</span></p>
<figure>{fig_titration()}</figure>
<ol class="steps">
<li>Pipette 25.0 cm<sup>3</sup> of alkali into a conical flask; add a few drops of indicator (methyl orange
or thymolphthalein).</li>
<li>Add acid from the burette until the indicator <b>just</b> changes colour (the end-point). Record the
volume.</li>
<li><b>Repeat without the indicator</b>, adding exactly the same volumes &mdash; so the salt isn&rsquo;t
contaminated.</li>
<li>Evaporate, crystallise and dry as in Method A.</li>
</ol>
</div>
</div>
<div class="box warn"><span class="lbl">Watch out</span>
Don&rsquo;t evaporate to <b>dryness</b> if you want crystals of a hydrated salt &mdash; you&rsquo;d drive off
the water of crystallisation (and the solid can spit). Heat only until saturated, then let it cool.
Don&rsquo;t use universal indicator in a titration &mdash; its colour change is gradual, not sharp.</div>

<h3>Preparing insoluble salts &mdash; Method C: precipitation</h3>
<p>Mix two <b>solutions</b>: one containing the metal ion, one containing the non-metal ion. The insoluble
salt forms as a <b>precipitate</b>.</p>
<div class="row">
<div>
<p>e.g. barium sulfate:<br>
BaCl<sub>2</sub>(aq) + Na<sub>2</sub>SO<sub>4</sub>(aq) &rarr; <b>BaSO<sub>4</sub>(s)</b> + 2NaCl(aq)<br>
ionic: Ba<sup>2+</sup>(aq) + SO<sub>4</sub><sup>2&minus;</sup>(aq) &rarr; BaSO<sub>4</sub>(s)</p>
<p class="small">Other examples: AgNO<sub>3</sub> + NaCl &rarr; AgCl(s) + NaNO<sub>3</sub>;
Pb(NO<sub>3</sub>)<sub>2</sub> + 2KI &rarr; PbI<sub>2</sub>(s) + 2KNO<sub>3</sub></p>
</div>
<div>
<ol class="steps">
<li>Mix the two solutions; a precipitate forms.</li>
<li><b>Filter</b> &mdash; the salt is the residue on the filter paper.</li>
<li><b>Wash</b> it with distilled water to remove the soluble impurities.</li>
<li><b>Dry</b> it (between filter papers or in a warm oven).</li>
</ol>
</div>
</div>
<div class="box exam"><span class="lbl">Choosing the two solutions</span>
Use a <b>nitrate</b> of the metal (all nitrates are soluble) and a <b>sodium or potassium</b> compound of the
non-metal ion (all are soluble). e.g. for lead(II) iodide: lead(II) nitrate + potassium iodide.</div>

<h3>Solubility rules</h3>
<table>
<tr><th style="width:44%">Soluble</th><th>Insoluble</th></tr>
<tr><td>all <b>sodium, potassium and ammonium</b> salts</td><td></td></tr>
<tr><td>all <b>nitrates</b></td><td></td></tr>
<tr><td><b>chlorides</b> &hellip;</td><td>&hellip; except <b>lead</b> and <b>silver</b> chloride</td></tr>
<tr><td><b>sulfates</b> &hellip;</td><td>&hellip; except <b>barium</b>, <b>calcium</b> and <b>lead</b> sulfate</td></tr>
<tr><td>&hellip; except sodium, potassium and ammonium carbonate</td><td><b>carbonates</b></td></tr>
<tr><td>&hellip; except sodium, potassium, ammonium hydroxide (calcium hydroxide is partially soluble)</td>
<td><b>hydroxides</b></td></tr>
</table>

<h3>Hydrated and anhydrous salts</h3>
<div class="box def"><span class="lbl">Definitions</span>
<b>Hydrated substance</b> &ndash; <span class="hl">a substance that is chemically combined with water</span>.<br>
<b>Anhydrous substance</b> &ndash; <span class="hl">a substance containing no water</span>.<br>
<b>Water of crystallisation</b> &ndash; <span class="hl">the water molecules present in crystals</span>, e.g.
CuSO<sub>4</sub>&middot;5H<sub>2</sub>O and CoCl<sub>2</sub>&middot;6H<sub>2</sub>O.</div>
<p>Heating removes the water of crystallisation: CuSO<sub>4</sub>&middot;5H<sub>2</sub>O (blue) &rarr;
CuSO<sub>4</sub> (white) + 5H<sub>2</sub>O. Adding water turns it blue again (see Topic 6, reversible
reactions).</p>
<div class="box exam"><span class="lbl">Worked example &mdash; find x in CuSO<sub>4</sub>&middot;xH<sub>2</sub>O</span>
2.50 g of hydrated copper(II) sulfate is heated until the mass stops changing: 1.60 g of anhydrous
CuSO<sub>4</sub> is left.<br>
Mass of water lost = 2.50 &minus; 1.60 = 0.90 g<br>
Moles of CuSO<sub>4</sub> = 1.60 &divide; 160 = 0.010 mol &nbsp; (M<sub>r</sub> = 64 + 32 + 4 &times; 16 = 160)<br>
Moles of H<sub>2</sub>O = 0.90 &divide; 18 = 0.050 mol<br>
Ratio CuSO<sub>4</sub> : H<sub>2</sub>O = 0.010 : 0.050 = 1 : 5 &rarr; <b>x = 5</b>, so CuSO<sub>4</sub>&middot;5H<sub>2</sub>O<br>
<span class="small">Heat to <b>constant mass</b> so you know all the water has gone.</span></div>

<div class="keep">
<h3>Self-check before the topic questions</h3>
<ul class="check">
<li>Give the word and symbol equations for acids with metals, bases, alkalis and carbonates</li>
<li>Describe the reaction of a base with an ammonium salt and the test for ammonia</li>
<li>State the colours of litmus, thymolphthalein and methyl orange in acid and alkali</li>
<li>Use universal indicator and the pH scale to compare acidity and H<sup>+</sup> concentration</li>
<li>Write the ionic equation for neutralisation</li>
<li>Define acids and bases as proton donors/acceptors and strong/weak acids; write the HCl and ethanoic
acid equations</li>
<li>Classify oxides as acidic, basic or amphoteric (Al<sub>2</sub>O<sub>3</sub>, ZnO)</li>
<li>Choose and describe the right method to make a salt (excess solid, titration, precipitation)</li>
<li>Use the solubility rules</li>
<li>Define hydrated, anhydrous and water of crystallisation; work out x in a hydrated formula</li>
</ul>
</div>
"""

if __name__ == "__main__":
    preview = sys.argv[1] if len(sys.argv) > 1 else None
    render(TITLE, BODY, "/tmp/chem_parts/topic07.pdf", preview_dir=preview)
