/** @typedef {{ label: string, crest: string, color: string, games: string[], aliases?: string[] }} FactionDef */

export { SUPPORTED_GAMES, G } from './games.js';
export { FACTION_DEFS_40K } from './defs-40k.js';
export { FACTION_DEFS_AOS } from './defs-aos.js';
export { FACTION_DEFS_OTHER } from './defs-other.js';

import { FACTION_DEFS_40K } from './defs-40k.js';
import { FACTION_DEFS_AOS } from './defs-aos.js';
import { FACTION_DEFS_OTHER } from './defs-other.js';

export const FACTION_DEFS = [
  ...FACTION_DEFS_40K,
  ...FACTION_DEFS_AOS,
  ...FACTION_DEFS_OTHER,
];
