# Future ideas

Extension points: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Shipped in app (see README)

- CSV templates, import preview/append, JSON backup with settings
- Dark / light / system theme, custom pipeline editor
- Inline unit editing, army CRUD, undo, duplicate row
- Filters (game, faction, state, source, spearhead), sorting
- Model-weighted progress, multi-tab storage warning
- PWA manifest + favicon, print stylesheet, mobile toolbar layout

## Backlog (not in scope yet)

1. **Cloud / multi-device sync** — extend `store.js` + `exportSnapshot()`
2. **Third-party importers UI** — register in `js/import/registry.js`
3. **Paint rack editing** — add/edit/delete paints in UI (import/export today)
4. **Faction crest/colour editor** — settings overrides, per-army ◐ reapply, contrast audit, CSV Crest/Color (see [docs/FACTION_PRESETS.md](docs/FACTION_PRESETS.md))
5. **Per-army pipeline** — skip magnetising etc. for armies that do not use it
6. **Painting queue / journal** — “up next”, finished-this-month history
7. **Notes tags** — filter e.g. “repaint candidate”
8. **Squad / project grouping** — relate split rows across armies
9. **Qty rollup** — collapse duplicate unit rows automatically
10. **Unit photos & points / loadout / codex version**
11. **List virtualization** — 500+ rows without full `innerHTML` rebuild
12. **Incremental DOM** — patch single rows instead of army blocks
13. **PWA install prompt** — optional `beforeinstallprompt` UX
14. **Army stable IDs** — survive CSV renames without new army blocks


Ask AI what I should do next based on the current state