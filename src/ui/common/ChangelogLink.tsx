import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { CHANGELOG_ENTRIES } from '@/content/changelog';
import { normalizeLocale } from '@/i18n/types';
import './ChangelogLink.css';

export function ChangelogLink() {
  const { t } = useTranslation('changelog');
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        className="footer-changelog-link"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {t('link')}
      </button>
      {open && <ChangelogModal onClose={close} />}
    </>
  );
}

function ChangelogModal({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation('changelog');
  const locale = normalizeLocale(i18n.language) ?? 'es';
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [onClose]);

  const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };
  const formatDate = (date: string) => new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="modal changelog-modal no-print" role="presentation" onMouseDown={onBackdropClick}>
      <div
        ref={dialogRef}
        className="modal__box changelog-modal__box"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="modal__header changelog-modal__header">
          <div>
            <p className="changelog-modal__eyebrow">Starcraft Builder</p>
            <h2 id={titleId}>{t('title')}</h2>
            <p id={descriptionId} className="changelog-modal__description">{t('description')}</p>
          </div>
          <button ref={closeRef} type="button" className="modal__close" aria-label={t('close')} onClick={onClose}>
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="changelog-modal__entries">
          {CHANGELOG_ENTRIES.map((entry, entryIndex) => (
            <article className="changelog-entry" data-current={entryIndex === 0 ? 'true' : undefined} key={entry.version}>
              <header className="changelog-entry__header">
                <div>
                  <span className="changelog-entry__version">v{entry.version}</span>
                  {entryIndex === 0 && <span className="changelog-entry__current">{t('current')}</span>}
                  <h3>{entry.title[locale]}</h3>
                </div>
                <time dateTime={entry.date}>{formatDate(entry.date)}</time>
              </header>
              <ul>
                {entry.changes.map((change, changeIndex) => <li key={`${entry.version}-${changeIndex}`}>{change[locale]}</li>)}
              </ul>
            </article>
          ))}
        </div>

        <footer className="changelog-modal__actions">
          <button type="button" onClick={onClose}>{t('close')}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
