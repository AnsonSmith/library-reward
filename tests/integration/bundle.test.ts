/**
 * Boots the built single file the way a Chromebook would: one HTML document with
 * an inline classic script and nothing to fetch. Skips when dist/ has not been
 * built. This does not replace checking on the real device (research R2), but it
 * catches a bundle that is self-contained yet does not run.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

const BUNDLE = join(__dirname, '..', '..', 'dist', 'LibraryReward.html');
const built = existsSync(BUNDLE);

describe.skipIf(!built)('the built single file', () => {
  const html = built ? readFileSync(BUNDLE, 'utf8') : '';

  it('has nothing to fetch at runtime', () => {
    const refs = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
      .map((m) => m[1]!)
      .filter((url) => !url.startsWith('data:') && !url.startsWith('#'));
    expect(refs).toEqual([]);
    expect(html).not.toMatch(/type=["']module/i);
  });

  it('renders the app when opened', async () => {
    const dom = new JSDOM(html, {
      runScripts: 'dangerously',
      url: 'file:///Users/librarian/Downloads/LibraryReward.html',
      pretendToBeVisual: true,
    });

    // React renders on a microtask; give the document a tick to settle.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const root = dom.window.document.getElementById('root');
    expect(root).not.toBeNull();
    expect(root!.innerHTML.length).toBeGreaterThan(200);

    const text = dom.window.document.body.textContent ?? '';
    expect(text).toContain('Library Reward');
    expect(text).toContain("This month's files");

    dom.window.close();
  });
});
