import { SLOT_TYPES, type CostSummary } from '@/engine/types';
import { useTranslation } from 'react-i18next';
import { slotLabel } from './Chips';
import { normalizeLocale } from '@/i18n/types';
import './ResourceBar.css';

interface Props {
  summary: CostSummary;
  hasErrors: boolean;
}

/**
 * Barra de recursos. Requisito explícito (CA-06.7): NUNCA se oculta.
 *
 * En escritorio queda fija en la cabecera; en móvil, fija abajo. Puede
 * contraer el detalle secundario, pero minerales, gas y espacios permanecen
 * siempre visibles.
 */
export function ResourceBar({ summary, hasErrors }: Props) {
  const { t } = useTranslation('builder');
  const { i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language) ?? 'es';
  const {
    mineralsSpent,
    mineralLimit,
    vespeneSpent,
    vespeneLimit,
    resourceType,
    resourcePerRound,
    totalSupply,
    slots,
  } = summary;

  const mineralsOver = mineralsSpent > mineralLimit;
  const vespeneOver = vespeneSpent > vespeneLimit;

  // Solo se muestran los tipos que la lista otorga o consume. Un tipo a cero
  // absoluto no aporta información y roba espacio en móvil — pero AIR sí se
  // muestra cuando la facción lo otorga (decisión D1).
  const visibleSlots = SLOT_TYPES.filter(
    (type) => slots[type].total > 0 || slots[type].used > 0,
  );

  return (
    <div
      className={`resbar${hasErrors ? ' resbar--alert' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="resbar__primary">
        <Metric
          label={t('minerals')}
          value={`${mineralsSpent} / ${mineralLimit}`}
          state={mineralsOver ? 'over' : 'ok'}
        />
        <Metric
          label={t('vespene')}
          value={`${vespeneSpent} / ${vespeneLimit}`}
          state={vespeneOver ? 'over' : 'ok'}
        />

        <div className="resbar__slots">
          {visibleSlots.length === 0 ? (
            <span className="resbar__hint">{t('noSlots')}</span>
          ) : (
            visibleSlots.map((type) => {
              const { used, total } = slots[type];
              const over = used > total;
              return (
                <span
                  key={type}
                  className={`resbar__slot${over ? ' resbar__slot--over' : ''}`}
                  title={`${slotLabel(type, locale)}: ${used} ${t('usedOf')} ${total}`}
                >
                  <span className="resbar__slot-label">{slotLabel(type, locale)}</span>
                  <span className="resbar__slot-value">
                    {used}/{total}
                  </span>
                </span>
              );
            })
          )}
        </div>
      </div>

      <div className="resbar__secondary">
        {resourceType && (
          <span title={t(`resource.${resourceType}`)}>
            {resourceType} <strong>{resourcePerRound}</strong> {t('perRound')}
          </span>
        )}
        <span>
          {t('supply')} <strong>{totalSupply}</strong>
        </span>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  state,
}: {
  label: string;
  value: string;
  state: 'ok' | 'over';
}) {
  return (
    <div className={`resbar__metric resbar__metric--${state}`}>
      <span className="resbar__metric-label">{label}</span>
      <span className="resbar__metric-value">{value}</span>
    </div>
  );
}
