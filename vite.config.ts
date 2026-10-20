import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { rapierWasmFile } from './build/rapierWasm';

export default defineConfig({
  plugins: [react(), tailwindcss(), rapierWasmFile()],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
  },
  server: { host: true, port: 5173 },
});
