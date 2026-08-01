import type { UpgradeOption } from '@/engine/types';

/**
 * Texto explicativo de una mejora.
 *
 * El reglamento no da una descripción propia a cada mejora: lo que hace está
 * en las habilidades o armas que otorga. Esta función busca por ese orden.
 */
export function upgradeDescription(upgrade: UpgradeOption): string {
  if (upgrade.text?.es) return upgrade.text.es;

  const fromAbilities = upgrade.grantsAbilities
    .map((ability) => ability.text.es)
    .filter(Boolean)
    .join(' ');
  if (fromAbilities) return fromAbilities;

  if (upgrade.grantsWeapons.length > 0) {
    return `Otorga el arma ${upgrade.grantsWeapons.map((w) => w.name).join(', ')}.`;
  }

  if (upgrade.replacesWeapon) {
    return `Sustituye el arma ${upgrade.replacesWeapon}.`;
  }

  // Decirlo es mejor que dejar un hueco en blanco: un espacio vacío parece
  // que la mejora no hace nada, cuando lo que falta es transcribir la carta.
  return 'Texto pendiente de transcribir; consulta la carta.';
}
