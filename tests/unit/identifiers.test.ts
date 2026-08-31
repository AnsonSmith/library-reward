import { describe, it, expect } from 'vitest';
import { normalizeBarcode, barcodesMatch } from '../../src/domain/identifiers';

describe('normalizeBarcode', () => {
  it('collapses leading-zero and whitespace variants of one student to one key', () => {
    const expected = '100001';
    expect(normalizeBarcode('000100001')).toBe(expected);
    expect(normalizeBarcode(' 100001 ')).toBe(expected);
    expect(normalizeBarcode('100001')).toBe(expected);
    expect(normalizeBarcode('00 100001')).toBe(expected);
  });

  it('drops the faculty patron prefix', () => {
    expect(normalizeBarcode('P 4242')).toBe('4242');
    expect(normalizeBarcode('p4242')).toBe('4242');
    expect(normalizeBarcode('P-4242')).toBe('4242');
  });

  it('is idempotent', () => {
    for (const raw of ['000100001', 'P 4242', '020100008', '  000100005 ']) {
      const once = normalizeBarcode(raw);
      expect(normalizeBarcode(once)).toBe(once);
    }
  });

  it('treats blank and all-zero values as matching nothing', () => {
    expect(normalizeBarcode('')).toBe('');
    expect(normalizeBarcode('   ')).toBe('');
    expect(normalizeBarcode('0000')).toBe('');
    expect(normalizeBarcode(null)).toBe('');
    expect(normalizeBarcode(undefined)).toBe('');
    expect(barcodesMatch('', '')).toBe(false);
    expect(barcodesMatch('0000', '0')).toBe(false);
  });

  it('never merges two distinct students', () => {
    // Real barcode shapes observed in the roster export.
    const distinct = ['000100001', '000100006', '000100007', '020100008', '000100005', 'P 4242'];
    const keys = distinct.map(normalizeBarcode);
    expect(new Set(keys).size).toBe(distinct.length);
  });

  it('matches across formatting drift between the two reports', () => {
    expect(barcodesMatch('000100002', '100002')).toBe(true);
    expect(barcodesMatch('000100003', ' 000100003')).toBe(true);
    expect(barcodesMatch('000100003', '000100004')).toBe(false);
  });
});
