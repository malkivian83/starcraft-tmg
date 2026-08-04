import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Constructor de listas · StarCraft TMG',
        short_name: 'SC:TMG Listas',
        description:
          'Constructor de listas de ejército para StarCraft: The Miniatures Game',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        // Iconos SVG: escalan a cualquier tamaño y evitan mantener un juego
        // de PNG. Chrome, Edge y Firefox los aceptan para instalar la PWA.
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // Las imágenes de carta se cachean bajo demanda, no en el precacheo:
        // multiplicarían el peso de la primera carga (SDD §8).
        runtimeCaching: [
          {
            urlPattern: /\/cards\/.*\.(?:png|webp|jpg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-images',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    // Respeta el puerto que asigne el entorno; si no, el de Vite por defecto.
    port: Number(process.env.PORT) || 5173,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
