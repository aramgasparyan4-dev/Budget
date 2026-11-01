"""Shared template for printable IGCSE topic notes.

Each topic is a small Python file that builds its HTML body (text + inline SVG
diagrams) and calls render(). Output is a clean A4 PDF meant to be printed.
"""
import math
import pathlib
import subprocess
import sys

FONTS = pathlib.Path(__file__).parent / "fonts"

CSS = """
@font-face { font-family: 'Body'; src: url('FONTS/SourceSans3-VF.ttf'); font-weight: 200 900; }
@font-face { font-family: 'Body'; src: url('FONTS/SourceSans3-Italic-VF.ttf');
             font-weight: 200 900; font-style: italic; }
@font-face { font-family: 'Hand'; src: url('FONTS/Kalam-Bold.ttf'); }

@page { size: A4; margin: 13mm 14mm 14mm 14mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Body', sans-serif; font-size: 10.6pt; line-height: 1.38;
       color: #1f1f1f; }

h1 { font-size: 23pt; font-weight: 800; color: #1d3c8c; margin: 0; line-height: 1.1; }
.meta { color: #666; font-size: 9.5pt; margin: 3px 0 10px; }
h2 { font-size: 14.5pt; font-weight: 800; color: #1d3c8c; margin: 15px 0 5px;
     padding-bottom: 2px; border-bottom: 2px solid #1d3c8c; break-after: avoid; }
h2 .num { display: inline-block; min-width: 30px; }
h3 { font-size: 11.4pt; font-weight: 700; color: #1d3c8c; margin: 9px 0 2px; break-after: avoid; }
p { margin: 2px 0 5px; }
ul, ol { margin: 2px 0 5px; padding-left: 18px; }
li { margin: 1px 0; }
b { font-weight: 700; color: #000; }
sub, sup { font-size: 68%; line-height: 0; }

.hl { background: linear-gradient(100deg, rgba(255,226,40,0) 1%, rgba(255,226,40,.65) 3%,
       rgba(255,226,40,.45) 50%, rgba(255,226,40,.65) 96%, rgba(255,226,40,0) 99%);
      padding: 0 .15em; border-radius: .25em .4em; box-decoration-break: clone;
      -webkit-box-decoration-break: clone; }
.red { color: #c62828; }
.green { color: #2e7d32; }
.blue { color: #1d3c8c; }
.small { font-size: 9.4pt; color: #555; }

.box { border-left: 4px solid; padding: 4px 10px 5px; margin: 7px 0; break-inside: avoid;
       border-radius: 0 6px 6px 0; }
.box .lbl { font-family: 'Hand'; font-size: 10.5pt; display: block; margin-bottom: 0;
            line-height: 1.3; }
.box.def { border-color: #1d3c8c; background: #eef2fa; }
.box.def .lbl { color: #1d3c8c; }
.box.exam { border-color: #2e7d32; background: #eef6ee; }
.box.exam .lbl { color: #2e7d32; }
.box.warn { border-color: #c62828; background: #fbeeee; }
.box.warn .lbl { color: #c62828; }
.box ol, .box ul { margin: 0; }

table { border-collapse: collapse; width: 100%; margin: 5px 0 8px; break-inside: avoid;
        font-size: 10pt; line-height: 1.28; }
th { font-weight: 700; color: #1d3c8c; text-align: left; border-bottom: 1.5px solid #1d3c8c;
     padding: 2px 6px; }
td { border-bottom: 1px solid #ddd; padding: 2px 6px; vertical-align: top; }
td.k, table.k td:first-child { font-weight: 700; }
table.c td, table.c th { text-align: center; }

figure { margin: 4px 0 6px; text-align: center; break-inside: avoid; }
figcaption { font-size: 9.2pt; color: #555; }
svg text { font-family: 'Body', sans-serif; }
.row { display: flex; gap: 14px; align-items: flex-start; break-inside: avoid; }
.row > * { flex: 1; min-width: 0; }
.keep { break-inside: avoid; }
.check li { list-style: none; margin-left: -16px; }
.check li::before { content: '\\2610'; font-family: 'DejaVu Sans', sans-serif; margin-right: 6px;
                    color: #1d3c8c; }
"""


def render(title, body_html, out_pdf, preview_dir=None):
    out_pdf = pathlib.Path(out_pdf)
    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    css = CSS.replace("FONTS/", FONTS.resolve().as_uri() + "/")
    html = f"<!DOCTYPE html><html><head><meta charset='utf-8'><title>{title}</title>" \
           f"<style>{css}</style></head><body>{body_html}</body></html>"
    tmp_html = pathlib.Path("/tmp") / (out_pdf.stem.replace(" ", "_") + ".html")
    tmp_html.write_text(html, encoding="utf-8")
    subprocess.run(["node", str(pathlib.Path(__file__).parent / "print_pdf.js"),
                    str(tmp_html), str(out_pdf), title], check=True)
    if preview_dir:
        preview_dir = pathlib.Path(preview_dir)
        preview_dir.mkdir(parents=True, exist_ok=True)
        subprocess.run(["pdftoppm", "-r", "70", "-png", str(out_pdf),
                        str(preview_dir / "page")], check=True)
    print(f"wrote {out_pdf}")


# ---------- SVG helpers for chemistry / physics diagrams ----------

INK = "#262626"
DOT_C = "#1d3c8c"    # dots in blue
CROSS_C = "#c62828"  # crosses in red


def dot(x, y, r=3.1, color=DOT_C):
    return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{color}"/>'


def cross(x, y, s=3.6):
    return (f'<path d="M{x-s:.1f},{y-s:.1f} L{x+s:.1f},{y+s:.1f} M{x-s:.1f},{y+s:.1f} '
            f'L{x+s:.1f},{y-s:.1f}" stroke="{CROSS_C}" stroke-width="2" stroke-linecap="round"/>')


def electron(kind, x, y):
    return dot(x, y) if kind == "d" else cross(x, y)


def text(x, y, s, size=15, anchor="middle", color=INK, extra=""):
    return (f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-size="{size}" '
            f'fill="{color}" {extra}>{s}</text>')


def shell(cx, cy, r, label=None, size=19):
    out = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{INK}" stroke-width="1.6"/>'
    if label:
        out += text(cx, round(cy + size * 0.35, 1), label, size)
    return out


def pair_on_circle(cx, cy, r, angle_deg, kinds, gap=5.5):
    """One or two electrons at a point on a circle, spread along the tangent."""
    a = math.radians(angle_deg)
    px, py = cx + r * math.cos(a), cy + r * math.sin(a)
    tx, ty = -math.sin(a), math.cos(a)
    offs = [-gap, gap] if len(kinds) == 2 else [0]
    return "".join(electron(k, px + tx * o, py + ty * o) for k, o in zip(kinds, offs))


def atom(cx, cy, config, label="", r0=22, step=17, kind="x"):
    """Full shell diagram: nucleus + concentric shells with electrons spread round."""
    out = (f'<circle cx="{cx}" cy="{cy}" r="{r0 - 8}" fill="#f3e5d0" stroke="{INK}" '
           f'stroke-width="1.3"/>')
    if label:
        out += text(cx, cy + 5, label, 13)
    for i, n in enumerate(config):
        r = r0 + i * step
        out += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{INK}" stroke-width="1.3"/>'
        # electrons placed in pairs at N/E/S/W like the usual textbook drawing
        slots = [-90, 0, 90, 180]
        if n <= 2:
            angles = [-90, 90][:n] if n == 2 else [-90]
            for a in angles:
                out += pair_on_circle(cx, cy, r, a, kind)
        else:
            counts = [0, 0, 0, 0]
            for k in range(n):
                counts[k % 4] += 1
            for a, c in zip(slots, counts):
                if c:
                    out += pair_on_circle(cx, cy, r, a, kind * c)
    return out


def brackets(x1, x2, y1, y2, charge, color=INK):
    t = 7
    return (f'<path d="M{x1+t},{y1} L{x1},{y1} L{x1},{y2} L{x1+t},{y2}" fill="none" '
            f'stroke="{color}" stroke-width="2"/>'
            f'<path d="M{x2-t},{y1} L{x2},{y1} L{x2},{y2} L{x2-t},{y2}" fill="none" '
            f'stroke="{color}" stroke-width="2"/>'
            + text(x2 + 9, y1 + 10, charge, 22))


def arrow_defs():
    return ('<defs><marker id="ah" markerWidth="10" markerHeight="10" refX="8" refY="5" '
            'orient="auto"><path d="M0,0 L9,5 L0,10" fill="none" stroke="#262626" '
            'stroke-width="1.6"/></marker></defs>')


def svg(w, h, inner, width_mm=None):
    style = f'style="width:{width_mm}mm"' if width_mm else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" {style}>'
            f'{arrow_defs()}{inner}</svg>')


if __name__ == "__main__":
    sys.exit("Run a topic file, e.g. python3 igcse/chemistry/src/topic02_atoms_elements_compounds.py")
