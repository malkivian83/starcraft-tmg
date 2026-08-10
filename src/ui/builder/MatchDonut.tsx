import { DONUT_CIRCUMFERENCE, DONUT_RADIUS, donutSegments, winRatePercent, type MatchGroup } from './matchStats';

interface MatchDonutProps {
  group: MatchGroup;
  playedLabel: string;
  ariaLabel: string;
  factionLabel: string;
}

export function MatchDonut({ group, playedLabel, ariaLabel, factionLabel }: MatchDonutProps) {
  const rate = winRatePercent(group)!;
  return (
    <article className="stats-donut">
      <svg className="stats-donut__svg" viewBox="0 0 110 110" role="img" aria-label={ariaLabel}>
        <circle className="stats-donut__track" cx="55" cy="55" r={DONUT_RADIUS} />
        <g transform="rotate(-90 55 55)">
          {donutSegments(group).map((segment) => (
            <circle
              key={segment.key}
              className={`stats-donut__segment stats-donut__segment--${segment.key}`}
              cx="55"
              cy="55"
              r={DONUT_RADIUS}
              strokeDasharray={`${segment.length} ${DONUT_CIRCUMFERENCE}`}
              strokeDashoffset={segment.offset}
            />
          ))}
        </g>
        <text className="stats-donut__rate" x="55" y="52" textAnchor="middle">{rate}%</text>
        <text className="stats-donut__score" x="55" y="68" textAnchor="middle">{group.wins}-{group.losses}-{group.draws}</text>
      </svg>
      <strong className="stats-donut__label">{factionLabel}</strong>
      <span className="stats-donut__total">{group.played} {playedLabel}</span>
    </article>
  );
}
