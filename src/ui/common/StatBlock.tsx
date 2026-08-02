import type { UnitProfile } from '@/engine/types';
import './StatBlock.css';

/**
 * Tira de características al estilo de la carta impresa: cada valor en su
 * casilla inclinada con el rótulo encima.
 *
 * El orden es el de la carta —SIZE, HIT POINTS, EVADE, ARMOUR, SPEED— para que
 * al comparar la app con la miniatura en la mesa los ojos vayan al mismo sitio.
 */
export function StatBlock({
  profile,
  size = 'normal',
}: {
  profile: UnitProfile;
  size?: 'normal' | 'small';
}) {
  const stats: Array<{ label: string; value: string }> = [
    { label: 'Size', value: profile.size },
    { label: 'Hit Points', value: profile.hitPoints },
    { label: 'Evade', value: profile.evade },
    { label: 'Armour', value: profile.armour },
    { label: 'Speed', value: profile.speed },
  ];

  if (profile.shield) {
    stats.unshift({ label: 'Shield', value: profile.shield });
  }

  return (
    <div className={`statblock statblock--${size}`}>
      {stats.map((stat) => (
        <div className="statblock__cell" key={stat.label}>
          <span className="statblock__label">{stat.label}</span>
          <span className="statblock__value">{stat.value}</span>
        </div>
      ))}
    </div>
  );
}
