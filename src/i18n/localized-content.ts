import type { Localized } from '@/engine/types';
import type { SupportedLocale } from './types';

export function localizedText(value: Localized | undefined, locale: SupportedLocale): string {
  if (!value) return '';
  return value[locale] || value.en || value.es;
}
