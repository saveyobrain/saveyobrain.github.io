# Save Yo Brain

> Working title. The name, website and repo (`saveyobrain`) may change later; the name lives in
> [`src/config.ts`](src/config.ts) and [`index.html`](index.html).

## Core idea

**Free browser games that help children, and people in general, build and keep their basic math skills.**

Basic math is a life skill, as important as reading and writing. Like any skill, it fades when it isn't
used. Save Yo Brain turns short bursts of mental math into simple, friendly games so anyone can practice
a little every day. No accounts, no ads, nothing to install: open the page and play.

Principles:

- **Free and instant.** Runs in any modern browser on desktop, tablet or phone.
- **Math is the game mechanic,** not a quiz bolted on: solving tasks is how you progress.
- **Gentle difficulty curve.** Start with numbers up to 6 and two answer options. Later levels bring bigger
  numbers, percentages and equations with up to four options.
- **Bright and friendly,** never dark or scary.

## Games

| Game | Idea |
| --- | --- |
| **Save the Light** | Find the exit of a random maze. Your candle only lights a small area around you and slowly burns down. Solve math tasks to keep it burning. Mazes get bigger, tasks get harder and the candle burns faster as you level up. |

More games are coming.

### Save the Light controls

- Move: arrow keys, WASD, or click/tap a tile inside the light
- Answer: keys `1`-`4` or click/tap an answer
- Pause menu: `Esc` or the button in the top-right corner

## Development

Requires [Node.js](https://nodejs.org/) 20+.

```bash
npm install
npm run dev       # local dev server at http://localhost:5173
npm test          # unit tests (math task generator, maze generator)
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

Tech: [Vite](https://vite.dev/), TypeScript and [Babylon.js](https://www.babylonjs.com/). The UI is plain HTML/CSS
over the canvas. Babylon.js is only downloaded when a game is opened, so the hub page loads instantly.

### Project layout

```
src/
  main.ts            hash router: #/ (hub) and #/play/<gameId>
  config.ts          site name (working title)
  strings.ts         all UI text (English)
  hub/               game list page
  core/
    game.ts          GameModule interface every game implements
    registry.ts      list of games shown in the hub
    math/            shared task generator and difficulty tiers
    ui/              task panel, HUD, modal cards
    input.ts         keyboard mapping (arrows/WASD, 1-4, Esc, Enter)
    storage.ts       progress saved in localStorage
    engine.ts        Babylon engine/scene setup
  games/
    save-the-light/  maze, player, candle, rendering, level progression
tests/               Vitest unit tests
```

### Adding a new game

1. Create `src/games/<game-id>/index.ts` that exports a `runtime` implementing `GameRuntime` from
   [`src/core/game.ts`](src/core/game.ts).
2. Add an entry to `GAMES` in [`src/core/registry.ts`](src/core/registry.ts) with a lazy `load()` import.
3. Reuse `core/math` for tasks, `core/ui` for the task panel/HUD/menus and `core/storage` for progress.

## Deployment

Live site: **https://saveyobrain.github.io/**

The GitHub Actions workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) tests, builds and
publishes to GitHub Pages on every push to `main`. Day-to-day work happens on `dev`; merge into `main` to release.

- Pages source is set to **GitHub Actions** in the repo settings.
- The site is served from the domain root, so the workflow builds with `BASE_PATH=/`. For a project site under a
  sub-path (`https://<owner>.github.io/<repo>/`), set `BASE_PATH=/<repo>/` instead.
- Custom domain: set it in **Settings > Pages > Custom domain** and add the DNS records GitHub shows there.
  With Actions-based deployments no `CNAME` file is needed, and `BASE_PATH` stays `/`.
