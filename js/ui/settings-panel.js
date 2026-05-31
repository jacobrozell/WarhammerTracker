import { getState, patchSettings, applyFactionPresets, setArmyPipeline, getArmyPipeline } from '../core/store.js';
import { DEFAULT_PIPELINE } from '../core/constants.js';
import {
  compositePresetKey,
  resolveFactionPreset,
} from '../data/faction-presets.js';
import { safeColor } from '../core/dom.js';
import { formDialog } from './form-modal.js';

/** @param {string} text */
function parsePipelineLines(text) {
  return text.split('\n').map(line => {
    const [key, hex] = line.split(',').map(s => s.trim());
    return key ? { key, hex: safeColor(hex || '#888') } : null;
  }).filter(/** @type {(x: {key: string, hex: string}|null) => x is {key: string, hex: string}} */ (x) => x !== null);
}

export async function openPipelineSettings() {
  const { settings } = getState();
  const current = settings.pipeline || DEFAULT_PIPELINE;
  const text = current.map(s => `${s.key},${s.hex}`).join('\n');
  const data = await formDialog('Custom pipeline (one stage per line: Name,#hex)', [
    { id: 'lines', label: 'Stages', type: 'textarea', value: text },
  ]);
  if (!data?.lines) return;
  const pipeline = parsePipelineLines(data.lines);
  if (!pipeline.length) return;
  patchSettings({ pipeline });
}

/** @param {string} armyName */
export async function openArmyPipelineSettings(armyName) {
  const army = getState().collection.find(a => a.army === armyName);
  if (!army) return;
  const current = getArmyPipeline(army);
  const useCustom = Boolean(army.pipeline?.length);
  const text = current.map(s => `${s.key},${s.hex}`).join('\n');
  const data = await formDialog(`Pipeline for "${armyName}"`, [
    { id: 'mode', label: 'Mode', options: ['Use global pipeline', 'Custom for this army'], value: useCustom ? 'Custom for this army' : 'Use global pipeline' },
    { id: 'lines', label: 'Stages (Name,#hex per line)', type: 'textarea', value: text },
  ]);
  if (!data) return;
  if (data.mode === 'Use global pipeline') {
    setArmyPipeline(armyName, null);
    return;
  }
  const pipeline = parsePipelineLines(data.lines);
  if (!pipeline.length) return;
  setArmyPipeline(armyName, pipeline);
}

export async function openFactionSettings() {
  const { settings, collection } = getState();
  /** @type {Map<string, { game: string, faction: string }>} */
  const pairs = new Map();
  collection.forEach(a => {
    pairs.set(compositePresetKey(a.game, a.faction), { game: a.game, faction: a.faction });
  });
  if (!pairs.size) pairs.set('40k:Custom', { game: '40k', faction: 'Custom' });
  const custom = settings.factionPresets || {};
  const lines = [...pairs.values()].map(({ game, faction }) => {
    const key = compositePresetKey(game, faction);
    const [crest, color] = resolveFactionPreset(faction, { game, presets: custom });
    const c = custom[key];
    return `${key},${c?.[0] || crest},${c?.[1] || color}`;
  }).join('\n');
  const data = await formDialog('Faction crests & colours (Game:Faction,Crest,#hex per line)', [
    { id: 'lines', label: 'Overrides for factions in your collection', type: 'textarea', value: lines },
  ]);
  if (!data?.lines) return;
  /** @type {Record<string, [string, string]>} */
  const presets = {};
  data.lines.split('\n').forEach(line => {
    const parts = line.split(',').map(s => s.trim());
    const key = parts[0];
    if (!key) return;
    const crest = (parts[1] || key.slice(0, 2)).slice(0, 8);
    presets[key] = [crest, safeColor(parts[2] || '#888')];
  });
  applyFactionPresets(Object.keys(presets).length ? presets : null);
}
