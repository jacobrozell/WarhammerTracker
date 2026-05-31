# Importing CSV

The Muster Roll uses **two CSV files** — one for armies, one for paints. They are imported separately.

## First-time setup

1. Open the app
2. On the **Armies** tab, click **Army Template** to download a starter file, or use the sample `warhammer_armies.csv` in this repo
3. Fill in your collection (spreadsheet or text editor)
4. Click **Import Armies CSV** and select your file
5. Repeat on the **Paints** tab with `warhammer_paint_inventory.csv`

You can also drag a CSV onto the empty-state drop zone.

## Column reference

Full schema: [SCHEMA.md](SCHEMA.md)

**Armies** (required columns): `Game`, `Faction`, `Army`, `Unit`

**Paints** (required columns): `Name`

## Tips

- Headers are case-insensitive
- UTF-8 with BOM is supported
- Fields with commas must be quoted: `"Notes, with comma"`
- Import **replaces** the current tab's data (export first to backup)
- Unknown painting states fall back to the first pipeline stage with a warning

## Export / backup

- **Export Armies** / **Export Paints** — CSV backup compatible with re-import
- JSON full backup (API): `exportJSONBackup()` in `js/import/index.js` — wire to UI when needed

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Unrecognised CSV" | Check you're using the correct import button (armies vs paints) |
| "Missing required columns" | Compare headers to [SCHEMA.md](SCHEMA.md) |
| Data gone after refresh | Data is per-browser; import again or check you didn't use private browsing |
| Old data from monolithic HTML | v2 localStorage migrates automatically to v3 on first load |
