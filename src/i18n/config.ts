import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './locales';
import { pwaResources } from './pwa';
import { cookiesResources } from './cookies';
import type { SupportedLocale } from './types';

export const defaultLocale: SupportedLocale = 'es';

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      es: { ...resources.es, pwa: pwaResources.es, cookies: cookiesResources.es },
      en: { ...resources.en, pwa: pwaResources.en, cookies: cookiesResources.en },
    },
    lng: defaultLocale,
    fallbackLng: defaultLocale,
    supportedLngs: ['es', 'en'],
    defaultNS: 'common',
    ns: ['common', 'navigation', 'home', 'lists', 'builder', 'builderUi', 'print', 'auth', 'support', 'faqs', 'account', 'admin', 'legal', 'errors', 'pwa', 'cookies'],
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
}

export default i18n;
