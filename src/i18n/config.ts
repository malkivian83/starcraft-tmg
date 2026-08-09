import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './locales';
import type { SupportedLocale } from './types';

export const defaultLocale: SupportedLocale = 'es';

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: defaultLocale,
    fallbackLng: defaultLocale,
    supportedLngs: ['es', 'en'],
    defaultNS: 'common',
    ns: ['common', 'navigation', 'home', 'lists', 'builder', 'builderUi', 'print', 'auth', 'support', 'account', 'admin', 'legal', 'errors'],
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
}

export default i18n;
