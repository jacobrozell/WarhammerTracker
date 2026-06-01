# The Muster Roll — improvement backlog

_Audit: 2026-05-31 (technical). User journey audit: 2026-05-31 — see [User audit](#user-audit-2026-05-31). Shipped items in [Done](#done). Larger ideas in [future_ideas.md](future_ideas.md)._

---

## User audit (2026-05-31)

### Onboarding & first run

- [x] **Two-step setup guidance** — empty states mention both tabs / CSV files
- [x] **Load sample / demo collection** — Sample data button loads shipped CSVs
- [x] **Replace vs Append on drag-and-drop** — import mode dialog before drop import

### Armies — functionality

- [x] **Paint rack CRUD in UI** — add / edit / delete paints without CSV round-trip
- [x] **Painting queue / saved views** — View chips: backlog, WIP, table-ready
- [x] **Game + Faction filters combine (AND)** — separate game + faction chips
- [x] **Persist sort & filter prefs** — saved in settings, restored on load
- [x] **Broader undo** — state changes + bulk advance via undo stack (Ctrl+Z)
- [x] **Move unit between armies** — ⇄ action on unit row
- [x] **Merge duplicate unit rows** — per-army footer action
- [x] **Bulk advance filtered set** — → Advance visible toolbar button
- [x] **Source ↔ paint linking** — fuzzy match; click paint source → filter armies
- [x] **Progress stat clarity** — separate Based and Done stat tiles
- [x] **Per-army pipeline** — ⚙ on army header; optional custom stages
- [x] **Faction crest / colour editor** — Factions button; Game:Faction,Crest,#hex
- [x] **Notes tags** — `#tag` in notes; Tag filter chips
- [ ] **Unit photos, points, loadout, codex version**
- [ ] **Army stable IDs** — survive CSV renames without duplicate army blocks
- [x] **Squad per-model tracking** — expand multi-model units; per-member state/notes; CSV Member columns
- [ ] **Squad / project grouping** — relate split rows across armies

### Paints — functionality

- [x] **Filter-scoped paint stats** — stats show (filtered) when search/filters active
- [x] **“Paints I need” / running low** — Running low flag + filter chip on paint rack

### Cross-cutting behaviour

- [x] **Automatic backup reminder** — toast if no Full backup in 14+ days
- [x] **Multi-tab merge** — clearer reload banner (use other tab's data)
- [x] **Import warnings prominence** — expandable list + copy button in import modal
- [x] **Export settings reminder** — CSV export toast mentions Full backup

### UI / UX polish

- [x] **Toolbar hierarchy** — primary actions + Import/export `<details>` groups
- [x] **State change as hero on mobile** — larger → advance button on small screens
- [x] **Filter bar density** — Game/Faction dropdowns when 8+ factions
- [x] **Unify modals on `<dialog>`** — import/form use native `#importModal` dialog
- [x] **Form modal focus** — first field on open
- [x] **Keyboard shortcuts** — `/` focus search (footer hint)
- [x] **Print expands all armies** — `beforeprint` clears collapsed + re-renders
- [x] **Notes as textarea** — multi-line notes in unit rows
- [x] **PWA install UX** — `beforeinstallprompt` install banner
- [x] **Two-tab empty-state copy** — mention both CSV files upfront

### Performance (large collections)

- [x] **Avoid full filter DOM rebuild** — preserve filter bar scroll on re-render
- [ ] **List virtualization** — 500+ rows without full `innerHTML` rebuild
- [ ] **Incremental DOM** — patch single rows instead of army blocks

---

## Security

- [x] **Harden JSON backup restore** — `parseBackup()` / `sanitize.js`: size cap, row limits, unknown keys rejected, string caps, pipeline hex via `safeColor`
- [x] **Cap CSV import size** — 8 MB limit in `handleImportFile` / JSON restore
- [x] **Content-Security-Policy** — meta tag in `index.html`
- [x] **Self-host or SRI-lock Google Fonts** — `css/fonts.css` + woff2 in `css/fonts/`
- [x] **Validate custom pipeline on save** — `safeColor` in `settings-panel.js`

## Performance

- [x] **Debounce army search** — 200 ms, matches paint search
- [ ] **Avoid full filter DOM rebuild** — filters still replace innerHTML each render (scroll preserved)
- [x] **Service worker for offline use** — `sw.js` + registration in `app.js`
- [x] **Lazy-render collapsed armies** — placeholder row until expand triggers re-render
- [x] **Fix Expand All + lazy units** — Expand All re-renders via `domainRefresh()`

## UI / UX

- [x] **Fix docs link on GitHub Pages** — `docs/importing.html`
- [x] **Theme toggle a11y copy** — aria-label reflects dark / light / system cycle
- [x] **Skip link + landmark** — skip link + `<main id="main">`
- [x] **`:focus-visible` on interactive controls**
- [x] **`prefers-reduced-motion`**
- [x] **Unify modals on `<dialog>`** — import/form use native `#importModal` dialog
- [x] **“No results” filtered empty state** — armies + paints with clear-filters button
- [x] **Keyboard shortcut hint** — footer + undo toasts mention Ctrl+Z
- [ ] **PWA install UX** — manifest still SVG-only; PNG icons optional

## Data integrity & storage

- [x] **Proactive storage quota warning** — ~80% budget toast via `storage-warn`
- [x] **Backup restore preview** — counts shown in confirm dialog
- [x] **Schema version migrations** — `runMigrations()` hook in `store.js`
- [x] **Expand undo** — army delete restorable via Ctrl+Z / Undo

## DevEx, quality & ops

- [x] **CI: run tests on push/PR** — `.github/workflows/ci.yml`
- [x] **Lint / typecheck script** — `npm run typecheck` (tsc + jsconfig); CI step
- [x] **Test gaps** — unit tests (sanitize, store, CSV round-trip, tags, source-match); `npm run test:coverage`; Playwright smoke in `tests/e2e/`
- [x] **`npm run dev` script** — `serve` devDependency
- [x] **Dependabot / `npm audit`** — `.github/dependabot.yml` + audit in CI
- [x] **Add `LICENSE`** — MIT

## Bugs & polish (small)

- [x] **`form-modal` option values** — `escapeAttr` for attributes
- [x] **Import modal focus on open** — focuses Done button
- [x] **Tab panel focus on switch** — focuses first control in panel
- [x] **Revoke object URLs defensively** — `try/finally` in `downloadText`

---

## Done

_(2026-05-31 — audit pass)_

**Security & data**

- JSON backup validation (`js/data/sanitize.js`, `js/core/limits.js`)
- CSV/JSON 8 MB import cap
- CSP meta tag
- Pipeline hex sanitization on save
- Storage quota warning at 80%
- Backup restore preview
- `runMigrations()` hook
- Army + unit undo

**Performance**

- Debounced army search
- Service worker (`sw.js`)
- Lazy collapsed army bodies

**UI / UX / a11y**

- `docs/importing.html` CSV guide
- Theme toggle aria-labels (3-state)
- Skip link, `<main>`, focus-visible, reduced motion
- Filtered empty states
- Ctrl+Z hints
- Tab focus on switch, modal focus on open

**DevEx**

- GitHub Actions CI + npm audit
- Dependabot
- `npm run dev`
- MIT LICENSE
- Tests: dom, sanitize (98 total)

_(2026-05-31 — full backlog pass)_

**Bugs & performance**

- Model-weighted collection/army progress and meter legend
- Multi-tab `storage` banner with reload
- Batch persist (`beginBatch` / `endBatch`) for bulk updates
- Debounced save toasts; silent note/qty/source edits

**Armies**

- Inline unit name, qty, source; spearhead toggle
- New / rename / delete army; add-unit form modal
- Duplicate row; undo delete (↩ / Ctrl+Z)
- Advance all units in army; per-row → advance
- Filters: state, source, spearhead; sort armies & units
- Collapsed armies persisted in settings

**Paints**

- Brand filter; duplicate names merged on import
- Minimal CSV (Name column only); TSV/semicolon auto-detect
- Source ↔ unit count on cards

**Import / export / safety**

- Import preview in confirm dialog; append mode
- Timestamped CSV exports; JSON backup includes settings
- Excel extension error; clear-all; first-visit banner

**UX / a11y / platform**

- Custom pipeline settings; theme cycles dark → light → system
- Native `confirm` → `<dialog>`; modal focus trap; tablist pattern
- Global drag-and-drop; grouped filter chips; tab badges & `#paints` hash
- Mobile toolbar rules; print CSS; docs link; favicon + web manifest
- Offline-friendly font stack; light-mode progress contrast

**Earlier batch**

- Note autosave without focus loss; filter-scoped stats
- Paint search debounce; import replace confirmation; JSON backup UI

_(2026-05-31 — user audit implementation)_

**Onboarding & import**

- Sample data button (`js/data/demo.js`); empty-state two-tab copy
- Drop/global import mode dialog (Replace / Append / Cancel)

**Armies**

- Game + Faction AND filters; View chips (backlog / WIP / table-ready)
- Persist filter + sort prefs in settings
- Expand All re-render fix; bulk advance visible; merge duplicates
- Move unit between armies; Based / Done stat split; notes as textarea

**Paints**

- Add / edit / delete in UI; fuzzy source ↔ unit counts
- Clickable source → armies tab filter; filter-scoped stats

**UX**

- `/` focus search; print expands all; form modal focuses first field

_(2026-05-31 — user audit batch 2)_

**Undo & pipelines**

- Undo stack (30 deep): deletes, state changes, bulk advance
- Per-army pipeline editor (⚙ on army header)
- Global + army pipelines used for progress and advance

**Factions & filters**

- Factions settings editor (Game:Faction keys)
- Notes `#tags` with tag filter chips
- Compact Game/Faction dropdowns when 8+ factions
- Filter bar scroll preserved on re-render

**Paints & backup**

- Running low flag + filter on paint rack
- Backup reminder after 14 days without Full backup
- `lastBackupAt` recorded on JSON export

**UX & platform**

- Toolbar groups (primary + Import/export details)
- Import modal: warning list, expand all, copy
- PWA install banner; multi-tab banner copy
- Mobile: larger → advance button; danger styling on Clear all

_(2026-05-31 — backlog batch 3)_

**Security & platform**

- Self-hosted fonts (`css/fonts.css`, latin woff2 subset); CSP no longer allows Google CDN
- Import/form modal migrated to native `<dialog>` (matches confirm dialogs)
- `npm run typecheck` + CI; `jsconfig.json` with checkJs on `js/`
