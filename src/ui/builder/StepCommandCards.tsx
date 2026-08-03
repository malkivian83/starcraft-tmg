import { useEffect, useState } from 'react';
import {
  getEligibleCreepCards,
  getEligibleTacticalCards,
} from '@/engine/eligibility';
import { useListStore } from '@/store/listStore';
import type { TacticalCard } from '@/engine/types';
import { SlotChips, UniqueChip } from '../common/Chips';

/**
 * Paso 1 — Cartas de mando: facción, tácticas y Creep Card.
 *
 * La Creep Card tiene bloque propio y no se mezcla entre las tácticas: es
 * obligatoria y exactamente una (R11), así que enterrarla entre cartas
 * opcionales llevaría a listas ilegales sin que nadie lo note.
 */
export function StepCommandCards({ onBeforeFactionChange }: { onBeforeFactionChange?: () => boolean }) {
  const { list, index, summary, validation } = useListStore();
  const [previewCard, setPreviewCard] = useState<TacticalCard | null>(null);
  const selectFactionCard = useListStore((s) => s.selectFactionCard);
  const addTacticalCard = useListStore((s) => s.addTacticalCard);
  const removeTacticalCard = useListStore((s) => s.removeTacticalCard);
  const selectCreepCard = useListStore((s) => s.selectCreepCard);

  const factionCards = index.catalog.factionCards;
  const tactical = getEligibleTacticalCards(list, index, summary);
  const creep = getEligibleCreepCards(list, index, summary);

  const creepMissing = validation.errors.some((e) => e.rule === 'R11');

  useEffect(() => {
    if (!previewCard) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewCard(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [previewCard]);

  return (
    <div className="split">
      <div className="stack">
        <section className="panel">
          <h2 className="panel__title">1 · Carta de Facción (obligatoria)</h2>
          <div className="stack">
            {factionCards.map((card) => (
              <button
                key={card.id}
                className={`card${list.factionCardId === card.id ? ' card--selected' : ''}`}
                onClick={() => {
                  if (list.factionCardId !== card.id && onBeforeFactionChange && !onBeforeFactionChange()) return;
                  selectFactionCard(card.id);
                }}
              >
                <div className="card__head">
                  <span className="card__name">{card.name}</span>
                  <span className="chip chip--cost">
                    +{card.resourcePerRound} {card.resource}
                  </span>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <SlotChips slots={card.startingSlots} />
                </div>
                <div className="row small muted" style={{ gap: 4 }}>
                  {card.tags.map((tag) => (
                    <span key={tag} className="chip chip--role">
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>

        {!list.factionCardId ? (
          <section className="panel">
            <p className="empty small">
              Elige una Carta de Facción para desbloquear las Cartas Tácticas.
            </p>
          </section>
        ) : (
          <>
            {creep.length > 0 && (
              <section className="panel">
                <h2 className="panel__title">
                  2 · Creep Card — obligatoria, exactamente una
                </h2>
                {creepMissing && (
                  <div
                    className="issue issue--error"
                    style={{ marginBottom: 10 }}
                  >
                    Tu Carta de Facción exige incluir una Creep Card. Sin ella
                    la lista no es legal.
                  </div>
                )}
                <div className="stack">
                  {creep.map(({ card, status, reason }) => {
                    const selected = list.creepCardId === card.id;
                    const blocked = status === 'blocked' && !selected;
                    return (
                      <button
                        key={card.id}
                        className={`card${selected ? ' card--selected' : ''}${
                          blocked ? ' card--blocked' : ''
                        }`}
                        disabled={blocked}
                        onClick={() => selectCreepCard(card.id)}
                      >
                        <div className="card__head">
                          <span className="card__name">{card.name}</span>
                          <span className="chip chip--cost">
                            {card.vespeneCost} gas
                          </span>
                        </div>
                        {blocked && reason && (
                          <span className="card__reason">{reason.es}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="panel">
              <h2 className="panel__title">
                {creep.length > 0 ? '3' : '2'} · Cartas Tácticas (cuestan gas)
              </h2>
              <div className="stack">
                {tactical
                  .filter(
                    (t) =>
                      // Una carta que ya llevas SIEMPRE se muestra, aunque su
                      // estado sea «imposible» por ser UNIQUE y estar incluida:
                      // si se ocultara, no habría forma de retirarla.
                      t.status !== 'impossible' ||
                      list.tacticalCardIds.includes(t.card.id),
                  )
                  .map(({ card, status, reason, remedy }) => {
                    const count = list.tacticalCardIds.filter(
                      (id) => id === card.id,
                    ).length;
                    const canAdd = status === 'available';
                    const blocked = status === 'blocked';
                    return (
                      <div
                        key={card.id}
                        className={`card${count > 0 ? ' card--selected' : ''}${
                          blocked ? ' card--blocked' : ''
                        }`}
                      >
                        <div className="card__head">
                          <span className="card__name">
                            {card.name}
                            {count > 1 && (
                              <span className="chip" style={{ marginLeft: 6 }}>
                                ×{count}
                              </span>
                            )}
                          </span>
                          <span className="chip chip--cost">
                            {card.vespeneCost} gas
                          </span>
                        </div>
                        <div className="row" style={{ gap: 4 }}>
                          <SlotChips slots={card.slotsGranted} />
                          <UniqueChip unique={card.unique} />
                          {card.resource && (
                            <span className="chip">
                              +{card.resourcePerRound} {card.resource}
                            </span>
                          )}
                        </div>
                        {blocked && reason && (
                          <>
                            <span className="card__reason">{reason.es}</span>
                            {remedy && (
                              <span className="card__remedy">{remedy.es}</span>
                            )}
                          </>
                        )}
                        <div className="row card-actions">
                          <button
                            type="button"
                            className="card-action card-action--preview"
                            title={`Ver ${card.name}`}
                            aria-label={`Ver carta ${card.name}`}
                            onClick={() => setPreviewCard(card)}
                          >
                            <span className="card-action__icon" aria-hidden="true">▣</span>
                            Ver carta
                          </button>
                          <button
                            type="button"
                            className="card-action card-action--add"
                            disabled={!canAdd}
                            title={
                              card.unique && count > 0
                                ? 'Es UNIQUE: solo se permite una copia.'
                                : reason?.es
                            }
                            aria-label={`Añadir ${card.name}`}
                            onClick={() => addTacticalCard(card.id)}
                          >
                            <span className="card-action__icon" aria-hidden="true">+</span>
                            Añadir
                          </button>
                          {count > 0 && (
                            <button
                              type="button"
                              className="card-action card-action--remove"
                              aria-label={`Quitar ${card.name}`}
                              onClick={() => removeTacticalCard(card.id)}
                            >
                              <span className="card-action__icon" aria-hidden="true">−</span>
                              Quitar
                            </button>
                          )}
                          {card.unique && count > 0 && (
                            <span className="small muted">
                              UNIQUE: máximo una copia
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          </>
        )}
      </div>

      <ActiveCards />
      {previewCard && (
        <TacticalCardModal
          card={previewCard}
          onClose={() => setPreviewCard(null)}
        />
      )}
    </div>
  );
}

function TacticalCardModal({
  card,
  onClose,
}: {
  card: TacticalCard;
  onClose: () => void;
}) {
  return (
    <div
      className="modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal__box modal__box--card-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tactical-card-preview-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <p className="eyebrow">Previsualización</p>
            <h2 id="tactical-card-preview-title">Vista de carta táctica</h2>
          </div>
          <button
            type="button"
            className="card-action modal__close"
            onClick={onClose}
            aria-label="Cerrar previsualización"
            title="Cerrar"
          >
            <span className="card-action__icon" aria-hidden="true">×</span>
          </button>
        </div>
        <CardDetail
          title={card.name}
          kind="Carta Táctica"
          badge={`${card.vespeneCost} gas`}
          slots={card.slotsGranted}
          abilities={card.abilities}
        />
      </div>
    </div>
  );
}

/** Panel derecho: qué llevas y qué hace cada carta. */
function ActiveCards() {
  const { list, index } = useListStore();

  const faction = list.factionCardId
    ? index.factionCards.get(list.factionCardId)
    : undefined;
  const creep = list.creepCardId
    ? index.creepCards.get(list.creepCardId)
    : undefined;
  const tacticals = list.tacticalCardIds
    .map((id) => index.tacticalCards.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  if (!faction) {
    return (
      <section className="panel">
        <p className="empty">
          Selecciona una Carta de Facción para ver aquí sus habilidades y las
          cartas activas de tu lista.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2 className="panel__title">Cartas de mando activas</h2>
      <div className="stack">
        <CardDetail
          title={faction.name}
          kind="Carta de Facción"
          badge={`+${faction.resourcePerRound} ${faction.resource}`}
          slots={faction.startingSlots}
          abilities={faction.abilities}
        />
        {creep && (
          <CardDetail
            title={creep.name}
            kind="Creep Card"
            badge={`${creep.vespeneCost} gas`}
            abilities={creep.abilities}
          />
        )}
        {tacticals.map((card, i) => (
          <CardDetail
            key={`${card.id}-${i}`}
            title={card.name}
            kind="Carta Táctica"
            badge={`${card.vespeneCost} gas`}
            slots={card.slotsGranted}
            abilities={card.abilities}
          />
        ))}
      </div>
    </section>
  );
}

function CardDetail({
  title,
  kind,
  badge,
  slots,
  abilities,
}: {
  title: string;
  kind: string;
  badge: string;
  slots?: Parameters<typeof SlotChips>[0]['slots'];
  abilities: Array<{ name: string; phase: 'MOVEMENT' | 'ASSAULT' | 'COMBAT' | 'ANY'; type: string; cost: number | 'X' | null; text: { es: string } }>;
}) {
  return (
    <article
      className="panel"
      style={{ background: 'var(--bg-raised)', borderLeft: '3px solid var(--accent)' }}
    >
      <div className="card__head">
        <h3>{title}</h3>
        <span className="small muted">{kind}</span>
      </div>
      <div className="row" style={{ gap: 4, margin: '6px 0' }}>
        {slots && <SlotChips slots={slots} />}
        <span className="chip chip--cost">{badge}</span>
      </div>
      {abilities.map((ability) => (
        <p key={ability.name} className="small" style={{ margin: '6px 0' }}>
          {/* Nombre en inglés, explicación en español (regla de idioma). */}
          <strong style={{ color: 'var(--accent)' }}>{ability.name}</strong>
          <span className={`chip small phase-tag phase-tag--${ability.phase}`} style={{ marginLeft: 6 }}>{phaseLabel(ability.phase)}</span>
          <span className="chip small">{ability.type}{ability.cost ? ` ${ability.cost}` : ''}</span>
          {ability.text.es && <> — {ability.text.es}</>}
        </p>
      ))}
    </article>
  );
}

function phaseLabel(phase: 'MOVEMENT' | 'ASSAULT' | 'COMBAT' | 'ANY') {
  return ({ MOVEMENT: 'Movimiento', ASSAULT: 'Asalto', COMBAT: 'Combate', ANY: 'Cualquier fase' })[phase];
}
