const DEFAULT_MEASUREMENT_ID = 'G-F7DMMN328B';
const GOOGLE_TAG_SCRIPT_ID = 'google-analytics-tag';

export type AnalyticsConsent = 'granted' | 'denied';

export const ANALYTICS_CONSENT_STORAGE_KEY = 'starcraft-builder.analytics-consent';

interface AnalyticsWindow extends Window {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

export function getAnalyticsMeasurementId(): string | null {
  const configured = (import.meta.env.VITE_GOOGLE_ANALYTICS_ID ?? '').trim();
  const candidate = configured || DEFAULT_MEASUREMENT_ID;
  return /^G-[A-Z0-9]+$/i.test(candidate) ? candidate : null;
}

export function analyticsAvailable(): boolean {
  return import.meta.env.PROD && getAnalyticsMeasurementId() !== null;
}

/** Quita query string y hash para no enviar tokens, seeds ni parámetros de sesión. */
export function analyticsPageLocation(location: Pick<Location, 'origin' | 'pathname'>): string {
  return `${location.origin}${location.pathname}`;
}

export function readAnalyticsConsent(storage: Pick<Storage, 'getItem'> | null | undefined): AnalyticsConsent | null {
  try {
    const stored = storage?.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return stored === 'granted' || stored === 'denied' ? stored : null;
  } catch {
    return null;
  }
}

export function storeAnalyticsConsent(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  consent: AnalyticsConsent,
): void {
  try {
    storage?.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
  } catch {
    // Si el navegador bloquea el almacenamiento, la elección sólo dura esta sesión.
  }
}

/** Carga gtag una sola vez, después de que el visitante haya aceptado. */
export function loadGoogleAnalytics(): boolean {
  if (!analyticsAvailable() || typeof window === 'undefined' || typeof document === 'undefined') return false;

  const id = getAnalyticsMeasurementId();
  if (!id) return false;

  const analyticsWindow = window as AnalyticsWindow;
  if (document.getElementById(GOOGLE_TAG_SCRIPT_ID)) return true;

  analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];
  analyticsWindow.gtag = analyticsWindow.gtag ?? ((...args: unknown[]) => {
    analyticsWindow.dataLayer!.push(args);
  });

  analyticsWindow.gtag('js', new Date());
  // La medición mejorada de cambios del historial registra la navegación SPA;
  // no enviamos page_view manuales para evitar duplicados.
  analyticsWindow.gtag('config', id, {
    page_title: document.title,
    page_location: analyticsPageLocation(window.location),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const script = document.createElement('script');
  script.id = GOOGLE_TAG_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
  return true;
}
