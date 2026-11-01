"""Build the single printable Chemistry 0620 PDF from all topic files.

Usage: python3 igcse/chemistry/src/build_all.py [preview_dir]

Renders each topic separately, adds a cover + contents page, merges everything,
stamps continuous page numbers and adds PDF bookmarks for topics and sections.
"""
import html
import importlib.util
import io
import pathlib
import re
import sys

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

SRC = pathlib.Path(__file__).resolve().parent
ROOT = SRC.parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from notes import render  # noqa: E402

PARTS = [
    "topic01_states_of_matter.py",
    "topic02_atoms_elements_compounds.py",
    "topic03_stoichiometry.py",
    "topic04_electrochemistry.py",
    "topic05_chemical_energetics.py",
    "topic06_chemical_reactions.py",
    "topic07_acids_bases_salts.py",
    "topic08_periodic_table.py",
    "topic09_metals.py",
    "topic10_environment.py",
    "topic11_organic_chemistry.py",
    "topic12_experimental_techniques.py",
    "topic13_practical_skills.py",
]
OUT = ROOT / "chemistry" / "Chemistry 0620 - Complete Notes.pdf"
TMP = pathlib.Path("/tmp/chem_book")


def load(path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def strip_tags(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def headings(body):
    """(h1 text, [h2 texts]) from a topic body."""
    h1 = strip_tags(re.search(r"<h1>(.*?)</h1>", body, re.S).group(1))
    h2s = []
    for m in re.finditer(r"<h2>(.*?)</h2>", body, re.S):
        inner = re.sub(r'<span class="num">.*?</span>', "", m.group(1))
        inner = re.sub(r'<span class="(small|tag)[^"]*".*?</span>', "", inner)
        h2s.append(strip_tags(inner))
    return h1, h2s


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def find_page(reader, text, start=0):
    key = norm(text)[:28]
    for i in range(start, len(reader.pages)):
        if key and key in norm(reader.pages[i].extract_text() or ""):
            return i
    return None


def cover_html(entries):
    rows = ""
    for e in entries:
        secs = " &middot; ".join(html.escape(s) for s in e["h2s"] if s)
        rows += (f"<tr><td class='k' style='white-space:nowrap'>{html.escape(e['h1'])}</td>"
                 f"<td class='small'>{secs}</td><td style='text-align:right'>{e['page']}</td></tr>")
    return f"""
<div style="text-align:center; margin: 28mm 0 14mm">
  <div style="font-size:12pt; color:#666; letter-spacing:2px">CAMBRIDGE IGCSE &middot; 0620 &middot; EXTENDED</div>
  <h1 style="font-size:40pt; margin:6px 0 2px">Chemistry</h1>
  <div style="font-size:15pt; color:#1d3c8c; font-weight:600">Complete notes &mdash; all 12 topics + practical skills</div>
</div>
<div class="box exam" style="max-width:150mm; margin: 0 auto">
<span class="lbl">How to use this</span>
<ol>
<li>Read one numbered section (they match the SaveMyExams sub-topics).</li>
<li>Do the SaveMyExams topic questions for that section and mark them with the mark scheme.</li>
<li>Turn every mistake into a flashcard. Aim for about 75&ndash;80%, then move on.</li>
<li>Before moving to the next topic, tick the self-check list at the end of the topic.</li>
</ol></div>
<h2 style="break-before: page">Contents</h2>
<table>
<tr><th>Topic</th><th>Sections</th><th style="text-align:right">Page</th></tr>
{rows}
</table>
"""


def stamp_numbers(writer, first_numbered=1):
    total = len(writer.pages)
    for i, page in enumerate(writer.pages):
        if i < first_numbered:
            continue
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        c.setFont("Helvetica", 8)
        c.setFillColor(HexColor("#888888"))
        c.drawRightString(A4[0] - 13 * mm, 6.2 * mm, f"{i + 1} / {total}")
        c.save()
        buf.seek(0)
        page.merge_page(PdfReader(buf).pages[0])


def main():
    TMP.mkdir(parents=True, exist_ok=True)
    entries, missing = [], []
    for name in PARTS:
        path = SRC / name
        if not path.exists():
            missing.append(name)
            continue
        try:
            mod = load(path)
        except Exception as exc:  # a part that doesn't import yet is reported, not fatal
            print(f"FAILED to load {name}: {exc}")
            missing.append(name)
            continue
        pdf = TMP / (path.stem + ".pdf")
        render(mod.TITLE, mod.BODY, pdf, page_numbers=False)
        h1, h2s = headings(mod.BODY)
        entries.append({"pdf": pdf, "h1": h1, "h2s": h2s,
                        "n": len(PdfReader(str(pdf)).pages)})
    if missing:
        print("missing parts (skipped):", ", ".join(missing))

    # cover + contents: render once to count its pages, then again with page numbers
    for e in entries:
        e["page"] = 0
    cover_pdf = TMP / "cover.pdf"
    render("Chemistry 0620 - Complete Notes", cover_html(entries), cover_pdf, page_numbers=False)
    start = len(PdfReader(str(cover_pdf)).pages) + 1
    for e in entries:
        e["page"] = start
        start += e["n"]
    render("Chemistry 0620 - Complete Notes", cover_html(entries), cover_pdf, page_numbers=False)

    writer = PdfWriter()
    for p in PdfReader(str(cover_pdf)).pages:
        writer.add_page(p)
    for e in entries:
        reader = PdfReader(str(e["pdf"]))
        offset = len(writer.pages)
        for p in reader.pages:
            writer.add_page(p)
        top = writer.add_outline_item(e["h1"], offset)
        last = 0
        for h in e["h2s"]:
            pg = find_page(reader, h, last)
            if pg is not None:
                writer.add_outline_item(h, offset + pg, parent=top)
                last = pg
    stamp_numbers(writer)
    writer.page_mode = "/UseOutlines"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "wb") as f:
        writer.write(f)
    print(f"wrote {OUT} ({len(writer.pages)} pages)")
    for e in entries:
        print(f"  p.{e['page']:>3}  {e['h1']}  ({e['n']} pages)")

    if len(sys.argv) > 1:
        import subprocess
        prev = pathlib.Path(sys.argv[1])
        prev.mkdir(parents=True, exist_ok=True)
        subprocess.run(["pdftoppm", "-r", "60", "-png", str(OUT), str(prev / "page")], check=True)


if __name__ == "__main__":
    main()
