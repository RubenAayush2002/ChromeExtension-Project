import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const root = resolve(__dirname, 'src');

/**
 * Separate build pass for content scripts injected via
 * chrome.scripting.executeScript({ files: [...] }), which requires a
 * classic (non-module) script — the main vite.config.ts build produces ES
 * modules with import statements for code-splitting, which throws at
 * injection time. This config bundles content/page-extract.ts as a single
 * self-contained IIFE instead. Run after the main build; emptyOutDir is off
 * so it doesn't wipe the main build's output.
 */
export default defineConfig({
  root,
  publicDir: false,
  resolve: {
    alias: {
      '@': root,
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    lib: {
      entry: resolve(root, 'content/page-extract.ts'),
      name: 'PersonalHomeBasePageExtract',
      formats: ['iife'],
      fileName: () => 'content/page-extract.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
