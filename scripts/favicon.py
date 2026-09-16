"""Build the favicon set from a generated 1:1 image on a flat background.

Usage: python3 scripts/favicon.py favicon.jpg

Writes public/favicon.ico (16/32/48, transparent), public/apple-touch-icon.png (180, opaque) and
public/icon-{192,512}.png (opaque, padded for the maskable safe zone). The flat background is
sampled from the corners and reused as the opaque fill, so the icons match the source art.
"""
import sys

from PIL import Image

from knockout import knockout_image

OUT = "public"
MASKABLE_FILL = 0.64  # content width as a fraction of the icon: inside the 80% safe-zone circle


def fit(subject: Image.Image, size: int, fill: float, bg) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), bg)
    w, h = subject.size
    scale = size * fill / max(w, h)
    s = subject.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    canvas.alpha_composite(s, ((size - s.width) // 2, (size - s.height) // 2))
    return canvas


def build(src: str) -> None:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    bg = tuple(im.getpixel((x, y))[:3] for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)])
    bg = tuple(sum(c[i] for c in bg) // 4 for i in range(3)) + (255,)
    knockout_image(im)
    subject = im.crop(im.getbbox())
    clear = (0, 0, 0, 0)
    fit(subject, 48, 0.94, clear).save(f"{OUT}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    fit(subject, 180, 0.84, bg).convert("RGB").save(f"{OUT}/apple-touch-icon.png", optimize=True)
    for size in (192, 512):
        fit(subject, size, MASKABLE_FILL, bg).convert("RGB").save(f"{OUT}/icon-{size}.png", optimize=True)


if __name__ == "__main__":
    build(sys.argv[1])
