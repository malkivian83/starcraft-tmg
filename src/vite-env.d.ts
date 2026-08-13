/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Versión de `package.json`, inyectada por `define` en vite.config.ts. */
declare const __APP_VERSION__: string;

/**
 * Identificador único de cada compilación, inyectado por `define`. A diferencia
 * de la versión, cambia en todos los despliegues aunque no se toque
 * `package.json`, que es lo que permite detectar que el móvil sigue ejecutando
 * un artefacto viejo.
 */
declare const __APP_BUILD_ID__: string;
