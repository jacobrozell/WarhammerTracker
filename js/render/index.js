import { renderArmyStats, renderArmyFilters, renderArmies } from './armies.js';
import { renderPaints } from './paints.js';

export function renderArmyDomain() {
  const refresh = () => renderArmyDomain();
  renderArmyStats();
  renderArmyFilters(refresh);
  renderArmies(refresh);
}

export function renderAll() {
  renderArmyDomain();
  renderPaints();
}
