import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import pkg from './package.json' with { type: 'json' };

/*
 * Identificador de la compilación. `package.json` sólo cambia cuando se sube la
 * versión a mano, así que no sirve para saber si un cliente está al día: dos
 * despliegues seguidos comparten número. La marca de tiempo del build sí cambia
 * siempre, y es lo que compara `deploymentVersion` contra `/version.json`.
 */
const buildId = Date.now().toString(36);

/**
 * Publica `version.json` junto al bundle. No entra en el precacheo del service
 * worker —`globPatterns` no incluye `.json`—, de modo que la app siempre lo lee
 * de la red y puede detectar un despliegue aunque su service worker esté roto.
 */
function publishBuildManifest(): Plugin {
  return {
    name: 'starcraft-tmg:build-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: pkg.version, buildId }),
      });
    },
  };
}

export default defineConfig({
  /*
   * La versión se inyecta en compilación en lugar de importar package.json
   * desde la app: así no acaba el manifiesto entero dentro del bundle y el
   * número que se ve en el pie es exactamente el del artefacto desplegado.
   */
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    publishBuildManifest(),
    VitePWA({
      registerType: 'autoUpdate',
      // El cliente se registra desde `src/main.tsx` para poder solicitar una
      // comprobación al reanudar la PWA en móvil.
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Starcraft Builder',
        short_name: 'Starcraft Builder',
        description:
          'Constructor de listas de ejército para StarCraft: The Miniatures Game',
        id: '/',
        lang: 'es',
        theme_color: '#11131f',
        background_color: '#11131f',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
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
          {
            urlPattern: /\/(?:logo\.png|auth-space-bg\.png|(?:home|lists|profile)-bg\.jpg|factions\/.*\.png)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-images',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
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
