import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/number-wizard/',
  plugins: [
    react(),
    // Precaches the whole build, art included, so the game runs offline after one visit. The
    // manifest stays the hand-written public/site.webmanifest; the plugin only emits the worker.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: { globPatterns: ['**/*.{js,css,html,webp,woff2,png,ico,webmanifest}'], maximumFileSizeToCacheInBytes: 4_000_000 },
    }),
  ],
  test: { environment: 'node' },
});
