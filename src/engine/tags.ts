import type { FactionTag } from './types';

/**
 * R3 — Regla de etiquetas (§9.1.2).
 *
 * TODA etiqueta de la unidad o carta debe aparecer también en la carta de
 * facción: es una relación de SUBCONJUNTO, no de intersección.
 *
 * El reglamento da el contraejemplo explícito: un Kerrigan Swarm Raptor
 * (Zerg, Kerrigan's Swarm) NO es elegible con una carta de facción cuya única
 * etiqueta es Zerg, pese a compartir esa etiqueta.
 *
 * Implementarlo como intersección no vacía —el error intuitivo— haría que la
 * aplicación aprobara listas ilegales, que es el peor fallo posible aquí.
 */
export function tagsAreEligible(
  cardTags: readonly FactionTag[],
  factionTags: readonly FactionTag[],
): boolean {
  const allowed = new Set(factionTags.map(normalizeTag));
  return cardTags.every((tag) => allowed.has(normalizeTag(tag)));
}

/** Devuelve las etiquetas que impiden la elegibilidad, para explicar el motivo. */
export function missingTags(
  cardTags: readonly FactionTag[],
  factionTags: readonly FactionTag[],
): FactionTag[] {
  const allowed = new Set(factionTags.map(normalizeTag));
  return cardTags.filter((tag) => !allowed.has(normalizeTag(tag)));
}

/** Las etiquetas se comparan sin distinguir mayúsculas ni espacios sobrantes. */
export function normalizeTag(tag: FactionTag): string {
  return tag.trim().toUpperCase();
}
