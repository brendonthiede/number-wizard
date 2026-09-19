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
| Monster    | Aspect ratio is 1:1. Whole body visible, facing the viewer, on a transparent background: a PNG with an alpha channel.             |
| Character  | Aspect ratio is 1:1. Waist up, facing the viewer, on a transparent background: a PNG with an alpha channel.                       |
| Loot       | Aspect ratio is 1:1. One object, centered, on a transparent background: a PNG with an alpha channel.                              |

Everything except a Background is transparent: monsters stand in front of a scene, and portraits and
Loot sit on the page ground, which is never quite the generator's beige. If a generated file comes
back on a flat colour anyway (check the corners), knock it out before committing:

```bash
python3 scripts/knockout.py art-src/<kind>/<slug>.png
```

The script samples the corner colour and clears only what is reachable from the border, so a
similar colour inside the figure survives. A JPEG cannot carry alpha, so re-encode first.
Commit the full-size master as
`art-src/<kind>/<slug>.png` (kind in lowercase: `background`, `monster`, `character`, `loot`).
ChatGPT downloads are sometimes JPEG data with a `.png` name (character-01 was). Re-encode before
committing:

```bash
python3 -c "from PIL import Image; p='art-src/character/character-01.png'; Image.open(p).convert('RGB').save(p,'PNG',optimize=True)"
```

## Shipping weight

The game never loads a master. After adding or knocking out one, build the shipped WebP files and
commit both:

```bash
python3 scripts/shrink.py
```

It writes `public/art/<kind>/<slug>.webp` at 1280 px wide for a Background, 768 for a monster and
512 for a portrait or Loot, and fails if a file passes 300 KB. `art-src/reference/` holds masters
kept for the record that never ship (castle-01, the before image of the style).

## Favicon

The favicon set in `public/` (`favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`)
is built from one generated 1:1 image on the plain background. Regenerate with:

```bash
python3 scripts/favicon.py <generated>.jpg
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

Complete and paste-ready. The prompts below predate the transparent-background spec; their images were knocked out afterwards.

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

### fourmidable-knight (monster)

The Fourmidable Knight. Quest 1 Encounter. Spell out the counts; the generator cannot count.

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A short, stout knight in dented rusty armour with four arms, two on each side, each hand gripping a different battered sword. The visor is up, showing a proud grin with one tooth missing. Aspect ratio is 1:1. Whole body visible, facing the viewer, on a transparent background: a PNG with an alpha channel.

### spinner-six (monster)

Spinner Six. Quest 1 Encounter. Spell out the counts; the generator cannot count.

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A big round fuzzy purple spider with exactly six legs, three on each side, and no more, standing on the tips of its legs with a sulky embarrassed expression and two big round eyes. Aspect ratio is 1:1. Whole body visible, facing the viewer, on a transparent background: a PNG with an alpha channel.

### ate-bat (monster)

The Ate-Bat. Quest 1 Encounter. Spell out the counts; the generator cannot count.

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A plump grey bat hovering with eight wings, four on each side stacked like feathers, cheeks stuffed full, mid-burp with little sparkles around its mouth, tiny satisfied eyes. Aspect ratio is 1:1. Whole body visible, facing the viewer, on a transparent background: a PNG with an alpha channel.

### tenta-cool (monster)

Tenta-Cool. Quest 1 Encounter. Spell out the counts; the generator cannot count.

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A teal squid wearing oversized sunglasses, lounging back with ten arms, five on each side, one arm folded behind its back and one giving a lazy thumbs-up, a smug relaxed smile. Aspect ratio is 1:1. Whole body visible, facing the viewer, on a transparent background: a PNG with an alpha channel.

### odd-owl (monster)

The Odd Owl. Quest 1 Encounter. Spell out the counts; the generator cannot count.

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A tall skinny owl with mismatched feathers, one ear tuft longer than the other, one eye wide open and one squinting, wings crossed like folded arms, looking grumpy and unimpressed. Aspect ratio is 1:1. Whole body visible, facing the viewer, on a transparent background: a PNG with an alpha channel.

### twelve-headed-hydra (monster)

Twelve-Headed Hydra. Quest 1 Encounter. Spell out the counts; the generator cannot count.

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A green dragon-like hydra with twelve heads on long necks arranged in three rows of four, each head with a different silly expression (arguing, yawning, confused, shouting), a big plump body and small legs, not scary. Aspect ratio is 1:1. Whole body visible, facing the viewer, on a transparent background: a PNG with an alpha channel.

### star-hat (loot)

Star Hat. Quest 1 Loot pool.

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A tall pointed wizard hat in deep blue covered in bright yellow stars, with a floppy bent tip and a wide brim. Aspect ratio is 1:1. One object, centered, on a transparent background: a PNG with an alpha channel.

### moon-hat (loot)

Moon Hat. Quest 1 Loot pool.

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A tall pointed wizard hat in midnight purple with one big yellow crescent moon on the front and a silver band around the brim. Aspect ratio is 1:1. One object, centered, on a transparent background: a PNG with an alpha channel.

### nine-eye-monocle (loot)

Nine-Eye Monocle. Quest 1 Loot pool.

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A brass monocle on a chain whose single round lens shows nine small cartoon eyes looking in different directions. Aspect ratio is 1:1. One object, centered, on a transparent background: a PNG with an alpha channel.

### rusty-gauntlet (loot)

Rusty Gauntlet. Quest 1 Loot pool.

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A single chunky knight's gauntlet in rusty orange-brown metal with riveted plates, palm open, slightly dented. Aspect ratio is 1:1. One object, centered, on a transparent background: a PNG with an alpha channel.

### spider-silk-scarf (loot)

Spider-Silk Scarf. Quest 1 Loot pool.

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A long soft scarf woven from shimmering silver-white spider silk with a faint web pattern, loosely knotted. Aspect ratio is 1:1. One object, centered, on a transparent background: a PNG with an alpha channel.

### bat-wing-cloak (loot)

Bat-Wing Cloak. Quest 1 Loot pool.

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A short dark grey cloak whose bottom edge is cut into scalloped bat-wing points, with a round clasp shaped like a bat face. Aspect ratio is 1:1. One object, centered, on a transparent background: a PNG with an alpha channel.

### ink-staff (loot)

Ink Staff. Quest 1 Loot pool.

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A wooden wizard staff whose top is a swirl of teal ink frozen mid-splash, with a few floating ink droplets around it. Aspect ratio is 1:1. One object, centered, on a transparent background: a PNG with an alpha channel.

### owl-feather-quill (loot)

Owl Feather Quill. Quest 1 Loot pool.

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A large striped brown-and-cream owl feather made into a writing quill, tip dipped in blue ink, resting at a jaunty angle. Aspect ratio is 1:1. One object, centered, on a transparent background: a PNG with an alpha channel.
