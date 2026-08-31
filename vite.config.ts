import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Vite writes `<script type="module" crossorigin>` even though the bundle is
 * emitted as an IIFE. An inline module script is also a module script, and under
 * file:// that is the category with the awkward edge cases (research R2). The
 * bundle has no imports left, so it is served as a plain classic script instead.
 */
function finalizeHtml(isWeb: boolean): Plugin {
  return {
    name: 'library-reward:finalize-html',
    enforce: 'post',
    // Runs after vite-plugin-singlefile has inlined the code, so by now the tag
    // carries no src and can safely become a classic script.
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.html')) continue;
        const html = typeof file.source === 'string' ? file.source : file.source.toString();
        let out = html.replace(
          /<script(?![^>]*\bsrc=)([^>]*)\btype="module"([^>]*)>/g,
          (_match, before, after) =>
            `<script${(before + after).replace(/\bcrossorigin\b/g, '').replace(/\s+/g, ' ').trimEnd()}>`,
        );

        // The manifest and icon links are the only external references in the
        // page, and they exist only where something can serve them. In the
        // file:// build they would be two guaranteed 404s, so they are removed.
        out = isWeb
          ? out.replace(/\s*data-hosted-only/g, '')
          : out
              .replace(/[ \t]*<link\b[^>]*\bdata-hosted-only\b[^>]*>\n?/g, '')
              .replace(/[ \t]*<!--[^>]*hosted build[^>]*-->\n?/g, '');

        file.source = out;
      }
    },
  };
}

/*
  Two deployment shapes, one codebase.

  - default ("file"): one double-clickable LibraryReward.html for a Chromebook,
    with nothing to fetch. See research.md R2/R8.
  - VITE_TARGET=web: the same page served from HTTPS (GitHub Pages), plus a
    manifest, icons, and a service worker so it installs as an app icon and works
    offline. The page itself is byte-for-byte the same idea — still no data leaves
    the device — it just gets a real origin, where storage is dependable and
    updates arrive on their own.

  Relative base so the hosted build works under any path, including the
  /<repo>/ subpath GitHub Pages uses for project sites.
*/
const isWeb = process.env.VITE_TARGET === 'web';

export default defineConfig({
  base: './',
  publicDir: isWeb ? 'public-web' : false,
  define: { __HOSTED_BUILD__: JSON.stringify(isWeb) },
  plugins: [react(), viteSingleFile(), finalizeHtml(isWeb)],
  build: {
    outDir: isWeb ? 'dist-web' : 'dist',
    target: 'es2020',
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
});
