"""Build the shipped WebP art in public/art from the full-size PNG masters in art-src.

Usage: python3 scripts/shrink.py

Run it after adding or knocking out a master. Widths are about three times the largest size a
screen shows that kind at, so a high-density display stays sharp. Masters are never upscaled.
"""
import glob
import os

from PIL import Image

SRC, OUT = "art-src", "public/art"
WIDTH = {"background": 1280, "monster": 768, "character": 512, "loot": 512}
QUALITY = 82
BUDGET_KB = 300  # per shipped file; a miss means the width or quality for that kind needs another look


def shrink(path: str) -> str:
    """Writes one master as a WebP under public/art, keeping its alpha channel; returns the new path."""
    kind = os.path.relpath(path, SRC).split(os.sep)[0]
    im = Image.open(path)
    im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
    width = min(WIDTH[kind], im.width)
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    out = os.path.join(OUT, os.path.relpath(path, SRC))[:-4] + ".webp"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out, "WEBP", quality=QUALITY, method=6)
    return out


if __name__ == "__main__":
    # Only the kinds in WIDTH ship; anything else under art-src (reference/) is a master kept for the record.
    for master in sorted(m for kind in WIDTH for m in glob.glob(f"{SRC}/{kind}/*.png")):
        out = shrink(master)
        size = os.path.getsize(out) // 1024
        print(f"{os.path.getsize(master) // 1024:5d} KB -> {size:4d} KB  {out}")
        assert size <= BUDGET_KB, f"{out} is over the {BUDGET_KB} KB budget"
