import { useEffect, useRef, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogIndex } from '@/engine/catalogIndex';
import type { ArmyList, ValidationIssue } from '@/engine/types';
import { normalizeLocale } from '@/i18n/types';
import { ValidationIssueList } from './ValidationIssueList';

export function ReviewErrorsModal({
  errors,
  list,
  index,
  onClose,
}: {
  errors: ValidationIssue[];
  list: ArmyList;
  index: CatalogIndex;
  onClose: () => void;
}) {
  const { t } = useTranslation('builderUi');
  const { i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language) ?? 'es';
  const dialogRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    continueRef.current?.focus();

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
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

  return (
    <div
      className="modal review-errors-modal no-print"
      role="presentation"
      onMouseDown={onBackdropClick}
    >
      <div
        ref={dialogRef}
        className="modal__box review-errors-modal__box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-errors-title"
        aria-describedby="review-errors-summary"
      >
        <header className="modal__header">
          <div>
            <h2 id="review-errors-title">{t('reviewErrorsTitle')}</h2>
            <p id="review-errors-summary" className="small muted">
              {t(errors.length === 1 ? 'reviewErrorsSummary_one' : 'reviewErrorsSummary_other', { count: errors.length })}
            </p>
          </div>
          <button
            type="button"
            className="modal__close"
            aria-label={t('reviewErrorsClose')}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <ValidationIssueList issues={errors} list={list} index={index} locale={locale} className="review-errors-modal__list" />

        <footer className="review-errors-modal__actions">
          <button ref={continueRef} type="button" onClick={onClose}>
            {t('reviewErrorsContinue')}
          </button>
        </footer>
      </div>
    </div>
  );
}
