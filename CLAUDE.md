# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # once
npm test             # all tests, single run (Vitest)
npm run test:watch   # watch mode
npx vitest run src/engine/mastery.test.ts          # one file
npx vitest run -t "returns to Learning"            # one test by name
npm run typecheck    # tsc, no emit
npm run dev          # Vite dev server
npm run build        # typecheck + production build to dist/
```

Deploys to GitHub Pages from `main` via `.github/workflows/deploy.yml`. Site base path is
`/number-wizard/`.

## What Number Wizard is

A math-practice game for kids wrapped in a Dungeons & Dragons-style adventure. Full intent is in
`ideas.md`; the points that shape design decisions:

- **Skills, in dependency order:** multiplication table (0 to 12), multi-digit multiplication,
  powers and exponents, long division with remainders. Earlier Skills get periodic Review.
- **Vocabulary:** `CONTEXT.md` is the glossary. Use its terms in code, issues, and tests.
- **Game layer:** story-driven quests and challenges; character progression and leveling driven by
  math performance; fun feedback and rewards; achievements.
- **Adaptive difficulty:** difficulty responds to the player's performance.
- **Performance tracking:** record per-problem performance details (not just scores) so an AI
  layer can personalize practice and drive adaptive difficulty later. Design the data model with
  this consumer in mind from the start.

## Working conventions

- **TDD is mandatory.** Write the failing test first, then the code, for every change. The
  math engine, Work checkers, and spaced-repetition scheduler are pure logic under Vitest.
- Keep the math engine (problem generation, answer checking, difficulty) separate from the
  game/story layer so each can be tested and changed on its own.
- **Art is AI-generated and committed.** Claude Code writes the image prompt; Brendon pastes
  it into ChatGPT and commits the resulting file. Never generate placeholder art that pretends
  to be final.
- Decisions with lasting consequences live in `docs/adr/`. Read them before changing storage,
  networking, or the AI loop.
- Add commands (build, run, lint, test, single test) to this file as soon as the toolchain lands.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for this repo, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical labels, unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
