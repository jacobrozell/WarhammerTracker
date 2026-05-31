import { processCSVText } from '../import/index.js';
import { toast } from '../ui/toast.js';

/** Load shipped sample CSVs from the repo root (requires static server). */
export async function loadDemoCollection() {
  try {
    const [armiesRes, paintsRes] = await Promise.all([
      fetch('warhammer_armies.csv'),
      fetch('warhammer_paint_inventory.csv'),
    ]);
    if (!armiesRes.ok || !paintsRes.ok) {
      toast('Could not load sample files — run via npm run dev', 4000);
      return false;
    }
    const armiesText = await armiesRes.text();
    const paintsText = await paintsRes.text();
    await processCSVText(armiesText, 'armies', 'replace');
    await processCSVText(paintsText, 'paints', 'replace');
    toast('Sample collection loaded');
    return true;
  } catch {
    toast('Could not load sample files', 4000);
    return false;
  }
}
