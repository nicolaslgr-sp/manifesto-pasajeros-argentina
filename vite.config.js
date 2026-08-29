import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/manifesto-pasajeros-argentina/',
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.dev.html')
      }
    }
  },
  worker: {
    format: 'es'
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
});
