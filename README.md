# The Muster Roll

A browser-based Warhammer hobby tracker — armies, painting pipeline, and paint inventory. Import from CSV, edit inline, auto-save to localStorage.

**Live locally:** open `index.html` in a browser, or run a static server:

```bash
npm run dev
# or: npx serve .
# or: python -m http.server 8080
```

> ES modules require a local server (not `file://` in most browsers).

## Quick start

1. Open the app
2. **Import Armies CSV** — use `warhammer_armies.csv` or download the template
3. **Import Paints CSV** — use `warhammer_paint_inventory.csv` or download the template
4. Edit states inline; changes save automatically

See [docs/IMPORTING_CSV.md](docs/IMPORTING_CSV.md), [docs/SCHEMA.md](docs/SCHEMA.md), and [docs/FACTION_PRESETS.md](docs/FACTION_PRESETS.md) for faction colours and supported game tokens.

## Publish (GitHub Pages)

1. Push this repo to GitHub
2. **Settings → Pages → Source:** Deploy from branch `main`, folder `/ (root)`
3. Site URL: `https://<user>.github.io/<repo>/`

Works the same on Netlify / Cloudflare Pages — point at repo root, no build command.

## Project structure

Modular ES modules — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for extension points (custom states, third-party importers, themes, cloud sync).

## Sample data

- `warhammer_armies.csv`
- `warhammer_paint_inventory.csv`

`warhammer_tracker.html` redirects to `index.html` for backwards compatibility.
