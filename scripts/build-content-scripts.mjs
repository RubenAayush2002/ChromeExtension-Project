import { build } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../src');
const outDir = resolve(__dirname, '../dist');

// Content scripts injected as classic scripts (content_scripts in manifest.json,
// or chrome.scripting.executeScript({ files })) can't use ES module imports —
// each needs its own self-contained IIFE build, run after the main vite build.
const entries = [
  { entry: 'content/page-extract.ts', name: 'ZeroDriftPageExtract', fileName: 'content/page-extract.js' },
  { entry: 'content/edge-tab.ts', name: 'ZeroDriftEdgeTab', fileName: 'content/edge-tab.js' },
];

for (const { entry, name, fileName } of entries) {
  await build({
    root,
    publicDir: false,
    resolve: { alias: { '@': root } },
    build: {
      outDir,
      emptyOutDir: false,
      lib: {
        entry: resolve(root, entry),
        name,
        formats: ['iife'],
        fileName: () => fileName,
      },
      rollupOptions: { output: { extend: true } },
    },
    logLevel: 'warn',
  });
  console.log(`Built ${fileName}`);
}
