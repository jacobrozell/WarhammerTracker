import { describe, it, expect } from 'vitest';
import { parseCSV, detectDelimiter, fileImportHint } from '../js/data/csv.js';

describe('csv — backlog (todo: import formats)', () => {
  describe('detectDelimiter', () => {
    it('detects tab-separated first line', () => {
      expect(detectDelimiter('Name\tType\tQty\n')).toBe('\t');
    });

    it('detects semicolon-separated first line', () => {
      expect(detectDelimiter('Name;Type;Qty\n')).toBe(';');
    });

    it('defaults to comma', () => {
      expect(detectDelimiter('Name,Type,Qty\n')).toBe(',');
    });
  });

  describe('parseCSV', () => {
    it('parses TSV as rows with correct columns', () => {
      const rows = parseCSV('Name\tType\nMacragge Blue\tBase\n');
      expect(rows[0]).toEqual(['Name', 'Type']);
      expect(rows[1]).toEqual(['Macragge Blue', 'Base']);
    });

    it('parses semicolon-separated files', () => {
      const rows = parseCSV('Name;Quantity\nShade;1\n');
      expect(rows[0]).toEqual(['Name', 'Quantity']);
      expect(rows[1][0]).toBe('Shade');
    });

    it('strips UTF-8 BOM', () => {
      const rows = parseCSV('\uFEFFName,Type\nA,Base\n');
      expect(rows[0][0]).toBe('Name');
    });
  });

  describe('fileImportHint', () => {
    it('warns on Excel extensions', () => {
      expect(fileImportHint('armies.xlsx')).toContain('Excel');
      expect(fileImportHint('paints.xls')).toContain('Excel');
    });

    it('returns null for csv files', () => {
      expect(fileImportHint('warhammer_armies.csv')).toBeNull();
    });
  });
});
