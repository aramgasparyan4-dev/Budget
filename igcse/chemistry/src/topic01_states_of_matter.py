"""Chemistry Topic 1 - States of Matter (Cambridge IGCSE 0620, Extended)."""
import pathlib
import random
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from notes import render, svg, text, INK  # noqa: E402

TITLE = "Chemistry 0620 - Topic 1: States of Matter"

PART = "#e3f2fd"


# ---------------- diagrams ----------------

def particle(x, y, r=8):
    return (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{PART}" stroke="{INK}" '
            f'stroke-width="1.2"/>')


def box(x, y, w, h):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" stroke="{INK}" '
            f'stroke-width="1.6"/>')


def mini_arrow(x, y, dx, dy):
    return (f'<path d="M{x:.1f},{y:.1f} L{x+dx:.1f},{y+dy:.1f}" stroke="#c62828" '
            f'stroke-width="1.3" marker-end="url(#ah)"/>')


def fig_particles():
    s = ""
    # solid: regular, touching
    ox, oy = 20, 20
    s += box(ox, oy, 120, 100)
    for r in range(5):
        for c in range(6):
            s += particle(ox + 15 + c * 18, oy + 20 + r * 17)
    s += text(ox + 60, oy + 122, "solid", 15)
    # liquid: random, mostly touching, fills bottom of box
    ox = 175
    s += box(ox, oy, 120, 100)
    random.seed(7)
    pts = []
    for r in range(4):
        for c in range(6):
            if (r, c) in {(0, 1), (0, 4), (1, 2)}:
                continue
            x = ox + 14 + c * 18.5 + (6 if r % 2 else 0) + random.uniform(-2, 2)
            y = oy + 91 - r * 16.5 + random.uniform(-1.5, 1.5)
            if x > ox + 110:
                continue
            pts.append((x, y))
    for x, y in pts:
        s += particle(x, y)
    s += text(ox + 60, oy + 122, "liquid", 15)
    # gas: far apart, fast, random directions
    ox = 330
    s += box(ox, oy, 120, 100)
    gas = [(20, 18, 14, 8), (70, 22, -12, 10), (100, 55, 10, -12), (45, 60, -14, -6),
           (22, 85, 12, 6), (80, 88, 14, -4), (105, 15, -6, 14)]
    for x, y, dx, dy in gas:
        s += particle(ox + x, oy + y) + mini_arrow(ox + x + dx * 0.7, oy + y + dy * 0.7, dx, dy)
    s += text(ox + 60, oy + 122, "gas", 15)
    return svg(470, 150, s, width_mm=128)


def fig_changes():
    s = ""
    for x, label in ((60, "SOLID"), (250, "LIQUID"), (440, "GAS")):
        s += (f'<rect x="{x-45}" y="38" width="90" height="34" rx="6" fill="{PART}" '
              f'stroke="{INK}" stroke-width="1.4"/>') + text(x, 61, label, 15)
    # forward arrows (top) and reverse (bottom)
    for x1, x2, top, bot in ((105, 205, "melting", "freezing"),
                             (295, 395, "boiling / evaporating", "condensing")):
        s += (f'<path d="M{x1+4},46 L{x2-4},46" stroke="{INK}" stroke-width="1.6" '
              f'marker-end="url(#ah)"/>')
        s += (f'<path d="M{x2-4},64 L{x1+4},64" stroke="{INK}" stroke-width="1.6" '
              f'marker-end="url(#ah)"/>')
        s += text((x1 + x2) / 2, 30, top, 13)
        s += text((x1 + x2) / 2, 90, bot, 13)
    s += text(250, 14, "energy taken in  →", 12, color="#c62828")
    s += text(250, 112, "←  energy given out", 12, color="#1d3c8c")
    return svg(500, 120, s, width_mm=120)


def fig_heating_curve():
    # data space: time 0..10, temp -30..140
    X0, Y0, W, H = 52, 200, 400, 175

    def P(t, T):
        return X0 + t / 10 * W, Y0 - (T + 30) / 170 * H

    s = (f'<path d="M{X0},{Y0} L{X0},{Y0-H-8}" stroke="{INK}" stroke-width="1.6" '
         f'marker-end="url(#ah)"/>'
         f'<path d="M{X0},{Y0} L{X0+W+10},{Y0}" stroke="{INK}" stroke-width="1.6" '
         f'marker-end="url(#ah)"/>')
    s += text(X0 + W / 2, Y0 + 22, "time (heated at a steady rate)", 13)
    s += text(18, Y0 - H / 2, "temperature", 13, extra=f'transform="rotate(-90 18 {Y0 - H / 2})"')
    pts = [(0, -20), (1, 0), (3, 0), (5, 100), (8.4, 100), (9.4, 130)]
    d = " ".join(f"{'M' if i == 0 else 'L'}{P(*p)[0]:.1f},{P(*p)[1]:.1f}" for i, p in enumerate(pts))
    s += f'<path d="{d}" fill="none" stroke="#1d3c8c" stroke-width="2.6" stroke-linejoin="round"/>'
    # dashed guide lines for m.p. and b.p.
    for T, lab in ((0, "m.p."), (100, "b.p.")):
        y = P(0, T)[1]
        s += (f'<path d="M{X0},{y:.1f} L{P(1 if T == 0 else 5, T)[0]:.1f},{y:.1f}" stroke="#999" '
              f'stroke-dasharray="4,3" stroke-width="1"/>')
        s += text(X0 - 6, y + 4, lab, 12, anchor="end")
    labels = [((0.5, -10), "solid", 12, 16, 16),
              ((2, 0), "melting", 12, 0, -18), ((2, 0), "(solid + liquid)", 11, 0, -6),
              ((4, 50), "liquid", 12, 22, 4),
              ((6.7, 100), "boiling", 12, 0, -18), ((6.7, 100), "(liquid + gas)", 11, 0, -6),
              ((8.9, 115), "gas", 12, 22, 4)]
    for (t, T), lab, size, dx, dy in labels:
        x, y = P(t, T)
        s += text(round(x + dx, 1), round(y + dy, 1), lab, size, color="#333")
    return svg(470, 230, s, width_mm=100)


def fig_diffusion():
    s = ""
    x1, x2, y = 70, 430, 40
    s += (f'<rect x="{x1}" y="{y}" width="{x2-x1}" height="30" rx="4" fill="#fafafa" '
          f'stroke="{INK}" stroke-width="1.6"/>')
    for x in (x1 + 2, x2 - 30):
        s += (f'<rect x="{x}" y="{y+3}" width="28" height="24" rx="8" fill="#fff" '
              f'stroke="#888" stroke-width="1" stroke-dasharray="2,2"/>')
    ring = x1 + 0.594 * (x2 - x1)
    s += (f'<rect x="{ring-5:.1f}" y="{y+1}" width="10" height="28" fill="#fff" stroke="{INK}" '
          f'stroke-width="1.2"/>')
    s += f'<path d="M{ring:.1f},{y+34} L{ring:.1f},{y+44}" stroke="{INK}" stroke-width="1"/>'
    s += text(round(ring, 1), y + 57, "white ring of ammonium chloride", 13)
    s += text(x1, y - 22, "cotton wool +", 12, anchor="start")
    s += text(x1, y - 8, "conc. ammonia", 12, anchor="start")
    s += text(x2, y - 22, "cotton wool +", 12, anchor="end")
    s += text(x2, y - 8, "conc. hydrochloric acid", 12, anchor="end")
    s += (f'<path d="M{x1+30},{y+72} L{ring-14:.1f},{y+72}" stroke="#1d3c8c" stroke-width="1.6" '
          f'marker-end="url(#ah)"/>')
    s += text(round((x1 + 30 + ring) / 2, 1), y + 90, "NH₃ (Mr 17) travels further", 12,
              color="#1d3c8c")
    s += (f'<path d="M{x2-30},{y+72} L{ring+14:.1f},{y+72}" stroke="#c62828" stroke-width="1.6" '
          f'marker-end="url(#ah)"/>')
    s += text(round((x2 - 30 + ring) / 2 + 8, 1), y + 90, "HCl (Mr 36.5)", 12, color="#c62828")
    return svg(500, 146, s, width_mm=125)


# ---------------- content ----------------

STYLE = """<style>.no { font-family: 'DejaVu Sans', sans-serif; color: #c62828; font-size: 90%; }</style>"""

BODY = STYLE + f"""
<h1>Topic 1 &nbsp;States of Matter</h1>
<div class="meta">Cambridge IGCSE Chemistry 0620 &middot; Extended &middot; Section 1 matches the
SaveMyExams sub-topic, so you can do their questions after it</div>

<h2><span class="num">1</span>Solids, Liquids &amp; Gases</h2>

<h3>Kinetic theory</h3>
<div class="box def"><span class="lbl">The kinetic particle theory</span>
All matter is made of <b>tiny particles</b> (atoms, molecules or ions) that are <span class="hl">always
moving</span>. The higher the temperature, the more <b>kinetic energy</b> the particles have and the faster
they move. The state of a substance depends on how strong the <b>forces of attraction</b> between its
particles are compared with how much energy the particles have.</div>

<figure>{fig_particles()}
<figcaption>Particle diagrams &mdash; exam diagrams need the right spacing: touching and regular (solid),
touching but random (liquid), far apart (gas).</figcaption></figure>

<h3>States of matter</h3>
<table class="k">
<tr><th></th><th>Solid</th><th>Liquid</th><th>Gas</th></tr>
<tr><td>Shape</td><td>fixed</td><td>takes the shape of its container</td><td>fills its container</td></tr>
<tr><td>Volume</td><td>fixed</td><td>fixed</td><td>no fixed volume</td></tr>
<tr><td>Compress?</td><td>no</td><td>no (only very slightly)</td><td><b>yes</b> &mdash; lots of space between particles</td></tr>
<tr><td>Flow?</td><td>no</td><td>yes</td><td>yes</td></tr>
<tr><td>Arrangement</td><td><b>regular</b> (lattice)</td><td><b>random</b></td><td><b>random</b></td></tr>
<tr><td>Separation</td><td>very close (touching)</td><td>close (touching)</td><td><b>far apart</b></td></tr>
<tr><td>Motion</td><td><b>vibrate</b> about fixed positions</td><td>move around / slide past each other</td>
<td>move <b>quickly and randomly</b> in all directions</td></tr>
<tr><td>Forces between particles</td><td>strong</td><td>weaker</td><td>very weak</td></tr>
</table>

<h3>Changes of state</h3>
<figure>{fig_changes()}</figure>
<table class="k">
<tr><th style="width:20%">Change</th><th>What happens to the particles</th></tr>
<tr><td>Melting</td><td>Heating gives particles more energy so they <b>vibrate more</b>. At the melting point
they have enough energy to <b>overcome some of the forces of attraction</b>, so they can move around each
other.</td></tr>
<tr><td>Boiling</td><td>At the boiling point particles have enough energy to <b>overcome the forces of
attraction</b> completely and escape. Bubbles of gas form <b>throughout</b> the liquid.</td></tr>
<tr><td>Evaporating</td><td>Liquid &rarr; gas <b>below</b> the boiling point, only at the <b>surface</b>:
the particles with the most energy escape. Faster at higher temperature and with a larger surface
area.</td></tr>
<tr><td>Condensing / freezing</td><td>Cooling: particles <b>lose energy</b> and slow down, so the forces of
attraction pull them closer together. Energy is <b>given out</b>.</td></tr>
</table>

<div class="row">
<div style="flex:0 0 102mm">
<figure style="margin-top:0">{fig_heating_curve()}<figcaption>Heating curve (e.g. ice &rarr; water &rarr;
steam). A cooling curve is the same shape in reverse.</figcaption></figure>
</div>
<div>
<h3 style="margin-top:2px">Heating and cooling curves</h3>
<p>The temperature rises when one state is being heated. It stays <span class="hl">constant</span> while the
state is changing (the flat parts).</p>
<div class="box exam"><span class="lbl">Why is the line flat? (common 2-mark question)</span>
The energy taken in is used to <b>overcome the forces of attraction</b> between the particles, not to
increase their kinetic energy, so the temperature does not rise.<br>
<span class="small">Cooling curve: the flat part is where energy is <b>released</b> as forces of attraction
form, which balances the heat lost.</span></div>
</div>
</div>

<div class="box def"><span class="lbl">Which state is it in at a given temperature?</span>
Below the melting point &rarr; <b>solid</b> &middot; between melting and boiling point &rarr; <b>liquid</b>
&middot; above the boiling point &rarr; <b>gas</b>.<br>
e.g. bromine: m.p. &minus;7 &deg;C, b.p. 59 &deg;C. At room temperature (25 &deg;C) it is between the two
&rarr; <b>liquid</b>. Careful with negatives: &minus;10 &deg;C is <i>below</i> &minus;7 &deg;C, so at
&minus;10 &deg;C bromine is solid.</div>

<h3>Pressure and temperature in gases</h3>
<p>Gas <b>pressure</b> is caused by gas particles <span class="hl">colliding with the walls of the
container</span>.</p>
<table class="k">
<tr><th style="width:27%">Change</th><th style="width:20%">Effect</th><th>Explanation (kinetic particle theory)</th></tr>
<tr><td>Temperature &uarr; (pressure kept the same)</td><td>volume <b>increases</b></td><td>Particles gain kinetic
energy and move faster, so they hit the walls <b>more often and with more force</b>. The gas expands until
the pressure is back to what it was.</td></tr>
<tr><td>Pressure &uarr; (temperature kept the same)</td><td>volume <b>decreases</b></td><td>The particles are
pushed <b>closer together</b> &mdash; gases can be compressed because there is lots of space between the
particles.</td></tr>
<tr><td>Temperature &uarr; in a sealed, fixed-volume container</td><td>pressure <b>increases</b></td><td>Particles
move faster and collide with the walls <b>more frequently and with more force</b>.</td></tr>
</table>

<h3>Diffusion</h3>
<div class="box def"><span class="lbl">Definition</span>
<b>Diffusion</b> &ndash; <span class="hl">the net movement of particles from an area of higher concentration
to an area of lower concentration, as a result of their random movement.</span></div>
<ul>
<li>Happens in <b>gases</b> (fast) and <b>liquids</b> (slower). Not in solids &mdash; the particles only
vibrate in fixed positions.</li>
<li>Examples: a smell spreading across a room; a purple potassium manganate(VII) crystal dissolving and
the colour spreading through water without stirring.</li>
<li><b>Higher temperature &rarr; faster diffusion</b> (particles have more kinetic energy).</li>
<li><span class="hl">Lower relative molecular mass &rarr; faster diffusion</span>: at the same temperature,
lighter particles move faster.</li>
</ul>
<figure>{fig_diffusion()}
<figcaption>NH<sub>3</sub>(g) + HCl(g) &rarr; NH<sub>4</sub>Cl(s). The white ring forms nearer the HCl end
because ammonia has the lower M<sub>r</sub>, so its molecules move faster and travel further in the same
time.</figcaption></figure>

<div class="box warn"><span class="lbl">Watch out</span>
<span class="no">&#10007;</span> &ldquo;Particles expand when heated&rdquo; &rarr; the particles stay the same size; the <b>spaces
between them</b> change.<br>
<span class="no">&#10007;</span> &ldquo;Particles in a solid don&rsquo;t move&rdquo; &rarr; they <b>vibrate</b> about fixed
positions.<br>
<span class="no">&#10007;</span> Diffusion answers without the word <b>random</b> movement, or without &ldquo;high to low
concentration&rdquo;.<br>
<span class="no">&#10007;</span> In the ammonia / HCl experiment, saying the heavier gas moves faster &mdash; it&rsquo;s the
<b>lighter</b> one (NH<sub>3</sub>).<br>
<span class="no">&#10007;</span> Mixing up boiling and evaporating: boiling happens at the boiling point throughout the liquid;
evaporation happens below it, at the surface only.</div>

<div class="keep">
<h3>Self-check before the topic questions</h3>
<ul class="check">
<li>Describe the properties of solids, liquids and gases (shape, volume, compressibility)</li>
<li>Describe and draw particle arrangement, separation and motion in each state</li>
<li>Name all the changes of state and explain each using particles and energy</li>
<li>Explain the flat sections of heating and cooling curves</li>
<li>Work out the state of a substance at a given temperature from its m.p. and b.p.</li>
<li>Describe and explain how temperature and pressure affect the volume of a gas</li>
<li>Define diffusion and explain the effect of temperature and of M<sub>r</sub> on its rate</li>
<li>Explain where the white ring forms in the ammonia / hydrogen chloride experiment</li>
</ul>
</div>
"""

if __name__ == "__main__":
    preview = sys.argv[1] if len(sys.argv) > 1 else None
    render(TITLE, BODY, "/tmp/chem_parts/topic01.pdf", preview_dir=preview)
