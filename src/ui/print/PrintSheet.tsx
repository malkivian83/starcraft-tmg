import { findComposition, upgradeCostFor } from '@/engine/costing';
import type { CatalogIndex } from '@/engine/catalogIndex';
import type { ArmyList, CostSummary, ValidationResult } from '@/engine/types';
import { SLOT_TYPES } from '@/engine/types';
import { useListStore } from '@/store/listStore';
import { slotLabel } from '../common/Chips';
import { StatBlock } from '../common/StatBlock';
import { SupplyBands } from '../common/SupplyBands';
import { groupAbilitiesByPhase, groupPurchasedUpgrades, groupUnitProfileByPhase } from '../common/abilityPhases';
import { collectKeywordGlossary, type KeywordGlossaryEntry } from '../common/keywordGlossary';
import { upgradeDescription } from '../common/upgradeText';
import { localizedText } from '@/i18n/localized-content';
import { useTranslation } from 'react-i18next';
import { normalizeLocale } from '@/i18n/types';
import './print.css';

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
  const { t } = useTranslation('print');
  const { i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language) ?? 'es';
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
  const keywordGlossary = collectKeywordGlossary(listKeywordTexts(list, index, locale))
    .sort((a, b) => a.label.localeCompare(b.label, locale));

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
            {list.race} · {scaleLabel(list.scaleId, t)} ·{' '}
            {summary.mineralsSpent}/{summary.mineralLimit} {t('minerals')} ·{' '}
            {summary.vespeneSpent}/{summary.vespeneLimit} {t('gas')}
            {summary.resourceType &&
              ` · ${summary.resourcePerRound} ${summary.resourceType}/${t('perRound')}`}
            {' · '}{t('supply')} {summary.totalSupply}
          </p>
        </div>
        {!validation.legal && (
          <p className="sheet__illegal">{t('invalid')}</p>
        )}
      </header>

      <section className="sheet__section">
        <h2>{t('commandCards')}</h2>
        <p className="sheet__cards">
          <strong>{t('faction')}:</strong> {faction?.name ?? t('noValue')}
          {creep && (
            <>
              {' · '}
              <strong>{t('creep')}:</strong> {creep.name} ({creep.vespeneCost} {t('gas')})
            </>
          )}
        </p>
        {list.tacticalCardIds.length > 0 && (
          <p className="sheet__cards">
            <strong>{t('tactics')}:</strong>{' '}
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
        <h2>{t('armySlots')}</h2>
        <p className="sheet__cards">
          {SLOT_TYPES.filter((t) => summary.slots[t].total > 0)
            .map(
              (t) =>
                `${slotLabel(t, locale)} ${summary.slots[t].used}/${summary.slots[t].total}`,
            )
            .join(' · ')}
        </p>
      </section>

      <section className="sheet__section">
        <h2>{t('units')}</h2>
        <table className="sheet__table">
          <thead>
            <tr>
              <th>{t('unit')}</th><th>{t('models')}</th><th>{t('supplyShort')}</th><th>{t('slot')}</th><th>{t('upgrades')}</th><th className="sheet__num">{t('minerals')}</th>
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
                  <td>{composition?.models ?? t('noValue')}</td>
                  <td>{composition?.supplyValue ?? t('noValue')}</td>
                  <td>{slotLabel(unit.slotType, locale)}</td>
                  <td className="sheet__upgrades">
                    {listEntry.upgrades.length === 0
                      ? t('noValue')
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
              <td colSpan={5}>{t('total')}</td>
              <td className="sheet__num">{summary.mineralsSpent}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {referenced.length > 0 && (
        <section className="sheet__section">
        <h2>{t('summoned')}</h2>
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
        <h2>{t('draftScenarios')}</h2>
        <p className="sheet__cards">
          <strong>{t('missions')}:</strong>{' '}
          {list.missionCardIds
            .map((id) => {
              const m = index.missionCards.get(id);
              return m ? `${m.name} (${scaleLabel(m.scale, t)})` : id;
            })
            .join(' · ') || t('noValue')}
        </p>
        <p className="sheet__cards">
          <strong>{t('deployments')}:</strong>{' '}
          {list.deploymentCardIds
            .map((id) => index.deploymentCards.get(id)?.name ?? id)
            .join(' · ') || t('noValue')}
        </p>
      </section>

      {list.notes && (
        <section className="sheet__section">
          <h2>{t('notes')}</h2>
          <p className="sheet__cards">{list.notes}</p>
        </section>
      )}

      <UnitReference data={data} />
      <KeywordGlossary entries={keywordGlossary} locale={locale} />
    </div>
  );
}

function listKeywordTexts(
  list: ArmyList,
  index: CatalogIndex,
  locale: 'es' | 'en',
): string[] {
  const texts: string[] = [];

  for (const listEntry of list.entries) {
    const unit = index.unitEntries.get(listEntry.unitEntryId);
    if (!unit) continue;

    const card = index.unitCards.get(unit.cardId);
    if (card) {
      for (const weapon of card.weapons) texts.push(...weapon.keywords);
      for (const ability of card.abilities) texts.push(localizedText(ability.text, locale));
    }

    for (const applied of listEntry.upgrades) {
      const upgrade = unit.upgrades.find((candidate) => candidate.id === applied.upgradeId);
      if (!upgrade) continue;
      for (const weapon of upgrade.grantsWeapons) texts.push(...weapon.keywords);
      for (const ability of upgrade.grantsAbilities) texts.push(localizedText(ability.text, locale));
      texts.push(upgradeDescription(upgrade, locale));
    }
  }

  return texts.filter(Boolean);
}

function KeywordGlossary({
  entries,
  locale,
}: {
  entries: KeywordGlossaryEntry[];
  locale: 'es' | 'en';
}) {
  if (entries.length === 0) return null;

  return (
    <section className="sheet__section sheet__glossary">
      <h2>{locale === 'en' ? 'Keyword glossary' : 'Glosario de palabras clave'}</h2>
      <dl className="sheet__glossary-list">
        {entries.map((entry) => (
          <div key={`${entry.label}-${entry.text.en}`} className="sheet__glossary-entry">
            <dt>{entry.label}</dt>
            <dd>{localizedText(entry.text, locale)}</dd>
          </div>
        ))}
      </dl>
    </section>
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
  const { i18n } = useTranslation();
  const { t } = useTranslation('print');
  const locale = normalizeLocale(i18n.language) ?? 'es';
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
      <h2>{t('unitProfile')} — {t('abilities').toLocaleLowerCase(locale)} y {t('upgrades').toLocaleLowerCase(locale)}</h2>
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
                {card && (
                  <div className="unitref__stats">
                    <StatBlock profile={card.profile} size="small" />
                    <SupplyBands bands={card.supplyProfile} size="small" />
                  </div>
                )}
                {card && card.combatTags.length > 0 && (
                  <p className="unitref__combat-tags">
                    {card.combatTags.join(', ')}
                  </p>
                )}
              </div>
            </div>

            {card && groupUnitProfileByPhase(card.weapons, card.abilities).map(({ phase, weapons, abilities }) => (
              <section key={phase} className="unitref__phase-group">
                <span className={`unitref__phase-title phase-tag phase-tag--${phase}`}>{phaseLabel(phase, t)}</span>
                {weapons.length > 0 && (
                  <table className="unitref__weapons">
                    <thead>
                      <tr>
                        <th>{t('weapons')}</th><th>{t('range')}</th><th>{t('target')}</th><th>{t('attacks')}</th><th>{t('hit')}</th><th>{t('surge')}</th><th>{t('damage')}</th><th>{t('keyword')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weapons.map((weapon) => (
                        <tr key={weapon.name}>
                          <td>{weapon.name}</td>
                          <td>{weapon.range}</td>
                          <td>{weapon.target}</td>
                          <td>{weapon.rateOfAttack}</td>
                          <td>{weapon.hit}</td>
                          <td>{weapon.surgeType ? `${weapon.surgeType} ${weapon.surgeDice ?? ''}`.trim() : t('noValue')}</td>
                          <td>{weapon.damage}</td>
                          <td>{weapon.keywords.join(', ') || t('noValue')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {abilities.map((ability) => (
                  <p key={ability.name} className="unitref__ability">
                    <strong>{ability.name}</strong>
                    <span className={`unitref__tag unitref__ability-type unitref__ability-type--${ability.type.toLowerCase()}`}>
                      {ability.type}
                    </span>
                    {ability.cost !== null && (
                      <span className={`unitref__tag unitref__resource-cost unitref__resource-cost--${resourceLabel(unit.race)}`}>
                        {ability.cost} {resourceLabel(unit.race)}
                      </span>
                    )}{' '}
                    {localizedText(ability.text, locale)}
                  </p>
                ))}
              </section>
            ))}

            {false && card!.weapons.length > 0 && (
              <table className="unitref__weapons">
                <thead>
                  <tr>
                    <th>{t('weapons')}</th><th>{t('range')}</th><th>{t('target')}</th><th>{t('attacks')}</th><th>{t('hit')}</th><th>{t('damage')}</th><th>{t('keyword')}</th>
                  </tr>
                </thead>
                <tbody>
                  {card!.weapons.map((weapon) => (
                    <tr key={weapon.name}>
                      <td>{weapon.name}</td>
                      <td>{weapon.range}</td>
                      <td>{weapon.target}</td>
                      <td>{weapon.rateOfAttack}</td>
                      <td>{weapon.hit}</td>
                      <td>{weapon.damage}</td>
                      <td>{weapon.keywords.join(', ') || t('noValue')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {false && groupAbilitiesByPhase(card!.abilities).map(([phase, abilities]) => (
              <section key={phase} className="unitref__phase-group">
                <span className={`unitref__phase-title phase-tag phase-tag--${phase}`}>{phaseLabel(phase, t)}</span>
                {abilities.map((ability) => (
                  <p key={ability.name} className="unitref__ability">
                    <strong>{ability.name}</strong>
                    <span className="unitref__tag">
                      {ability.type}
                      {ability.cost ? ` ${ability.cost} ${resourceLabel(unit.race)}` : ''}
                    </span>{' '}
                    {localizedText(ability.text, locale)}
                  </p>
                ))}
              </section>
            ))}

            {applied.length > 0 && (
              <div className="unitref__upgrades">
                <span className="unitref__upgrades-title">{t('upgrades')} {t('purchased', { defaultValue: locale === 'en' ? 'purchased' : 'compradas' })}</span>
                {groupPurchasedUpgrades(applied).map(({ phase, upgrades }) => (
                  <section key={phase} className="unitref__phase-group unitref__upgrade-phase">
                    <span className={`unitref__phase-title phase-tag phase-tag--${phase}`}>{phaseLabel(phase, t)}</span>
                    {upgrades.map(({ applied: a, upgrade }) => (
                      <p key={upgrade.id} className="unitref__ability">
                        <strong>{upgrade.name}</strong>
                        <span className="unitref__tag unitref__mineral-cost">+{upgradeCostFor(upgrade, listEntry.compositionId)} min.</span>
                        {upgrade.grantsAbilities.map((ability) => (
                          <span key={ability.name}>
                            <span className={`unitref__tag unitref__ability-type unitref__ability-type--${ability.type.toLowerCase()}`}>
                              {ability.type}
                            </span>
                            {ability.cost !== null && (
                              <span className={`unitref__tag unitref__resource-cost unitref__resource-cost--${resourceLabel(card?.race ?? unit.race)}`}>
                                {ability.cost} {resourceLabel(card?.race ?? unit.race)}
                              </span>
                            )}
                          </span>
                        ))}
                        {upgrade.specialist && (
                          <span className="unitref__tag">
                            SPECIALIST
                            {a.modelIndex !== null && ` · ${t('model', { defaultValue: locale === 'en' ? 'model' : 'modelo' })} #${a.modelIndex + 1}`}
                          </span>
                        )}
                        {upgrade.replacesWeapon && (
                          <span className="unitref__tag">
                            {t('replaceWeapon', { defaultValue: locale === 'en' ? 'replaces' : 'sustituye' })} {upgrade.replacesWeapon}
                          </span>
                        )}{' '}
                        {upgradeDescription(upgrade, locale)}
                      </p>
                    ))}
                    {upgrades.some(({ upgrade }) => upgrade.grantsWeapons.length > 0) && (
                      <table className="unitref__weapons">
                        <thead>
                          <tr>
                            <th>{t('upgradeWeapon', { defaultValue: locale === 'en' ? 'Upgrade weapon' : 'Arma de mejora' })}</th><th>{t('range')}</th><th>{t('target')}</th><th>{t('attacks')}</th><th>{t('hit')}</th><th>{t('surge')}</th><th>{t('damage')}</th><th>{t('keyword')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {upgrades.flatMap(({ upgrade }) =>
                            upgrade.grantsWeapons.map((weapon) => (
                              <tr key={`${upgrade.id}-${weapon.name}`}>
                                <td>{weapon.name}</td>
                                <td>{weapon.range}</td>
                                <td>{weapon.target}</td>
                                <td>{weapon.rateOfAttack}</td>
                                <td>{weapon.hit}</td>
                                <td>{weapon.surgeType ? `${weapon.surgeType} ${weapon.surgeDice ?? ''}`.trim() : t('noValue')}</td>
                                <td>{weapon.damage}</td>
                                <td>{weapon.keywords.join(', ') || t('noValue')}</td>
                              </tr>
                            )),
                          )}
                        </tbody>
                      </table>
                    )}
                  </section>
                ))}
                {false && applied.map(({ applied: a, upgrade }) => (
                  <p key={upgrade.id} className="unitref__ability">
                    <strong>{upgrade.name}</strong>
                    <span className="unitref__tag">+{upgradeCostFor(upgrade, listEntry.compositionId) ?? 0} min.</span>
                    {upgrade.grantsAbilities.map((ability) => (
                      <span key={ability.name} className="unitref__tag">
                        {ability.type}{ability.cost ? ` ${ability.cost} ${resourceLabel(card?.race ?? unit.race)}` : ''}
                      </span>
                    ))}
                    {upgrade.specialist && (
                      <span className="unitref__tag">
                        SPECIALIST
                        {a.modelIndex !== null && ` · ${t('model', { defaultValue: locale === 'en' ? 'model' : 'modelo' })} #${a.modelIndex + 1}`}
                      </span>
                    )}
                    {upgrade.replacesWeapon && (
                      <span className="unitref__tag">
                        {t('replaceWeapon', { defaultValue: locale === 'en' ? 'replaces' : 'sustituye' })} {upgrade.replacesWeapon}
                      </span>
                    )}{' '}
                    {upgradeDescription(upgrade, locale)}
                  </p>
                ))}
                {false && applied.some((x) => x.upgrade.grantsWeapons.length > 0) && (
                  <table className="unitref__weapons">
                    <thead>
                      <tr>
                        <th>{t('upgradeWeapon', { defaultValue: locale === 'en' ? 'Upgrade weapon' : 'Arma de mejora' })}</th><th>{t('range')}</th><th>{t('target')}</th><th>{t('attacks')}</th><th>{t('hit')}</th><th>{t('damage')}</th><th>{t('keyword')}</th>
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
                            <td>{weapon.keywords.join(', ') || t('noValue')}</td>
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

function phaseLabel(phase: 'MOVEMENT' | 'ASSAULT' | 'COMBAT' | 'ANY', t: (key: string) => string) {
  return ({ MOVEMENT: t('abilityPhaseMovement'), ASSAULT: t('abilityPhaseAssault'), COMBAT: t('abilityPhaseCombat'), ANY: t('abilityPhaseAny') })[phase].toUpperCase();
}

function scaleLabel(scale: string, t: (key: string) => string): string {
  return scale === 'skirmish' ? t('scaleSkirmish') : scale === 'standard' ? t('scaleStandard') : t('scaleGrandOffensive');
}

function resourceLabel(race: 'ZERG' | 'TERRAN' | 'PROTOSS') {
  return ({ ZERG: 'BM', TERRAN: 'CP', PROTOSS: 'PE' })[race];
}
