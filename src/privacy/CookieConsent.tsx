import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizedPath, routeLocale } from '@/i18n/routing';
import {
  analyticsAvailable,
  loadGoogleAnalytics,
  readAnalyticsConsent,
  storeAnalyticsConsent,
  type AnalyticsConsent as AnalyticsConsentValue,
} from '@/analytics/analytics';

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function CookieConsent() {
  const { t } = useTranslation('cookies');
  const locale = routeLocale(typeof window === 'undefined' ? '/' : window.location.pathname);
  const [consent, setConsent] = useState<AnalyticsConsentValue | null>(() => (
    typeof window === 'undefined' ? null : readAnalyticsConsent(browserStorage())
  ));

  useEffect(() => {
    if (consent === 'granted') loadGoogleAnalytics();
  }, [consent]);

  if (!analyticsAvailable() || consent !== null) return null;

  const choose = (next: AnalyticsConsentValue) => {
    storeAnalyticsConsent(browserStorage(), next);
    setConsent(next);
  };

  return (
    <aside className="cookie-consent no-print" role="dialog" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-description">
      <div className="cookie-consent__copy">
        <strong id="cookie-consent-title">{t('title')}</strong>
        <p id="cookie-consent-description">{t('description')}</p>
        <a href={localizedPath('terms', locale)}>{t('learnMore')}</a>
      </div>
      <div className="cookie-consent__actions">
        <button type="button" className="button-link" onClick={() => choose('denied')}>{t('reject')}</button>
        <button type="button" className="button-primary" onClick={() => choose('granted')}>{t('accept')}</button>
      </div>
    </aside>
  );
}
