import type { UnitProfile } from '@/engine/types';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('builder');
  const stats: Array<{ label: string; value: string }> = [
    { label: t('stats.size'), value: profile.size },
    { label: t('stats.hitPoints'), value: profile.hitPoints },
    { label: t('stats.evade'), value: profile.evade },
    { label: t('stats.armour'), value: profile.armour },
    { label: t('stats.speed'), value: profile.speed },
  ];

  if (profile.shield) {
    stats.unshift({ label: t('stats.shield'), value: profile.shield });
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
