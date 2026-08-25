import { useEffect } from 'react';
import type { LocalizedPage } from '@/i18n/routing';
import type { SupportedLocale } from '@/i18n/types';
import { buildSeoMetadata, serializeStructuredData, SITE_ORIGIN } from './metadata';

export function SeoMetadata({ page, locale, noIndex = false }: { page: LocalizedPage; locale: SupportedLocale; noIndex?: boolean }) {
  useEffect(() => {
    applySeoMetadata(page, locale, noIndex);
  }, [locale, noIndex, page]);
  return null;
}

function applySeoMetadata(page: LocalizedPage, locale: SupportedLocale, noIndex: boolean): void {
  const baseMetadata = buildSeoMetadata(page, locale);
  const metadata = noIndex
    ? { ...baseMetadata, robots: 'noindex, nofollow', alternates: [], structuredData: null }
    : baseMetadata;
  document.documentElement.lang = locale;
  document.title = metadata.title;

  upsertMeta('name', 'description', metadata.description);
  upsertMeta('name', 'robots', metadata.robots);
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:site_name', 'Starcraft Builder');
  upsertMeta('property', 'og:title', metadata.title);
  upsertMeta('property', 'og:description', metadata.description);
  upsertMeta('property', 'og:url', metadata.canonicalUrl);
  upsertMeta('property', 'og:image', `${SITE_ORIGIN}/logo.png`);
  upsertMeta('property', 'og:image:alt', 'StarCraft: The Miniatures Game');
  upsertMeta('property', 'og:locale', locale === 'en' ? 'en_US' : 'es_ES');
  upsertMeta('property', 'og:locale:alternate', locale === 'en' ? 'es_ES' : 'en_US');
  upsertMeta('name', 'twitter:card', 'summary');
  upsertMeta('name', 'twitter:title', metadata.title);
  upsertMeta('name', 'twitter:description', metadata.description);
  upsertMeta('name', 'twitter:image', `${SITE_ORIGIN}/logo.png`);

  upsertCanonical(metadata.canonicalUrl);
  replaceAlternates(metadata.alternates);
  replaceStructuredData(metadata.structuredData);
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function upsertCanonical(href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }
  element.href = href;
}

function replaceAlternates(alternates: ReturnType<typeof buildSeoMetadata>['alternates']): void {
  document.head.querySelectorAll('link[data-seo-alternate]').forEach((element) => element.remove());
  for (const alternate of alternates) {
    const element = document.createElement('link');
    element.rel = 'alternate';
    element.hreflang = alternate.hreflang;
    element.href = alternate.href;
    element.dataset.seoAlternate = 'true';
    document.head.appendChild(element);
  }
}

function replaceStructuredData(structuredData: ReturnType<typeof buildSeoMetadata>['structuredData']): void {
  const existing = document.getElementById('seo-structured-data');
  if (!structuredData) {
    existing?.remove();
    return;
  }

  const script = existing instanceof HTMLScriptElement ? existing : document.createElement('script');
  script.id = 'seo-structured-data';
  script.type = 'application/ld+json';
  script.textContent = serializeStructuredData(structuredData);
  if (!script.isConnected) document.head.appendChild(script);
}
