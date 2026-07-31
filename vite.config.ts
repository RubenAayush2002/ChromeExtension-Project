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
    rollupOptions: {
      input: {
        newtab: resolve(root, 'newtab/index.html'),
        options: resolve(root, 'options/index.html'),
        background: resolve(root, 'background/index.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background/index.js' : 'assets/[name]-[hash].js',
      },
    },
  },
  plugins: [copyManifestAndAssets()],
});
