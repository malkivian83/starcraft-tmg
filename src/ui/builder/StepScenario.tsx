import { useState } from 'react';
import type {
  Catalog,
  DeploymentCard,
  MissionCard,
  ScaleId,
} from '@/engine/types';
import { useListStore } from '@/store/listStore';
import { useTranslation } from 'react-i18next';
import { localizedText } from '@/i18n/localized-content';
import { normalizeLocale } from '@/i18n/types';
import { CardImageModal, CardPreviewButton } from '../common/CardImagePreview';

export function playableScenarioCards(
  catalog: Pick<Catalog, 'missionCards' | 'deploymentCards'>,
  scaleId: ScaleId,
) {
  return {
    missions: catalog.missionCards.filter(
      (mission) => mission.scale === scaleId,
    ),
    deployments: catalog.deploymentCards.filter(
      (deployment) => deployment.scale === scaleId,
    ),
  };
}

/**
 * Paso 3 — Misión y despliegue.
 *
 * Se seleccionan las 2+2 cartas que LLEVAS al draft (§9.2). El draft en sí
 * —tirada, descartes, afinidad de marcadores— se resuelve en la mesa con el
 * oponente delante, así que no es parte de la construcción de la lista.
 */
export function StepScenario() {
  const { t } = useTranslation('builderUi');
  const { list, index } = useListStore();
  const toggleMission = useListStore((s) => s.toggleMission);
  const toggleDeployment = useListStore((s) => s.toggleDeployment);
  const [preview, setPreview] = useState<{ name: string; imageRef: string } | null>(null);

  const { missions, deployments } = playableScenarioCards(
    index.catalog,
    list.scaleId,
  );

  return (
    <div className="stack">
      <div className="panel">
        <p className="small muted" style={{ margin: 0 }}>
          {t('scenarioHint')}
        </p>
      </div>

      <section className="panel">
        <h2 className="panel__title">
          {t('missions', { count: list.missionCardIds.length })}
        </h2>
        <div className="scenario-grid scenario-grid--missions">
          {missions.map((mission) => (
            <MissionCardView
              key={mission.id}
              mission={mission}
              selected={list.missionCardIds.includes(mission.id)}
              disabled={
                !list.missionCardIds.includes(mission.id) &&
                list.missionCardIds.length >= 2
              }
              onToggle={() => toggleMission(mission.id)}
              onPreview={() => mission.imageRef && setPreview({ name: mission.name, imageRef: mission.imageRef })}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel__title">
          {t('deployments', { count: list.deploymentCardIds.length })}
        </h2>
        <div className="scenario-grid scenario-grid--deployments">
          {deployments.map((deployment) => (
            <DeploymentCardView
              key={deployment.id}
              deployment={deployment}
              selected={list.deploymentCardIds.includes(deployment.id)}
              disabled={
                !list.deploymentCardIds.includes(deployment.id) &&
                list.deploymentCardIds.length >= 2
              }
              onToggle={() => toggleDeployment(deployment.id)}
              onPreview={() => deployment.originalImageRef && setPreview({ name: deployment.name, imageRef: deployment.originalImageRef })}
            />
          ))}
        </div>
      </section>
      {preview && (
        <CardImageModal
          title={preview.name}
          images={[{ src: preview.imageRef, alt: t('originalCardImage', { name: preview.name }) }]}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

function MissionCardView({
  mission,
  selected,
  disabled,
  onToggle,
  onPreview,
}: {
  mission: MissionCard;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  onPreview: () => void;
}) {
  const { i18n } = useTranslation();
  const { t } = useTranslation('builderUi');
  const { t: tBuilder } = useTranslation('builder');
  const locale = normalizeLocale(i18n.language) ?? 'es';
  return (
    <article className={`card scenario-selection-card${selected ? ' card--selected' : ''}`}>
      <div className="card__head">
        <span className="card__name card__name-with-preview">
          {mission.name}
          {mission.imageRef && <CardPreviewButton cardName={mission.name} onOpen={onPreview} />}
        </span>
        <span className="chip">{scaleLabel(mission.scale, t)}</span>
      </div>
      <div className="scenario-mission-stats" aria-label={t('missions', { count: 0 })}>
        <span className="scenario-mission-stat scenario-mission-stat--supply">
          <span className="scenario-mission-stat__label">{t('supply')}</span>
          <span className="scenario-mission-stat__value">{mission.startingSupply}</span>
          <span className="scenario-mission-stat__meta">+{mission.supplyEscalation}/{tBuilder('perRound')}</span>
        </span>
        <span className="scenario-mission-stat scenario-mission-stat--rounds">
          <span className="scenario-mission-stat__label">{t('rounds')}</span>
          <span className="scenario-mission-stat__value">{mission.gameLength}</span>
        </span>
        {mission.instantWinLead && (
          <span className="scenario-mission-stat scenario-mission-stat--victory">
            <span className="scenario-mission-stat__label">{locale === 'en' ? 'Victory' : 'Victoria'}</span>
            <span className="scenario-mission-stat__value">
              +{mission.instantWinLead} <small>{locale === 'en' ? 'VP' : 'PV'}</small>
            </span>
          </span>
        )}
      </div>
      {localizedText(mission.missionParameters, locale) && (
        <p className="small muted" style={{ margin: 0 }}>
          <strong>{locale === 'en' ? 'Mission parameters' : 'Parámetros de misión'}:</strong>{' '}
          {localizedText(mission.missionParameters, locale)}
        </p>
      )}
      {localizedText(mission.scoringConditions, locale) && (
        <p className="small muted" style={{ margin: 0 }}>
          <strong>{locale === 'en' ? 'Scoring conditions' : 'Condiciones de puntuación'}:</strong>{' '}
          {localizedText(mission.scoringConditions, locale)}
        </p>
      )}
      {localizedText(mission.additionalConditions, locale) && (
        <p className="small muted" style={{ margin: 0 }}>
          <strong>{locale === 'en' ? 'Additional conditions' : 'Condiciones adicionales'}:</strong>{' '}
          {localizedText(mission.additionalConditions, locale)}
        </p>
      )}
      <button
        type="button"
        className={`card-action ${selected ? 'card-action--remove' : 'card-action--add'}`}
        disabled={!selected && disabled}
        aria-pressed={selected}
        aria-label={`${selected ? t('remove') : t('add')} ${mission.name}`}
        onClick={onToggle}
      >
        {selected ? t('remove') : t('add')}
      </button>
    </article>
  );
}

function DeploymentCardView({
  deployment,
  selected,
  disabled,
  onToggle,
  onPreview,
}: {
  deployment: DeploymentCard;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  onPreview: () => void;
}) {
  const { t } = useTranslation('builderUi');
  return (
    <article className={`card scenario-selection-card${selected ? ' card--selected' : ''}`}>
      <div className="card__head">
        <span className="card__name card__name-with-preview">
          {deployment.name}
          {deployment.originalImageRef && <CardPreviewButton cardName={deployment.name} onOpen={onPreview} />}
        </span>
        <span className="chip">
          {deployment.battlefield.width}×{deployment.battlefield.height}″
        </span>
      </div>
      <span className="small muted">{scaleLabel(deployment.scale, t)}</span>
      {/* El diagrama de marcadores ES la carta: se muestra la imagen original. */}
      <img
        className="scenario-diagram"
        src={`/${deployment.imageRef}`}
        alt={t('deploymentDiagram', { name: deployment.name })}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <button
        type="button"
        className={`card-action ${selected ? 'card-action--remove' : 'card-action--add'}`}
        disabled={!selected && disabled}
        aria-pressed={selected}
        aria-label={`${selected ? t('remove') : t('add')} ${deployment.name}`}
        onClick={onToggle}
      >
        {selected ? t('remove') : t('add')}
      </button>
    </article>
  );
}

function scaleLabel(scale: ScaleId, t: (key: string, options?: Record<string, unknown>) => string): string {
  return scale === 'skirmish' ? t('scaleSkirmish') : scale === 'standard' ? t('scaleStandard') : t('scaleGrandOffensive');
}
