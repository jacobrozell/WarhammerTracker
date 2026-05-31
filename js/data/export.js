import { downloadText } from './csv.js';
import { ARMY_SCHEMA, PAINT_SCHEMA } from './schema.js';

/** @param {'armies'|'paints'} kind */
export function downloadTemplate(kind) {
  const schema = kind === 'armies' ? ARMY_SCHEMA : PAINT_SCHEMA;
  downloadText(schema.template, schema.filename);
}
