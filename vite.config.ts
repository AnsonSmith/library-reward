import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Vite writes `<script type="module" crossorigin>` even though the bundle is
 * emitted as an IIFE. An inline module script is also a module script, and under
 * file:// that is the category with the awkward edge cases (research R2). The
 * bundle has no imports left, so it is served as a plain classic script instead.
 */
function classicInlineScript(): Plugin {
  return {
    name: 'library-reward:classic-inline-script',
    enforce: 'post',
    // Runs after vite-plugin-singlefile has inlined the code, so by now the tag
    // carries no src and can safely become a classic script.
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.html')) continue;
        const html = typeof file.source === 'string' ? file.source : file.source.toString();
        file.source = html.replace(
          /<script(?![^>]*\bsrc=)([^>]*)\btype="module"([^>]*)>/g,
          (_match, before, after) =>
            `<script${(before + after).replace(/\bcrossorigin\b/g, '').replace(/\s+/g, ' ').trimEnd()}>`,
        );
      }
    },
  };
}

// Everything must inline into one double-clickable file. See research.md R2/R8:
// under file:// there is no module fetching, no dynamic import(), and no workers.
export default defineConfig({
  plugins: [react(), viteSingleFile(), classicInlineScript()],
  build: {
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
