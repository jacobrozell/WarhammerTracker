import { renderArmyStats, renderArmyFilters, renderArmies, setArmyDomainRefresh } from './armies.js';
import { renderPaints } from './paints.js';

export function renderArmyDomain() {
  const refresh = () => renderArmyDomain();
  setArmyDomainRefresh(refresh);
  renderArmyStats();
  renderArmyFilters(refresh);
  renderArmies(refresh);
}

export function renderAll() {
  renderArmyDomain();
  renderPaints();
}
