// Build gate: the deliverable must be exactly one self-contained file.
// A bundle that quietly references an external asset works perfectly on a
// developer machine and fails in front of a class. See research.md R8.
import { readdirSync, readFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const TARGET = 'LibraryReward.html';

if (!existsSync(DIST)) {
  console.error('FAIL: dist/ does not exist. Run the build first.');
  process.exit(1);
}

// Vite emits index.html; the artifact the librarian double-clicks is named for the app.
if (existsSync(join(DIST, 'index.html')) && !existsSync(join(DIST, TARGET))) {
  renameSync(join(DIST, 'index.html'), join(DIST, TARGET));
}

const files = readdirSync(DIST, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => join(e.parentPath ?? e.path, e.name).replace(/^dist[/\\]/, ''));

const problems = [];

if (files.length !== 1 || files[0] !== TARGET) {
  problems.push(`expected exactly one file (${TARGET}), found: ${files.join(', ') || '(none)'}`);
}

const html = readFileSync(join(DIST, TARGET), 'utf8');

// Any src=/href= that is not a data: URI or an in-page anchor means a runtime fetch.
const refs = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
  .map((m) => m[1])
  .filter((url) => !url.startsWith('data:') && !url.startsWith('#'));

if (refs.length > 0) {
  problems.push(`external references found (must be inlined): ${[...new Set(refs)].join(', ')}`);
}

if (/<script[^>]+\bsrc=/i.test(html)) problems.push('a <script> tag still loads an external file');
// An inline module script is the one script category with file:// edge cases.
if (/<script[^>]+type=["']module/i.test(html)) problems.push('the inline script is still type="module"');
if (/\bimport\s*\(/.test(html)) problems.push('a dynamic import() survived the build');
if (/new\s+Worker\s*\(/.test(html)) problems.push('a Web Worker survived the build');
if (/<link[^>]+rel=["']?stylesheet/i.test(html)) problems.push('a stylesheet is still linked');

if (problems.length) {
  console.error('FAIL: single-file build gate');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`OK: dist/${TARGET} is self-contained (${kb} KB)`);
