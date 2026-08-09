import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  /*
   * La versión se inyecta en compilación en lugar de importar package.json
   * desde la app: así no acaba el manifiesto entero dentro del bundle y el
   * número que se ve en el pie es exactamente el del artefacto desplegado.
   */
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Constructor de listas · StarCraft TMG',
        short_name: 'SC:TMG Listas',
        description:
          'Constructor de listas de ejército para StarCraft: The Miniatures Game',
        theme_color: '#11131f',
        background_color: '#11131f',
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
