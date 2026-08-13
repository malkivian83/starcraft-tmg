import { SLOT_TYPES } from '@/engine/types';
import { useTranslation } from 'react-i18next';
import { localizedText } from '@/i18n/localized-content';
import { normalizeLocale } from '@/i18n/types';
import { useListStore } from '@/store/listStore';
import { slotLabel } from '../common/Chips';

/** Paso 4 — Revisión, libro mayor de espacios e impresión. */
export function StepReview() {
  const { t } = useTranslation('builderUi');
  const { i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language) ?? 'es';
  const { summary, validation } = useListStore();

  return (
    <div className="review-layout">
      <section className="panel no-print review-layout__validation">
        <h2 className="panel__title">{t('validation')}</h2>
        {validation.legal ? (
          <p style={{ color: 'var(--ok)', margin: 0 }}>
            {t('legal')}
          </p>
        ) : (
          <p style={{ color: 'var(--error)', margin: '0 0 10px' }}>
            {t('illegal', { count: validation.errors.length })}
          </p>
        )}

        <div className="stack" style={{ marginTop: 10 }}>
          {validation.errors.map((issue, i) => (
            <div key={`e${i}`} className="issue issue--error">
              <span className="issue__rule">
                {issue.rule} · {issue.ruleRef}
              </span>
              <div>{localizedText(issue.message, locale)}</div>
              {issue.remedy && (
                <div className="issue__remedy">→ {localizedText(issue.remedy, locale)}</div>
              )}
            </div>
          ))}
          {validation.warnings.map((issue, i) => (
            <div key={`w${i}`} className="issue issue--warning">
              <span className="issue__rule">
                {issue.rule} · {issue.ruleRef}
              </span>
              <div>{localizedText(issue.message, locale)}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="review-layout__main stack">
      <section className="panel no-print">
        <h2 className="panel__title">
          {t('ledger')}
        </h2>
        <div className="ledger">
          {SLOT_TYPES.filter(
            (t) => summary.slots[t].total > 0 || summary.slots[t].used > 0,
          ).map((type) => {
            const ledger = summary.slots[type];
            const free = ledger.total - ledger.used;
            return (
              <div key={type} className="ledger__block">
                <h3 className="ledger__title">
                  {slotLabel(type, locale)}{' '}
                  <span className={free < 0 ? 'ledger__bad' : 'ledger__ok'}>
                    {ledger.used}/{ledger.total}
                  </span>
                </h3>
                <table className="ledger__table">
                  <tbody>
                    {ledger.grantedBy.map((source, i) => (
                      <tr key={`g${i}`}>
                        <td>{source.cardName}</td>
                        <td className="ledger__num ledger__ok">
                          +{source.amount}
                        </td>
                      </tr>
                    ))}
                    {ledger.consumedBy.map((consumer, i) => (
                      <tr key={`c${i}`}>
                        <td className="muted">{consumer.unitName}</td>
                        <td className="ledger__num muted">
                          −{consumer.amount}
                        </td>
                      </tr>
                    ))}
                    <tr className="ledger__total">
                      <td>{t('free')}</td>
                      <td
                        className={`ledger__num ${
                          free < 0 ? 'ledger__bad' : ''
                        }`}
                      >
                        {free}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel no-print">
        <h2 className="panel__title">{t('sheet')}</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          {t('printHint')}
        </p>
        <button onClick={() => window.print()}>{t('print')}</button>
      </section>
      </div>
    </div>
  );
}
