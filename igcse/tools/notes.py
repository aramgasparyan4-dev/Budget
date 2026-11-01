"""Shared template for printable IGCSE topic notes.

Each topic is a small Python file that builds its HTML body (text + inline SVG
diagrams) and calls render(). Output is an A4 PDF styled like neat handwritten
notes on squared paper.
"""
import math
import pathlib
import subprocess
import sys


FONTS = pathlib.Path(__file__).parent / "fonts"

CSS = """
@font-face { font-family: 'Hand'; src: url('FONTS/PatrickHand-Regular.ttf'); }
@font-face { font-family: 'HeadHand'; src: url('FONTS/Kalam-Bold.ttf'); font-weight: 700; }
@font-face { font-family: 'HeadHand'; src: url('FONTS/Kalam-Regular.ttf'); font-weight: 400; }

@page { size: A4; margin: 13mm 13mm 15mm 13mm; }
* { box-sizing: border-box; }
html {
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
  background-color: #fffef9;
  background-image:
    linear-gradient(rgba(70,110,170,.10) 1px, transparent 1px),
    linear-gradient(90deg, rgba(70,110,170,.10) 1px, transparent 1px);
  background-size: 5mm 5mm;
}
body {
  margin: 0; font-family: 'Hand', sans-serif; font-size: 12.6pt; line-height: 1.32;
  color: #262626;
}
h1 { font-family: 'HeadHand'; font-weight: 700; color: #1d3c8c; font-size: 30pt;
     margin: 0; line-height: 1.1; }
.meta { color: #555; font-size: 11.5pt; margin: 2px 0 8px; }
h2 { font-family: 'HeadHand'; font-weight: 700; color: #1d3c8c; font-size: 18pt;
     margin: 16px 0 4px; break-after: avoid; line-height: 1.15;
     border-bottom: 2.5px solid #1d3c8c; border-radius: 0 0 60% 5% / 0 0 6px 3px;
     display: inline-block; padding-right: 10px; }
h3 { font-family: 'HeadHand'; font-weight: 700; color: #1d3c8c; font-size: 13.5pt;
     margin: 10px 0 2px; break-after: avoid; }
p { margin: 3px 0 5px; }
ul, ol { margin: 2px 0 6px; padding-left: 20px; }
li { margin: 1px 0; }
b, strong { font-weight: normal; color: #000; text-decoration: underline;
            text-decoration-color: rgba(29,60,140,.55); text-decoration-thickness: 1.5px;
            text-underline-offset: 2px; }
sub, sup { font-size: 70%; line-height: 0; }

.hl { background: linear-gradient(100deg, rgba(255,230,40,0) 1%, rgba(255,230,40,.75) 3%,
       rgba(255,230,40,.55) 50%, rgba(255,230,40,.75) 96%, rgba(255,230,40,0) 99%);
      padding: 0 .18em; border-radius: .3em .5em; box-decoration-break: clone;
      -webkit-box-decoration-break: clone; }
.red { color: #c62828; }
.green { color: #2e7d32; }
.blue { color: #1d3c8c; }
.small { font-size: 10.8pt; color: #444; }

.tag { font-family: 'HeadHand'; font-weight: 700; font-size: 8.5pt; letter-spacing: .5px;
       padding: 0 6px; border-radius: 8px 3px 8px 3px; vertical-align: 2px; white-space: nowrap; }
.tag.ext { color: #fff; background: #7b3fa0; }
.tag.edx { color: #fff; background: #b26a00; }

.box { border: 2px solid; padding: 5px 11px 6px; margin: 8px 0;
       border-radius: 255px 14px 225px 14px / 14px 225px 14px 255px; break-inside: avoid; }
.box .lbl { font-family: 'HeadHand'; font-weight: 700; font-size: 11pt; display: block;
            margin-bottom: 1px; }
.box.def { border-color: #1d3c8c; background: rgba(29,60,140,.04); }
.box.def .lbl { color: #1d3c8c; }
.box.exam { border-color: #2e7d32; background: rgba(46,125,50,.05); }
.box.exam .lbl { color: #2e7d32; }
.box.warn { border-color: #c62828; background: rgba(198,40,40,.04); }
.box.warn .lbl { color: #c62828; }
.box.ext { border-color: #7b3fa0; border-style: dashed; }
.box.ext .lbl { color: #7b3fa0; }

table { border-collapse: collapse; width: 100%; margin: 6px 0 8px; break-inside: avoid;
        font-size: 11.6pt; line-height: 1.22; }
th { font-family: 'HeadHand'; font-weight: 700; color: #1d3c8c; text-align: left;
     border-bottom: 2px solid #1d3c8c; padding: 3px 6px; font-size: 11pt; }
td { border-bottom: 1px dashed rgba(0,0,0,.25); padding: 3px 6px; vertical-align: top; }
td:first-child { font-family: 'HeadHand'; font-weight: 700; color: #333; }
table.plain td:first-child { font-family: 'Hand'; font-weight: normal; }

figure { margin: 6px 0 8px; text-align: center; break-inside: avoid; }
figcaption { font-size: 10.8pt; color: #444; margin-top: 0; }
svg text { font-family: 'Hand'; }
.row { display: flex; gap: 12px; align-items: flex-start; break-inside: avoid; }
.row > * { flex: 1; }
.cols2 { columns: 2; column-gap: 18px; }
.keep { break-inside: avoid; }
.pb { break-before: page; }
.check li { list-style: none; margin-left: -18px; }
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


# ---------- SVG helpers for chemistry diagrams ----------

INK = "#262626"
DOT_C = "#1d3c8c"   # dots in blue ink
CROSS_C = "#c62828"  # crosses in red ink


def dot(x, y, r=3.1):
    return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{DOT_C}"/>'


def cross(x, y, s=3.6):
    return (f'<path d="M{x-s:.1f},{y-s:.1f} L{x+s:.1f},{y+s:.1f} M{x-s:.1f},{y+s:.1f} '
            f'L{x+s:.1f},{y-s:.1f}" stroke="{CROSS_C}" stroke-width="2" stroke-linecap="round"/>')


def electron(kind, x, y):
    return dot(x, y) if kind == "d" else cross(x, y)


def shell(cx, cy, r, label=None, size=20):
    out = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{INK}" stroke-width="1.6"/>'
    if label:
        out += (f'<text x="{cx}" y="{cy + size*0.35:.1f}" text-anchor="middle" '
                f'font-size="{size}" fill="{INK}">{label}</text>')
    return out


def pair_on_circle(cx, cy, r, angle_deg, kinds, gap=5.5):
    """Two electrons at a point on a circle, spread along the tangent."""
    a = math.radians(angle_deg)
    px, py = cx + r * math.cos(a), cy + r * math.sin(a)
    tx, ty = -math.sin(a), math.cos(a)
    out = ""
    offs = [-gap, gap] if len(kinds) == 2 else [0]
    for k, o in zip(kinds, offs):
        out += electron(k, px + tx * o, py + ty * o)
    return out


def text(x, y, s, size=15, anchor="middle", color=INK, extra=""):
    return (f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-size="{size}" '
            f'fill="{color}" {extra}>{s}</text>')


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
    sys.exit("Run a topic file, e.g. python3 igcse/chemistry/src/02_chemical_bonding.py")
