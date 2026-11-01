"""Chemistry - Practical Skills for Paper 6, Alternative to Practical (Cambridge IGCSE 0620)."""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from notes import render, svg, text, INK  # noqa: E402

TITLE = "Chemistry 0620 - Practical Skills (Paper 6)"

LBL = "#444"


def fig_burette():
    s = ""
    x0, x1 = 60, 92
    top, unit = 20, 9.0          # pixels per 0.1 cm3
    y = lambda v: top + (v - 23.6) * 10 * unit   # noqa: E731
    reading = 24.6
    ym = y(reading)
    # liquid below the meniscus
    s += (f'<path d="M{x0},{ym-5:.1f} Q{(x0+x1)/2},{ym+5:.1f} {x1},{ym-5:.1f} L{x1},{y(25.6):.1f} '
          f'L{x0},{y(25.6):.1f} Z" fill="#cfe3f7"/>')
    s += (f'<path d="M{x0},{ym-5:.1f} Q{(x0+x1)/2},{ym+5:.1f} {x1},{ym-5:.1f}" fill="none" '
          f'stroke="#1d3c8c" stroke-width="1.6"/>')
    s += (f'<path d="M{x0},{top-6} L{x0},{y(25.6):.1f} M{x1},{top-6} L{x1},{y(25.6):.1f}" '
          f'stroke="{INK}" stroke-width="1.8"/>')
    v = 23.7
    while v <= 25.55:
        yy = y(v)
        major = abs(v - round(v)) < 1e-6
        half = abs(v * 10 % 10 - 5) < 1e-6
        ln = 16 if major else (11 if half else 7)
        s += f'<path d="M{x1},{yy:.1f} L{x1-ln},{yy:.1f}" stroke="{INK}" stroke-width="1.1"/>'
        if major:
            s += text(x1 + 6, round(yy + 5, 1), f"{int(round(v))}", 14, anchor="start")
        v = round(v + 0.1, 1)
    # eye line
    s += (f'<path d="M{x0-36},{ym:.1f} L{x1+46},{ym:.1f}" stroke="#c62828" stroke-width="1.2" '
          f'stroke-dasharray="4,3"/>')
    s += text(x0 - 40, round(ym + 4, 1), "eye", 12, anchor="end", color="#c62828")
    s += text(x1 + 50, round(ym - 4, 1), "bottom of", 12, anchor="start", color="#c62828")
    s += text(x1 + 50, round(ym + 10, 1), "meniscus", 12, anchor="start", color="#c62828")
    s += text(x1 + 50, round(y(25.3), 1), "reading:", 13, anchor="start", color="#1d3c8c")
    s += text(x1 + 50, round(y(25.3) + 16, 1), "24.6 cm³", 13, anchor="start", color="#1d3c8c")
    s += text(x1 + 6, round(y(23.75), 1), "↓ numbers increase", 11, anchor="start", color=LBL)
    s += text(x1 + 6, round(y(23.75) + 13, 1), "   downwards", 11, anchor="start", color=LBL)
    return svg(250, 205, s, width_mm=54)


def _catmull(points):
    """Smooth path through points (Catmull-Rom converted to cubic Bezier)."""
    d = f"M{points[0][0]:.1f},{points[0][1]:.1f}"
    for i in range(len(points) - 1):
        p0 = points[i - 1] if i > 0 else points[i]
        p1, p2 = points[i], points[i + 1]
        p3 = points[i + 2] if i + 2 < len(points) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}"
    return d


def fig_graph():
    s = ""
    X0, Y0, W, H = 62, 210, 256, 180     # origin and plot size in px
    tmax, vmax = 80, 60
    px = lambda t: X0 + t / tmax * W     # noqa: E731
    py = lambda v: Y0 - v / vmax * H     # noqa: E731
    for t in range(0, tmax + 1, 5):
        w = 0.9 if t % 10 == 0 else 0.4
        s += f'<path d="M{px(t):.1f},{Y0} L{px(t):.1f},{Y0-H}" stroke="#b9cbe6" stroke-width="{w}"/>'
    for v in range(0, vmax + 1, 5):
        w = 0.9 if v % 10 == 0 else 0.4
        s += f'<path d="M{X0},{py(v):.1f} L{X0+W},{py(v):.1f}" stroke="#b9cbe6" stroke-width="{w}"/>'
    s += f'<path d="M{X0},{Y0-H-6} L{X0},{Y0} L{X0+W+6},{Y0}" stroke="{INK}" stroke-width="1.6" fill="none"/>'
    for t in range(0, tmax + 1, 20):
        s += text(round(px(t), 1), Y0 + 15, str(t), 12)
    for v in range(0, vmax + 1, 20):
        s += text(X0 - 6, round(py(v) + 4, 1), str(v), 12, anchor="end")
    s += text(X0 + W / 2, Y0 + 32, "time / s", 13)
    s += text(16, Y0 - H / 2, "volume of gas / cm³", 13,
              extra=f'transform="rotate(-90 16 {Y0 - H / 2})"')
    data = [(0, 0), (10, 18), (20, 32), (30, 30), (40, 49), (50, 54), (60, 56), (70, 57), (80, 57)]
    good = [(px(t), py(v)) for t, v in data if (t, v) != (30, 30)]
    s += f'<path d="{_catmull(good)}" fill="none" stroke="#1d3c8c" stroke-width="1.8"/>'
    for t, v in data:
        x, y = px(t), py(v)
        s += (f'<path d="M{x-4:.1f},{y-4:.1f} L{x+4:.1f},{y+4:.1f} M{x-4:.1f},{y+4:.1f} '
              f'L{x+4:.1f},{y-4:.1f}" stroke="{INK}" stroke-width="1.5"/>')
    ax, ay = px(30), py(30)
    s += f'<circle cx="{ax:.1f}" cy="{ay:.1f}" r="9" fill="none" stroke="#c62828" stroke-width="1.5"/>'
    s += text(round(ax + 14, 1), round(ay + 24, 1), "anomalous point:", 12, anchor="start", color="#c62828")
    s += text(round(ax + 14, 1), round(ay + 38, 1), "circled, line ignores it", 12, anchor="start",
              color="#c62828")
    s += text(round(px(48), 1), round(py(36), 1), "smooth curve of best fit,", 12, anchor="start",
              color="#1d3c8c")
    s += text(round(px(48), 1), round(py(36) + 14, 1), "not dot-to-dot", 12, anchor="start",
              color="#1d3c8c")
    return svg(330, 250, s, width_mm=80)


STYLE = """<style>
.long { break-inside: auto; }
.long tr { break-inside: avoid; }
.say td:nth-child(1) { width: 22%; font-weight: 700; }
.say td:nth-child(2) { width: 39%; color: #2e7d32; }
.say td:nth-child(3) { color: #c62828; }
.check.two { columns: 2; column-gap: 18px; font-size: 9.8pt; }
.check.two li { break-inside: avoid; }
.we { font-size: 9.8pt; line-height: 1.3; }
</style>"""

BODY = STYLE + f"""
<h1>Practical Skills &nbsp;(Paper 6)</h1>
<div class="meta">Cambridge IGCSE Chemistry 0620 &middot; Alternative to Practical &middot; Use with Topic 12 and
real Paper 6 past papers</div>

<h2><span class="num">1</span>What Paper 6 asks</h2>
<p>Paper 6 is a written paper (1 hour, 40 marks) about experiments you could do in a lab. The same few
question types come up every year:</p>
<table class="k">
<tr><th style="width:30%">Question type</th><th>What you do</th></tr>
<tr><td>Reading apparatus</td><td>read thermometers, burettes, measuring cylinders, gas syringes or stopwatches
from diagrams and complete a table</td></tr>
<tr><td>Results and graphs</td><td>complete a results table, plot a graph, draw a line of best fit and read values
from it</td></tr>
<tr><td>Conclusions</td><td>describe the pattern in the data and explain it with chemistry you know</td></tr>
<tr><td>Observations / tests</td><td>describe what you would see, or identify ions and gases from test results</td></tr>
<tr><td>Evaluation</td><td>spot problems with the method and suggest improvements</td></tr>
<tr><td>Planning</td><td>write a method for an investigation (usually the last question)</td></tr>
</table>
<p>The qualitative analysis tests (Topic 12) are printed at the back of the paper &mdash; but you still need to
know <i>how</i> to describe the observations precisely.</p>

<h2><span class="num">2</span>Variables and planning</h2>
<div class="box def"><span class="lbl">Definitions</span>
<b>Independent variable</b> &ndash; the one you deliberately <b>change</b>.<br>
<b>Dependent variable</b> &ndash; the one you <b>measure</b>.<br>
<b>Control variables</b> &ndash; everything else you <b>keep the same</b>, so the test is fair.</div>

<div class="box exam"><span class="lbl">A plan that scores: include all of these</span>
<ol>
<li>Numbered steps a classmate could follow, naming <b>apparatus and quantities</b> (&ldquo;use a measuring
cylinder to add 50 cm<sup>3</sup> of dilute hydrochloric acid to a conical flask&rdquo;).</li>
<li>What you <b>change</b>, and a sensible range (at least 5 different values).</li>
<li>What you <b>measure</b>, and with which apparatus.</li>
<li>What you <b>keep the same</b> (name at least two control variables).</li>
<li><b>Repeat</b> and take the mean.</li>
<li>How the results answer the question (&ldquo;the shorter the time, the faster the rate&rdquo;).</li>
</ol></div>

<div class="keep">
<h3>Worked example</h3>
<p class="small">Plan an investigation into how the concentration of hydrochloric acid affects the rate of its reaction
with magnesium ribbon.</p>
<ol class="we">
<li>Measure 50 cm<sup>3</sup> of 0.5 mol/dm<sup>3</sup> hydrochloric acid with a measuring cylinder and pour it into a
conical flask.</li>
<li>Connect a gas syringe to the flask with a bung and delivery tube.</li>
<li>Add a 3 cm length of magnesium ribbon, quickly replace the bung and start the stopwatch.</li>
<li>Record the volume of hydrogen in the syringe every 10 seconds until the reaction stops.</li>
<li>Repeat with acid of 1.0, 1.5, 2.0 and 2.5 mol/dm<sup>3</sup>.</li>
<li>Keep the same: volume of acid, length of magnesium, temperature.</li>
<li>Repeat each concentration and calculate the mean. The greater the volume of gas in the first 30 s (or the
steeper the graph), the faster the rate.</li>
</ol>
</div>

<h2><span class="num">3</span>Apparatus and reading scales</h2>
<div class="row">
<div>
<table class="k">
<tr><th style="width:36%">Apparatus</th><th>Reading it</th></tr>
<tr><td>burette</td><td>scale reads <b>downwards</b>; divisions of 0.1 cm<sup>3</sup>; record to 1 decimal place
(e.g. 0.0, 24.6)</td></tr>
<tr><td>volumetric pipette</td><td>one fixed volume, e.g. 25.0 cm<sup>3</sup></td></tr>
<tr><td>measuring cylinder</td><td>read the bottom of the meniscus at eye level</td></tr>
<tr><td>thermometer</td><td>read at eye level; usually to the nearest 0.5 &deg;C or 1 &deg;C, depending on the scale</td></tr>
<tr><td>gas syringe</td><td>read where the plunger is</td></tr>
<tr><td>stopwatch</td><td>convert minutes to seconds: 1 min 25 s = <b>85 s</b></td></tr>
<tr><td>balance</td><td>record all the digits shown, e.g. 2.45 g</td></tr>
</table>
<div class="box warn"><span class="lbl">Watch out</span>
Burette: reading <b>upwards</b> by mistake (24.6 read as 23.4) is the classic error &middot; titre = final
&minus; initial &middot; record every reading in a column to the <b>same</b> number of decimal places.</div>
</div>
<figure style="flex:0 0 56mm">{fig_burette()}<figcaption>Reading a burette</figcaption></figure>
</div>

<h2><span class="num">4</span>Results tables</h2>
<div class="row">
<div>
<ul>
<li>Each column heading has the <b>quantity and unit</b>, e.g. <i>temperature / &deg;C</i> or <i>time (s)</i>.</li>
<li><b>No units</b> in the body of the table &mdash; just numbers.</li>
<li>Same number of decimal places down each column, matching the apparatus.</li>
<li>Include calculated columns (change in temperature, titre, mean).</li>
</ul>
</div>
<div style="flex:0 0 80mm">
<table class="c">
<tr><th>initial temperature / &deg;C</th><th>final temperature / &deg;C</th><th>temperature change / &deg;C</th></tr>
<tr><td>21.0</td><td>28.5</td><td>7.5</td></tr>
<tr><td>21.5</td><td>32.0</td><td>10.5</td></tr>
</table>
</div>
</div>

<h2><span class="num">5</span>Graphs</h2>
<div class="row">
<div>
<ul>
<li><b>Independent</b> variable on the <b>x-axis</b>; dependent on the y-axis.</li>
<li>Label both axes with <b>quantity and unit</b> (&ldquo;time / s&rdquo;).</li>
<li>Choose a <b>linear</b> scale that is easy to read (each square = 1, 2, 5 or 10 units &mdash; never 3) and
makes the points fill <b>at least half</b> of the grid in each direction.</li>
<li>Plot points <b>accurately</b> with small neat crosses.</li>
<li>Draw a <b>smooth curve or a ruled straight line</b> of best fit &mdash; never join the dots.</li>
<li><b>Anomalous</b> results: circle them and leave them out of the line.</li>
<li>When reading a value off the graph, <b>draw the lines</b> on the graph to show how you did it.</li>
</ul>
</div>
<figure style="flex:0 0 82mm">{fig_graph()}<figcaption>Volume of hydrogen against time</figcaption></figure>
</div>

<div class="box exam"><span class="lbl">Describing and explaining a trend</span>
<b>Describe:</b> use the data &mdash; &ldquo;as the concentration increases, the time taken decreases&rdquo;; quote
numbers from the table or graph.<br>
<b>Explain:</b> use the theory &mdash; e.g. &ldquo;more particles per unit volume, so more frequent collisions&rdquo;.<br>
<b>Reaction finished?</b> On a gas-volume graph the curve levels off: one reactant has been used up.</div>

<h2><span class="num">6</span>Describing observations precisely</h2>
<p>Write what you would <b>see</b>, not what you know is happening.</p>
<table class="say long">
<thead><tr><th>Situation</th><th>Say</th><th>Don&rsquo;t say</th></tr></thead>
<tr><td>gas produced</td><td>bubbles / fizzing / effervescence</td><td>&ldquo;a gas was given off&rdquo;,
&ldquo;hydrogen was produced&rdquo; (a conclusion, not an observation)</td></tr>
<tr><td>colour change</td><td>&ldquo;the solution changed from <b>blue to colourless</b>&rdquo; (both colours)</td>
<td>&ldquo;it changed colour&rdquo;, &ldquo;it went colourless&rdquo;</td></tr>
<tr><td>no colour</td><td><b>colourless</b></td><td>&ldquo;clear&rdquo; (clear means see-through; a blue solution is
clear)</td></tr>
<tr><td>a solid forms in a solution</td><td>&ldquo;a <b>white precipitate</b>&rdquo; (give the colour)</td>
<td>&ldquo;white solution&rdquo;, &ldquo;it went cloudy&rdquo; (except limewater)</td></tr>
<tr><td>solid used up</td><td>&ldquo;the solid disappears&rdquo; / &ldquo;dissolves&rdquo;</td><td>&ldquo;the solid
melts&rdquo;</td></tr>
<tr><td>temperature change</td><td>&ldquo;the flask gets warmer&rdquo;; give readings</td><td>&ldquo;it
reacts&rdquo;</td></tr>
<tr><td>flame test</td><td>the exact colour: lilac, orange-red&hellip;</td><td>&ldquo;purple&rdquo;,
&ldquo;orange&rdquo; for calcium</td></tr>
</table>

<h2><span class="num">7</span>Errors and improvements</h2>
<table class="k long">
<thead><tr><th style="width:44%">Problem</th><th>Improvement</th></tr></thead>
<tr><td>Heat lost to the surroundings in a temperature-change experiment</td><td>Use an insulated (polystyrene) cup
with a lid</td></tr>
<tr><td>Gas escapes before the bung is put in</td><td>Put the solid in a small tube inside the flask, insert the
bung, then tip it over to start the reaction</td></tr>
<tr><td>Acid spray escapes in a mass-loss experiment</td><td>Put a cotton wool plug in the neck of the flask
(gas gets out, spray doesn&rsquo;t)</td></tr>
<tr><td>Volume measured with a measuring cylinder</td><td>Use a burette or volumetric pipette (more precise)</td></tr>
<tr><td>Gas is soluble in water so can&rsquo;t be collected over water</td><td>Collect it in a gas syringe</td></tr>
<tr><td>Hard to judge the end-point / when a cross disappears</td><td>Use a light sensor (or the same person
judges every time)</td></tr>
<tr><td>Temperature changes between runs</td><td>Use a water bath to keep the temperature constant</td></tr>
<tr><td>Reaction too fast to time accurately</td><td>Use more dilute acid or larger pieces of solid</td></tr>
<tr><td>Only one set of results</td><td>Repeat, identify anomalies and take the mean</td></tr>
</table>
<div class="box warn"><span class="lbl">Watch out &mdash; answers that score nothing</span>
&ldquo;Human error&rdquo; &middot; &ldquo;use more accurate equipment&rdquo; without naming it &middot; &ldquo;do it more
carefully&rdquo; &middot; &ldquo;to make it a fair test&rdquo; without saying what you keep the same. Always name the
<b>specific</b> problem and the <b>specific</b> fix.</div>

<h2><span class="num">8</span>Safety</h2>
<p>Eye protection is always expected. Beyond that, the precaution must match the <b>specific hazard</b>:</p>
<table class="k">
<tr><th style="width:44%">Hazard</th><th>Precaution</th></tr>
<tr><td>Flammable liquids (ethanol, hexane)</td><td>No naked flames; heat with a water bath or electric heater</td></tr>
<tr><td>Toxic gases (chlorine, sulfur dioxide)</td><td>Use a fume cupboard</td></tr>
<tr><td>Corrosive acids and alkalis (e.g. sodium hydroxide)</td><td>Wear eye protection (and gloves); wash spills with
plenty of water</td></tr>
<tr><td>Heating a solid in a test tube</td><td>Point the open end away from people</td></tr>
<tr><td>Collecting a gas over water while heating</td><td>Remove the delivery tube from the water before you stop
heating, so water isn&rsquo;t sucked back into the hot tube</td></tr>
<tr><td>Hot apparatus</td><td>Let it cool; hold with tongs</td></tr>
</table>

<div class="keep">
<h3>Self-check before Paper 6 past papers</h3>
<ul class="check two">
<li>Identify the independent, dependent and control variables in any experiment</li>
<li>Write a full plan: steps with apparatus and quantities, range, measurements, controls, repeats, conclusion</li>
<li>Read a burette, thermometer, measuring cylinder, gas syringe and stopwatch from a diagram</li>
<li>Draw a results table with units in the headings and consistent decimal places</li>
<li>Plot a graph with a good scale, a line of best fit and anomalous points identified</li>
<li>Describe and explain a trend using numbers from the data</li>
<li>Describe observations precisely (bubbles, both colours, colourless, precipitate colour)</li>
<li>Give a specific problem with a method and a specific improvement</li>
<li>Match a safety precaution to a specific hazard</li>
</ul>
</div>
"""

if __name__ == "__main__":
    preview = sys.argv[1] if len(sys.argv) > 1 else None
    render(TITLE, BODY, "/tmp/chem_parts/topic13.pdf", preview_dir=preview)
