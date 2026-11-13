import preact from '@preact/preset-vite';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Three small pages, one per window, plus index.html: a test bench that shows
// all three side by side in an ordinary browser.
export default defineConfig({
  plugins: [preact()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        star: resolve(import.meta.dirname, 'star.html'),
        panel: resolve(import.meta.dirname, 'panel.html'),
        quickadd: resolve(import.meta.dirname, 'quickadd.html'),
      },
    },
  },
});
