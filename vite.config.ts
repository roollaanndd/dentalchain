import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * ARTIFACT=true produces a single self-contained index.html with every chunk
 * inlined, for hosts that serve one file and cannot rewrite routes. The app
 * switches to hash routing in that mode (see src/App.tsx).
 */
const SINGLE_FILE = process.env.ARTIFACT === 'true';

export default defineConfig({
  // GitHub Pages serves this project at /<repo>/, so the asset base has to
  // match or every chunk 404s. Vercel/Netlify serve from the root.
  base: process.env.GITHUB_PAGES === 'true' ? '/dentalchain/' : './',
  plugins: [react(), tailwindcss(), ...(SINGLE_FILE ? [viteSingleFile()] : [])],
  define: { __ARTIFACT__: JSON.stringify(SINGLE_FILE) },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    target: 'es2022',
    rollupOptions: SINGLE_FILE
      ? {}
      : {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom'],
              router: ['react-router-dom'],
              icons: ['lucide-react'],
              motion: ['motion'],
            },
          },
        },
  },
  server: { port: 3000, host: '0.0.0.0' },
});
