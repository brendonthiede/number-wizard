# Music guide

Three tracks, from `docs/design.md`: a title loop, a battle loop and a victory sting. They are
generated in Suno from the prompts below, the way art comes from ChatGPT. Claude Code writes the
prompts; Brendon generates, picks and commits the files. Playback is not built yet: the Music
toggle on the Title screen is greyed until these files exist, and wiring them in is its own plan.

## Shared sound

Every prompt starts from the same idea, so the three tracks belong to one game: a friendly,
slightly silly fantasy adventure for a 10-year-old. Storybook orchestra with a chiptune wink:
flute, lute, pizzicato strings, glockenspiel, a little brass, light hand percussion, and one
retro square-wave lead used sparingly. Bright major keys. Never dark, never tense, never epic.

## Using Suno

- Use Custom mode. Put the prompt in the Style box, leave Lyrics empty and set Instrumental on. If
  a version offers an Exclude Styles box, put `vocals, choir, lyrics, dubstep, trap, metal` in it.
- Generate a few takes and pick by ear. Suno cannot promise a seamless loop, so the prompts ask
  for a steady tempo with no intro, no outro and no fade. Trim the take to a whole number of bars
  at the given BPM and the loop will sit well enough for a game.
- Suno makes tracks of a minute or more. For the sting, keep the first few seconds up to the
  final chord and cut the rest.

## Files

Commit the masters as MP3 under `public/music/` with these names. Aim for 128 kbps mono; a loop
of a minute is then about 1 MB, which the offline bundle can carry.

| Track | File | Length | BPM |
|---|---|---|---|
| Title loop | `public/music/title-loop.mp3` | 60 to 90 s, trimmed to whole bars | 92 |
| Battle loop | `public/music/battle-loop.mp3` | 45 to 60 s, trimmed to whole bars | 128 |
| Victory sting | `public/music/victory-sting.mp3` | 3 to 5 s, ending on the final chord | 120 |

## Attribution

`docs/design.md` asks for an attribution file for every sourced track. Record here, when the
files land: the Suno plan the account was on at generation time (the plan decides the rights to
the output), the date, and the take's Suno link if there is one.

## Prompts

Complete and paste-ready. Each is one Style box.

### title-loop

Instrumental, no vocals. A warm, whimsical fantasy-adventure theme for a children's game title
screen: storybook orchestra with a light chiptune wink. Gentle flute melody over lute and
pizzicato strings, glockenspiel sparkle on the offbeats, soft hand percussion, a hint of horn on
the phrase ends, and one quiet square-wave counter-melody. Bright major key, 92 BPM, steady tempo
throughout, calm and hopeful, a little playful, like the map of a kind kingdom unfolding. Starts
straight in on the first beat with no intro, keeps the same energy all the way through, and never
fades out or builds to a big finish, so it can loop.

### battle-loop

Instrumental, no vocals. A bouncy, energetic battle theme for a children's fantasy game, playful
rather than menacing: driving pizzicato strings and snappy hand percussion under a cheeky
square-wave chiptune lead, quick flute runs, glockenspiel hits on the accents, and short brass
stabs. Bright major key with a mischievous minor turn now and then, 128 BPM, steady tempo
throughout, exciting and fun, like a cartoon goblin bouncing around a castle. Starts straight in
on the first beat with no intro, holds one level of energy the whole way, and never fades out or
builds to a big finish, so it can loop.

### victory-sting

Instrumental, no vocals. A short, triumphant fanfare for a children's fantasy game: a bright brass
flourish rising in three steps, glockenspiel and flute sparkling over it, a quick drum roll into
one big happy final chord that rings and stops. Bright major key, 120 BPM, joyful and silly,
like a tiny parade for a wizard who just won. Begins at once with no build-up and reaches its
final chord within four seconds; anything after that will be cut.
