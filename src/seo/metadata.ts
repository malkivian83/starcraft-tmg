import { localizedPath, type LocalizedPage } from '@/i18n/routing';
import type { SupportedLocale } from '@/i18n/types';

export const SITE_ORIGIN = 'https://www.starcraft-builder.com';

type StructuredData = Record<string, unknown>;
type StructuredDataValue = StructuredData | StructuredData[];

interface PageCopy {
  title: string;
  description: string;
  breadcrumb: string;
}

export interface SeoAlternate {
  hreflang: 'es' | 'en' | 'x-default';
  href: string;
}

export interface SeoMetadataDescriptor {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  alternates: SeoAlternate[];
  structuredData: StructuredDataValue | null;
}

const PUBLIC_PAGES = new Set<LocalizedPage>([
  'home',
  'guest-builder',
  'games',
  'support',
  'faqs',
  'terms',
]);

const PAGE_COPY: Record<SupportedLocale, Record<LocalizedPage, PageCopy>> = {
  es: {
    home: {
      title: 'Starcraft Builder | Listas para StarCraft TMG',
      description: 'Crea, valida e imprime listas de ejército y gestiona partidas de StarCraft: The Miniatures Game en español o inglés.',
      breadcrumb: 'Inicio',
    },
    'guest-builder': {
      title: 'Constructor de listas StarCraft TMG | Starcraft Builder',
      description: 'Construye y valida gratis una lista Zerg, Terran o Protoss para StarCraft: The Miniatures Game, sin necesidad de crear una cuenta.',
      breadcrumb: 'Crear lista',
    },
    games: {
      title: 'Gestor de partidas StarCraft TMG | Starcraft Builder',
      description: 'Controla rondas, suministro de misión y puntos de victoria durante tus partidas de StarCraft: The Miniatures Game.',
      breadcrumb: 'Partidas',
    },
    support: {
      title: 'Soporte | Starcraft Builder',
      description: 'Contacta con el soporte de Starcraft Builder para comunicar incidencias o resolver dudas sobre la aplicación.',
      breadcrumb: 'Soporte',
    },
    faqs: { title: 'FAQ de StarCraft TMG | Starcraft Builder', description: 'Consulta en español las preguntas frecuentes y aclaraciones oficiales de StarCraft: The Miniatures Game.', breadcrumb: 'Preguntas frecuentes' },
    terms: {
      title: 'Términos y condiciones | Starcraft Builder',
      description: 'Consulta los términos y condiciones de uso de Starcraft Builder, proyecto fan no oficial para StarCraft TMG.',
      breadcrumb: 'Términos y condiciones',
    },
    builder: { title: 'Nueva lista | Starcraft Builder', description: 'Editor privado de listas de ejército.', breadcrumb: 'Nueva lista' },
    lists: { title: 'Mis listas | Starcraft Builder', description: 'Biblioteca privada de listas de ejército.', breadcrumb: 'Mis listas' },
    'public-lists': { title: 'Listas públicas | Starcraft Builder', description: 'Biblioteca de listas compartidas por la comunidad.', breadcrumb: 'Listas públicas' },
    profile: { title: 'Mi perfil | Starcraft Builder', description: 'Configuración privada de la cuenta.', breadcrumb: 'Mi perfil' },
    'public-list': { title: 'Lista pública | Starcraft Builder', description: 'Detalle de una lista compartida por la comunidad.', breadcrumb: 'Lista pública' },
    register: { title: 'Crear cuenta | Starcraft Builder', description: 'Crea una cuenta de Starcraft Builder.', breadcrumb: 'Crear cuenta' },
    'check-email': { title: 'Revisa tu correo | Starcraft Builder', description: 'Verificación de la cuenta de Starcraft Builder.', breadcrumb: 'Revisa tu correo' },
    'verify-email': { title: 'Verificar correo | Starcraft Builder', description: 'Verificación de la cuenta de Starcraft Builder.', breadcrumb: 'Verificar correo' },
    'reset-password': { title: 'Restablecer contraseña | Starcraft Builder', description: 'Restablecimiento de la contraseña de Starcraft Builder.', breadcrumb: 'Restablecer contraseña' },
  },
  en: {
    home: {
      title: 'Starcraft Builder | StarCraft TMG Army Lists',
      description: 'Create, validate, and print army lists and manage games for StarCraft: The Miniatures Game in English or Spanish.',
      breadcrumb: 'Home',
    },
    'guest-builder': {
      title: 'StarCraft TMG Army List Builder | Starcraft Builder',
      description: 'Build and validate a Zerg, Terran, or Protoss list for StarCraft: The Miniatures Game for free, without creating an account.',
      breadcrumb: 'Create list',
    },
    games: {
      title: 'StarCraft TMG Game Manager | Starcraft Builder',
      description: 'Track rounds, mission supply, and victory points during your StarCraft: The Miniatures Game sessions.',
      breadcrumb: 'Games',
    },
    support: {
      title: 'Support | Starcraft Builder',
      description: 'Contact Starcraft Builder support to report an issue or ask a question about the application.',
      breadcrumb: 'Support',
    },
    faqs: { title: 'StarCraft TMG FAQ | Starcraft Builder', description: 'Read the official frequently asked questions and rules clarifications for StarCraft: The Miniatures Game.', breadcrumb: 'FAQ' },
    terms: {
      title: 'Terms and conditions | Starcraft Builder',
      description: 'Read the terms and conditions for Starcraft Builder, an unofficial fan-made project for StarCraft TMG.',
      breadcrumb: 'Terms and conditions',
    },
    builder: { title: 'New list | Starcraft Builder', description: 'Private army list editor.', breadcrumb: 'New list' },
    lists: { title: 'My lists | Starcraft Builder', description: 'Private army list library.', breadcrumb: 'My lists' },
    'public-lists': { title: 'Public lists | Starcraft Builder', description: 'Army lists shared by the community.', breadcrumb: 'Public lists' },
    profile: { title: 'My profile | Starcraft Builder', description: 'Private account settings.', breadcrumb: 'My profile' },
    'public-list': { title: 'Public list | Starcraft Builder', description: 'Details of an army list shared by the community.', breadcrumb: 'Public list' },
    register: { title: 'Create account | Starcraft Builder', description: 'Create a Starcraft Builder account.', breadcrumb: 'Create account' },
    'check-email': { title: 'Check your email | Starcraft Builder', description: 'Starcraft Builder account verification.', breadcrumb: 'Check your email' },
    'verify-email': { title: 'Verify email | Starcraft Builder', description: 'Starcraft Builder account verification.', breadcrumb: 'Verify email' },
    'reset-password': { title: 'Reset password | Starcraft Builder', description: 'Reset your Starcraft Builder password.', breadcrumb: 'Reset password' },
  },
};

function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path}`;
}

function canonicalUrl(page: LocalizedPage, locale: SupportedLocale): string {
  return absoluteUrl(localizedPath(page, locale));
}

function websiteStructuredData(): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_ORIGIN}/#website`,
    url: `${SITE_ORIGIN}/`,
    name: 'Starcraft Builder',
    alternateName: ['StarCraft TMG Builder', 'starcraft-builder.com'],
    inLanguage: ['es', 'en'],
  };
}

function organizationStructuredData(locale: SupportedLocale): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_ORIGIN}/#organization`,
    name: 'Starcraft Builder',
    alternateName: ['StarCraft TMG Builder', 'starcraft-builder.com'],
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/icon-512.png`,
    description: PAGE_COPY[locale].home.description,
  };
}

function breadcrumbStructuredData(page: LocalizedPage, locale: SupportedLocale): StructuredData {
  const copy = PAGE_COPY[locale];
  const pageUrl = canonicalUrl(page, locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: copy.home.breadcrumb,
        item: canonicalUrl('home', locale),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: copy[page].breadcrumb,
        item: pageUrl,
      },
    ],
  };
}

function alternateLinks(page: LocalizedPage): SeoAlternate[] {
  return [
    { hreflang: 'es', href: canonicalUrl(page, 'es') },
    { hreflang: 'en', href: canonicalUrl(page, 'en') },
    { hreflang: 'x-default', href: canonicalUrl(page, 'es') },
  ];
}

export function buildSeoMetadata(page: LocalizedPage, locale: SupportedLocale): SeoMetadataDescriptor {
  const isPublic = PUBLIC_PAGES.has(page);
  const copy = PAGE_COPY[locale][page];
  return {
    title: copy.title,
    description: copy.description,
    canonicalUrl: canonicalUrl(page, locale),
    robots: isPublic
      ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      : 'noindex, nofollow',
    alternates: isPublic ? alternateLinks(page) : [],
    structuredData: !isPublic
      ? null
      : page === 'home'
        ? [websiteStructuredData(), organizationStructuredData(locale)]
        : breadcrumbStructuredData(page, locale),
  };
}

/** Serializa JSON-LD sin permitir que datos futuros cierren la etiqueta script. */
export function serializeStructuredData(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
