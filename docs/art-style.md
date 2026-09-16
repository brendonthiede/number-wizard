# Art style guide

Every image prompt is three parts joined into one paragraph, in this order:

1. **Base style** (below, verbatim)
2. **Subject**: what this specific image shows, written by Claude Code
3. **Spec sentence** for the image's kind (from the table below, verbatim)

Claude Code writes the whole paragraph; the prompts in this file and in any Claude Code output are
complete. Paste them into ChatGPT as-is. Never assemble one by hand.

## Base style

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette,
simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly
and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject.

## Spec sentence per kind

| Kind       | Spec sentence (append verbatim)                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Background | Aspect ratio is 16:9. This is a full scene with no characters; leave the center calm.                                        |
| Monster    | Aspect ratio is 1:1. Whole body visible, facing the viewer, on a plain flat single-color background (#F4EFE6).               |
| Character  | Aspect ratio is 1:1. Waist up, facing the viewer, on a plain flat single-color background (#F4EFE6).                         |
| Loot       | Aspect ratio is 1:1. One object, centered, on a plain flat single-color background (#F4EFE6).                                |

Characters and Loot are displayed inside a framed panel on a plain ground, so their flat backgrounds
stay. Monsters stand in front of a scene background, so their flat colour is knocked out before
committing (issue #4):

```bash
python3 scripts/knockout.py public/art/monster/<slug>.png
```

The script samples the corner colour and clears only what is reachable from the border, so ask for
the plain background as usual and let the script remove it. Commit files as
`public/art/<kind>/<slug>.png` (kind in lowercase: `background`, `monster`, `character`, `loot`).
ChatGPT downloads are sometimes JPEG data with a `.png` name (character-01 was). Re-encode before
committing:

```bash
python3 -c "from PIL import Image; p='public/art/character/character-01.png'; Image.open(p).convert('RGB').save(p,'PNG',optimize=True)"
```

## Lessons from generated images

- Mood words beat adjectives. "Golden hour" and "meadow" produced a postcard castle even with
  "crumbling" in the prompt (castle-01). The revised prompt below produced castle-02, the keeper. For a menacing place, set the mood with the sky, the light,
  and the plants, then name three concrete signs of damage. Never rely on a single adjective.
- The base style's "friendly and slightly silly" is right for monsters and the Character. For a
  lair background, follow it with "the place looks dangerous but nothing in it is gory or scary
  for a 10-year-old" so the generator keeps the tone without making the scene pretty.
- Generators cannot count. "Nine eyes in a triangle" gave ten (gob-nine). When a number matters,
  spell out the arrangement ("three rows of 2, 3 and 4 eyes") and expect to fix it afterwards in
  PIL rather than re-rolling; small flat-color edits are cheap and keep the rest of the image.
- Line weight drifts between images: gob-nine has thick outlines, character-01 thinner ones, and
  castle-02 is busier than "simple shapes". The framed panel hides most of this. If a later image
  reads as a different style, add "thick uniform outlines" after the base style rather than re-rolling
  the keepers.
- The generator picks the Character's hair, skin and hat details when the prompt leaves them open.
  For the three selectable portraits, name each one's hat colour, hair and skin so they read as
  different people at thumbnail size (see character-02 and character-03 below).
- castle-01 is kept on purpose as the "before" of the mood-word lesson. Nothing in the game uses it.
- The generator ignores the exact background hex: gob-nine came back on (240, 230, 212), not
  #F4EFE6. Never hardcode the colour in a knockout; sample it.

## Prompts

Complete and paste-ready.

### castle-02: Fortress of Twelves, a monster lair (background)

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. The place looks dangerous but nothing in it is gory or scary for a 10-year-old. A wide view of a ruined stone fortress on a rocky hill at dusk under a purple and green sky with a low crescent moon. Twelve towers, several leaning at odd angles, two collapsed into rubble, walls with large cracks and missing stones, the main gate smashed open and hanging off one hinge. Sickly green light glows from the windows and a thin column of smoke rises from inside. Tattered dark banners with a spiral motif. Dead twisted trees, dry brown grass, and scattered rubble along a winding path that leads up from a swampy hollow. A few bats in the sky. Aspect ratio is 16:9. This is a full scene with no characters; leave the center calm.

### gob-nine (monster)

Generated with the prompt below; it came back with ten forehead eyes in rows of 1, 2, 3, 4. The top eye was painted out in PIL, leaving nine in rows of 2, 3, 4. Story: Gob-nine has nine eyes on its forehead, plus the two ordinary ones it was born with, which it insists do not count.

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A goblin with nine eyes arranged in a triangle on its forehead, green skin, a mischievous grin, holding a wooden club. Aspect ratio is 1:1. Whole body visible, facing the viewer, on a plain flat single-color background (#F4EFE6).

### character-01 (character)

Came back as a brown-haired, freckled kid with a star-and-moon hat and an orange striped scarf. Keeper.

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A young wizard apprentice with a slightly-too-big pointed blue hat, a star-tipped staff, and a determined smile. Aspect ratio is 1:1. Waist up, facing the viewer, on a plain flat single-color background (#F4EFE6).

### character-02 (character)

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A young wizard apprentice with dark brown skin and short curly black hair, a slightly-too-big pointed purple hat with a bent tip, a green robe with a yellow sash, a crescent-moon-tipped staff, and a big confident grin. Aspect ratio is 1:1. Waist up, facing the viewer, on a plain flat single-color background (#F4EFE6).

### character-03 (character)

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A young wizard apprentice with light skin and a long red ponytail, a slightly-too-big pointed red hat with a wide floppy brim, round glasses, a dark blue robe with yellow trim, a lightning-bolt-tipped staff, and a curious raised-eyebrow smile. Aspect ratio is 1:1. Waist up, facing the viewer, on a plain flat single-color background (#F4EFE6).
