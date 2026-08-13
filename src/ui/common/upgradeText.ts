import type { UpgradeOption } from '@/engine/types';
import type { SupportedLocale } from '@/i18n/types';
import { localizedText } from '@/i18n/localized-content';

/**
 * Texto explicativo de una mejora.
 *
 * El reglamento no da una descripción propia a cada mejora: lo que hace está
 * en las habilidades o armas que otorga. Esta función busca por ese orden.
 */
export function upgradeDescription(upgrade: UpgradeOption, locale: SupportedLocale = 'es'): string {
  if (upgrade.text && localizedText(upgrade.text, locale)) return localizedText(upgrade.text, locale);

  const fromAbilities = upgrade.grantsAbilities
    .map((ability) => localizedText(ability.text, locale))
    .filter(Boolean)
    .join(' ');
  if (fromAbilities) return fromAbilities;

  if (upgrade.grantsWeapons.length > 0) {
    return locale === 'en'
      ? `Grants the weapon ${upgrade.grantsWeapons.map((w) => w.name).join(', ')}.`
      : `Otorga el arma ${upgrade.grantsWeapons.map((w) => w.name).join(', ')}.`;
  }

  if (upgrade.replacesWeapon) {
    return locale === 'en' ? `Replaces the weapon ${upgrade.replacesWeapon}.` : `Sustituye el arma ${upgrade.replacesWeapon}.`;
  }

  // Decirlo es mejor que dejar un hueco en blanco: un espacio vacío parece
  // que la mejora no hace nada, cuando lo que falta es transcribir la carta.
  return locale === 'en' ? 'Text pending transcription; check the card.' : 'Texto pendiente de transcribir; consulta la carta.';
}
