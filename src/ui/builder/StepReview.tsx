import { SLOT_TYPES } from '@/engine/types';
import { useListStore } from '@/store/listStore';
import { slotLabel } from '../common/Chips';
import { PrintSheet } from '../print/PrintSheet';

/** Paso 4 — Revisión, libro mayor de espacios e impresión. */
export function StepReview() {
  const { summary, validation } = useListStore();

  return (
    <div className="review-layout">
      <section className="panel no-print review-layout__validation">
        <h2 className="panel__title">Validación</h2>
        {validation.legal ? (
          <p style={{ color: 'var(--ok)', margin: 0 }}>
            ✓ La lista es legal.
          </p>
        ) : (
          <p style={{ color: 'var(--error)', margin: '0 0 10px' }}>
            La lista todavía no es legal: {validation.errors.length} problema(s)
            por resolver.
          </p>
        )}

        <div className="stack" style={{ marginTop: 10 }}>
          {validation.errors.map((issue, i) => (
            <div key={`e${i}`} className="issue issue--error">
              <span className="issue__rule">
                {issue.rule} · {issue.ruleRef}
              </span>
              <div>{issue.message.es}</div>
              {issue.remedy && (
                <div className="issue__remedy">→ {issue.remedy.es}</div>
              )}
            </div>
          ))}
          {validation.warnings.map((issue, i) => (
            <div key={`w${i}`} className="issue issue--warning">
              <span className="issue__rule">
                {issue.rule} · {issue.ruleRef}
              </span>
              <div>{issue.message.es}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="review-layout__main stack">
      <section className="panel no-print">
        <h2 className="panel__title">
          Libro mayor de espacios — de dónde sale cada uno
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
                  {slotLabel(type)}{' '}
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
                      <td>Libres</td>
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
        <h2 className="panel__title">Hoja de lista</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Imprime la hoja de tu lista o guárdala como PDF desde el destino de
          impresión.
        </p>
        <button onClick={() => window.print()}>Imprimir / PDF</button>
      </section>

      <PrintSheet />
      </div>
    </div>
  );
}
