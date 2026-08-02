#!/usr/bin/env python3
"""Turn a black-on-white artwork PNG into a transparent alpha mask.

The work cards paint their visual with `background: var(--ink)` clipped by a
CSS mask, so the artwork must carry its shape in the *alpha* channel: ink
where the drawing is, transparent where the paper was. That keeps one asset
working in both themes — black web on paper, light web on near-black — which
a flat black-on-white PNG can't do.

    python3 tools/mesh-png-to-mask.py <source.png> assets/work-picsly-mesh.png

Options:
    --invert    source is light-on-dark instead of black-on-white
    --size N    longest edge of the output (default 1400)
    --gamma G   >1 thins faint strokes, <1 fattens them (default 1.0)
"""
import argparse
import sys

from PIL import Image, ImageOps

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("dst")
ap.add_argument("--invert", action="store_true")
ap.add_argument("--size", type=int, default=1400)
ap.add_argument("--gamma", type=float, default=1.0)
a = ap.parse_args()

im = Image.open(a.src)

src_alpha = None
if im.mode in ("RGBA", "LA"):
    ch = im.convert("RGBA").getchannel("A")
    if ch.getextrema()[0] < 250:
        src_alpha = ch          # already cut out — that channel *is* the artwork

if src_alpha is not None:
    # Use it verbatim. Re-deriving it from luminance would only lose the
    # antialiasing the source already carries.
    alpha = src_alpha
else:
    grey = im.convert("L")
    if a.invert:
        grey = ImageOps.invert(grey)
    # ink coverage = how dark the pixel is
    alpha = ImageOps.invert(grey)
    alpha = ImageOps.autocontrast(alpha, cutoff=(0.2, 0.0))
if a.gamma != 1.0:
    lut = [min(255, round(255 * ((v / 255) ** a.gamma))) for v in range(256)]
    alpha = alpha.point(lut)

# Trim the empty margin so the artwork fills the card frame, then square it
# up — the visual is 4:3 and the mask is centred, so a square keeps it honest.
box = alpha.getbbox()
if box:
    alpha = alpha.crop(box)
w, h = alpha.size
side = max(w, h)
square = Image.new("L", (side, side), 0)
square.paste(alpha, ((side - w) // 2, (side - h) // 2))
alpha = square

if side > a.size:
    alpha = alpha.resize((a.size, a.size), Image.LANCZOS)

# The colour never renders — CSS paints the mask with var(--ink) — so only
# the alpha channel matters. WebP holds this dense line art in roughly a
# third of the equivalent PNG; lossless, because lossy haloes thin strokes.
if a.dst.lower().endswith(".webp"):
    out = Image.merge("RGBA", (Image.new("L", alpha.size, 0),) * 3 + (alpha,))
    out.save(a.dst, lossless=True, quality=100, method=6)
else:
    out = Image.merge("LA", (Image.new("L", alpha.size, 0), alpha))
    out.save(a.dst, optimize=True)

print(f"{a.src} -> {a.dst}  {alpha.size[0]}x{alpha.size[1]}", file=sys.stderr)
