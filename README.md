# Number Wizard

A math-practice game wrapped in a Dungeons & Dragons-style adventure. Cast Spells by answering
multiplication Problems, defeat monsters, collect Loot and earn Achievements.

Play it at <https://www.digestibledevops.com/number-wizard/>.

## Run it locally

You need [Node.js](https://nodejs.org/) 22 or newer.

```bash
git clone https://github.com/brendonthiede/number-wizard.git
cd number-wizard
npm install
npm run dev
```

Then open <http://localhost:5173/number-wizard/>. The page reloads by itself when you change a
file. Press `Ctrl+C` in the terminal to stop.

### Play on another device

To try it on a tablet or Chromebook on the same Wi-Fi:

```bash
npm run dev -- --host
```

Vite prints a `Network:` address. Open it on the other device and add `/number-wizard/`. Copy Export
in the Guide screen does not work this way, because browsers only allow clipboard access over
https or on localhost. Use Download Export instead.

### Where progress is saved

Progress lives in the browser, on that one device, for that one address. Your local copy and the
live site do not share a save. To move progress between them, open the Guide screen (the gear on
the Title screen), download an Export from one and Import it into the other.

### Try the production build

```bash
npm run build
npm run preview
```

Then open <http://localhost:4173/number-wizard/>.

## Install it

Open the live site in Chrome, then choose Install app from the browser menu (or the install icon in
the address bar). It opens like any app and works with no Wi-Fi: every screen and every image is
kept on the device after the first visit. Progress stays on that device, as above.

## More

- `CLAUDE.md` has the commands for tests and checks, and the working conventions.
- `CONTEXT.md` is the glossary for the words the game uses.
- `ideas.md` holds the full intent, and `docs/adr/` records the lasting decisions.
