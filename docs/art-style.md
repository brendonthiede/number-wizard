# Art style guide

Paste the **Base style** paragraph at the top of every image prompt, then the subject line for
the specific image. Revise this file after the first three images (a background, a monster, the
Character) come back.

## Base style

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette,
simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly
and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject.

## Specs

| Kind        | Aspect | Background                         | Notes                                   |
| ----------- | ------ | ----------------------------------- | ---------------------------------------- |
| Background  | 16:9   | Full scene                         | No characters; leave the centre calm    |
| Monster     | 1:1    | Plain flat single colour (#F4EFE6) | Whole body visible, facing the viewer   |
| Character   | 1:1    | Plain flat single colour (#F4EFE6) | Wizard apprentice, waist up, holds staff|
| Loot        | 1:1    | Plain flat single colour (#F4EFE6) | One object, centred                     |

Images are displayed inside a framed panel, so plain backgrounds are fine and no cutout is needed.
Commit files as `public/art/<kind>/<slug>.png`.

## First three prompts

1. Background: "[Base style]. A wide view of a crumbling stone fortress on a hill at golden hour,
   twelve tall towers, banners with a spiral motif, a winding path leading up from a meadow."
2. Monster: "[Base style]. A goblin with nine eyes arranged in a triangle on its forehead, green
   skin, mischievous grin, holding a wooden club, full body, facing the viewer."
3. Character: "[Base style]. A young wizard apprentice with a slightly-too-big pointed blue hat,
   a star-tipped staff, a determined smile, waist up, facing the viewer."
