/*
  Build gate.

  The file:// deliverable must be exactly one self-contained file: a bundle that
  quietly references an external asset works perfectly on a developer machine and
  fails in front of a class.

  The hosted build is allowed a manifest, icons, and a service worker — the things
  that make it installable and offline-capable — and nothing else.
*/
import { readdirSync, readFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.argv.includes('--web') ? 'web' : 'file';
const DIST = mode === 'web' ? 'dist-web' : 'dist';
const TARGET = mode === 'web' ? 'index.html' : 'LibraryReward.html';

const ALLOWED_EXTRAS = new Set([
  'manifest.webmanifest',
  'sw.js',
  'icon-192.png',
  'icon-512.png',
]);
const ALLOWED_REFS = new Set(['./manifest.webmanifest', './icon-192.png']);

if (!existsSync(DIST)) {
  console.error(`FAIL: ${DIST}/ does not exist. Run the build first.`);
  process.exit(1);
}

// Vite emits index.html; the file the librarian double-clicks is named for the app.
if (mode === 'file' && existsSync(join(DIST, 'index.html')) && !existsSync(join(DIST, TARGET))) {
  renameSync(join(DIST, 'index.html'), join(DIST, TARGET));
}

const files = readdirSync(DIST, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => join(e.parentPath ?? e.path, e.name).replace(new RegExp(`^${DIST}[/\\\\]`), ''));

const problems = [];

if (!files.includes(TARGET)) {
  problems.push(`${TARGET} was not produced`);
}
const unexpected = files.filter((f) => f !== TARGET && !(mode === 'web' && ALLOWED_EXTRAS.has(f)));
if (unexpected.length > 0) {
  problems.push(`unexpected files in ${DIST}/: ${unexpected.join(', ')}`);
}

const html = existsSync(join(DIST, TARGET)) ? readFileSync(join(DIST, TARGET), 'utf8') : '';

const refs = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
  .map((m) => m[1])
  .filter((url) => !url.startsWith('data:') && !url.startsWith('#'))
  .filter((url) => !(mode === 'web' && ALLOWED_REFS.has(url)));

if (refs.length > 0) {
  problems.push(`external references found (must be inlined): ${[...new Set(refs)].join(', ')}`);
}

if (/<script[^>]+\bsrc=/i.test(html)) problems.push('a <script> tag still loads an external file');
if (/<link[^>]+rel=["']?stylesheet/i.test(html)) problems.push('a stylesheet is still linked');
// An inline module script is the one script category with file:// edge cases.
if (/<script[^>]+type=["']module/i.test(html)) problems.push('the inline script is still type="module"');
if (/\bimport\s*\(/.test(html)) problems.push('a dynamic import() survived the build');
if (/new\s+Worker\s*\(/.test(html)) problems.push('a Web Worker survived the build');

if (mode === 'file' && /data-hosted-only/.test(html)) {
  problems.push('a hosted-only tag survived into the offline build');
}
if (mode === 'web' && !/manifest\.webmanifest/.test(html)) {
  problems.push('the hosted build is missing its manifest link');
}

if (problems.length) {
  console.error(`FAIL: build gate (${mode})`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`OK: ${DIST}/${TARGET} is self-contained (${kb} KB, ${mode} build)`);
