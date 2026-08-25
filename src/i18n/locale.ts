import i18n from './config';
import { normalizeLocale, type SupportedLocale } from './types';

export const LOCALE_STORAGE_KEY = 'starcraft-tmg.locale';

function updateDocumentMetadata(locale: SupportedLocale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.title = 'Starcraft Builder · StarCraft TMG';
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description) description.content = locale === 'en'
    ? 'Army list builder for StarCraft: The Miniatures Game'
    : 'Constructor de listas de ejército para StarCraft: The Miniatures Game';
}

export function localeFromPathname(pathname: string): SupportedLocale | null {
  return normalizeLocale(pathname.split('/')[1]);
}

export function browserLocale(): SupportedLocale | null {
  if (typeof navigator === 'undefined') return null;
  for (const language of navigator.languages ?? [navigator.language]) {
    const normalized = normalizeLocale(language);
    if (normalized) return normalized;
  }
  return null;
}

export function storedLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') return null;
  return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
}

export function preferredLocale(profileLocale?: SupportedLocale | null): SupportedLocale {
  return profileLocale ?? storedLocale() ?? browserLocale() ?? 'es';
}

export function setStoredLocale(locale: SupportedLocale): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function changeLocale(locale: SupportedLocale): void {
  setStoredLocale(locale);
  void i18n.changeLanguage(locale);
  updateDocumentMetadata(locale);
}

export function syncLocale(locale: SupportedLocale): void {
  if (i18n.language !== locale) void i18n.changeLanguage(locale);
  updateDocumentMetadata(locale);
}
