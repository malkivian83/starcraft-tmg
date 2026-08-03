import { findComposition, upgradeCostFor } from '@/engine/costing';
import type { CatalogIndex } from '@/engine/catalogIndex';
import type { ArmyList, CostSummary, ValidationResult } from '@/engine/types';
import { SLOT_TYPES } from '@/engine/types';
import { useListStore } from '@/store/listStore';
import { slotLabel } from '../common/Chips';
import { StatBlock } from '../common/StatBlock';
import { upgradeDescription } from '../common/upgradeText';
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
export interface PrintSheetData {
  list: ArmyList;
  index: CatalogIndex;
  summary: CostSummary;
  validation: ValidationResult;
}

export function PrintSheet({ data }: { data?: PrintSheetData } = {}) {
  const store = useListStore();
  const list = data?.list ?? store.list;
  const index = data?.index ?? store.index;
  const summary = data?.summary ?? store.summary;
  const validation = data?.validation ?? store.validation;

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
          <img
            className="sheet__logo"
            src="/logo.png"
            alt="StarCraft: The Miniatures Game"
            width={521}
            height={149}
          />
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

      <UnitReference data={data} />
    </div>
  );
}

/**
 * Resumen de fichas de unidad: perfil, armas, habilidades y —sobre todo— qué
 * hacen las mejoras compradas.
 *
 * Es la parte que evita tener que llevar el PDF a la mesa: sin esto, la hoja
 * dice «Adrenal Glands» pero no qué hace, que es justo lo que se olvida en
 * mitad de una partida.
 */
function UnitReference({ data }: { data?: PrintSheetData }) {
  const store = useListStore();
  const list = data?.list ?? store.list;
  const index = data?.index ?? store.index;
  if (list.entries.length === 0) return null;

  // Una ficha por unidad DISTINTA: dos escuadras de Zerglings con el mismo
  // equipo no necesitan dos veces el mismo texto.
  const seen = new Set<string>();
  const blocks = list.entries
    .map((listEntry) => {
      const unit = index.unitEntries.get(listEntry.unitEntryId);
      if (!unit) return null;
      const upgradeIds = listEntry.upgrades
        .map((u) => u.upgradeId)
        .sort()
        .join(',');
      const key = `${unit.id}|${upgradeIds}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return { key, unit, listEntry };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  return (
    <section className="sheet__section sheet__reference">
      <h2>Fichas de unidad — perfiles, habilidades y mejoras</h2>
      {blocks.map(({ key, unit, listEntry }) => {
        const card = index.unitCards.get(unit.cardId);
        const applied = listEntry.upgrades
          .map((a) => ({
            applied: a,
            upgrade: unit.upgrades.find((u) => u.id === a.upgradeId),
          }))
          .filter((x): x is { applied: typeof x.applied; upgrade: NonNullable<typeof x.upgrade> } =>
            Boolean(x.upgrade),
          );

        return (
          <article key={key} className="unitref">
            <div className="unitref__head">
              {card?.miniRef && (
                <img
                  className="unitref__mini"
                  src={`/${card.miniRef}`}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div className="unitref__ident">
                <h3 className="unitref__name">{unit.name}</h3>
                {card && <StatBlock profile={card.profile} size="small" />}
              </div>
            </div>

            {card && card.weapons.length > 0 && (
              <table className="unitref__weapons">
                <thead>
                  <tr>
                    <th>Arma</th>
                    <th>Alc.</th>
                    <th>Obj.</th>
                    <th>RdA</th>
                    <th>Imp.</th>
                    <th>Dañ.</th>
                    <th>Palabras clave</th>
                  </tr>
                </thead>
                <tbody>
                  {card.weapons.map((weapon) => (
                    <tr key={weapon.name}>
                      <td>{weapon.name}</td>
                      <td>{weapon.range}</td>
                      <td>{weapon.target}</td>
                      <td>{weapon.rateOfAttack}</td>
                      <td>{weapon.hit}</td>
                      <td>{weapon.damage}</td>
                      <td>{weapon.keywords.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {card && groupAbilitiesByPhase(card.abilities).map(([phase, abilities]) => (
              <section key={phase} className="unitref__phase-group">
                <span className={`unitref__phase-title phase-tag phase-tag--${phase}`}>{phaseLabel(phase)}</span>
                {abilities.map((ability) => (
                  <p key={ability.name} className="unitref__ability">
                    <strong>{ability.name}</strong>
                    <span className="unitref__tag">
                      {ability.type}
                      {ability.cost ? ` ${ability.cost} ${resourceLabel(card.race)}` : ''}
                    </span>{' '}
                    {ability.text.es}
                  </p>
                ))}
              </section>
            ))}

            {applied.length > 0 && (
              <div className="unitref__upgrades">
                <span className="unitref__upgrades-title">Mejoras compradas</span>
                {applied.map(({ applied: a, upgrade }) => (
                  <p key={upgrade.id} className="unitref__ability">
                    <strong>{upgrade.name}</strong>
                    <span className="unitref__tag">+{upgradeCostFor(upgrade, listEntry.compositionId) ?? 0} min.</span>
                    <span className={`unitref__tag phase-tag phase-tag--${upgrade.grantsAbilities[0]?.phase ?? upgrade.grantsWeapons[0]?.phase ?? 'ANY'}`}>{phaseLabel(upgrade.grantsAbilities[0]?.phase ?? upgrade.grantsWeapons[0]?.phase ?? 'ANY')}</span>
                    {upgrade.grantsAbilities.map((ability) => (
                      <span key={ability.name} className="unitref__tag">
                        {ability.type}{ability.cost ? ` ${ability.cost} ${resourceLabel(card?.race ?? unit.race)}` : ''}
                      </span>
                    ))}
                    {upgrade.specialist && (
                      <span className="unitref__tag">
                        SPECIALIST
                        {a.modelIndex !== null && ` · modelo #${a.modelIndex + 1}`}
                      </span>
                    )}
                    {upgrade.replacesWeapon && (
                      <span className="unitref__tag">
                        sustituye {upgrade.replacesWeapon}
                      </span>
                    )}{' '}
                    {upgradeDescription(upgrade)}
                  </p>
                ))}
                {applied.some((x) => x.upgrade.grantsWeapons.length > 0) && (
                  <table className="unitref__weapons">
                    <thead>
                      <tr>
                        <th>Arma de mejora</th>
                        <th>Alc.</th>
                        <th>Obj.</th>
                        <th>RdA</th>
                        <th>Imp.</th>
                        <th>Dañ.</th>
                        <th>Palabras clave</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applied.flatMap(({ upgrade }) =>
                        upgrade.grantsWeapons.map((weapon) => (
                          <tr key={`${upgrade.id}-${weapon.name}`}>
                            <td>{weapon.name}</td>
                            <td>{weapon.range}</td>
                            <td>{weapon.target}</td>
                            <td>{weapon.rateOfAttack}</td>
                            <td>{weapon.hit}</td>
                            <td>{weapon.damage}</td>
                            <td>{weapon.keywords.join(', ') || '—'}</td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

function phaseLabel(phase: 'MOVEMENT' | 'ASSAULT' | 'COMBAT' | 'ANY') {
  return ({ MOVEMENT: 'Movimiento', ASSAULT: 'Asalto', COMBAT: 'Combate', ANY: 'Cualquier fase' })[phase];
}

function resourceLabel(race: 'ZERG' | 'TERRAN' | 'PROTOSS') {
  return ({ ZERG: 'BM', TERRAN: 'CP', PROTOSS: 'PE' })[race];
}

function groupAbilitiesByPhase<T extends { phase: 'MOVEMENT' | 'ASSAULT' | 'COMBAT' | 'ANY' }>(abilities: T[]) {
  const order = ['MOVEMENT', 'ASSAULT', 'COMBAT', 'ANY'] as const;
  return order
    .map((phase) => [phase, abilities.filter((ability) => ability.phase === phase)] as const)
    .filter(([, grouped]) => grouped.length > 0);
}
