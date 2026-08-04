import { SLOT_TYPES, type SlotPool, type SlotType } from '@/engine/types';

const SLOT_LABEL: Record<SlotType, string> = {
  CORE: 'Core',
  ELITE: 'Élite',
  SUPPORT: 'Apoyo',
  AIR: 'Aéreo',
  HERO: 'Héroe',
};

/** Espacios que otorga una carta: `3× Núcleo`, `1× Aéreo`… */
export function SlotChips({ slots }: { slots: SlotPool }) {
  const entries = SLOT_TYPES.filter((t) => (slots[t] ?? 0) > 0);
  if (entries.length === 0) {
    return <span className="chip">No otorga espacios</span>;
  }
  return (
    <span className="row" style={{ gap: 4 }}>
      {entries.map((type) => (
        <span key={type} className="chip chip--slot">
          {slots[type]}× {SLOT_LABEL[type]}
        </span>
      ))}
    </span>
  );
}

export function UniqueChip({ unique }: { unique: boolean }) {
  if (!unique) return null;
  return <span className="chip chip--unique">UNIQUE</span>;
}

export function slotLabel(type: SlotType): string {
  return SLOT_LABEL[type];
}
