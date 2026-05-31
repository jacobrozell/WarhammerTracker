import { renderArmyStats, renderArmyFilters, renderArmies } from './armies.js';
import { renderPaints } from './paints.js';

export function renderAll() {
  const refresh = () => renderAll();
  renderArmyStats();
  renderArmyFilters(refresh);
  renderArmies(refresh);
  renderPaints();
}
