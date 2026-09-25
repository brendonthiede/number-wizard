# PWA and sound

## Context

`docs/design.md` promises an installable PWA that works offline on Noah's Chromebook, and sound:
six effects, music, two toggles remembered between sessions, no sliders. Neither exists. The site
already has a manifest and icons, so today it installs but does nothing offline, and every screen
is silent.

Decided with Brendon: two independent halves in two PRs, PWA first. Effects are synthesised in
code with the Web Audio API, so there are no files, licences or attribution to source. Music is
deferred until Brendon has tracks; its toggle ships greyed.

## Half 1: PWA (branch `feat/pwa`)

**Approach.** `vite-plugin-pwa` in `generateSW` mode precaches the whole build, art included
(the built site is 2.9 MB, 1.3 MB of it art), so the game runs with no network after one visit.
`registerType: 'autoUpdate'` picks up a new deploy on the next load with no prompt. The save lives
in IndexedDB and is untouched.

- `package.json`: add `vite-plugin-pwa` as a dev dependency. It is the one new dependency of the
  plan; a hand-written service worker would need the build's hashed file names injected, which is
  the plugin's job.
- `vite.config.ts`: `VitePWA({ registerType: 'autoUpdate', manifest: false, workbox: {
  globPatterns: ['**/*.{js,css,html,webp,woff2,png,ico,webmanifest}'], maximumFileSizeToCacheInBytes:
  4_000_000 }, includeAssets: ['art/**', 'fonts/**'] })`. `manifest: false` keeps the existing
  `public/site.webmanifest` as the single manifest and the `index.html` link to it; the plugin only
  emits and registers the service worker. `base` stays `/number-wizard/`, which the plugin honours
  for the worker scope.
- `src/main.tsx`: `import { registerSW } from 'virtual:pwa-register'; registerSW();` guarded so the
  test environment, which has no service worker, is unaffected. Add the plugin's client types to
  `tsconfig.json` (`"types": ["vite/client", "vite-plugin-pwa/client"]`) so the virtual module type-checks.
- `public/site.webmanifest`: `start_url` and `scope` become `/number-wizard/` explicitly; today's
  `./` resolves the same but the worker scope must match.
- `README.md`: a short "Install it" section: open the site in Chrome, use Install app from the
  menu, and it then works with no Wi-Fi.
- Tests: the plugin runs at build time, so no unit test is added for it. CI already runs
  `npm run build`; the evidence is the built `dist/sw.js` naming every art file, checked by hand
  below and in the PR description.

**Verify.** `npm run build`; confirm `dist/sw.js` and `dist/workbox-*.js` exist and `sw.js`
names `art/monster/gob-nine.webp` and `fonts/lexend-latin.woff2`. `npm run preview`, open
`http://localhost:4173/number-wizard/`, play one fight, then in DevTools set Network to Offline and
reload: the game loads and the fight's art shows. Chrome's install prompt appears in the address
bar. The whole test suite, typecheck, docstring check and build pass.

## Half 2: sound effects and toggles (branch `feat/sound`)

**Effects** (`src/ui/sound.ts`, new). One shared `AudioContext` created on first use, resumed on
each call (browsers suspend it until a user gesture; every effect follows a tap or Enter, so this
always succeeds). Each effect is a few oscillator notes with a short gain envelope:

| Effect | Notes | Character |
|---|---|---|
| Hit | one square note, 440 Hz, 90 ms | a plain thump |
| Critical Hit | two rising square notes, 660 then 880 Hz, 70 ms each | a bright ding |
| Glancing Blow | one triangle note sliding 440 to 330 Hz over 150 ms | a wobble |
| Miss | one sawtooth note at 110 Hz, 220 ms | a low buzz |
| Level up | four rising square notes, C E G C, 90 ms each | a fanfare |
| Loot drop | three quick triangle notes, 880, 1100, 1320 Hz, 60 ms each | a sparkle |

Exports `Effect` as an as-const object (`Effect.Hit` etc, no magic strings) and
`playEffect(effect: Effect)`, which returns at once and does nothing when effects are off or the
browser has no `AudioContext`. Output gain is fixed at 0.15 so nothing is startling on a
Chromebook speaker.

**Toggles.** Two, on the Title screen beside the gear: "Effects on" / "Effects off" and "Music",
the latter disabled with the line "coming soon" until music exists. Stored in `localStorage`
under `number-wizard-sound` as `{ effects: boolean; music: boolean }`, default effects on. This
is a device preference, not learning history, so it stays out of the save and its version:
ADR-0001 covers the Player's history, and an Export should not carry one device's speaker
choice. Reads and writes are wrapped so a blocked `localStorage` means "effects on" and never an
error. `src/ui/sound.ts` owns the read and write; the Title screen owns the buttons.

**Hook points.**
- `src/ui/EncounterScreen.tsx`, in `doCast` after `setFeedback`: `playEffect` by outcome, through a
  small `EFFECT_BY_OUTCOME` record keyed by `Outcome`. This is the only place an Attempt resolves.
- `src/App.tsx`, in the Encounter's `onFinish` after `setScreen(Screen.Result)`: Loot drop when
  `revealFor` returned a reveal with `isNew`, then Level up when `levelUp(xpBefore, xp)`. Both in
  that order, 250 ms apart, so a first win plays both without overlap. Survival's `onEnd` plays
  Level up only.
- No sound on the Map, the Guide or the Trophy Case.

**Tests (TDD).**
- `src/ui/sound.test.ts`: `playEffect` calls into a stubbed `AudioContext` with the note count and
  frequencies from the table for each effect; does nothing when effects are off; does nothing and
  does not throw when `AudioContext` is undefined; the setting round-trips through a stubbed
  `localStorage` and defaults to effects on when it throws.
- `src/ui/EncounterScreen.test.tsx`: each outcome plays its effect (spy on `playEffect`); a cast with
  effects off plays nothing.
- `src/App.test.tsx`: the first win plays Loot drop then Level up; a Retreat plays nothing extra.
- `src/ui/TitleScreen.test.tsx` (new; the Title screen has no test file today): the Effects
  toggle flips the stored setting and its label; the Music toggle is disabled and says "coming soon".
- `docs/design.md` sound line gains a dated note: effects synthesised, music deferred.

**Verify.** In a browser: a fight with effects on plays a distinct sound on Hit, Critical Hit,
Glancing Blow (a Quest 2 grid with a wrong cell) and Miss; a first win plays the sparkle then the
fanfare; the Effects toggle silences it all and survives a reload. Nothing plays before the first
tap, and the console shows no AudioContext warning. Full suite, typecheck, docstrings, build.

## Order

PWA first: a build change with no gameplay risk, and it makes offline play work at once. Sound
second, judged in play testing on its own. Each half is one branch and one PR that Brendon merges.
