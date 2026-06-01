import { ARMY_SCHEMA } from '../../js/data/schema.js';
import { getArmyPresentation } from '../../js/data/factions/index.js';

/** Mirrors export row shape in js/import/index.js for round-trip tests. */
export function armiesToExportRows(collection, factionPresets = null) {
  const rows = [ARMY_SCHEMA.exportHeaders];
  collection.forEach(a => {
    const { crest, color } = getArmyPresentation(a, factionPresets);
    a.units.forEach(u => {
      const base = [
        a.game, a.faction, a.army, u.unit, u.qty || 1, u.source || '',
        u.state,
        u.spearhead === undefined ? '' : (u.spearhead ? 'Yes' : 'No'),
        u.notes || '',
      ];
      if (u.members?.length) {
        u.members.forEach((m, i) => {
          rows.push([
            ...base,
            String(i + 1),
            m.state || '',
            m.notes || '',
            crest,
            color,
          ]);
        });
      } else {
        rows.push([...base, '', '', '', crest, color]);
      }
    });
  });
  return rows;
}
