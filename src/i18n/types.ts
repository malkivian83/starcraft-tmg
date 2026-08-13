export const SUPPORTED_LOCALES = ['es', 'en'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return value === 'es' || value === 'en';
}

export function normalizeLocale(value: string | null | undefined): SupportedLocale | null {
  if (!value) return null;
  const language = value.toLowerCase().split('-')[0];
  return isSupportedLocale(language) ? language : null;
}
