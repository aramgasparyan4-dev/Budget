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
      // MyGarage Drive (index.html); Echo City (echo-city/) shares the engine until it becomes its own project
      input: { main: resolve(__dirname, 'index.html'), echoCity: resolve(__dirname, 'echo-city/index.html') },
    },
  },
  server: { host: true, port: 5173 },
});
