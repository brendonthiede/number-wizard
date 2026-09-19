# Screen layout from play testing: a split into independent features

## Context

Play testing on the first battle: a win that gives Loot and several Achievements pushes the Loot
off the top of the screen. Other screens lose content at the top too, and their Continue or Title
buttons can sit well below the bottom edge.

What I found: two separate causes.

1. **Focus scrolls the page.** The result, Story Panel, closing, Survival result and Guide
   confirmation screens put `autoFocus` on a button at the bottom, and the Quest and Quest list
   screens call `.focus()` on a row. The browser scrolls to the focused element, so the top of the
   screen goes off the top. `TrophyCaseScreen.tsx` already hit this and fixed it for itself with
   `focus({ preventScroll: true })`. Also, `App` swaps screens without a page load, so a scroll
   position carries over from one screen to the next.
2. **Tall content.** `.screen` is one centred column with `min-height: 100vh`. Every new
   Achievement is its own line, so a big win is simply taller than a 768 px Chromebook screen.

Brendon asked for the work to be split into as many independent features as possible, each
planned, validated and built on its own. Decisions so far: the carousel holds Achievements only
(Loot and the Level up line stay always visible); the pinned navigation experiment is run locally
with a few options and screenshots for feedback, covering the result and Quest screens first.

## The features

| # | Feature | Depends on | Ships as |
|---|---|---|---|
| 1 | Screens open at the top | nothing | PR |
| 2 | Achievement carousel | nothing | PR |
| 3 | Pinned navigation experiment | nothing | screenshots and a recommendation, no merge |
| 4 | Pinned navigation on the result and Quest screens | the option chosen in 3 | PR |
| 5a-5d | Pinned navigation on the other screens, one group each | the layout piece from 4 | one PR each |

1, 2 and 3 are independent of each other and can go in any order. Suggested order is as numbered:
1 is the smallest and removes the worst symptom, 2 fixes the height, 3 then judges the pinned bar
on screens that are already behaving.

### 1. Screens open at the top (built on approval of this plan)

- New `src/ui/useFocusOnMount.ts`: returns a ref and focuses it once on mount with
  `preventScroll: true`. It is the pattern already in `src/ui/TrophyCaseScreen.tsx`, lifted out.
- Use it in place of `autoFocus` on `ResultScreen`, `SurvivalResultScreen`, `StoryPanelScreen`,
  `ClosingPanelScreen`, and in place of the bare `.focus()` in `QuestScreen`, `QuestListScreen`
  and `TrophyCaseScreen`. The Guide confirmation's Cancel keeps `autoFocus`: it appears inside the
  Guide screen, not on mount, and that view is a few lines tall, so nothing scrolls.
- Left alone on purpose: the Name input on `CreateScreen` (it is at the top), and the
  Encounter screen's inputs and its Next Problem button (they are in-page focus moves where
  scrolling to the control is wanted on a narrow layout).
- `src/App.tsx`: scroll to the top whenever `screen` changes, so a scrolled Quest list never
  leaves the Story Panel half way down. jsdom has no `window.scrollTo`, so guard the call and
  stub it in the test.
- Tests first: the hook focuses with `preventScroll: true` (spy on `HTMLElement.prototype.focus`);
  each screen's existing "is focused" test keeps passing unchanged; `App` calls `scrollTo(0, 0)`
  on a screen change.
- Keyboard play is unchanged: the same button still has focus, so Enter still continues.

### 2. Achievement carousel

- New `src/ui/AchievementCarousel.tsx`, used by `ResultScreen` and `SurvivalResultScreen` in place
  of the list of Achievement lines. One Achievement shows at a time in a fixed-height slot, with
  previous and next arrow buttons and a "2 of 4" count. One Achievement shows with no arrows.
- It rotates every four seconds. Using an arrow stops the rotation for good. It never rotates
  when the device asks for reduced motion. Arrows are real buttons with names, the slot is a
  polite live region only while the Player is driving it, and nothing relies on colour.
- To settle in its own plan: whether the arrows wrap, and whether rotation pauses while an arrow
  has keyboard focus.

### 3. Pinned navigation experiment (local only)

- A throwaway branch. Build two or three layouts for the result screen and the Quest screen, take
  screenshots at 1366 × 768 and at a narrow width, each with short and with tall content, and
  bring them back with a recommendation. Nothing is merged.
- Options to try: a sticky bar at the bottom of the normal page scroll; an app shell where the
  screen is exactly the viewport height, the content scrolls inside it and the bar never moves;
  and a side rail on a wide screen, where the Encounter screen already keeps its keypad, falling
  back to a bottom bar when narrow.
- Things to judge: how much height the bar costs on a Chromebook, whether content hides under it,
  focus and Tab order, and how it looks beside the Encounter screen, which already fits.

### 4. Pinned navigation on the result and Quest screens

The option chosen in 3, built properly with tests, as one shared layout piece (a nav area plus a
scrolling body) that the later screens reuse.

### 5. The other screens, one small feature each

- 5a: Story Panel and closing panel.
- 5b: Trophy Case.
- 5c: Guide screen.
- 5d: Survival result, Quest list, Character creation and Title. These are short; some may need
  nothing, and saying so is a valid outcome.

## Verify (feature 1)

`npm test`, `npm run typecheck`, `npm run docstrings`, `npm run build`. Then in a browser at
1366 × 768: win a first battle on a new save and confirm the result screen opens at the top with
Victory, the XP and the Loot in view; scroll the Quest screen down, pick a monster, and confirm the
Story Panel opens at the top. Feature branch and PR as usual.
