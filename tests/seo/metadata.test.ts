import { describe, expect, it } from 'vitest';
import type { LocalizedPage } from '@/i18n/routing';
import { SITE_ORIGIN, buildSeoMetadata, serializeStructuredData } from '@/seo/metadata';

type StructuredData = Record<string, unknown>;

interface BreadcrumbItem extends StructuredData {
  '@type': string;
  position: number;
  name: string;
  item: string;
}

interface BreadcrumbList extends StructuredData {
  '@context': string;
  '@type': string;
  itemListElement: BreadcrumbItem[];
}

const breadcrumb = (page: LocalizedPage, locale: 'es' | 'en'): BreadcrumbList =>
  buildSeoMetadata(page, locale).structuredData as BreadcrumbList;

const structuredDataKeys = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(structuredDataKeys);
  if (value === null || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, child]) => [key, ...structuredDataKeys(child)]);
};

describe('metadatos SEO y rich snippets', () => {
  it('usa el dominio canónico con www y crea un WebSite válido en la portada', () => {
    expect(SITE_ORIGIN).toBe('https://www.starcraft-builder.com');

    for (const locale of ['es', 'en'] as const) {
      const metadata = buildSeoMetadata('home', locale);
      const website = (Array.isArray(metadata.structuredData)
        ? metadata.structuredData.find((item) => item['@type'] === 'WebSite')
        : metadata.structuredData) as StructuredData;
      const organization = (Array.isArray(metadata.structuredData)
        ? metadata.structuredData.find((item) => item['@type'] === 'Organization')
        : null) as StructuredData;

      expect(metadata.title.trim()).not.toBe('');
      expect(metadata.description.trim()).not.toBe('');
      expect(metadata.robots).toContain('index');
      expect(metadata.robots).toContain('follow');
      expect(metadata.robots).not.toContain('noindex');
      expect(website).toMatchObject({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
      });
      expect(typeof website.name).toBe('string');
      expect(new URL(String(website.url)).origin).toBe(SITE_ORIGIN);
      expect(organization).toMatchObject({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Starcraft Builder',
        url: SITE_ORIGIN,
      });
      expect(new URL(String(organization.logo)).origin).toBe(SITE_ORIGIN);
    }
  });

  it.each([
    ['es', 'Inicio', 'Crear lista', '/es/inicio', '/es/crear-lista'],
    ['en', 'Home', 'Create list', '/en/home', '/en/create-list'],
  ] as const)(
    'crea un BreadcrumbList localizado de dos elementos para guest-builder (%s)',
    (locale, homeName, pageName, homePath, pagePath) => {
      const data = breadcrumb('guest-builder', locale);

      expect(data).toMatchObject({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
      });
      expect(data.itemListElement).toEqual([
        {
          '@type': 'ListItem',
          position: 1,
          name: homeName,
          item: `${SITE_ORIGIN}${homePath}`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: pageName,
          item: `${SITE_ORIGIN}${pagePath}`,
        },
      ]);
      for (const item of data.itemListElement) {
        expect(new URL(item.item).origin).toBe(SITE_ORIGIN);
      }
    },
  );

  it.each([
    ['support', 'es', '/es/inicio', '/es/soporte'],
    ['support', 'en', '/en/home', '/en/support'],
    ['terms', 'es', '/es/inicio', '/es/terminos-y-condiciones'],
    ['terms', 'en', '/en/home', '/en/terms-and-conditions'],
    ['faqs', 'es', '/es/inicio', '/es/faqs'],
    ['faqs', 'en', '/en/home', '/en/faqs'],
  ] as const)('crea breadcrumbs absolutos para %s en %s', (page, locale, homePath, pagePath) => {
    const data = breadcrumb(page, locale);

    expect(data['@type']).toBe('BreadcrumbList');
    expect(data.itemListElement).toHaveLength(2);
    expect(data.itemListElement.map(({ position, item }) => ({ position, item }))).toEqual([
      { position: 1, item: `${SITE_ORIGIN}${homePath}` },
      { position: 2, item: `${SITE_ORIGIN}${pagePath}` },
    ]);
  });

  it('marca como no indexables las rutas privadas y no publica datos estructurados para ellas', () => {
    const privatePages: LocalizedPage[] = [
      'builder',
      'lists',
      'public-lists',
      'profile',
      'public-list',
      'register',
      'check-email',
      'verify-email',
      'reset-password',
    ];

    for (const page of privatePages) {
      for (const locale of ['es', 'en'] as const) {
        const metadata = buildSeoMetadata(page, locale);

        expect(metadata.robots, `${page}/${locale}`).toBe('noindex, nofollow');
        expect(metadata.structuredData, `${page}/${locale}`).toBeNull();
      }
    }
  });

  it('genera canonical y hreflang coherentes para las páginas públicas localizadas', () => {
    const pages: Array<{
      page: LocalizedPage;
      es: string;
      en: string;
    }> = [
      { page: 'home', es: '/es/inicio', en: '/en/home' },
      { page: 'guest-builder', es: '/es/crear-lista', en: '/en/create-list' },
      { page: 'games', es: '/es/partidas', en: '/en/games' },
      { page: 'support', es: '/es/soporte', en: '/en/support' },
      { page: 'terms', es: '/es/terminos-y-condiciones', en: '/en/terms-and-conditions' },
      { page: 'faqs', es: '/es/faqs', en: '/en/faqs' },
    ];

    for (const { page, es, en } of pages) {
      const expectedAlternates = [
        { hreflang: 'es', href: `${SITE_ORIGIN}${es}` },
        { hreflang: 'en', href: `${SITE_ORIGIN}${en}` },
      ];

      const spanish = buildSeoMetadata(page, 'es');
      const english = buildSeoMetadata(page, 'en');

      expect(spanish.canonicalUrl).toBe(`${SITE_ORIGIN}${es}`);
      expect(english.canonicalUrl).toBe(`${SITE_ORIGIN}${en}`);
      expect(spanish.alternates).toEqual(expect.arrayContaining(expectedAlternates));
      expect(english.alternates).toEqual(expect.arrayContaining(expectedAlternates));
    }
  });

  it('no inventa reseñas ni valoraciones en ningún rich snippet', () => {
    for (const page of ['home', 'guest-builder', 'games', 'support', 'terms', 'faqs'] as const) {
      for (const locale of ['es', 'en'] as const) {
        const keys = structuredDataKeys(buildSeoMetadata(page, locale).structuredData);

        expect(keys, `${page}/${locale}`).not.toContain('aggregateRating');
        expect(keys, `${page}/${locale}`).not.toContain('review');
      }
    }
  });

  it('serializa JSON-LD escapando caracteres que podrían romper el script', () => {
    const value = {
      text: '</script><span>&\u2028\u2029',
      nested: ['<', '>', '&'],
    };

    const serialized = serializeStructuredData(value);
    const escaped = serialized.toLowerCase();

    expect(serialized).not.toContain('<');
    expect(serialized).not.toContain('>');
    expect(serialized).not.toContain('&');
    expect(serialized).not.toContain('\u2028');
    expect(serialized).not.toContain('\u2029');
    expect(escaped).toContain('\\u003c');
    expect(escaped).toContain('\\u003e');
    expect(escaped).toContain('\\u0026');
    expect(escaped).toContain('\\u2028');
    expect(escaped).toContain('\\u2029');
    expect(JSON.parse(serialized)).toEqual(value);
  });
});
