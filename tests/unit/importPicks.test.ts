import { describe, it, expect } from 'vitest';
import { mergePicked, type Picked } from '../../src/ui/screens/ImportScreen';

function file(name: string, size = 100): Picked {
  return { name, size, bytes: new Uint8Array(size) };
}

describe('accumulating the month\'s files across several picks', () => {
  it('keeps everything chosen so far, in the order it was chosen', () => {
    const after = mergePicked(
      [file('roster.xlsx'), file('week1.xlsx')],
      [file('week2.xlsx'), file('week3.xlsx')],
    );
    expect(after.map((f) => f.name)).toEqual([
      'roster.xlsx',
      'week1.xlsx',
      'week2.xlsx',
      'week3.xlsx',
    ]);
  });

  it('ignores a file that is already chosen', () => {
    // Re-picking the same folder is the obvious way to lose track of what is in.
    const after = mergePicked([file('week1.xlsx')], [file('week1.xlsx'), file('week2.xlsx')]);
    expect(after.map((f) => f.name)).toEqual(['week1.xlsx', 'week2.xlsx']);
  });

  it('ignores a duplicate within a single pick', () => {
    const after = mergePicked([], [file('week1.xlsx'), file('week1.xlsx')]);
    expect(after).toHaveLength(1);
  });

  it('treats same-named files of different sizes as different reports', () => {
    // Two weeks of exports saved under one name in different folders.
    const after = mergePicked([file('circ.xlsx', 100)], [file('circ.xlsx', 220)]);
    expect(after).toHaveLength(2);
  });

  it('returns the same array when a pick adds nothing, so React can skip a render', () => {
    const current = [file('week1.xlsx')];
    expect(mergePicked(current, [file('week1.xlsx')])).toBe(current);
  });
});
