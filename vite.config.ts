import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      // two games share one engine: Echo City (index.html) and Near Miss (near-miss.html)
      input: { main: resolve(__dirname, 'index.html'), nearMiss: resolve(__dirname, 'near-miss.html') },
    },
  },
  server: { host: true, port: 5173 },
});
