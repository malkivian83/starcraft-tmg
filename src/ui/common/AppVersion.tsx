import { useTranslation } from 'react-i18next';

/**
 * Versión del artefacto desplegado, para el pie de página.
 *
 * Sirve para cerrar los partes de incidencia: cuando alguien escribe por
 * soporte diciendo que un coste no le cuadra, lo primero que hace falta saber
 * es qué versión tiene delante —el navegador puede estar sirviendo una copia
 * cacheada por la PWA—. `__APP_VERSION__` lo inyecta Vite desde package.json.
 */
export function AppVersion() {
  const { t } = useTranslation('common');
  const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : null;
  if (!version) return null;
  return (
    <span className="app-version" title={t('version', { version })}>
      v{version}
    </span>
  );
}
