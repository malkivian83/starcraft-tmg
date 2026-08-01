import { findComposition, upgradeCostFor } from '@/engine/costing';
import { SLOT_TYPES } from '@/engine/types';
import { useListStore } from '@/store/listStore';
import { slotLabel } from '../common/Chips';
import './print.css';

const SCALE_LABEL: Record<string, string> = {
  skirmish: 'Escaramuza',
  standard: 'Estándar',
  grand_offensive: 'Gran Ofensiva',
};

/**
 * Hoja de lista A4 (CA-11.1..11.3).
 *
 * Pensada para llevarla a la mesa: legible en blanco y negro, sin ningún
 * elemento de interfaz, y con las unidades invocadas separadas en su propio
 * bloque para que nadie las confunda con parte del ejército.
 */
export function PrintSheet() {
  const { list, index, summary, validation } = useListStore();

  const faction = list.factionCardId
    ? index.factionCards.get(list.factionCardId)
    : undefined;
  const creep = list.creepCardId
    ? index.creepCards.get(list.creepCardId)
    : undefined;

  const mustered = list.entries.filter((e) => !e.reference);
  const referenced = list.entries.filter((e) => e.reference);

  return (
    <div className="sheet">
      <header className="sheet__head">
        <div>
          <h1 className="sheet__title">{list.name}</h1>
          <p className="sheet__sub">
            {list.race} · {SCALE_LABEL[list.scaleId]} ·{' '}
            {summary.mineralsSpent}/{summary.mineralLimit} minerales ·{' '}
            {summary.vespeneSpent}/{summary.vespeneLimit} gas
            {summary.resourceType &&
              ` · ${summary.resourcePerRound} ${summary.resourceType}/ronda`}
            {' · '}suministro {summary.totalSupply}
          </p>
        </div>
        {!validation.legal && (
          <p className="sheet__illegal">LISTA NO VÁLIDA</p>
        )}
      </header>

      <section className="sheet__section">
        <h2>Cartas de mando</h2>
        <p className="sheet__cards">
          <strong>Facción:</strong> {faction?.name ?? '—'}
          {creep && (
            <>
              {' · '}
              <strong>Creep:</strong> {creep.name} ({creep.vespeneCost} gas)
            </>
          )}
        </p>
        {list.tacticalCardIds.length > 0 && (
          <p className="sheet__cards">
            <strong>Tácticas:</strong>{' '}
            {list.tacticalCardIds
              .map((id) => {
                const card = index.tacticalCards.get(id);
                return card ? `${card.name} (${card.vespeneCost})` : id;
              })
              .join(' · ')}
          </p>
        )}
      </section>

      <section className="sheet__section">
        <h2>Espacios de ejército</h2>
        <p className="sheet__cards">
          {SLOT_TYPES.filter((t) => summary.slots[t].total > 0)
            .map(
              (t) =>
                `${slotLabel(t)} ${summary.slots[t].used}/${summary.slots[t].total}`,
            )
            .join(' · ')}
        </p>
      </section>

      <section className="sheet__section">
        <h2>Unidades</h2>
        <table className="sheet__table">
          <thead>
            <tr>
              <th>Unidad</th>
              <th>Modelos</th>
              <th>Sum.</th>
              <th>Espacio</th>
              <th>Mejoras</th>
              <th className="sheet__num">Min.</th>
            </tr>
          </thead>
          <tbody>
            {mustered.map((listEntry) => {
              const unit = index.unitEntries.get(listEntry.unitEntryId);
              if (!unit) return null;
              const composition = findComposition(
                unit,
                listEntry.compositionId,
              );
              const upgradeCost = listEntry.upgrades.reduce((sum, applied) => {
                const upgrade = unit.upgrades.find(
                  (u) => u.id === applied.upgradeId,
                );
                return (
                  sum +
                  (upgrade
                    ? (upgradeCostFor(upgrade, listEntry.compositionId) ?? 0)
                    : 0)
                );
              }, 0);

              return (
                <tr key={listEntry.instanceId}>
                  <td>{unit.name}</td>
                  <td>{composition?.models ?? '—'}</td>
                  <td>{composition?.supplyValue ?? '—'}</td>
                  <td>{slotLabel(unit.slotType)}</td>
                  <td className="sheet__upgrades">
                    {listEntry.upgrades.length === 0
                      ? '—'
                      : listEntry.upgrades
                          .map((applied) => {
                            const upgrade = unit.upgrades.find(
                              (u) => u.id === applied.upgradeId,
                            );
                            if (!upgrade) return applied.upgradeId;
                            // La nominación del modelo se imprime: es lo que
                            // permite montar la miniatura correcta (§9.1.11).
                            return applied.modelIndex !== null
                              ? `${upgrade.name} (modelo #${applied.modelIndex + 1})`
                              : upgrade.name;
                          })
                          .join(', ')}
                  </td>
                  <td className="sheet__num">
                    {(composition?.mineralCost ?? 0) + upgradeCost}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}>Total</td>
              <td className="sheet__num">{summary.mineralsSpent}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {referenced.length > 0 && (
        <section className="sheet__section">
          <h2>Unidades invocadas (referencia — no cuentan)</h2>
          <p className="sheet__cards">
            {referenced
              .map(
                (e) => index.unitEntries.get(e.unitEntryId)?.name ?? e.unitEntryId,
              )
              .join(' · ')}
          </p>
        </section>
      )}

      <section className="sheet__section">
        <h2>Escenarios que llevo al draft</h2>
        <p className="sheet__cards">
          <strong>Misiones:</strong>{' '}
          {list.missionCardIds
            .map((id) => {
              const m = index.missionCards.get(id);
              return m ? `${m.name} (${SCALE_LABEL[m.scale]})` : id;
            })
            .join(' · ') || '—'}
        </p>
        <p className="sheet__cards">
          <strong>Despliegues:</strong>{' '}
          {list.deploymentCardIds
            .map((id) => index.deploymentCards.get(id)?.name ?? id)
            .join(' · ') || '—'}
        </p>
      </section>

      {list.notes && (
        <section className="sheet__section">
          <h2>Notas</h2>
          <p className="sheet__cards">{list.notes}</p>
        </section>
      )}
    </div>
  );
}
