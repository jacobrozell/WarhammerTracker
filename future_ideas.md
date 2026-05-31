# Future ideas

Status after architecture refactor — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for extension points.

1. **CSV tool for new users** — done (templates, empty states, validated import, sample CSVs)
2. **Dark mode** — done (header toggle, `css/tokens.css`, `settings.theme`)
3. **How are we going to publish?** — static site ready; see [README.md](README.md) GitHub Pages section
4. **Data save** — localStorage v3 + JSON `exportSnapshot()` hook; cloud sync = extend `store.js`
5. **Migration from other tools?** — add importer to `js/import/registry.js`
6. **Adding custom states** — `settings.pipeline` + `pipeline.setCustomPipeline()`; needs settings UI
