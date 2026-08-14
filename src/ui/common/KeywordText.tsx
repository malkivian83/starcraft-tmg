import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SupportedLocale } from '@/i18n/types';
import { keywordAt } from './keywordGlossary';

interface TooltipPosition {
  left: number;
  top: number;
  placement: 'above' | 'below';
}

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
      <KeywordTerm
        key={`keyword-${key++}`}
        value={value}
        description={description}
      />,
    );
    cursor += match.length;
  }

  return <>{parts}</>;
}

function KeywordTerm({ value, description }: { value: string; description: string }) {
  const termRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const term = termRef.current;
      const tooltip = tooltipRef.current;
      if (!term || !tooltip) return;

      const termRect = term.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const viewportMargin = 12;
      const gap = 8;
      const halfWidth = tooltipRect.width / 2;
      const minimumLeft = viewportMargin + halfWidth;
      const maximumLeft = window.innerWidth - viewportMargin - halfWidth;
      const left = Math.min(Math.max(termRect.left + termRect.width / 2, minimumLeft), maximumLeft);
      const aboveTop = termRect.top - gap - tooltipRect.height;
      const placement = aboveTop >= viewportMargin ? 'above' : 'below';
      const unclampedTop = placement === 'above' ? aboveTop : termRect.bottom + gap;
      const top = Math.min(
        Math.max(unclampedTop, viewportMargin),
        window.innerHeight - viewportMargin - tooltipRect.height,
      );

      setPosition({ left, top, placement });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, description]);

  return (
    <>
      <span
        ref={termRef}
        className="keyword-term"
        tabIndex={0}
        role="button"
        aria-label={`${value}: ${description}`}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {value}
      </span>
      {open && typeof document !== 'undefined' && createPortal(
        <span
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className="keyword-tooltip"
          data-placement={position?.placement}
          style={position ? { left: position.left, top: position.top } : undefined}
        >
          {description}
        </span>,
        document.body,
      )}
    </>
  );
}

function findNextKeyword(text: string, start: number): number | null {
  for (let index = start; index < text.length; index += 1) {
    if (keywordAt(text, index)) return index;
  }
  return null;
}
