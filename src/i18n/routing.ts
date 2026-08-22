import { localeFromPathname } from './locale';
import type { SupportedLocale } from './types';

export type LocalizedPage = 'home' | 'builder' | 'lists' | 'public-lists' | 'games' | 'profile' | 'support' | 'public-list' | 'guest-builder' | 'terms' | 'register' | 'check-email' | 'verify-email' | 'reset-password';

const paths: Record<SupportedLocale, Record<LocalizedPage, string>> = {
  es: { home: 'inicio', builder: 'nueva-lista', lists: 'mis-listas', 'public-lists': 'listas-publicas', games: 'partidas', profile: 'perfil', support: 'soporte', 'public-list': 'listas-publicas', 'guest-builder': 'crear-lista', terms: 'terminos-y-condiciones', register: 'registro', 'check-email': 'revisa-tu-correo', 'verify-email': 'verificar-correo', 'reset-password': 'restablecer-contrasena' },
  en: { home: 'home', builder: 'new-list', lists: 'my-lists', 'public-lists': 'public-lists', games: 'games', profile: 'profile', support: 'support', 'public-list': 'public-lists', 'guest-builder': 'create-list', terms: 'terms-and-conditions', register: 'register', 'check-email': 'check-your-email', 'verify-email': 'verify-email', 'reset-password': 'reset-password' },
};

export function localizedPath(page: LocalizedPage, locale: SupportedLocale, id?: string | null): string {
  const base = `/${locale}/${paths[locale][page]}`;
  if (page === 'public-list' && id) return `${base}/${encodeURIComponent(id)}`;
  return base;
}

export function pathForLocalePage(page: LocalizedPage, locale: SupportedLocale, id?: string | null): string {
  return localizedPath(page, locale, id);
}

export function stripLocale(pathname: string): string {
  const locale = localeFromPathname(pathname);
  return locale ? pathname.replace(new RegExp(`^/${locale}`), '') || '/' : pathname;
}

export function routeLocale(pathname: string): SupportedLocale {
  return localeFromPathname(pathname) ?? 'es';
}

export function findPublicListId(pathname: string): string | null {
  const locale = routeLocale(pathname);
  const segment = paths[locale]['public-list'];
  const match = pathname.match(new RegExp(`^/${locale}/${segment}/([^/]+)$`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function pageFromPath(pathname: string): LocalizedPage {
  const locale = routeLocale(pathname);
  const stripped = stripLocale(pathname);
  const current = paths[locale];
  if (stripped === `/${current.builder}`) return 'builder';
  if (stripped === `/${current.lists}`) return 'lists';
  if (stripped === `/${current['public-lists']}`) return 'public-lists';
  if (stripped === `/${current.games}` || stripped === '/partida' || stripped === '/game') return 'games';
  if (stripped === `/${current.profile}`) return 'profile';
  if (stripped === `/${current.support}`) return 'support';
  if (stripped === `/${current['guest-builder']}`) return 'guest-builder';
  if (stripped === `/${current.terms}`) return 'terms';
  if (stripped === `/${current.register}`) return 'register';
  if (stripped === `/${current['check-email']}`) return 'check-email';
  if (stripped === `/${current['verify-email']}`) return 'verify-email';
  if (stripped === `/${current['reset-password']}`) return 'reset-password';
  if (stripped.startsWith(`/${current['public-list']}/`)) return 'public-list';
  return 'home';
}
