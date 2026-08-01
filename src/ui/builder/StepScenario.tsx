import type { DeploymentCard, MissionCard } from '@/engine/types';
import { useListStore } from '@/store/listStore';

/**
 * Paso 3 — Misión y despliegue.
 *
 * Se seleccionan las 2+2 cartas que LLEVAS al draft (§9.2). El draft en sí
 * —tirada, descartes, afinidad de marcadores— se resuelve en la mesa con el
 * oponente delante, así que no es parte de la construcción de la lista.
 */
export function StepScenario() {
  const { list, index } = useListStore();
  const toggleMission = useListStore((s) => s.toggleMission);
  const toggleDeployment = useListStore((s) => s.toggleDeployment);

  const missions = index.catalog.missionCards;
  const deployments = index.catalog.deploymentCards;

  return (
    <div className="stack">
      <div className="panel">
        <p className="small muted" style={{ margin: 0 }}>
          Cada jugador lleva <strong>2 cartas de misión</strong> y{' '}
          <strong>2 de despliegue</strong>, sin repetir ninguna dentro de su
          propio conjunto. El reglamento sí permite que ambos jugadores lleven
          las mismas cartas.
        </p>
      </div>

      <section className="panel">
        <h2 className="panel__title">
          Misiones — {list.missionCardIds.length} de 2
        </h2>
        <div className="scenario-grid">
          {missions.map((mission) => (
            <MissionCardView
              key={mission.id}
              mission={mission}
              selected={list.missionCardIds.includes(mission.id)}
              offScale={mission.scale !== list.scaleId}
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
          Despliegues — {list.deploymentCardIds.length} de 2
        </h2>
        <div className="scenario-grid">
          {deployments.map((deployment) => (
            <DeploymentCardView
              key={deployment.id}
              deployment={deployment}
              selected={list.deploymentCardIds.includes(deployment.id)}
              offScale={deployment.scale !== list.scaleId}
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

const SCALE_LABEL: Record<string, string> = {
  skirmish: 'Escaramuza',
  standard: 'Estándar',
  grand_offensive: 'Gran Ofensiva',
};

function MissionCardView({
  mission,
  selected,
  offScale,
  disabled,
  onToggle,
}: {
  mission: MissionCard;
  selected: boolean;
  offScale: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={`card${selected ? ' card--selected' : ''}`}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`Misión ${mission.name}, escala ${SCALE_LABEL[mission.scale]}`}
      onClick={onToggle}
    >
      <div className="card__head">
        <span className="card__name">{mission.name}</span>
        <span className="chip">{SCALE_LABEL[mission.scale]}</span>
      </div>
      <div className="row small muted" style={{ gap: 10 }}>
        <span>
          Suministro <strong>{mission.startingSupply}</strong> (+
          {mission.supplyEscalation}/ronda)
        </span>
        <span>{mission.gameLength} rondas</span>
        {mission.instantWinLead && (
          <span>Victoria a +{mission.instantWinLead} PV</span>
        )}
      </div>
      {mission.scoringConditions.es && (
        <p className="small muted" style={{ margin: 0 }}>
          {mission.scoringConditions.es}
        </p>
      )}
      {/* R13 es aviso, no error: no está prohibido, pero descuadra la partida. */}
      {offScale && (
        <span className="card__reason">
          Diseñada para otra escala de enfrentamiento.
        </span>
      )}
    </button>
  );
}

function DeploymentCardView({
  deployment,
  selected,
  offScale,
  disabled,
  onToggle,
}: {
  deployment: DeploymentCard;
  selected: boolean;
  offScale: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={`card${selected ? ' card--selected' : ''}`}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`Despliegue ${deployment.name}, mesa ${deployment.battlefield.width}×${deployment.battlefield.height} pulgadas`}
      onClick={onToggle}
    >
      <div className="card__head">
        <span className="card__name">{deployment.name}</span>
        <span className="chip">
          {deployment.battlefield.width}×{deployment.battlefield.height}″
        </span>
      </div>
      <span className="small muted">{SCALE_LABEL[deployment.scale]}</span>
      {/* El diagrama de marcadores ES la carta: se muestra la imagen original. */}
      <img
        className="scenario-diagram"
        src={`/${deployment.imageRef}`}
        alt={`Diagrama de despliegue ${deployment.name}`}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      {offScale && (
        <span className="card__reason">
          Diseñada para otra escala de enfrentamiento.
        </span>
      )}
    </button>
  );
}
