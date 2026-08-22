const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const localApiUrl = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/api\/?$/i;

export function resolveApiBaseUrl(configured: string | undefined, mode: string): string {
  const value = (configured ?? '').trim();
  const isProductionBuild = mode === 'production';
  return (
    isProductionBuild && localApiUrl.test(value)
      ? '/api'
      : value || (isProductionBuild ? '/api' : 'http://localhost:3001/api')
  ).replace(/\/$/, '');
}

/**
 * En producción la API se sirve bajo el mismo dominio que la SPA. Así un
 * bundle compilado sin variables de entorno no intenta acceder al localhost
 * del dispositivo del usuario.
 */
export const apiBaseUrl = resolveApiBaseUrl(configuredApiBaseUrl, import.meta.env.MODE);
