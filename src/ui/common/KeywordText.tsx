import type { ReactNode } from 'react';
import type { SupportedLocale } from '@/i18n/types';
import { keywordAt } from './keywordGlossary';

export function KeywordText({ text, locale }: { text: string; locale: SupportedLocale }) {
  if (!text) return null;

  const parts: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  while (cursor < text.length) {
    const match = keywordAt(text, cursor);
    if (!match) {
      const nextKeyword = findNextKeyword(text, cursor + 1);
      const end = nextKeyword ?? text.length;
      parts.push(text.slice(cursor, end));
      cursor = end;
      continue;
    }

    const value = text.slice(cursor, cursor + match.length);
    const description = match.text[locale] || match.text.en || match.text.es;
    parts.push(
      <span
        key={`keyword-${key++}`}
        className="keyword-term"
        data-tooltip={description}
        title={description}
        tabIndex={0}
        role="button"
        aria-label={`${value}: ${description}`}
      >
        {value}
      </span>,
    );
    cursor += match.length;
  }

  return <>{parts}</>;
}

function findNextKeyword(text: string, start: number): number | null {
  for (let index = start; index < text.length; index += 1) {
    if (keywordAt(text, index)) return index;
  }
  return null;
}
