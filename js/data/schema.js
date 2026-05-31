export const ARMY_SCHEMA = {
  id: 'muster-armies',
  label: 'Muster Roll Armies',
  filename: 'warhammer_armies.csv',
  required: ['game', 'faction', 'army', 'unit'],
  optional: ['qty', 'source', 'state', 'spearhead', 'notes'],
  exportHeaders: ['Game', 'Faction', 'Army', 'Unit', 'Qty', 'Source', 'State', 'Spearhead', 'Notes'],
  template: 'Game,Faction,Army,Unit,Qty,Source,State,Spearhead,Notes\n40k,Space Marines,My Chapter,Intercessors (5),1,Starter Set,Unassembled,,\n',
};

export const PAINT_SCHEMA = {
  id: 'muster-paints',
  label: 'Muster Roll Paints',
  filename: 'warhammer_paint_inventory.csv',
  required: ['name'],
  optional: ['type', 'brand', 'source', 'quantity', 'notes'],
  exportHeaders: ['Name', 'Type', 'Brand', 'Source', 'Quantity', 'Notes'],
  template: 'Name,Type,Brand,Source,Quantity,Notes\nMacragge Blue,Base,Citadel,Paint Set,1,\n',
};

/** @param {string[][]} rows */
export function detectMusterArmies(rows) {
  const head = (rows[0] || []).map(h => String(h).trim().toLowerCase());
  return ['game', 'army', 'unit'].every(h => head.includes(h));
}

/** @param {string[][]} rows */
export function detectMusterPaints(rows) {
  const head = (rows[0] || []).map(h => String(h).trim().toLowerCase());
  return head.includes('name') && (head.includes('quantity') || head.includes('type'));
}
