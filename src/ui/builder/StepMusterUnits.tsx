import { useState } from 'react';
import { findComposition, upgradeCostFor } from '@/engine/costing';
import { getEligibleUnits } from '@/engine/eligibility';
import type { ListEntry, UnitEntry } from '@/engine/types';
import { useListStore } from '@/store/listStore';
import { slotLabel, UniqueChip } from '../common/Chips';
import { models } from '../common/plural';
import { upgradeDescription } from '../common/upgradeText';

/**
 * Paso 2 — Reclutamiento.
 *
 * Filtrado de dos niveles (SDD §6.6): lo imposible se oculta, lo bloqueado
 * por recursos se muestra atenuado con el motivo. Ocultar lo segundo dejaría
 * al usuario sin saber que la unidad existe.
 */
export function StepMusterUnits() {
  const { list, index, summary } = useListStore();
  const addUnit = useListStore((s) => s.addUnit);
  const addReferenceUnit = useListStore((s) => s.addReferenceUnit);

  if (!list.factionCardId) {
    return (
      <div className="panel">
        <p className="empty">
          Primero elige una Carta de Facción en el paso 1: es la que determina
          qué unidades puedes reclutar y cuántos espacios tienes.
        </p>
      </div>
    );
  }

  const eligible = getEligibleUnits(list, index, summary).filter(
    // Nivel 1: nunca podrá formar parte de este ejército → se oculta.
    (u) => u.status !== 'impossible',
  );
  const recruitable = eligible.filter((u) => !u.entry.summoned);
  const summoned = eligible.filter((u) => u.entry.summoned);

  return (
    <div className="split">
      <div className="stack">
        <section className="panel">
          <h2 className="panel__title">Catálogo de unidades</h2>
          <div className="stack">
            {recruitable.map(({ entry, status, reason, remedy, compositions }) => (
              <div
                key={entry.id}
                className={`card${status === 'blocked' ? ' card--blocked' : ''}`}
              >
                <div className="card__head">
                  <span className="card__name">
                    {entry.name} <UniqueChip unique={entry.unique} />
                  </span>
                  <span className="chip chip--slot">
                    {slotLabel(entry.slotType)}
                  </span>
                </div>

                <div className="row" style={{ gap: 6 }}>
                  {compositions.map(({ composition, status: cs, reason: cr }) => (
                    <button
                      key={composition.id}
                      className="comp"
                      disabled={cs !== 'available'}
                      title={cr?.es}
                      aria-label={`Añadir ${entry.name} con ${models(composition.models)} por ${composition.mineralCost} minerales`}
                      onClick={() => addUnit(entry.id, composition.id)}
                    >
                      <span className="comp__models">
                        {models(composition.models)}
                      </span>
                      <span className="comp__supply">
                        suministro {composition.supplyValue}
                      </span>
                      <span className="comp__cost">
                        {composition.mineralCost} min.
                      </span>
                    </button>
                  ))}
                </div>

                {status === 'blocked' && reason && (
                  <>
                    <span className="card__reason">{reason.es}</span>
                    {remedy && <span className="card__remedy">{remedy.es}</span>}
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        {summoned.length > 0 && (
          <section className="panel">
            <h2 className="panel__title">
              Unidades invocadas — referencia, sin coste
            </h2>
            <p className="small muted" style={{ marginTop: 0 }}>
              No se reclutan ni ocupan espacios (§9.1.9). Añádelas para tener
              sus características a mano en la lista impresa.
            </p>
            <div className="stack">
              {summoned.map(({ entry }) => (
                <div key={entry.id} className="card">
                  <div className="card__head">
                    <span className="card__name">{entry.name}</span>
                    <span className="chip">Invocada</span>
                  </div>
                  <div>
                    <button onClick={() => addReferenceUnit(entry.id)}>
                      Añadir como referencia
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <Roster />
    </div>
  );
}

function Roster() {
  const { list } = useListStore();

  if (list.entries.length === 0) {
    return (
      <section className="panel">
        <p className="empty">
          Aún no has reclutado ninguna unidad. Elige una composición del
          catálogo para añadirla.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2 className="panel__title">Tu ejército ({list.entries.length})</h2>
      <div className="stack">
        {list.entries.map((entry) => (
          <RosterEntry key={entry.instanceId} listEntry={entry} />
        ))}
      </div>
    </section>
  );
}

function RosterEntry({ listEntry }: { listEntry: ListEntry }) {
  const { index, validation } = useListStore();
  const removeUnit = useListStore((s) => s.removeUnit);
  const changeComposition = useListStore((s) => s.changeComposition);

  const unit = index.unitEntries.get(listEntry.unitEntryId);
  if (!unit) return null;

  const composition = findComposition(unit, listEntry.compositionId);
  const card = index.unitCards.get(unit.cardId);
  const issues = validation.errors.filter(
    (e) => e.entryInstanceId === listEntry.instanceId,
  );

  return (
    <article
      className="panel"
      style={{
        background: 'var(--bg-raised)',
        borderLeft: `3px solid ${issues.length ? 'var(--error)' : 'var(--accent)'}`,
      }}
    >
      <div className="card__head">
        <h3>
          {unit.name}{' '}
          {listEntry.reference && <span className="chip">Referencia</span>}
        </h3>
        <div className="row small muted">
          {card && (
            <>
              <span>PG {card.profile.hitPoints}</span>
              <span>Vel. {card.profile.speed}</span>
              <span>Eva. {card.profile.evade}</span>
              <span>Arm. {card.profile.armour}</span>
            </>
          )}
          <button
            onClick={() => removeUnit(listEntry.instanceId)}
            aria-label={`Quitar ${unit.name}`}
            title="Quitar de la lista"
          >
            ✕
          </button>
        </div>
      </div>

      {!listEntry.reference && (
        <div className="row small" style={{ margin: '6px 0' }}>
          <span className="muted">Composición:</span>
          {unit.compositions.map((c) => (
            <button
              key={c.id}
              className={c.id === listEntry.compositionId ? 'chip chip--slot' : 'chip'}
              style={{ cursor: 'pointer' }}
              aria-pressed={c.id === listEntry.compositionId}
              aria-label={`Cambiar a ${models(c.models)} por ${c.mineralCost} minerales`}
              onClick={() => changeComposition(listEntry.instanceId, c.id)}
            >
              {models(c.models)} · {c.mineralCost}
            </button>
          ))}
          <span className="chip chip--slot">
            {composition?.supplyValue ?? 0}× {slotLabel(unit.slotType)}
          </span>
        </div>
      )}

      {!listEntry.reference && composition && (
        <Upgrades unit={unit} listEntry={listEntry} models={composition.models} />
      )}

      {issues.map((issue, i) => (
        <div key={i} className="issue issue--error" style={{ marginTop: 6 }}>
          {issue.message.es}
          {issue.remedy && (
            <div className="issue__remedy">{issue.remedy.es}</div>
          )}
        </div>
      ))}
    </article>
  );
}

/**
 * Mejoras. Las SPECIALIST exigen nominar el modelo que las porta (§9.1.7):
 * sin esa nominación no se puede representar ni imprimir la unidad con
 * precisión, y la lista no es legal.
 */
function Upgrades({
  unit,
  listEntry,
  models,
}: {
  unit: UnitEntry;
  listEntry: ListEntry;
  models: number;
}) {
  const toggleUpgrade = useListStore((s) => s.toggleUpgrade);
  const setUpgradeModel = useListStore((s) => s.setUpgradeModel);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const available = unit.upgrades.filter(
    (u) => upgradeCostFor(u, listEntry.compositionId) !== undefined,
  );
  if (available.length === 0) return null;

  return (
    <div style={{ marginTop: 6 }}>
      <div className="panel__title" style={{ marginBottom: 6 }}>
        Mejoras
      </div>
      <div className="stack" style={{ gap: 4 }}>
        {available.map((upgrade) => {
          const applied = listEntry.upgrades.find(
            (a) => a.upgradeId === upgrade.id,
          );
          const cost = upgradeCostFor(upgrade, listEntry.compositionId) ?? 0;
          const detailId = `${listEntry.instanceId}-${upgrade.id}-detalle`;
          const open = expanded.has(upgrade.id);

          return (
            <div key={upgrade.id}>
              <div className="row" style={{ gap: 6 }}>
                {/*
                 * El «+» abre la explicación sin tener que comprar la mejora:
                 * decidir si te interesa exige saber qué hace antes de pagarla.
                 */}
                <button
                  className="upg__toggle"
                  aria-expanded={open}
                  aria-controls={detailId}
                  aria-label={`${open ? 'Ocultar' : 'Ver'} qué hace ${upgrade.name}`}
                  onClick={() => toggle(upgrade.id)}
                >
                  {open ? '−' : '+'}
                </button>

                <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(applied)}
                    onChange={() =>
                      toggleUpgrade(listEntry.instanceId, upgrade.id)
                    }
                  />
                  <span>{upgrade.name}</span>
                  <span className="chip chip--cost">+{cost}</span>
                  {upgrade.specialist && (
                    <span className="chip chip--unique">SPECIALIST</span>
                  )}
                  {upgrade.replacesWeapon && (
                    <span className="chip small">
                      sustituye {upgrade.replacesWeapon}
                    </span>
                  )}
                </label>

                {applied && upgrade.specialist && (
                  <label className="row small muted" style={{ gap: 4 }}>
                    Modelo
                    <select
                      value={applied.modelIndex ?? 0}
                      onChange={(e) =>
                        setUpgradeModel(
                          listEntry.instanceId,
                          upgrade.id,
                          Number(e.target.value),
                        )
                      }
                    >
                      {Array.from({ length: models }, (_, i) => (
                        <option key={i} value={i}>
                          #{i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {open && (
                <div id={detailId} className="upg__detail">
                  <p style={{ margin: 0 }}>{upgradeDescription(upgrade)}</p>
                  {upgrade.grantsWeapons.map((weapon) => (
                    <p key={weapon.name} className="upg__weapon">
                      <strong>{weapon.name}</strong> · Alc. {weapon.range} ·{' '}
                      {weapon.target} · RdA {weapon.rateOfAttack} · Imp.{' '}
                      {weapon.hit} · Daño {weapon.damage}
                      {weapon.keywords.length > 0 && ` · ${weapon.keywords.join(', ')}`}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
