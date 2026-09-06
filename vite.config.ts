import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves this project at /<repo>/, so the asset base has to
  // match or every chunk 404s. Vercel/Netlify serve from the root.
  base: process.env.GITHUB_PAGES === 'true' ? '/dentalchain/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    target: 'es2022',
    rollupOptions: {
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
