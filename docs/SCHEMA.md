# Muster Roll CSV Schema

The Muster Roll accepts **two separate CSV files**: one for armies/units and one for paint inventory. Import detects the file type from its header row (case-insensitive column names).

Both files use UTF-8 encoding, comma delimiters, and RFC 4180-style quoting (fields containing commas, quotes, or newlines must be wrapped in `"`; literal quotes are doubled).

---

## 1. Armies (`warhammer_armies.csv`)

One row per **unit entry**. Multiple rows with the same `Army` value are grouped into one army list.

### Columns

| Column     | Required | Type    | Description |
|------------|----------|---------|-------------|
| `Game`     | yes      | string  | Game system, e.g. `40k`, `AoS`, `HH`, `TOW`. Free text — used for filtering. |
| `Faction`  | yes      | string  | Faction name, e.g. `Grey Knights`, `Skaven`, `Terrain`. Drives crest colour when known. |
| `Army`     | yes      | string  | Your list name (display label). Rows sharing this value form one army block. |
| `Unit`     | yes      | string  | Unit or model name, e.g. `Strike Squad (5)`, `Rat Ogors`. Parentheses can encode model counts for stats. |
| `Qty`      | no       | integer | Number of this entry (default `1`). Multiplies model count when `Unit` contains `(N)`. |
| `Source`   | no       | string  | Where it came from — box name, gift, etc. |
| `State`    | no       | enum    | Painting/build pipeline stage (default `Unassembled`). See [Pipeline states](#pipeline-states). |
| `Spearhead`| no       | boolean | `Yes` / `No` (also `true`/`false`, `1`/`0`). Omit for games that do not use spearhead lists (e.g. 40k). |
| `Notes`    | no       | string  | Free-text notes shown inline in the tracker. |

### Example

```csv
Game,Faction,Army,Unit,Qty,Source,State,Spearhead,Notes
40k,Grey Knights,Grey Knights,Castellan Crowe,1,Combat Patrol 1,Based,,No magnets
AoS,Skaven,Vermindoom,Rat Ogors,3,Skaventide,Based,Yes,
AoS,Terrain,Sand & Bone,Shyish Terrain Piece,1,Sand & Bone Gaming Pack,Unassembled,Yes,
```

### Grouping rules

- Armies are built in **first-seen order** of the `Army` column.
- `Game` and `Faction` are taken from the **first row** of each army group; later rows should match but mismatches produce a warning.
- `crest` and `color` are derived from `Faction` (known factions get preset colours; unknown factions use a generated abbreviation and grey).

Custom pipeline states (see `settings.pipeline`) are validated on import instead of the default list.

---

## 2. Paints (`warhammer_paint_inventory.csv`)

One row per **distinct paint pot** (or basing product, primer, etc.).

### Columns

| Column     | Required | Type    | Description |
|------------|----------|---------|-------------|
| `Name`     | yes      | string  | Paint or product name. |
| `Type`     | no       | enum    | Category — drives swatch colour. See [Paint types](#paint-types). Default empty string. |
| `Brand`    | no       | string  | Manufacturer, e.g. `Citadel`, `Army Painter`. |
| `Source`   | no       | string  | Kit or set it came from. |
| `Quantity` | no       | integer | Number of pots (default `1`). |
| `Notes`    | no       | string  | Optional notes. |

### Example

```csv
Name,Type,Brand,Source,Quantity,Notes
Khorne Red,Base,Citadel,Skaven Painting Kit,1,
Leadbelcher,Base,Citadel,Skaven Painting Kit + Stormcast Painting Kit,2,Duplicate from both kits
Black Primer,Primer,,Spray,1,
```

---

## Pipeline states

Default `State` values (case-insensitive on import; stored as canonical title case):

| State        | Progress |
|--------------|----------|
| Unassembled  | 0%       |
| Assembled    | ~12.5%   |
| Magnetising  | ~25%     |
| Magnetised   | ~37.5%   |
| Primed       | ~50%     |
| Base Coated  | ~62.5%   |
| Detailed     | ~75%     |
| Based        | ~87.5%   |
| Done         | 100%     |

Users can replace this list via `settings.pipeline` (future settings UI). Unknown states fall back to the first stage with an import warning.

---

## Paint types

Known types get preset swatch colours: `Base`, `Shade`, `Technical`, `Speedpaint`, `Speedpaint Metallic`, `Medium`, `Primer`, `Basing`. Unknown types use a neutral grey swatch.

---

## File detection

On import, the registry inspects the header row:

- Contains `game`, `army`, and `unit` → **armies** file (Muster Roll format)
- Contains `name` and (`quantity` or `type`) → **paints** file (Muster Roll format)
- Additional formats → register importers in `js/import/registry.js`

---

## Templates

Shipped sample files in this repo:

- `warhammer_armies.csv`
- `warhammer_paint_inventory.csv`

Use **Export** in the app to generate CSVs from your current collection, or copy these files as starting templates.
