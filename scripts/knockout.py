"""Knock out the flat background of a monster PNG so it can sit over a scene.

Usage: python3 scripts/knockout.py public/art/monster/<slug>.png

The generator's "plain flat single-color background" is uniform but not the exact hex asked for,
so the colour is sampled from the corners. Only pixels reachable from the border are cleared, so a
similar colour inside the figure survives. Edits in place; re-run is a no-op once the corners are
transparent.
"""
import sys
from collections import deque

from PIL import Image

TOLERANCE = 28  # per channel; the sampled border varied by 7, anti-aliased fringe needs more


def knockout(path: str) -> int:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    if all(c[3] == 0 for c in corners):
        return 0
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    near = lambda p: all(abs(p[i] - bg[i]) <= TOLERANCE for i in range(3))
    seen = bytearray(w * h)
    queue = deque((x, y) for x in range(w) for y in (0, h - 1))
    queue.extend((x, y) for y in range(h) for x in (0, w - 1))
    cleared = 0
    while queue:
        x, y = queue.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        p = px[x, y]
        if not near(p):
            continue
        px[x, y] = (p[0], p[1], p[2], 0)
        cleared += 1
        if x > 0: queue.append((x - 1, y))
        if x < w - 1: queue.append((x + 1, y))
        if y > 0: queue.append((x, y - 1))
        if y < h - 1: queue.append((x, y + 1))
    im.save(path, "PNG", optimize=True)
    return cleared


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        print(f"{arg}: cleared {knockout(arg)} pixels")
