"""Builds the St. Xavier's brand lockups that replace the template's wordmark.

The header, footer and preloader all render the logo as `<img src="…svg">`
inside a fixed box with `object-fit: contain`, so the replacement has to be a
single self-contained SVG at the same aspect ratio. That rules out webfonts —
an SVG loaded through <img> is an isolated document and never sees the page's
@font-face rules — so the wordmark is baked to outlines here, straight from the
site's own Instrument Sans file, and the crest is embedded as a base64 PNG.

Run with a Python that has fontTools, brotli and Pillow:
    python _extract/brand-logo.py
"""

import base64
import pathlib

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT = ROOT / 'public/fonts/pxiTypc9vsFDm051Uf6KVwgkfoSxQ0GsQv8ToedPibnr0SZe1Q-f587e7.woff2'

INK = '#111111'
WHITE = '#ffffff'
CREST_RATIO = 352 / 420  # width / height of the cut-out crest

_fonts: dict[int, TTFont] = {}


def font(weight: int) -> TTFont:
    if weight not in _fonts:
        f = TTFont(FONT)
        _fonts[weight] = instancer.instantiateVariableFont(f, {'wght': weight}, inplace=True)
    return _fonts[weight]


def advance(text: str, weight: int, tracking: float = 0.0) -> float:
    """Width of `text` in em, with `tracking` em added between characters."""
    f = font(weight)
    cmap, hmtx, upem = f.getBestCmap(), f['hmtx'], f['head'].unitsPerEm
    return sum(hmtx[cmap[ord(c)]][0] / upem for c in text) + tracking * (len(text) - 1)


def outline(text: str, weight: int, size: float, x: float, baseline: float, tracking: float = 0.0) -> str:
    """`text` as a single SVG path, laid out left-to-right from (x, baseline)."""
    f = font(weight)
    cmap, hmtx, glyphs = f.getBestCmap(), f['hmtx'], f.getGlyphSet()
    upem = f['head'].unitsPerEm
    scale = size / upem
    parts, pen_x = [], x
    for ch in text:
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        path = pen.getCommands()
        if path:
            # Flip the Y axis: font units run up from the baseline, SVG runs down.
            parts.append(f'<g transform="translate({pen_x:.3f} {baseline:.3f}) scale({scale:.5f} {-scale:.5f})"><path d="{path}"/></g>')
        pen_x += hmtx[name][0] * scale + tracking * size
    return ''.join(parts)


def crest(height: float, x: float, y: float, asset: pathlib.Path) -> str:
    data = base64.b64encode(asset.read_bytes()).decode()
    return (f'<image x="{x:.3f}" y="{y:.3f}" width="{height * CREST_RATIO:.3f}" height="{height:.3f}" '
            f'preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,{data}"/>')


def lockup(box_w: float, box_h: float, colour: str, asset: pathlib.Path,
           crest_h: float, gap: float, secondary_ratio: float) -> str:
    """Crest at the left, institution name over association name, both flush
    to the same measure — the two-line lockup used at every size."""
    line1, line2 = "ST. XAVIER'S COLLEGE", 'ALUMNI ASSOCIATION'
    crest_w = crest_h * CREST_RATIO
    text_x = crest_w + gap
    measure = box_w - text_x

    size1 = measure / advance(line1, 700)
    size2 = size1 * secondary_ratio
    # Track the second line out so it ends flush with the first.
    tracking = (measure / size2 - advance(line2, 600)) / (len(line2) - 1)

    cap = 0.72
    block = cap * size1 + size1 * 0.42 + cap * size2
    top = (box_h - block) / 2
    base1 = top + cap * size1
    base2 = top + block

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{box_w:g}" height="{box_h:g}" '
        f'viewBox="0 0 {box_w:g} {box_h:g}" fill="none">'
        f'{crest(crest_h, 0, (box_h - crest_h) / 2, asset)}'
        f'<g fill="{colour}">'
        f'{outline(line1, 700, size1, text_x, base1)}'
        f'{outline(line2, 600, size2, text_x, base2, tracking)}'
        f'</g></svg>'
    )


def write(name: str, svg: str) -> None:
    path = ROOT / 'public/svg' / name
    path.write_text(svg, encoding='utf-8')
    print(f'{name:26} {len(svg) / 1024:6.1f} KB')


small = ROOT / 'public/images/brand/crest-160.png'
large = ROOT / 'public/images/brand/crest-420.png'

# Header (156×38) and preloader; the scrolled header and footer use the dark cut.
write('logo-white.svg', lockup(156, 38, WHITE, small, crest_h=34, gap=8, secondary_ratio=0.62))
write('logo-dark.svg', lockup(153, 38, INK, small, crest_h=34, gap=8, secondary_ratio=0.62))
# The oversized mark behind the footer, rendered at roughly 1245×227.
write('logo-watermark.svg', lockup(1245, 227, INK, large, crest_h=205, gap=48, secondary_ratio=0.62))
