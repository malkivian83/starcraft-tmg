import { SLOT_TYPES, type SlotPool, type SlotType } from '@/engine/types';
import i18n from '@/i18n/config';
import { normalizeLocale } from '@/i18n/types';

const SLOT_LABEL: Record<'es' | 'en', Record<SlotType, string>> = {
  es: { CORE: 'Núcleo', ELITE: 'Élite', SUPPORT: 'Apoyo', AIR: 'Aéreo', HERO: 'Héroe' },
  en: { CORE: 'Core', ELITE: 'Elite', SUPPORT: 'Support', AIR: 'Air', HERO: 'Hero' },
};

function currentLocale(): 'es' | 'en' { return normalizeLocale(i18n.language) ?? 'es'; }

/** Espacios que otorga una carta: `3× Núcleo`, `1× Aéreo`… */
export function SlotChips({ slots }: { slots: SlotPool }) {
  const entries = SLOT_TYPES.filter((t) => (slots[t] ?? 0) > 0);
  if (entries.length === 0) {
    return <span className="chip">{currentLocale() === 'en' ? 'No slots granted' : 'No otorga espacios'}</span>;
  }
  return (
    <span className="row" style={{ gap: 4 }}>
      {entries.map((type) => (
        <span key={type} className="chip chip--slot">
          {slots[type]}× {SLOT_LABEL[currentLocale()][type]}
        </span>
      ))}
    </span>
  );
}

/**
 * Etiquetas de combate del pie de la carta: `BIOLOGICAL`, `LIGHT`, `GROUND`…
 *
 * En inglés a propósito, como el resto de nombres de juego: son las palabras
 * que aparecen literalmente en los Surge Type y en los objetivos de las armas
 * enemigas, y traducirlas rompería la correspondencia con la mesa.
 */
export function CombatTagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="row" style={{ gap: 4 }}>
      {tags.map((tag) => (
        <span key={tag} className="chip chip--combat">
          {tag}
        </span>
      ))}
    </span>
  );
}

export function UniqueChip({ unique }: { unique: boolean }) {
  if (!unique) return null;
  return <span className="chip chip--unique">UNIQUE</span>;
}

export function slotLabel(type: SlotType, locale: 'es' | 'en' = currentLocale()): string {
  return SLOT_LABEL[locale][type];
}
