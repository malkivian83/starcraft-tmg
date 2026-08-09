import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { changeLocale, localeFromPathname, preferredLocale, syncLocale } from './locale';
import { findPublicListId, localizedPath, pageFromPath, routeLocale } from './routing';
import type { SupportedLocale } from './types';

function preserveSuffix(search: string, hash: string): string {
  return `${search}${hash}`;
}

export function LocaleBootstrap() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const initialPathHadLocale = useRef(localeFromPathname(location.pathname) !== null);
  const redirectedLegacyPath = useRef(false);

  useEffect(() => {
    const currentLocale = localeFromPathname(location.pathname);
    if (currentLocale) {
      syncLocale(currentLocale);
      return;
    }
    if (redirectedLegacyPath.current) return;
    redirectedLegacyPath.current = true;
    const legacyPublicId = location.pathname.match(/^\/public-lists\/([^/]+)$/)?.[1];
    const page = legacyPublicId ? 'public-list' : pageFromPath(location.pathname);
    const locale = preferredLocale();
    navigate(localizedPath(page, locale, legacyPublicId ? decodeURIComponent(legacyPublicId) : null) + preserveSuffix(location.search, location.hash), { replace: true });
  }, [location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (status !== 'authenticated' || !user?.locale || initialPathHadLocale.current) return;
    const currentLocale = routeLocale(location.pathname);
    if (currentLocale === user.locale) return;
    const id = findPublicListId(location.pathname);
    const page = pageFromPath(location.pathname);
    changeLocale(user.locale as SupportedLocale);
    navigate(localizedPath(page, user.locale as SupportedLocale, id) + preserveSuffix(location.search, location.hash), { replace: true });
  }, [location.hash, location.pathname, location.search, navigate, status, user?.locale]);

  return null;
}
