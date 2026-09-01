import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findComposition, upgradeCostFor } from '@/engine/costing';
import { getEligibleUnits, isUnitAddable } from '@/engine/eligibility';
import type { ListEntry, UnitCard, UnitEntry } from '@/engine/types';
import { useListStore } from '@/store/listStore';
import { CombatTagChips, slotLabel, UniqueChip } from '../common/Chips';
import { models } from '../common/plural';
import { StatBlock } from '../common/StatBlock';
import { SupplyBands } from '../common/SupplyBands';
import { groupAbilitiesByPhase, groupUnitProfileByPhase, groupUpgradesByPhase } from '../common/abilityPhases';
import { KeywordText } from '../common/KeywordText';
import { CardImageModal, CardPreviewButton } from '../common/CardImagePreview';
import { upgradeDescription } from '../common/upgradeText';
import { localizedText } from '@/i18n/localized-content';
import { normalizeLocale, type SupportedLocale } from '@/i18n/types';
import './unitcard.css';

/**
 * Paso 2 — Reclutamiento.
 *
 * Las unidades incompatibles o sin recursos permanecen en el catálogo. La
 * falta de espacios es provisional: permite incorporar la composición y deja
 * que la validación final muestre R4 hasta añadir las tácticas adecuadas.
 */
export function StepMusterUnits() {
  const { i18n } = useTranslation();
  const { t } = useTranslation('builderUi');
  const locale = normalizeLocale(i18n.language) ?? 'es';
  const summonedLabel = locale === 'en' ? 'Summoned' : 'Invocadas';
  const { list, index, summary } = useListStore();
  const addUnit = useListStore((s) => s.addUnit);
  const addReferenceUnit = useListStore((s) => s.addReferenceUnit);
  const [previewCard, setPreviewCard] = useState<UnitCard | null>(null);

  const faction = list.factionCardId
    ? index.factionCards.get(list.factionCardId)
    : undefined;

  if (!faction || faction.race !== list.race) {
    return (
      <div className="panel">
        <p className="empty">
          {t('chooseFactionHint')}
        </p>
      </div>
    );
  }

  const eligible = getEligibleUnits(list, index, summary);
  const recruitable = eligible.filter((u) => !u.entry.summoned);
  const summoned = eligible.filter((u) => u.entry.summoned);

  return (
    <div className="split">
      <div className="stack">
        <section className="panel">
          <h2 className="panel__title">{t('catalog')}</h2>
          <div className="stack">
            {recruitable.map(({ entry, status, compositions }) => {
              const card = index.unitCards.get(entry.cardId);
              return (
              <div
                key={entry.id}
                className={`card unit-card--${status}`}
              >
                <div className="card__head">
                  <span className="card__name">
                    <span className="card__name-with-preview">
                      {entry.name} <UniqueChip unique={entry.unique} />
                      {card?.imageRefFront && card.imageRefBack && (
                        <CardPreviewButton
                          cardName={card.name}
                          onOpen={() => setPreviewCard(card)}
                        />
                      )}
                    </span>
                  </span>
                  <span className="chip chip--slot">
                    {slotLabel(entry.slotType, locale)}
                  </span>
                </div>

                <div className="row" style={{ gap: 6 }}>
                  {compositions.map(({ composition, status: cs, reason: cr, remedy: cm }) => {
                    const detailId = `unit-${entry.id}-${composition.id}-eligibility`;
                    const addable = isUnitAddable(cs);
                    const detailText = [cr, cm]
                      .filter((text): text is NonNullable<typeof text> => Boolean(text))
                      .map((text) => localizedText(text, locale))
                      .join(' ');
                    return (
                      <div key={composition.id} className={`comp-wrap comp-wrap--${cs}`}>
                        <button
                          className="comp"
                          disabled={!addable}
                          title={cr ? localizedText(cr, locale) : undefined}
                          aria-describedby={detailText ? detailId : undefined}
                          aria-label={t('addUnitAria', { name: entry.name, models: models(composition.models), cost: composition.mineralCost })}
                          onClick={() => { if (addable) addUnit(entry.id, composition.id); }}
                        >
                          <span className="comp__models">{models(composition.models)}</span>
                          <span className="comp__supply">{t('supply')} {composition.supplyValue}</span>
                          <span className="comp__cost">{composition.mineralCost} min.</span>
                        </button>
                        {detailText && <span id={detailId} className="sr-only">{detailText}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        </section>

        {summoned.length > 0 && (
          <section className="panel">
            <h2 className="panel__title">
              {summonedLabel}
            </h2>
            <p className="small muted" style={{ marginTop: 0 }}>
              {t('noRecruit')}
            </p>
            <div className="stack">
              {summoned.map(({ entry, status, reason, remedy }) => {
                const addable = isUnitAddable(status);
                const detailId = `summoned-${entry.id}-eligibility`;
                const detailText = [reason, remedy]
                  .filter((text): text is NonNullable<typeof text> => Boolean(text))
                  .map((text) => localizedText(text, locale))
                  .join(' ');
                const card = index.unitCards.get(entry.cardId);
                return <div key={entry.id} className={`card unit-card--${status}`}>
                  <div className="card__head">
                    <span className="card__name">
                      <span className="card__name-with-preview">
                        {entry.name}
                        {card?.imageRefFront && card.imageRefBack && (
                          <CardPreviewButton
                            cardName={card.name}
                            onOpen={() => setPreviewCard(card)}
                          />
                        )}
                      </span>
                    </span>
                    <span className="chip">{summonedLabel}</span>
                  </div>
                  <div>
                    <button
                      disabled={!addable}
                      title={reason ? localizedText(reason, locale) : undefined}
                      aria-describedby={detailText ? detailId : undefined}
                      onClick={() => { if (addable) addReferenceUnit(entry.id); }}
                    >
                      {t('addReference')}
                    </button>
                    {detailText && <span id={detailId} className="sr-only">{detailText}</span>}
                  </div>
                </div>;
              })}
            </div>
          </section>
        )}
      </div>

      <Roster />
      {previewCard?.imageRefFront && previewCard.imageRefBack && (
        <CardImageModal
          title={previewCard.name}
          images={[
            {
              src: previewCard.imageRefFront,
              alt: t('cardFront', { name: previewCard.name }),
            },
            {
              src: previewCard.imageRefBack,
              alt: t('cardBack', { name: previewCard.name }),
            },
          ]}
          onClose={() => setPreviewCard(null)}
        />
      )}
    </div>
  );
}

function Roster() {
  const { t } = useTranslation('builderUi');
  const { list } = useListStore();

  if (list.entries.length === 0) {
    return (
      <section className="panel">
        <p className="empty">
          {t('noUnits')}
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2 className="panel__title">{t('yourArmy', { count: list.entries.length })}</h2>
      <p className="small muted roster__hint">
        {t('reorderHint')}
      </p>
      <div className="stack">
        {list.entries.map((entry, position) => (
          <RosterEntry
            key={entry.instanceId}
            listEntry={entry}
            position={position}
            total={list.entries.length}
          />
        ))}
      </div>
    </section>
  );
}

function RosterEntry({
  listEntry,
  position,
  total,
}: {
  listEntry: ListEntry;
  position: number;
  total: number;
}) {
  const { i18n } = useTranslation();
  const { t } = useTranslation('builderUi');
  const locale = normalizeLocale(i18n.language) ?? 'es';
  const { index, validation } = useListStore();
  const removeUnit = useListStore((s) => s.removeUnit);
  const moveUnit = useListStore((s) => s.moveUnit);
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
      className="unitcard"
      style={{
        borderLeftColor: issues.length ? 'var(--error)' : 'var(--accent)',
      }}
    >
      <div className="unitcard__top">
        {card?.miniRef && (
          <img
            className="unitcard__mini"
            src={`/${card.miniRef}`}
            alt={locale === 'en' ? `Thumbnail of ${unit.name}` : `Miniatura de ${unit.name}`}
            /*
             * Sin carga diferida a propósito: son pocas y pequeñas, y al
             * imprimir hay que garantizar que ya están descargadas. Una
             * imagen diferida puede no llegar a tiempo y salir en blanco
             * en el PDF.
             */
            decoding="async"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}

        <div className="unitcard__main">
          <div className="card__head">
            <h3>
              {unit.name}{' '}
              {listEntry.reference && <span className="chip">{t('addReference')}</span>}
            </h3>
            <div className="unitcard__actions">
              <button
                className="card-action"
                onClick={() => moveUnit(listEntry.instanceId, 'up')}
                disabled={position === 0}
                aria-label={`${t('moveUp', { defaultValue: locale === 'en' ? 'Move up' : 'Subir' })} ${unit.name}`}
                title={t('moveUp', { defaultValue: locale === 'en' ? 'Move up' : 'Subir' })}
              >
                ↑
              </button>
              <button
                className="card-action"
                onClick={() => moveUnit(listEntry.instanceId, 'down')}
                disabled={position === total - 1}
                aria-label={`${t('moveDown', { defaultValue: locale === 'en' ? 'Move down' : 'Bajar' })} ${unit.name}`}
                title={t('moveDown', { defaultValue: locale === 'en' ? 'Move down' : 'Bajar' })}
              >
                ↓
              </button>
              <button
                className="card-action card-action--remove"
                onClick={() => removeUnit(listEntry.instanceId)}
                aria-label={`${t('remove')} ${unit.name}`}
                title={t('remove')}
              >
                ×
              </button>
            </div>
          </div>

          {card && (
            <div className="unitcard__stats">
              <StatBlock profile={card.profile} />
              <SupplyBands
                bands={card.supplyProfile}
                selectedModels={composition?.models}
              />
            </div>
          )}

          {card && (
            <div className="unitcard__combat-tags">
              <CombatTagChips tags={card.combatTags} />
            </div>
          )}

          {!listEntry.reference && (
            <div className="row small" style={{ marginTop: 8 }}>
              <span className="muted">{t('composition')}</span>
              {unit.compositions.map((c) => (
                <button
                  key={c.id}
                  className={
                    c.id === listEntry.compositionId ? 'chip chip--slot' : 'chip'
                  }
                  style={{ cursor: 'pointer' }}
                  aria-pressed={c.id === listEntry.compositionId}
                  aria-label={t('changeComposition', { defaultValue: locale === 'en' ? 'Change to {{models}} for {{cost}} minerals' : 'Cambiar a {{models}} por {{cost}} minerales', models: models(c.models), cost: c.mineralCost })}
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
        </div>
      </div>

      {/*
        Las habilidades van ANTES que las mejoras: son lo que la unidad hace de
        serie, y las mejoras se eligen sabiendo con qué se combinan.
      */}
      {card && card.weapons.length + card.abilities.length > 0 && (
        <UnitProfileDetails card={card} />
      )}

      {!listEntry.reference && composition && (
        <Upgrades unit={unit} listEntry={listEntry} models={composition.models} />
      )}

      {issues.map((issue, i) => (
        <div key={i} className="issue issue--error" style={{ marginTop: 6 }}>
          {localizedText(issue.message, locale)}
          {issue.remedy && (
            <div className="issue__remedy">{localizedText(issue.remedy, locale)}</div>
          )}
        </div>
      ))}
    </article>
  );
}

/** Armas y habilidades de serie de la unidad, antes de las mejoras. */
function UnitProfileDetails({ card }: { card: UnitCard }) {
  const { i18n } = useTranslation();
  const { t } = useTranslation('builderUi');
  const locale = normalizeLocale(i18n.language) ?? 'es';
  return (
    <div className="unitcard__profile">
      {groupUnitProfileByPhase(card.weapons, card.abilities).map(({ phase, weapons, abilities }) => (
        <section key={phase} className="ability-group">
          <div className={`ability-group__title phase-tag phase-tag--${phase}`}>
            {phaseLabel(phase, t)}
          </div>
          <WeaponTable weapons={weapons} t={t} locale={locale} />
          {abilities.map((ability) => {
            const resource = ability.resource ?? resourceLabel(card.race);
            return (
            <p key={ability.name} className="ability">
              <strong className="ability__name">{ability.name}</strong>
              <span className={`ability__tag ability__type ability__type--${ability.type.toLowerCase()}`}>
                {ability.type}
              </span>
              {ability.cost !== null && (
                <span className={`ability__tag ability__resource-cost ability__resource-cost--${resource}`}>
                  {ability.cost} {resource}
                </span>
              )}{' '}
              <KeywordText text={localizedText(ability.text, locale)} locale={locale} />
            </p>
            );
          })}
        </section>
      ))}

      {false && card.weapons.length > 0 && (
        <table className="wtable">
          <thead>
            <tr>
              <th>{t('weapons')}</th>
              <th>{t('range')}</th>
              <th>{t('target')}</th>
              <th>RoA</th>
              <th>{t('hit')}</th>
              <th>{t('surge')}</th>
              <th>{t('damage')}</th>
            </tr>
          </thead>
          <tbody>
            {card.weapons.map((weapon) => (
              <tr key={weapon.name}>
                <td className="wtable__name">
                  {weapon.name}
                  {weapon.keywords.length > 0 && (
                    <span className="wtable__kw">
                      {weapon.keywords.join(', ')}
                    </span>
                  )}
                </td>
                <td>{weapon.range}</td>
                <td>{weapon.target}</td>
                <td>{weapon.rateOfAttack}</td>
                <td>{weapon.hit}</td>
                <td>
                  {weapon.surgeType
                    ? `${weapon.surgeType} ${weapon.surgeDice ?? ''}`.trim()
                    : '—'}
                </td>
                <td>{weapon.damage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {false && groupAbilitiesByPhase(card.abilities).map(([phase, abilities]) => (
        <section key={phase} className="ability-group">
          <div className={`ability-group__title phase-tag phase-tag--${phase}`}>
            {phaseLabel(phase, t)}
          </div>
          {abilities.map((ability) => (
            <p key={ability.name} className="ability">
              <strong className="ability__name">{ability.name}</strong>
              <span className="ability__tag">
                {ability.type}
                {ability.cost ? ` ${ability.cost} ${resourceLabel(card.race)}` : ''}
              </span>{' '}
              {localizedText(ability.text, locale)}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

function WeaponTable({
  weapons,
  t,
  locale,
}: {
  weapons: UnitCard['weapons'];
  t: (key: string) => string;
  locale: SupportedLocale;
}) {
  if (weapons.length === 0) return null;

  return (
    <div className="wtable-scroll">
      <table className="wtable">
        <thead>
          <tr>
            <th>{t('weapons')}</th>
            <th>{t('range')}</th>
            <th>{t('target')}</th>
            <th>RoA</th>
            <th>{t('hit')}</th>
            <th>{t('surge')}</th>
            <th>{t('damage')}</th>
          </tr>
        </thead>
        <tbody>
          {weapons.map((weapon) => (
            <tr key={weapon.name}>
              <td className="wtable__name">
                {weapon.name}
                {weapon.keywords.length > 0 && (
                  <span className="wtable__kw">
                    {weapon.keywords.map((keyword, index) => (
                      <span key={`${keyword}-${index}`}>
                        {index > 0 ? ', ' : ''}
                        <KeywordText text={keyword} locale={locale} />
                      </span>
                    ))}
                  </span>
                )}
              </td>
              <td>{weapon.range}</td>
              <td>{weapon.target}</td>
              <td>{weapon.rateOfAttack}</td>
              <td>{weapon.hit}</td>
            <td>{weapon.surgeType ? `${weapon.surgeType} ${weapon.surgeDice ?? ''}`.trim() : '—'}</td>
              <td>{weapon.damage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
  const { i18n } = useTranslation();
  const { t } = useTranslation('builderUi');
  const locale = normalizeLocale(i18n.language) ?? 'es';
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
        {t('upgrades')}
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {groupUpgradesByPhase(available).map(({ phase, upgrades }) => (
          <section className="upg__phase-group" key={phase}>
            <div className={`upg__phase-title phase-tag phase-tag--${phase}`}>
              {phaseLabel(phase, t)}
            </div>
            <div className="stack" style={{ gap: 4 }}>
              {upgrades.map((upgrade) => {
          const applied = listEntry.upgrades.find(
            (a) => a.upgradeId === upgrade.id,
          );
          const cost = upgradeCostFor(upgrade, listEntry.compositionId) ?? 0;
          const detailId = `${listEntry.instanceId}-${upgrade.id}-detalle`;
          const open = expanded.has(upgrade.id);
          const upgradeTypes = Array.from(new Set(upgrade.grantsAbilities.map((ability) => ability.type)));
          const upgradeAbilityCosts = Array.from(new Map(
            upgrade.grantsAbilities
              .filter((ability) => ability.cost !== null)
              .map((ability) => {
                const resource = ability.resource ?? resourceLabel(unit.race);
                return [`${ability.cost}|${resource}`, { cost: ability.cost, resource }] as const;
              }),
          ).values());

                return (
                  <div key={upgrade.id}>
              <div className="row upg__row" style={{ gap: 6 }}>
                {/*
                 * El «+» abre la explicación sin tener que comprar la mejora:
                 * decidir si te interesa exige saber qué hace antes de pagarla.
                 */}
                <button
                  className="upg__toggle"
                  aria-expanded={open}
                  aria-controls={detailId}
                  aria-label={`${open ? t('hide') : t('show')} ${t('ability')} ${upgrade.name}`}
                  onClick={() => toggle(upgrade.id)}
                >
                  {open ? '−' : '+'}
                </button>

                <label className="row upg__choice" style={{ gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(applied)}
                    onChange={() =>
                      toggleUpgrade(listEntry.instanceId, upgrade.id)
                    }
                  />
                  <span className="upg__name">{upgrade.name}</span>
                  <span className="chip chip--cost">+{cost} min.</span>
                  {upgradeTypes.map((type) => (
                    <span key={type} className={`chip small ability__type ability__type--${type.toLowerCase()}`}>
                      {type}
                    </span>
                  ))}
                  {upgradeAbilityCosts.map(({ cost: abilityCost, resource }) => (
                    <span key={`ability-cost-${abilityCost}-${resource}`} className={`chip small ability__resource-cost ability__resource-cost--${resource}`}>
                      {abilityCost} {resource}
                    </span>
                  ))}
                  {upgrade.specialist && (
                    <span className="chip chip--unique">SPECIALIST</span>
                  )}
                  {upgrade.replacesWeapon && (
                    <span className="chip small">
                      {t('replaceWeapon', { defaultValue: locale === 'en' ? 'replaces' : 'sustituye' })} {upgrade.replacesWeapon}
                    </span>
                  )}
                </label>

                {applied && upgrade.specialist && (
                  <label className="row small muted upg__model" style={{ gap: 4 }}>
                    {t('model', { defaultValue: locale === 'en' ? 'Model' : 'Miniatura' })}
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
                  <p style={{ margin: 0 }}>
                    <KeywordText text={upgradeDescription(upgrade, locale)} locale={locale} />
                  </p>
                  {upgrade.grantsWeapons.length > 0 && (
                    <div className="wtable-scroll">
                      <table className="wtable wtable--upgrade">
                        <thead>
                          <tr>
                            <th>{t('weapons')}</th><th>{t('range')}</th><th>{t('target')}</th><th>RoA</th>
                            <th>{t('hit')}</th><th>{t('surge')}</th><th>{t('damage')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {upgrade.grantsWeapons.map((weapon) => (
                            <tr key={weapon.name}>
                              <td className="wtable__name">
                                {weapon.name}
                                {weapon.keywords.length > 0 && (
                                  <span className="wtable__kw">
                                    {weapon.keywords.map((keyword, index) => (
                                      <span key={`${keyword}-${index}`}>
                                        {index > 0 ? ', ' : ''}
                                        <KeywordText text={keyword} locale={locale} />
                                      </span>
                                    ))}
                                  </span>
                                )}
                              </td>
                              <td>{weapon.range}</td><td>{weapon.target}</td><td>{weapon.rateOfAttack}</td>
                              <td>{weapon.hit}</td>
                            <td>{weapon.surgeType ? `${weapon.surgeType} ${weapon.surgeDice ?? ''}`.trim() : '—'}</td>
                              <td>{weapon.damage}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {upgrade.grantsAbilities.map((ability) => (
                    <p key={ability.name} className="upg__weapon">
                      <strong>{ability.name}</strong> · {phaseLabel(ability.phase, t)} · {ability.type}
                      {ability.cost !== null && (
                        <span className={`ability__tag ability__resource-cost ability__resource-cost--${ability.resource ?? resourceLabel(unit.race)}`}>
                          {ability.cost} {ability.resource ?? resourceLabel(unit.race)}
                        </span>
                      )}
                    </p>
                  ))}
                </div>
              )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function phaseLabel(phase: 'MOVEMENT' | 'ASSAULT' | 'COMBAT' | 'ANY', t: (key: string) => string) {
  return ({ MOVEMENT: t('phaseMovement'), ASSAULT: t('phaseAssault'), COMBAT: t('phaseCombat'), ANY: t('phaseAny') })[phase].toUpperCase();
}

function resourceLabel(race: 'ZERG' | 'TERRAN' | 'PROTOSS') {
  return ({ ZERG: 'BM', TERRAN: 'CP', PROTOSS: 'PE' })[race];
}
