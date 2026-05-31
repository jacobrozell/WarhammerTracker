# Faction presets & army colours

Army headers and faction filter chips use a **crest** (short label, ≤8 characters) and an **accent colour** (hex). These are UI accents inspired by faction lore—not Citadel paint matches.

## Data model

### Source of truth: `FACTION_DEFS`

Each definition in `js/data/factions/defs.js`:

| Field | Purpose |
|-------|---------|
| `label` | Canonical faction name (matches CSV `Faction` column) |
| `crest` | Abbreviation shown in the army header badge |
| `color` | Hex accent for borders, chips, `--fac` CSS variable |
| `games` | Which `Game` values use the composite key `Game:Faction` |
| `aliases` | Extra strings that resolve to this def (e.g. `Eldar` → `Aeldari`) |

Built maps (see `js/data/factions/build.js`):

- **`COMPOSITE_FACTION_PRESETS`** — `"40k:Ultramarines"` → `[crest, color]` (preferred when `game` is known)
- **`DEFAULT_FACTION_PRESETS`** — flat `"Ultramarines"` → `[crest, color]` (import fallback, synonyms)
- **`CANONICAL_FACTIONS`** — `{ "40k": ["Ultramarines", …], … }` for UI and tests

### Resolution order (`resolveFactionPreset`)

1. Normalize faction via **`FACTION_ALIASES`** (legacy CSV labels, case-insensitive)
2. **`mergeFactionPresets(userOverrides)`** — `{ ...builtDefaults, ...settings.factionPresets }`
3. Lookup **`${game}:${faction}`** when `game` is provided (no flat fallback — avoids cross-game collisions like `Skaven`)
4. If `game` is omitted, lookup flat **`faction`**
5. Fallback: first two letters of faction name + `#888`

### User overrides

`settings.factionPresets` stores **only overrides**, not the full catalogue. They are merged on top of built defaults:

```js
mergeFactionPresets(settings.factionPresets)
// => { ...DEFAULT_FACTION_PRESETS, ...user }
```

Keys may be flat (`Ultramarines`) or composite (`40k:Ultramarines`).

### Army presentation (hybrid)

`getArmyPresentation(army, userPresets)`:

1. `army.crestOverride` / `army.colorOverride` if set (per-army custom theme)
2. Else `resolveFactionPreset(faction, { game, presets })`
3. Else stored `army.crest` / `army.color` (legacy snapshots from older imports)

The UI uses **presentation** so preset updates apply without re-importing. Import still writes `crest`/`color` for backward-compatible JSON/CSV export.

## Supported `Game` column values

| Token | System |
|-------|--------|
| `40k` | Warhammer 40,000 |
| `AoS` | Age of Sigmar |
| `TOW` | Warhammer: The Old World |
| `30k` | Horus Heresy |
| `Necromunda` | Necromunda |
| `Warcry` | Warcry (alliance buckets) |
| `Blood Bowl` | Blood Bowl |
| `MESBG` | Middle-earth Strategy Battle Game |

Kill Team rows can reuse **`40k`** factions.

## Import behaviour

- Unknown `(game, faction)` pairs produce a **warning** and grey fallback (`#888`).
- Optional future CSV columns: `Crest`, `Color` (not implemented yet).

## Why composite keys?

The same English word can mean different factions in different games (e.g. Skaven in AoS vs Blood Bowl). Scoping by `Game` avoids collisions.

**Do not** map game names to factions in `FACTION_ALIASES` (e.g. `"Old World"` → `"The Empire"` was removed).

## Pipeline colours vs faction colours

| System | Stored in | Used for |
|--------|-----------|----------|
| Pipeline stages | `settings.pipeline` | Unit state dropdowns, progress meter |
| Faction accents | `FACTION_DEFS` / overrides | Army header, faction filter chips |

Keep these separate; do not drive state colours from faction accents.

## Extension points

| Task | Where |
|------|--------|
| Add a faction | `js/data/factions/defs.js` + test in `tests/faction-presets.test.js` |
| Legacy CSV label | `js/data/factions/aliases.js` |
| User-facing editor | Settings → faction overrides (`settings-panel.js`) |
| Reapply defaults to one army | Army header **◐** button or `reapplyArmyFactionDefaults()` in `store.js` |

## Roadmap (documented, not all shipped)

- [x] Composite `game:faction` lookup
- [x] Override merge for `settings.factionPresets`
- [x] Import warnings for unknown factions
- [x] `FACTION_DEFS` single source
- [x] `getArmyPresentation` hybrid
- [x] New army: game + faction pickers
- [x] Contrast checks vs light/dark theme tokens (`js/data/factions/contrast.js`, `auditFactionContrasts()`)
- [x] CSV `Crest` / `Color` columns (optional import/export; sets overrides when present)
- [x] “Reapply faction defaults” action per army (◐ on army header)
- [x] Split `defs.js` by game file (`defs-40k.js`, `defs-aos.js`, `defs-other.js`)
