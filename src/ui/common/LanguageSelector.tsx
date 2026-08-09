import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { updateLocale } from '@/auth/authService';
import { useAuthStore } from '@/store/authStore';
import { changeLocale } from '@/i18n/locale';
import { findPublicListId, localizedPath, pageFromPath, routeLocale } from '@/i18n/routing';
import type { SupportedLocale } from '@/i18n/types';

export function LanguageSelector() {
  const { t } = useTranslation('common');
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const locale = routeLocale(location.pathname);

  useEffect(() => { changeLocale(locale); }, [locale]);

  const selectLocale = (nextLocale: SupportedLocale) => {
    if (nextLocale === locale) return;
    const page = pageFromPath(location.pathname);
    const id = findPublicListId(location.pathname);
    changeLocale(nextLocale);
    navigate(`${localizedPath(page, nextLocale, id)}${location.search}${location.hash}`);
    if (user) void updateLocale(nextLocale).then(setUser).catch(() => undefined);
  };

  return (
    <label className="language-selector">
      <span className="sr-only">{t('language')}</span>
      <select aria-label={t('language')} value={locale} onChange={(event) => selectLocale(event.target.value as SupportedLocale)}>
        <option value="es">{t('spanish')}</option>
        <option value="en">{t('english')}</option>
      </select>
    </label>
  );
}
