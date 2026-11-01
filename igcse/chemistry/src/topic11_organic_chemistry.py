"""Chemistry Topic 11 - Organic Chemistry (Cambridge IGCSE 0620, Extended)."""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from notes import render, svg, text, INK  # noqa: E402

TITLE = "Chemistry 0620 - Topic 11: Organic Chemistry"


def f(s):
    """Subscript the numbers inside chemical formulae (not leading coefficients)."""
    return re.sub(r"(?<=[A-Za-z\)])(\d+)", r"<sub>\1</sub>", s)


def eq(s):
    return f'<span class="eq">{f(s)}</span>'


# ---------------- displayed-formula drawer ----------------
# Each molecule is drawn from a small character grid:
#   atoms: C H O N R, L = Cl, B = Br, M = CH3, X = box (block of carbon atoms)
#   bonds: - single, = double, # triple (horizontal); | single, " double (vertical)
#   [ ] = repeat-unit brackets, n after ] = subscript n

LABEL = {"L": "Cl", "B": "Br", "M": 'CH<tspan font-size="10" dy="4">3</tspan>'}
RAD_H = {"L": 11, "B": 11, "M": 15, "X": 15}
DX = DY = 17


def mol(rows, scale=0.26, hl=None):
    """hl: list of (r1, c1, r2, c2) grid boxes to shade (e.g. a linkage)."""
    nrows = len(rows)
    ncols = max(len(r) for r in rows)
    pad = 12

    def ch(r, c):
        if 0 <= r < nrows and 0 <= c < len(rows[r]):
            return rows[r][c]
        return " "

    def is_atom(k):
        return k.isalpha() and k != "n"

    def xy(r, c):
        return pad + c * DX, pad + r * DY

    out = []
    has_br = any("[" in r for r in rows)
    for (r1, c1, r2, c2) in (hl or []):
        x1, y1 = xy(r1, c1)
        x2, y2 = xy(r2, c2)
        out.append(f'<rect x="{x1-10}" y="{y1-11}" width="{x2-x1+20}" height="{y2-y1+22}" '
                   f'rx="5" fill="#fff3c4"/>')
    for r in range(nrows):
        for c in range(len(rows[r])):
            k = rows[r][c]
            if k in "-=#":
                a, b = ch(r, c - 1), ch(r, c + 1)
                x, y = xy(r, c)
                xa = x - DX + RAD_H.get(a, 7) if is_atom(a) else (x - DX - 6 if a == "[" else
                                                                   x - DX / 2 if a in "-=#" else x - DX * 0.7)
                xb = x + DX - RAD_H.get(b, 7) if is_atom(b) else (x + DX + 6 if b == "]" else
                                                                   x + DX / 2 if b in "-=#" else x + DX * 0.7)
                offs = {"-": [0], "=": [-2.6, 2.6], "#": [-3.6, 0, 3.6]}[k]
                for o in offs:
                    out.append(f'<line x1="{xa:.1f}" y1="{y+o:.1f}" x2="{xb:.1f}" y2="{y+o:.1f}" '
                               f'stroke="{INK}" stroke-width="1.5"/>')
            elif k in '|"':
                a, b = ch(r - 1, c), ch(r + 1, c)
                x, y = xy(r, c)
                ya = y - DY + 10 if is_atom(a) else y - DY * 0.7
                yb = y + DY - 10 if is_atom(b) else y + DY * 0.7
                offs = [0] if k == "|" else [-2.6, 2.6]
                for o in offs:
                    out.append(f'<line x1="{x+o:.1f}" y1="{ya:.1f}" x2="{x+o:.1f}" y2="{yb:.1f}" '
                               f'stroke="{INK}" stroke-width="1.5"/>')
            elif k == "X":
                x, y = xy(r, c)
                out.append(f'<rect x="{x-14}" y="{y-8}" width="28" height="16" fill="#e8eaf0" '
                           f'stroke="{INK}" stroke-width="1.3"/>')
            elif is_atom(k):
                x, y = xy(r, c)
                out.append(text(x, y + 5, LABEL.get(k, k), 15))
            elif k == "[":
                x, y = xy(r, c)
                out.append(f'<path d="M{x+5},{y-28} L{x},{y-28} L{x},{y+28} L{x+5},{y+28}" '
                           f'fill="none" stroke="{INK}" stroke-width="1.6"/>')
            elif k == "]":
                x, y = xy(r, c)
                out.append(f'<path d="M{x-5},{y-28} L{x},{y-28} L{x},{y+28} L{x-5},{y+28}" '
                           f'fill="none" stroke="{INK}" stroke-width="1.6"/>')
            elif k == "n":
                x, y = xy(r, c)
                out.append(text(x - 6, y + 30, "n", 14, anchor="start",
                                extra='font-style="italic"'))
    w = 2 * pad + (ncols - 1) * DX
    h = 2 * pad + (nrows - 1) * DY
    if has_br:
        br_rows = [i for i, r in enumerate(rows) if "[" in r]
        h = max(h, pad + br_rows[-1] * DY + 36)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
            f'style="width:{w*scale:.1f}mm; vertical-align:middle">{"".join(out)}</svg>')


def figmol(rows, caption, scale=0.26, hl=None):
    return f'<figure class="mol">{mol(rows, scale, hl)}<figcaption>{caption}</figcaption></figure>'


# ---------- molecules ----------
METHANE = ["  H", "  |", "H-C-H", "  |", "  H"]
ETHANE = ["  H H", "  | |", "H-C-C-H", "  | |", "  H H"]
ETHENE = ["H H", "| |", "C=C", "| |", "H H"]
ETHANOL = ["  H H", "  | |", "H-C-C-O-H", "  | |", "  H H"]
ETHANOIC = ["  H O", '  | "', "H-C-C-O-H", "  |", "  H"]
CHLOROMETHANE = ["  H", "  |", "H-C-L", "  |", "  H"]
DIBROMOETHANE = ["  B B", "  | |", "H-C-C-H", "  | |", "  H H"]
BUTANE = ["  H H H H", "  | | | |", "H-C-C-C-C-H", "  | | | |", "  H H H H"]
METHYLPROPANE = ["  H H H", "  | | |", "H-C-C-C-H", "  | | |", "  H | H",
                 "    |", "  H-C-H", "    |", "    H"]
BUT1ENE = ["  H H H H", "  | | | |", "H-C=C-C-C-H", "      | |", "      H H"]
BUT2ENE = ["  H H H H", "  | | | |", "H-C-C=C-C-H", "  |     |", "  H     H"]
PROPAN1OL = ["  H H H", "  | | |", "H-C-C-C-O-H", "  | | |", "  H H H"]
PROPAN2OL = ["    H", "    |", "  H O H", "  | | |", "H-C-C-C-H", "  | | |", "  H H H"]
ETHYL_ETHANOATE = ["  H O   H H", '  | "   | |', "H-C-C-O-C-C-H", "  |     | |", "  H     H H"]
POLY_ETHENE = ["  H H", "  | |", "[-C-C-]n", "  | |", "  H H"]
PROPENE = ["H H", "| |", "C=C", "| |", "H M"]
POLY_PROPENE = ["  H H", "  | |", "[-C-C-]n", "  | |", "  H M"]
CHLOROETHENE = ["H H", "| |", "C=C", "| |", "H L"]
POLY_CHLOROETHENE = ["  H H", "  | |", "[-C-C-]n", "  | |", "  H L"]
DIACID = ["    O   O", '    "   "', "H-O-C-X-C-O-H"]
DIAMINE = ["  H   H", "  |   |", "H-N-X-N-H"]
DIOL = ["H-O-X-O-H"]
NYLON = ["  O   O H   H", '  "   " |   |', "[-C-X-C-N-X-N-]n"]
PET = ["  O   O", '  "   "', "[-C-X-C-O-X-O-]n"]
AMINO_ACID = ["  H H O", '  | | "', "H-N-C-C-O-H", "    |", "    R"]
PROTEIN = [" H H O H H O", ' | | " | | "', "-N-C-C-N-C-C-", "   |     |", "   R     R"]


def fig_column():
    fractions = ["refinery gas", "gasoline (petrol)", "naphtha", "kerosene (paraffin)",
                 "diesel oil (gas oil)", "fuel oil", "lubricating oil", "bitumen"]
    s = ('<defs><linearGradient id="hot" x1="0" y1="1" x2="0" y2="0">'
         '<stop offset="0" stop-color="#f8c9c4"/><stop offset="1" stop-color="#d6e4f7"/>'
         '</linearGradient></defs>')
    x0, x1, top, bot = 110, 170, 16, 300
    s += f'<rect x="{x0}" y="{top}" width="{x1-x0}" height="{bot-top}" rx="10" fill="url(#hot)" ' \
         f'stroke="{INK}" stroke-width="1.6"/>'
    ys = [top + 14 + i * 37 for i in range(8)]
    ys[-1] = bot - 6
    for i, (name, y) in enumerate(zip(fractions, ys)):
        if i == 0:
            s += f'<path d="M140,{top} L140,{top-8} L190,{top-8}" fill="none" stroke="{INK}" stroke-width="1.6"/>'
            s += text(196, top - 4, name, 12.5, anchor="start")
            continue
        if i == 7:
            s += f'<path d="M140,{bot} L140,{bot+10} L190,{bot+10}" fill="none" stroke="{INK}" stroke-width="1.6"/>'
            s += text(196, bot + 14, name, 12.5, anchor="start")
            continue
        s += f'<line x1="{x1}" y1="{y}" x2="190" y2="{y}" stroke="{INK}" stroke-width="1.6"/>'
        s += text(196, y + 4, name, 12.5, anchor="start")
    # trays
    for y in ys[1:-1]:
        s += f'<line x1="{x0+4}" y1="{y+6}" x2="{x1-4}" y2="{y+6}" stroke="#777" stroke-width="1" stroke-dasharray="3,2"/>'
    # furnace + inlet
    s += f'<rect x="8" y="250" width="64" height="40" rx="4" fill="#ffe0b2" stroke="{INK}" stroke-width="1.4"/>'
    s += text(40, 266, "crude oil", 11.5) + text(40, 280, "heated", 11.5)
    s += f'<path d="M72,262 L{x0},262" stroke="{INK}" stroke-width="1.6" marker-end="url(#ah)"/>'
    s += text(88, 246, "vapour", 11, color="#555")
    # temperature labels
    s += text(78, 40, "cooler", 12, color="#1d3c8c") + text(78, 225, "hotter", 12, color="#c62828")
    s += f'<path d="M78,210 L78,52" stroke="#777" stroke-width="1.2" marker-end="url(#ah)"/>'
    return svg(330, 320, s, width_mm=74)


# ---------------- content ----------------

STYLE = """<style>
.eq { white-space: nowrap; }
.eqs { font-size: 11pt; line-height: 1.7; }
.mol { display: inline-block; margin: 2px 10px 4px 0; vertical-align: top; }
.mol figcaption { margin-top: 0; }
.mols { text-align: center; break-inside: avoid; }
.cond { color: #1d3c8c; font-size: 9.5pt; }
table.br { break-inside: auto; }
table.br tr { break-inside: avoid; }
.big { font-size: 15pt; vertical-align: middle; padding: 0 6px; }
</style>"""


def arrow(cond=""):
    c = f'<span class="cond">{cond}</span><br>' if cond else ""
    return f'<span class="big" style="display:inline-block;text-align:center;line-height:1">{c}&rarr;</span>'


BODY = STYLE + f"""
<h1>Topic 11 &nbsp;Organic Chemistry</h1>
<div class="meta">Cambridge IGCSE Chemistry 0620 &middot; Extended &middot; Sections 1&ndash;3 match
the SaveMyExams sub-topics, so you can do their questions after each one</div>

<h2><span class="num">1</span>Formulae, Functional Groups &amp; Terminology</h2>

<h3>Organic formulae</h3>
<p>A <b>hydrocarbon</b> is <span class="hl">a compound that contains hydrogen and carbon only</span>.
Ethanol (C<sub>2</sub>H<sub>5</sub>OH) is <i>not</i> a hydrocarbon &mdash; it contains oxygen.</p>
<div class="row">
<div>
<table class="k">
<tr><th>Formula type</th><th>What it shows</th><th>Ethanol</th></tr>
<tr><td>Molecular</td><td>number of each type of atom</td><td>{f("C2H6O")}</td></tr>
<tr><td>General</td><td>formula for a whole series</td><td>C<sub>n</sub>H<sub>2n+1</sub>OH</td></tr>
<tr><td>Structural</td><td>an <b>unambiguous</b> description of how the atoms are arranged</td>
<td>{f("CH3CH2OH")}</td></tr>
<tr><td>Displayed</td><td><b>all</b> the atoms and <b>all</b> the bonds</td><td>see right &rarr;</td></tr>
</table>
<p class="small">More structural formulae: CH<sub>2</sub>=CH<sub>2</sub> (ethene),
CH<sub>3</sub>COOCH<sub>3</sub> (methyl ethanoate).</p>
</div>
<div style="flex:0 0 46mm; text-align:center">{figmol(ETHANOL, "ethanol, displayed")}</div>
</div>

<h3>Homologous series</h3>
<div class="box def"><span class="lbl">Definitions</span>
<b>Homologous series</b> &ndash; <span class="hl">a family of similar compounds with similar chemical
properties due to the presence of the same functional group.</span><br>
<b>Functional group</b> &ndash; <span class="hl">an atom or group of atoms that determine the chemical
properties of a homologous series.</span></div>
<p><b>General characteristics of a homologous series:</b> same functional group &middot; same general
formula &middot; each member differs from the next by a <b>&ndash;CH<sub>2</sub>&ndash;</b> unit &middot;
a <b>trend in physical properties</b> (e.g. boiling point rises as the chain gets longer) &middot;
<b>similar chemical properties</b>.</p>
<table class="k">
<tr><th>Series</th><th>Functional group</th><th>General formula</th><th>Name ends</th><th>Example</th></tr>
<tr><td>Alkanes</td><td>C&ndash;C single bonds only</td><td>C<sub>n</sub>H<sub>2n+2</sub></td><td>-ane</td><td>methane {f("CH4")}</td></tr>
<tr><td>Alkenes</td><td>C=C</td><td>C<sub>n</sub>H<sub>2n</sub></td><td>-ene</td><td>ethene {f("C2H4")}</td></tr>
<tr><td>Alcohols</td><td>&ndash;OH</td><td>C<sub>n</sub>H<sub>2n+1</sub>OH</td><td>-ol</td><td>ethanol {f("C2H5OH")}</td></tr>
<tr><td>Carboxylic acids</td><td>&ndash;COOH</td><td>C<sub>n</sub>H<sub>2n+1</sub>COOH</td><td>-oic acid</td><td>ethanoic acid {f("CH3COOH")}</td></tr>
<tr><td>Esters</td><td>&ndash;COO&ndash;</td><td>&mdash;</td><td>-yl &hellip;-oate</td><td>ethyl ethanoate {f("CH3COOC2H5")}</td></tr>
</table>

<h3>Saturated &amp; unsaturated compounds</h3>
<div class="box def"><span class="lbl">Definitions</span>
<b>Saturated</b> &ndash; <span class="hl">molecules in which all carbon&ndash;carbon bonds are single
bonds</span> (e.g. alkanes).<br>
<b>Unsaturated</b> &ndash; <span class="hl">molecules in which one or more carbon&ndash;carbon bonds are
not single bonds</span> (e.g. alkenes, with C=C).</div>
<p>Test: <b>aqueous bromine</b> (bromine water) turns from <b>orange to colourless</b> with an
unsaturated compound; it stays orange with a saturated one (see Alkenes).</p>

<h3>Naming organic compounds</h3>
<div class="row">
<div style="flex:0 0 44mm">
<table class="k c">
<tr><th>Carbons</th><th>Prefix</th></tr>
<tr><td>1</td><td>meth-</td></tr><tr><td>2</td><td>eth-</td></tr>
<tr><td>3</td><td>prop-</td></tr><tr><td>4</td><td>but-</td></tr>
</table>
</div>
<div>
<ul>
<li><b>Name = prefix (number of C atoms in the chain) + ending (the series).</b></li>
<li>Count <b>every</b> carbon, including the one in &ndash;COOH: ethan<b>oic</b> acid, CH<sub>3</sub>COOH,
has 2.</li>
<li>A number shows <b>where</b> the C=C or &ndash;OH is: count from the end of the chain nearest to it.
But-<b>1</b>-ene has C=C starting at carbon 1; propan-<b>2</b>-ol has &ndash;OH on carbon 2.</li>
</ul>
</div>
</div>
<table class="k br">
<tr><th style="width:6%">C</th><th>Alkane</th><th>Alkene</th><th>Alcohol</th><th>Carboxylic acid</th></tr>
<tr><td>1</td><td>methane {f("CH4")}</td><td>&mdash;</td><td>methanol {f("CH3OH")}</td><td>methanoic acid HCOOH</td></tr>
<tr><td>2</td><td>ethane {f("CH3CH3")}</td><td>ethene {f("CH2=CH2")}</td><td>ethanol {f("CH3CH2OH")}</td><td>ethanoic acid {f("CH3COOH")}</td></tr>
<tr><td>3</td><td>propane {f("CH3CH2CH3")}</td><td>propene {f("CH2=CHCH3")}</td>
<td>propan-1-ol {f("CH3CH2CH2OH")}<br>propan-2-ol {f("CH3CH(OH)CH3")}</td><td>propanoic acid {f("CH3CH2COOH")}</td></tr>
<tr><td>4</td><td>butane {f("CH3CH2CH2CH3")}</td><td>but-1-ene {f("CH2=CHCH2CH3")}<br>but-2-ene {f("CH3CH=CHCH3")}</td>
<td>butan-1-ol {f("CH3CH2CH2CH2OH")}<br>butan-2-ol {f("CH3CH(OH)CH2CH3")}</td><td>butanoic acid {f("CH3CH2CH2COOH")}</td></tr>
</table>

<div class="mols">
{figmol(METHANE, "methane")}{figmol(ETHANE, "ethane")}{figmol(ETHENE, "ethene")}{figmol(ETHANOIC, "ethanoic acid")}{figmol(PROPAN1OL, "propan-1-ol")}{figmol(PROPAN2OL, "propan-2-ol")}
</div>

<div class="keep">
<h3>Structural isomers</h3>
<div class="box def"><span class="lbl">Definition</span>
<b>Structural isomers</b> &ndash; <span class="hl">compounds with the same molecular formula but different
structural formulae.</span></div>
<div class="mols">
{figmol(BUTANE, "butane, CH₃CH₂CH₂CH₃")}{figmol(METHYLPROPANE, "methylpropane, CH₃CH(CH₃)CH₃")}
{figmol(BUT1ENE, "but-1-ene, CH₃CH₂CH=CH₂")}{figmol(BUT2ENE, "but-2-ene, CH₃CH=CHCH₃")}
</div>
<p class="small" style="text-align:center">Both pairs: same molecular formula (C<sub>4</sub>H<sub>10</sub>;
C<sub>4</sub>H<sub>8</sub>), different arrangement. Propan-1-ol and propan-2-ol (above) are isomers
too.</p>
</div>

<h2><span class="num">2</span>Organic Families</h2>

<h3>Fossil fuels</h3>
<ul>
<li>The fossil fuels are <b>coal, natural gas and petroleum</b> (crude oil).</li>
<li><b>Methane</b> is the main constituent of natural gas.</li>
<li>Petroleum is a <b>mixture of hydrocarbons</b>, separated into useful <b>fractions</b> by
<span class="hl">fractional distillation</span>.</li>
</ul>
<div class="row">
<figure style="flex:0 0 76mm">{fig_column()}</figure>
<div>
<ol>
<li>Petroleum is heated so it turns into vapour, which enters the column near the bottom.</li>
<li>The column is <b>hot at the bottom and cooler at the top</b>.</li>
<li>Vapours rise. Each fraction <b>condenses</b> at the height where the temperature falls below its
boiling point, and is collected there.</li>
<li>Small molecules (low boiling points) reach the top; bitumen (very high boiling point) is collected
at the bottom.</li>
</ol>
<div class="box exam"><span class="lbl">From the bottom to the top of the column</span>
chain length <b>decreases</b> &middot; volatility <b>increases</b> &middot; boiling point
<b>decreases</b> &middot; viscosity <b>decreases</b></div>
</div>
</div>
<table class="k br">
<tr><th style="width:28%">Fraction (top &rarr; bottom)</th><th>Use</th></tr>
<tr><td>refinery gas</td><td>gas for heating and cooking</td></tr>
<tr><td>gasoline / petrol</td><td>fuel for cars</td></tr>
<tr><td>naphtha</td><td>chemical feedstock (raw material for making other chemicals)</td></tr>
<tr><td>kerosene / paraffin</td><td>jet fuel</td></tr>
<tr><td>diesel oil / gas oil</td><td>fuel for diesel engines</td></tr>
<tr><td>fuel oil</td><td>fuel for ships and home heating systems</td></tr>
<tr><td>lubricating oil</td><td>lubricants, waxes and polishes</td></tr>
<tr><td>bitumen</td><td>making roads</td></tr>
</table>
<p class="small">Order follows the Cambridge syllabus list. Some textbooks swap fuel oil and lubricating
oil &mdash; check your teacher&rsquo;s diagram.</p>

<h3>Alkanes</h3>
<p>Alkanes are <span class="hl">saturated hydrocarbons</span>: all their bonds are <b>single covalent
bonds</b>. They are <b>generally unreactive</b>, except for <b>combustion</b> and <b>substitution by
chlorine</b>.</p>
<div class="row">
<div>
<p><b>Combustion</b></p>
<p class="eqs">complete: {eq("CH4 + 2O2 → CO2 + 2H2O")}<br>
incomplete: {eq("2CH4 + 3O2 → 2CO + 4H2O")}<br>
<span class="small">(very little oxygen can also give soot: {eq("CH4 + O2 → C + 2H2O")})</span></p>
</div>
<div>
<div class="box def" style="margin-top:0"><span class="lbl">Substitution</span>
<b>Substitution reaction</b> &ndash; <span class="hl">one atom or group of atoms is replaced by another
atom or group of atoms.</span></div>
</div>
</div>
<p><b>Substitution with chlorine</b> is a <b>photochemical reaction</b>: <span class="hl">ultraviolet
light provides the activation energy</span>. One H is replaced by Cl:</p>
<div class="mols">
{figmol(METHANE, "methane")}<span class="big">+ Cl<sub>2</sub></span>{arrow("UV light")}
{figmol(CHLOROMETHANE, "chloromethane")}<span class="big">+ HCl</span>
</div>
<p class="eqs" style="text-align:center">{eq("CH4 + Cl2 → CH3Cl + HCl")} &nbsp;&nbsp;&nbsp;
{eq("C2H6 + Cl2 → C2H5Cl + HCl")} (chloroethane)</p>

<h3>Alkenes</h3>
<p>Alkenes contain a <b>C=C double covalent bond</b>, so they are <span class="hl">unsaturated
hydrocarbons</span>.</p>
<div class="box def"><span class="lbl">Cracking</span>
Alkenes (and hydrogen) are made by <b>cracking</b>: breaking <b>larger alkane molecules</b> into smaller
ones using a <span class="hl">high temperature (550&nbsp;&deg;C) and a catalyst</span>.<br>
<span class="eqs">{eq("C10H22 → C8H18 + C2H4")} &nbsp;&nbsp; (alkane &rarr; smaller alkane + alkene)<br>
{eq("C2H6 → C2H4 + H2")} &nbsp;&nbsp; (alkane &rarr; alkene + hydrogen)</span></div>
<div class="box exam"><span class="lbl">Why crack? (common 2&ndash;3 mark question)</span>
<b>1.</b> Fractional distillation gives more large alkanes than are needed, and not enough of the
smaller, more useful ones such as petrol &mdash; cracking <b>matches supply to demand</b>.<br>
<b>2.</b> It produces <b>alkenes</b>, used to make polymers and ethanol.<br>
<b>3.</b> It produces <b>hydrogen</b>, which can be used as a fuel.</div>
<div class="box def"><span class="lbl">Test: saturated or unsaturated?</span>
Add <b>aqueous bromine</b> (bromine water) and shake. Alkene (unsaturated): <b>orange &rarr;
colourless</b>. Alkane (saturated): <b>stays orange</b>.</div>

<h3>Addition reactions</h3>
<p>In an <b>addition reaction</b> <span class="hl">only one product is formed</span>. The C=C opens up
and the atoms add across it.</p>
<table class="k br">
<tr><th style="width:18%">Add</th><th style="width:30%">Conditions</th><th>Equation (with ethene)</th><th>Product</th></tr>
<tr><td>Bromine</td><td>room temperature (bromine or aqueous bromine)</td><td>{eq("C2H4 + Br2 → C2H4Br2")}</td><td>1,2-dibromoethane</td></tr>
<tr><td>Hydrogen</td><td><b>nickel catalyst</b>, heated</td><td>{eq("C2H4 + H2 → C2H6")}</td><td>ethane</td></tr>
<tr><td>Steam (H<sub>2</sub>O)</td><td><b>acid catalyst</b> (phosphoric acid), 300&nbsp;&deg;C, 60&nbsp;atm (6000&nbsp;kPa)</td><td>{eq("C2H4 + H2O → C2H5OH")}</td><td>ethanol</td></tr>
</table>
<div class="mols">
{figmol(ETHENE, "ethene")}<span class="big">+ Br<sub>2</sub></span>{arrow()}{figmol(DIBROMOETHANE, "1,2-dibromoethane")}
&nbsp;&nbsp;&nbsp;{figmol(ETHENE, "ethene")}<span class="big">+ H<sub>2</sub>O</span>{arrow("acid cat.")}{figmol(ETHANOL, "ethanol")}
</div>
<p class="small">Other alkenes do the same: propene + Br<sub>2</sub> &rarr; 1,2-dibromopropane,
CH<sub>3</sub>CHBrCH<sub>2</sub>Br.</p>

<h3>Alcohols</h3>
<p>Ethanol is used as a <b>solvent</b> and as a <b>fuel</b>. It burns completely to carbon dioxide and
water: <span class="eqs">{eq("C2H5OH + 3O2 → 2CO2 + 3H2O")}</span></p>
<table class="k">
<tr><th style="width:18%"></th><th>Fermentation</th><th>Catalytic addition of steam to ethene</th></tr>
<tr><td>Equation</td><td>{eq("C6H12O6 → 2C2H5OH + 2CO2")}</td><td>{eq("C2H4 + H2O → C2H5OH")}</td></tr>
<tr><td>Conditions</td><td>aqueous glucose, <b>yeast</b>, <b>25&ndash;35&nbsp;&deg;C</b>, <b>no oxygen</b></td>
<td><b>300&nbsp;&deg;C</b>, <b>6000&nbsp;kPa / 60&nbsp;atm</b>, <b>acid catalyst</b></td></tr>
<tr><td>Advantages</td><td>uses <b>renewable</b> raw materials (sugar from crops); low temperature, so
less energy needed</td><td><b>fast</b>, <b>continuous</b> process; produces <b>pure</b> ethanol;
high yield</td></tr>
<tr><td>Disadvantages</td><td><b>slow</b>, batch process; ethanol is <b>impure</b> (dilute, must be
separated by fractional distillation); needs land for crops</td><td>ethene comes from petroleum &mdash;
<b>non-renewable</b>; high temperature and pressure need a lot of energy</td></tr>
</table>
<p class="small">Why no oxygen in fermentation? With oxygen, the ethanol is oxidised to ethanoic acid.
Why 25&ndash;35&nbsp;&deg;C? Too cold is too slow; too hot denatures the enzymes in the yeast.</p>

<h3>Carboxylic acids</h3>
<p>Ethanoic acid is a <b>weak acid</b>. It reacts like other acids, forming salts called
<b>ethanoates</b>:</p>
<table class="k">
<tr><th style="width:18%">With</th><th>Equation</th><th>Salt formed</th></tr>
<tr><td>metal</td><td>{eq("2CH3COOH + Mg → (CH3COO)2Mg + H2")}</td><td>magnesium ethanoate</td></tr>
<tr><td>base</td><td>{eq("CH3COOH + NaOH → CH3COONa + H2O")}</td><td>sodium ethanoate</td></tr>
<tr><td>carbonate</td><td>{eq("2CH3COOH + Na2CO3 → 2CH3COONa + H2O + CO2")}</td><td>sodium ethanoate</td></tr>
</table>
<p><b>Making ethanoic acid by oxidising ethanol:</b></p>
<ul>
<li>with <b>acidified aqueous potassium manganate(VII)</b> (purple &rarr; colourless):
{eq("C2H5OH + 2[O] → CH3COOH + H2O")}</li>
<li>by <b>bacterial oxidation</b> during vinegar production (oxygen from the air):
{eq("C2H5OH + O2 → CH3COOH + H2O")}</li>
</ul>

<h3>Ethanoic acid &amp; esterification reactions</h3>
<p>A carboxylic acid reacts with an alcohol, using an <b>acid catalyst</b> (concentrated sulfuric
acid) and heat, to form an <span class="hl">ester and water</span>:</p>
<div class="mols">
{figmol(ETHANOIC, "ethanoic acid", 0.22)}<span class="big">+</span>{figmol(ETHANOL, "ethanol", 0.22)}{arrow("conc. H₂SO₄")}
{figmol(ETHYL_ETHANOATE, "ethyl ethanoate", 0.22, hl=[(0, 4, 2, 6)])}<span class="big">+ H<sub>2</sub>O</span>
</div>
<p class="eqs" style="text-align:center">{eq("CH3COOH + C2H5OH ⇌ CH3COOC2H5 + H2O")}</p>
<div class="row">
<div class="box exam"><span class="lbl">Naming esters</span>
<b>Alcohol part first</b> (-ol &rarr; <b>-yl</b>), then <b>acid part</b> (-oic acid &rarr;
<b>-oate</b>).<br>
ethan<b>ol</b> + ethan<b>oic acid</b> &rarr; eth<b>yl</b> ethan<b>oate</b>.<br>
But the formula is written <b>acid part first</b>: CH<sub>3</sub>COO&ndash;C<sub>2</sub>H<sub>5</sub>.</div>
<div>
<table class="k">
<tr><th>Alcohol + acid</th><th>Ester</th></tr>
<tr><td>methanol + ethanoic acid</td><td>methyl ethanoate {f("CH3COOCH3")}</td></tr>
<tr><td>ethanol + methanoic acid</td><td>ethyl methanoate {f("HCOOC2H5")}</td></tr>
<tr><td>methanol + propanoic acid</td><td>methyl propanoate {f("CH3CH2COOCH3")}</td></tr>
<tr><td>propan-1-ol + ethanoic acid</td><td>propyl ethanoate {f("CH3COOCH2CH2CH3")}</td></tr>
<tr><td>butan-1-ol + ethanoic acid</td><td>butyl ethanoate {f("CH3COOCH2CH2CH2CH3")}</td></tr>
</table>
</div>
</div>

<h2><span class="num">3</span>Polymers</h2>

<h3>Polymers</h3>
<div class="box def"><span class="lbl">Definition</span>
<b>Polymers</b> &ndash; <span class="hl">large molecules built up from many smaller molecules called
monomers.</span> Plastics are made from polymers.</div>

<h3>Addition &amp; condensation polymers</h3>
<p><b>Addition polymerisation:</b> monomers with a <b>C=C</b> join together; each double bond opens up
and the polymer is the <b>only product</b>.</p>
<div class="mols">
<span class="big"><i>n</i></span>{figmol(ETHENE, "ethene")}{arrow()}{figmol(POLY_ETHENE, "poly(ethene)")}
&nbsp;&nbsp;&nbsp;
<span class="big"><i>n</i></span>{figmol(PROPENE, "propene")}{arrow()}{figmol(POLY_PROPENE, "poly(propene)")}
&nbsp;&nbsp;&nbsp;
<span class="big"><i>n</i></span>{figmol(CHLOROETHENE, "chloroethene")}{arrow()}{figmol(POLY_CHLOROETHENE, "poly(chloroethene)")}
</div>
<div class="box exam"><span class="lbl">Deducing repeat unit &harr; monomer</span>
<b>Monomer &rarr; repeat unit:</b> draw the two C=C carbons with their groups, change C=C to C&ndash;C,
add a bond sticking out on each side through brackets, and an <i>n</i>.<br>
<b>Repeat unit &rarr; monomer:</b> remove the brackets, <i>n</i> and the outer bonds, and put back the
C=C between the two carbons.</div>

<p><b>Condensation polymerisation:</b> two different monomers, each with <b>two functional groups</b>,
join together and a <span class="hl">small molecule (water) is formed</span> at every link. The boxes
below stand for chains of carbon atoms.</p>
<table class="k br">
<tr><th style="width:15%">Polymer</th><th>Monomers</th><th>Repeat unit</th></tr>
<tr><td>Nylon<br><span class="small">a polyamide</span></td>
<td>{mol(DIACID, 0.22)}<br><span class="small">dicarboxylic acid</span><br>{mol(DIAMINE, 0.22)}<br><span class="small">diamine</span></td>
<td>{mol(NYLON, 0.24, hl=[(0, 6, 2, 8)])}<br><span class="small"><b>amide linkage</b> &ndash;CONH&ndash; (shaded)</span></td></tr>
<tr><td>PET<br><span class="small">a polyester</span></td>
<td>{mol(DIACID, 0.22)}<br><span class="small">dicarboxylic acid</span><br>{mol(DIOL, 0.22)}<br><span class="small">diol</span></td>
<td>{mol(PET, 0.24, hl=[(0, 6, 2, 8)])}<br><span class="small"><b>ester linkage</b> &ndash;COO&ndash; (shaded)</span></td></tr>
</table>
<p>PET can be <b>converted back into its monomers</b> and re-polymerised, so it can be recycled.</p>

<div class="row">
<div>
<p><b>Proteins</b> are <span class="hl">natural polyamides</span>, formed from <b>amino acid</b>
monomers. They have the same amide linkage as nylon; R is a different group in each amino acid.</p>
<div class="mols">{figmol(AMINO_ACID, "amino acid, H₂N–CHR–COOH")}</div>
</div>
<div class="mols" style="flex:0 0 80mm">{figmol(PROTEIN, "part of a protein chain", 0.26, hl=[(0, 2, 2, 3), (0, 6, 2, 7)])}</div>
</div>

<table class="k">
<tr><th style="width:18%"></th><th>Addition polymerisation</th><th>Condensation polymerisation</th></tr>
<tr><td>Monomers</td><td>contain a C=C double bond</td><td>each has two functional groups (&ndash;COOH,
&ndash;NH<sub>2</sub>, &ndash;OH); usually two different monomers</td></tr>
<tr><td>Products</td><td><b>polymer only</b></td><td>polymer <b>+ a small molecule (water)</b></td></tr>
<tr><td>Linkage</td><td>C&ndash;C chain</td><td>amide &ndash;CONH&ndash; or ester &ndash;COO&ndash;</td></tr>
<tr><td>Examples</td><td>poly(ethene), poly(propene), poly(chloroethene)</td><td>nylon, PET, proteins</td></tr>
</table>

<h3>Plastics &amp; their disposal</h3>
<table class="k">
<tr><th style="width:28%">Problem</th><th>Why</th></tr>
<tr><td>Disposal in landfill sites</td><td>Most plastics are <b>non-biodegradable</b>, so they stay in
landfill for a very long time and take up land.</td></tr>
<tr><td>Accumulation in oceans</td><td>Plastics don&rsquo;t break down, so they build up in the oceans and
harm aquatic life.</td></tr>
<tr><td>Burning</td><td>Forms <b>toxic gases</b> (and adds CO<sub>2</sub>, a greenhouse gas).</td></tr>
</table>

<div class="box warn"><span class="lbl">Watch out &mdash; marks often lost in this topic</span>
<ul>
<li>Bromine water goes <b>colourless</b>, not &ldquo;clear&rdquo; (clear can still be coloured).</li>
<li>Displayed formulae must show <b>every</b> bond, including O&ndash;H; every carbon has exactly 4
bonds.</li>
<li>Cracking needs a <b>catalyst and a high temperature</b>. It breaks molecules (chemical change);
fractional distillation only separates them (physical).</li>
<li>Chlorine + alkane needs <b>UV light</b> and is <b>substitution</b> (2 products). Bromine + alkene is
<b>addition</b> (1 product).</li>
<li>Ester names: alcohol part first (ethyl), acid part second (ethanoate).</li>
<li>Addition polymerisation: <b>no</b> water formed. Condensation: water formed at every link.</li>
<li>Fermentation must be done <b>without oxygen</b>.</li>
</ul></div>

<div class="keep">
<h3>Self-check before the topic questions</h3>
<ul class="check">
<li>Draw displayed formulae and write structural, molecular and general formulae</li>
<li>Define homologous series, functional group, saturated, unsaturated, structural isomers</li>
<li>Name and draw unbranched alkanes, alkenes, alcohols and carboxylic acids up to 4 carbons</li>
<li>Name and draw esters made from these alcohols and acids</li>
<li>Describe fractional distillation, the trends up the column and the use of each fraction</li>
<li>Write combustion and substitution (UV) equations for alkanes</li>
<li>Describe cracking (conditions, equations, reasons) and the bromine water test</li>
<li>Describe addition of bromine, hydrogen (Ni) and steam (acid catalyst) to alkenes</li>
<li>Compare fermentation and the hydration of ethene, with conditions, pros and cons</li>
<li>Write reactions of ethanoic acid with metals, bases and carbonates; describe its formation by oxidation</li>
<li>Describe esterification and draw an ester</li>
<li>Deduce addition polymer repeat units and monomers; draw nylon, PET and a protein</li>
<li>Compare addition and condensation polymerisation; explain the problems of plastic disposal</li>
</ul>
</div>
"""

if __name__ == "__main__":
    out = "/tmp/chem_parts/topic11.pdf"
    preview = sys.argv[1] if len(sys.argv) > 1 else None
    render(TITLE, BODY, out, preview_dir=preview)
