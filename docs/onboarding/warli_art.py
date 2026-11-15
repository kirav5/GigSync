"""Draws every GigSync picture: python3 warli_art.py <out dir>. Writes one .svg per scene and an index.html.

Afterwards fit each SVG's viewBox to its drawing (getBBox in a browser), as public/art's files are.
"""
import os
import sys

import warli_start  # noqa: F401  (registers its scenes)
import warli_work  # noqa: F401  (registers its scenes)
from warli_kit import SCENES, svg

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
cells = []
for name, (label, fn) in SCENES.items():
    body = fn()
    s = svg(body, label)
    open(os.path.join(OUT, f"{name}.svg"), "w").write(s)
    cells.append(f'<figure><div class="t">{s}</div><figcaption>{name}</figcaption></figure>')
html = (
    "<!doctype html><meta charset=utf-8><style>body{margin:0;padding:20px;background:#FAF6EE;font:13px sans-serif;"
    "display:grid;grid-template-columns:repeat(6,200px);gap:16px}.t{background:#F6ECE1;border-radius:18px;padding:10px}"
    "svg{display:block;width:180px;height:144px}figure{margin:0}figcaption{text-align:center;padding:4px}</style>"
    + "".join(cells)
)
open(os.path.join(OUT, "index.html"), "w").write(html)
print(len(SCENES), "scenes")
