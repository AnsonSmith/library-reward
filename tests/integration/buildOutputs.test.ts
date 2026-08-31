/**
 * Keeps the two deployment shapes honest.
 *
 * The offline build is the primary deliverable and must stay a single file with
 * nothing to fetch. The hosted build may add exactly the files that make it
 * installable and offline-capable — and nothing else. Both skip when not built.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const OFFLINE = join(ROOT, 'dist', 'LibraryReward.html');
const HOSTED_DIR = join(ROOT, 'dist-web');
const HOSTED = join(HOSTED_DIR, 'index.html');

describe.skipIf(!existsSync(OFFLINE))('the offline build', () => {
  const html = existsSync(OFFLINE) ? readFileSync(OFFLINE, 'utf8') : '';

  it('is the only file in dist/', () => {
    expect(readdirSync(join(ROOT, 'dist'))).toEqual(['LibraryReward.html']);
  });

  it('references nothing at all — no manifest, no icons, no service worker', () => {
    expect(html).not.toMatch(/manifest/i);
    expect(html).not.toMatch(/serviceWorker/);
    expect(html).not.toMatch(/<link\b/i);
    const refs = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
      .map((m) => m[1]!)
      .filter((u) => !u.startsWith('data:') && !u.startsWith('#'));
    expect(refs).toEqual([]);
  });
});

describe.skipIf(!existsSync(HOSTED))('the hosted build', () => {
  const html = existsSync(HOSTED) ? readFileSync(HOSTED, 'utf8') : '';

  it('ships exactly the files that make it installable and offline-capable', () => {
    expect(readdirSync(HOSTED_DIR).sort()).toEqual([
      'icon-192.png',
      'icon-512.png',
      'index.html',
      'manifest.webmanifest',
      'sw.js',
    ]);
  });

  it('links its manifest and registers a service worker', () => {
    expect(html).toMatch(/rel="manifest"/);
    expect(html).toMatch(/serviceWorker/);
    expect(html).not.toMatch(/data-hosted-only/);
  });

  it('uses relative paths so it works under a /repo/ subpath', () => {
    const refs = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
      .map((m) => m[1]!)
      .filter((u) => !u.startsWith('data:') && !u.startsWith('#'));
    expect(refs.every((u) => u.startsWith('./'))).toBe(true);
  });

  it('declares a manifest a Chromebook can install', () => {
    const manifest = JSON.parse(readFileSync(join(HOSTED_DIR, 'manifest.webmanifest'), 'utf8'));
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toContain('512x512');
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  });

  it('caches network-first so a fix is never held back by a stale cache', () => {
    const sw = readFileSync(join(HOSTED_DIR, 'sw.js'), 'utf8');
    expect(sw).toMatch(/fetch\(request\)/);
    expect(sw).toMatch(/caches\.match/);
  });
});
