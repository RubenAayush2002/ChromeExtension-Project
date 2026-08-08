import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';

const root = resolve(__dirname, 'src');
const outDir = resolve(__dirname, 'dist');

function copyManifestAndAssets() {
  return {
    name: 'copy-manifest-and-assets',
    closeBundle() {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        resolve(outDir, 'manifest.json'),
        readFileSync(resolve(root, 'manifest.json'))
      );
      if (existsSync(resolve(__dirname, 'public'))) {
        cpSync(resolve(__dirname, 'public'), outDir, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  root,
  publicDir: false,
  resolve: {
    alias: {
      '@': root,
    },
  },
  build: {
    outDir,
    emptyOutDir: true,
    // The modulepreload polyfill targets browsers without native ESM
    // support — irrelevant inside a Chrome extension (MV3 requires modern
    // Chrome) and its <link rel="modulepreload"> tags trigger a benign but
    // noisy "cross-world extension resource mismatch" console warning here.
    modulePreload: false,
    rollupOptions: {
      input: {
        newtab: resolve(root, 'newtab/index.html'),
        options: resolve(root, 'options/index.html'),
        background: resolve(root, 'background/index.ts'),
        popup: resolve(root, 'popup/index.html'),
        bookmarksPanel: resolve(root, 'bookmarks-panel/index.html'),
        readingView: resolve(root, 'reading-view/index.html'),
        blocked: resolve(root, 'blocked/index.html'),
        screenshot: resolve(root, 'screenshot/index.html'),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background/index.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  plugins: [copyManifestAndAssets()],
});
