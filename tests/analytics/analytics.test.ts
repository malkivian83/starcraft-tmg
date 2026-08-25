import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  analyticsAvailable,
  analyticsPageLocation,
  getAnalyticsMeasurementId,
  readAnalyticsConsent,
  storeAnalyticsConsent,
} from '@/analytics/analytics';

describe('Google Analytics', () => {
  it('usa un ID de medición GA4 válido y no se activa en tests/desarrollo', () => {
    expect(getAnalyticsMeasurementId()).toMatch(/^G-[A-Z0-9]+$/i);
    expect(analyticsAvailable()).toBe(false);
  });

  it('elimina query string y hash de la ubicación enviada', () => {
    expect(analyticsPageLocation({
      origin: 'https://www.starcraft-builder.com',
      pathname: '/es/verificar-correo',
    })).toBe('https://www.starcraft-builder.com/es/verificar-correo');
  });

  it('persiste sólo decisiones de consentimiento válidas', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };

    expect(readAnalyticsConsent(storage)).toBeNull();
    storeAnalyticsConsent(storage, 'granted');
    expect(values.get(ANALYTICS_CONSENT_STORAGE_KEY)).toBe('granted');
    expect(readAnalyticsConsent(storage)).toBe('granted');
    values.set(ANALYTICS_CONSENT_STORAGE_KEY, 'unexpected');
    expect(readAnalyticsConsent(storage)).toBeNull();
  });
});
