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
        <div className="scenario-grid">
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
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel__title">
          {t('deployments', { count: list.deploymentCardIds.length })}
        </h2>
        <div className="scenario-grid">
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
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function MissionCardView({
  mission,
  selected,
  disabled,
  onToggle,
}: {
  mission: MissionCard;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const { i18n } = useTranslation();
  const { t } = useTranslation('builderUi');
  const { t: tBuilder } = useTranslation('builder');
  const locale = normalizeLocale(i18n.language) ?? 'es';
  return (
    <button
      className={`card${selected ? ' card--selected' : ''}`}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${t('missions', { count: 0 })} ${mission.name}, ${t('scale')} ${scaleLabel(mission.scale, t)}`}
      onClick={onToggle}
    >
      <div className="card__head">
        <span className="card__name">{mission.name}</span>
        <span className="chip">{scaleLabel(mission.scale, t)}</span>
      </div>
      <div className="row small muted" style={{ gap: 10 }}>
        <span>
          {t('supply')} <strong>{mission.startingSupply}</strong> (+
          {mission.supplyEscalation}/{tBuilder('perRound')})
        </span>
        <span>{mission.gameLength} {t('rounds')}</span>
        {mission.instantWinLead && (
          <span>{t('victory', { points: mission.instantWinLead })}</span>
        )}
      </div>
      {localizedText(mission.scoringConditions, locale) && (
        <p className="small muted" style={{ margin: 0 }}>
          {localizedText(mission.scoringConditions, locale)}
        </p>
      )}
    </button>
  );
}

function DeploymentCardView({
  deployment,
  selected,
  disabled,
  onToggle,
}: {
  deployment: DeploymentCard;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation('builderUi');
  return (
    <button
      className={`card${selected ? ' card--selected' : ''}`}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${t('deployments', { count: 0 })} ${deployment.name}`}
      onClick={onToggle}
    >
      <div className="card__head">
        <span className="card__name">{deployment.name}</span>
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
    </button>
  );
}

function scaleLabel(scale: ScaleId, t: (key: string, options?: Record<string, unknown>) => string): string {
  return scale === 'skirmish' ? t('scaleSkirmish') : scale === 'standard' ? t('scaleStandard') : t('scaleGrandOffensive');
}
