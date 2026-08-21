import type { Localized } from '@/engine/types';

export interface KeywordMatch {
  length: number;
  text: Localized;
}

export interface KeywordGlossaryEntry {
  label: string;
  text: Localized;
}

interface KeywordRule {
  pattern: RegExp;
  text: Localized;
}

/**
 * Reglas que pueden aparecer en perfiles, armas y textos de habilidades.
 * Las expresiones empiezan en `^` porque se prueban desde cada posición del
 * texto; así se conserva exactamente la notación de la carta, incluidos sus
 * valores entre paréntesis.
 */
const KEYWORD_RULES: KeywordRule[] = [
  { pattern: /^ANTI-EVADE(?:\s*\(\d+\))?/, text: { es: 'El objetivo sufre -X a su tirada de Evasión para este ataque.', en: 'The target suffers -X to its Evade Roll for this attack.' } },
  { pattern: /^ARMY SLOT/, text: { es: 'Indica el tipo de espacio de ejército que ocupa la unidad.', en: 'Shows the Army Slot type occupied by the Unit.' } },
  { pattern: /^ACCESS POINTS?/, text: { es: 'Conexiones del terreno que permiten cambiar de nivel de elevación.', en: 'Terrain connections that allow models to change elevation.' } },
  { pattern: /^BULKY/, text: { es: 'Esta arma no puede usarse para un ataque a distancia mientras la unidad está trabada.', en: 'This weapon cannot be used for a Ranged Attack while the Unit is Engaged.' } },
  { pattern: /^BURROWED/i, text: { es: 'La unidad obtiene HIDDEN, cuenta como Tamaño 0 y solo puede realizar las acciones permitidas mientras está enterrada.', en: 'The Unit gains HIDDEN, counts as Size 0, and may perform only the actions allowed while Burrowed.' } },
  { pattern: /^BURST FIRE(?:\s+\d+["”]?)?(?:\s*\(\d+\))?/, text: { es: 'Contra un objetivo dentro de Y pulgadas, aumenta la Cadencia de Ataque en X para ese ataque.', en: 'Against a target Within Y inches, increase this weapon’s Rate of Attack by X for that attack.' } },
  { pattern: /^CONCENTRATED FIRE(?:\s*\(\d+\))?/, text: { es: 'Este arma no puede retirar más de X miniaturas como bajas en un ataque.', en: 'This weapon cannot remove more than X models as casualties in an attack.' } },
  { pattern: /^CRITICAL HIT(?:\s*\(\d+\))?/, text: { es: 'Mueve X dados de la Reserva de Armadura directamente a la Reserva de Daño.', en: 'Move X dice from the Armour Pool directly to the Damage Pool.' } },
  { pattern: /^DEBUFFS?/, text: { es: 'La unidad sufre una penalización a la característica indicada hasta el final de la ronda.', en: 'The Unit suffers a penalty to the specified characteristic until the End of the Round.' } },
  { pattern: /^DISPLACEMENT/, text: { es: 'La miniatura líder puede terminar su movimiento solapando esta ficha o unidad y después se coloca en contacto peana con peana.', en: 'The Leading Model may end its move overlapping this Token or Unit, then is set in base-to-base contact.' } },
  { pattern: /^DODGE(?:\s*\(\d+\))?/, text: { es: 'Reduce en X los dados que Surge o CRITICAL HIT mueven de Armadura a Daño.', en: 'Reduce by X the dice moved from Armour to Damage by Surge or CRITICAL HIT.' } },
  { pattern: /^GROUND LEVEL|^NIVEL DE SUELO/, text: { es: 'Nivel de elevación directamente sobre el tablero.', en: 'The elevation level directly on the playmat.' } },
  { pattern: /^HEAL(?:\s*\(\d+\)|\s*\(X\))?/, text: { es: 'Retira X puntos de daño acumulado; no devuelve miniaturas destruidas.', en: 'Remove X points of accumulated Damage; destroyed models cannot return.' } },
  { pattern: /^HIDDEN/, text: { es: 'No puede ser objetivo de ataques a distancia o habilidades que requieran línea de visión salvo que el atacante esté a 4 pulgadas o menos; además es inmune a IMPACT.', en: 'Cannot be targeted by Ranged Attacks or Line-of-Sight abilities unless the attacker is Within 4 inches; it is also immune to IMPACT.' } },
  { pattern: /^HITS(?:\s+\d+)?(?:\s*\(\d+\))?/, text: { es: 'La unidad sufre X impactos automáticos que pasan directamente a la Reserva de Armadura y no generan Surge.', en: 'The Unit suffers X automatic hits placed directly into the Armour Pool; they do not generate Surge.' } },
  { pattern: /^IMPACT(?:\s*\(\d+\)(?:\s+\d+\+)?)?/, text: { es: 'Después de una Carga exitosa, cada miniatura elegible genera X dados de Impacto; cada resultado Y+ coloca un dado en la Reserva de Armadura.', en: 'After a successful Charge, each eligible model generates X Impact dice; each result of Y+ places a die in the Armour Pool.' } },
  { pattern: /^IMPASSABLE TERRAIN|^TERRENO INFRANQUEABLE/, text: { es: 'No se puede mover a través, sobre ni terminar el movimiento en este terreno.', en: 'Models cannot move through, onto, or end their movement on this terrain.' } },
  { pattern: /^INDIRECT FIRE/, text: { es: 'Puede ignorar la línea de visión al elegir el objetivo y resolver el daño, pero debe estar dentro de alcance.', en: 'May ignore Line of Sight when selecting a target and resolving Damage, but the target must be Within Range.' } },
  { pattern: /^INSTANT/, text: { es: 'Las unidades enemigas no pueden declarar ni resolver Reacciones en respuesta a ataques de esta arma.', en: 'Enemy Units cannot declare or resolve Reactions in response to attacks made with this weapon.' } },
  { pattern: /^LOCKED IN(?:\s*\(\d+\))?/, text: { es: 'Contra una unidad con estado Stationary, aumenta la Cadencia de Ataque en X.', en: 'Against a Unit with Stationary Status, increase this weapon’s Rate of Attack by X.' } },
  { pattern: /^LONG RANGE(?:\s*\(\d+["”]?\))?/, text: { es: 'Aumenta el alcance máximo a X pulgadas; más allá del alcance normal se aplica -1 a Impacto.', en: 'Increase the maximum Range to X inches; attacks beyond normal Range suffer -1 to Hit.' } },
  { pattern: /^MORPH(?:\s*\([^)]*\))?(?:\s+\d+)?/, text: { es: 'Transforma miniaturas de la unidad activa en la unidad indicada, respetando el suministro disponible.', en: 'Transforms models from the active Unit into the named Unit, subject to Available Supply.' } },
  { pattern: /^NON-LETHAL DAMAGE(?:\s*\(\d+\))?/, text: { es: 'Añade X puntos al marcador de daño sin retirar miniaturas; se combinan con el daño normal posterior.', en: 'Add X points to the Damage Marker without removing models; it combines with later standard Damage.' } },
  { pattern: /^ON CREEP|^SOBRE CREEP/, text: { es: 'Una unidad Zerg terrestre dentro de 6 pulgadas de Creep se considera SOBRE CREEP.', en: 'A Ground Zerg Unit Within 6 inches of Creep is considered ON CREEP.' } },
  { pattern: /^PIERCE(?:\s+[A-Za-z]+)?(?:\s*\(\d+\))?/, text: { es: 'Contra el tipo de combate indicado, el Daño de esta arma se considera X.', en: 'Against the specified Combat Tag, treat this weapon’s Damage as X.' } },
  { pattern: /^PINPOINT/, text: { es: 'Puede elegir como objetivo unidades enemigas trabadas, ignorando la restricción normal de ataques a distancia.', en: 'May target Engaged Enemy Units, ignoring the normal Ranged Attack restriction.' } },
  { pattern: /^PLACE(?:\s*\(\d+\))?/, text: { es: 'Retira la miniatura líder y colócala completamente dentro de X pulgadas; después coloca el resto manteniendo coherencia.', en: 'Remove and set the Leading Model Wholly Within X inches, then set the rest in Coherency.' } },
  { pattern: /^PRECISION(?:\s*\(\d+\))?/, text: { es: 'Después de tirar para Impacto, mueve hasta X dados fallidos directamente a la Reserva de Armadura.', en: 'After rolling to Hit, move up to X failed Attack Dice directly into the Armour Pool.' } },
  { pattern: /^REPEATABLE/, text: { es: 'No está limitado por el uso de una vez por ronda; puede repetirse si se pagan sus costes y se cumplen sus condiciones.', en: 'It is exempt from the once-per-round limit and may be repeated when its costs and conditions are met.' } },
  { pattern: /^RESPAWN(?:\s*\(\d+\))?/, text: { es: 'Devuelve hasta X miniaturas destruidas a la unidad sin aumentar su actual tramo de suministro.', en: 'Return up to X destroyed models without increasing the Unit’s current Supply bracket.' } },
  { pattern: /^SHIELDED/, text: { es: 'El Escudo se suma a las Heridas de la primera miniatura y se pierde cuando el daño total supera ese valor.', en: 'The Shield adds to the first model’s Hit Points and is lost when total Damage exceeds it.' } },
  { pattern: /^SIDEARM/, text: { es: 'Permite usar esta arma además del arma normal de la miniatura; sus ataques se resuelven en un lote separado.', en: 'Allows the equipped model to use this weapon in addition to its normal weapon; resolve it as a separate Batch.' } },
  { pattern: /^SIEGE MODE/, text: { es: 'Mientras está en este estado, la unidad no puede moverse ni cargar y solo puede usar armas compatibles con el modo.', en: 'While in this Status, the Unit cannot move or Charge and may use only compatible weapons.' } },
  { pattern: /^SPECIALIST/, text: { es: 'Solo una miniatura de la unidad puede estar equipada con esta arma.', en: 'Only one model in the Unit may be equipped with this weapon.' } },
  { pattern: /^SPILLOVER/, text: { es: 'Son impactos de un arma de plantilla que afectan a miniaturas fuera de la unidad objetivo principal.', en: 'These are hits from a Template Weapon affecting models outside the Primary target Unit.' } },
  { pattern: /^STATIONARY/, text: { es: 'La unidad empieza la ronda con este estado y lo pierde si cualquier miniatura se mueve, es movida o es colocada.', en: 'The Unit starts the Round with this Status and loses it if any model moves, is moved, or is PLACED.' } },
  { pattern: /^STAY IN PLAY/, text: { es: 'El efecto persiste durante la fase de Limpieza y Renovación hasta que una regla lo retire.', en: 'The effect persists through Cleanup & Refresh until a rule removes it.' } },
  { pattern: /^SUMMON(?:\s*\([^)]*\))?/, text: { es: 'Coloca la unidad indicada en contacto con su unidad padre, respetando coherencia, suministro y la Zona de Influencia.', en: 'Set the named Unit in contact with its Parent Unit, subject to Coherency, Supply, and Zone of Influence.' } },
  { pattern: /^TOUGH(?:\s*\(\d+\))?/, text: { es: 'Durante una tirada de Armadura, convierte hasta X resultados fallidos en éxitos.', en: 'During an Armour Roll, change up to X failed results into successes.' } },
  { pattern: /^BUFF(?:\s+[A-Za-z-]+(?:\s*\(\d+\))?)/, text: { es: 'La unidad obtiene una bonificación de X a la característica indicada hasta el final de la ronda.', en: 'The Unit gains a bonus of X to the specified characteristic until the End of the Round.' } },
];

function isWordCharacter(value: string | undefined): boolean {
  return value !== undefined && /[A-Za-z0-9]/.test(value);
}

export function keywordAt(text: string, index: number): KeywordMatch | null {
  if (index > 0 && isWordCharacter(text[index - 1])) return null;

  for (const rule of KEYWORD_RULES) {
    const match = rule.pattern.exec(text.slice(index));
    if (!match) continue;
    const value = match[0];
    if (isWordCharacter(text[index + value.length])) continue;
    return { length: value.length, text: rule.text };
  }

  return null;
}

/**
 * Finds the keyword rules used by a collection of card texts. The first
 * spelling found is kept as the label (including any value such as `(2)`),
 * while equal rule explanations are collapsed into one glossary entry.
 */
export function collectKeywordGlossary(texts: readonly string[]): KeywordGlossaryEntry[] {
  const entries: KeywordGlossaryEntry[] = [];
  const seen = new Set<string>();

  for (const text of texts) {
    let index = 0;
    while (index < text.length) {
      const match = keywordAt(text, index);
      if (!match) {
        index += 1;
        continue;
      }

      const label = text.slice(index, index + match.length);
      const key = `${match.text.es}\u0000${match.text.en}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({ label, text: match.text });
      }
      index += match.length;
    }
  }

  return entries;
}
