import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

type MapScale = 'skirmish' | 'standard';

interface MapExample {
  id: string;
  image: string;
}

const MAP_EXAMPLES: Record<MapScale, readonly MapExample[]> = {
  standard: Array.from({ length: 6 }, (_, index) => ({
    id: `standard-${index + 1}`,
    image: `/maps/examples/standard-${String(index + 1).padStart(2, '0')}.webp`,
  })),
  skirmish: Array.from({ length: 3 }, (_, index) => ({
    id: `skirmish-${index + 1}`,
    image: `/maps/examples/skirmish-${String(index + 1).padStart(2, '0')}.webp`,
  })),
};

export function GameMapExamples({ en, scale }: { en: boolean; scale: MapScale }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const titleId = useId();
  const examples = MAP_EXAMPLES[scale];
  const scaleLabel = scale === 'skirmish' ? (en ? 'Skirmish' : 'Escaramuza') : (en ? 'Standard' : 'Estándar');
  const dimensions = scale === 'skirmish' ? '36″ × 36″' : '36″ × 54″';
  const closePreview = useCallback(() => setSelectedIndex(null), []);

  useEffect(() => setSelectedIndex(null), [scale]);

  return <section className="game-map-examples" data-scale={scale} aria-labelledby={titleId}>
    <header className="game-map-examples__header">
      <div className="game-map-examples__heading">
        <span className="game-map-examples__icon" aria-hidden="true"><i /><i /><i /><i /></span>
        <div>
          <span>{en ? 'Table reference' : 'Referencia de mesa'}</span>
          <h3 id={titleId}>{en ? 'Example maps' : 'Mapas de ejemplo'}</h3>
          <p>{en ? 'Open a layout and use it as a guide when placing terrain.' : 'Abre una disposición y úsala como guía al colocar la escenografía.'}</p>
        </div>
      </div>
      <span className="game-map-examples__scale"><strong>{dimensions}</strong><span>{scaleLabel}</span></span>
    </header>

    <ol className="game-map-examples__rail">
      {examples.map((example, index) => <li key={example.id}>
        <button
          className="game-map-example"
          type="button"
          aria-haspopup="dialog"
          aria-label={en ? `Open example map ${index + 1} of ${examples.length}` : `Abrir mapa de ejemplo ${index + 1} de ${examples.length}`}
          onClick={() => setSelectedIndex(index)}
        >
          <span className="game-map-example__image">
            <img src={example.image} alt="" loading="lazy" decoding="async" />
            <span aria-hidden="true">↗</span>
          </span>
          <span className="game-map-example__label">
            <span>{en ? 'Layout' : 'Disposición'}</span>
            <strong>{String(index + 1).padStart(2, '0')}</strong>
          </span>
        </button>
      </li>)}
    </ol>

    {selectedIndex !== null && <MapPreviewModal
      key={scale}
      en={en}
      examples={examples}
      initialIndex={selectedIndex}
      scale={scale}
      scaleLabel={scaleLabel}
      dimensions={dimensions}
      onClose={closePreview}
    />}
  </section>;
}

function MapPreviewModal({ en, examples, initialIndex, scale, scaleLabel, dimensions, onClose }: {
  en: boolean;
  examples: readonly MapExample[];
  initialIndex: number;
  scale: MapScale;
  scaleLabel: string;
  dimensions: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const current = examples[index] ?? examples[0]!;
  const move = useCallback((direction: -1 | 1) => {
    setIndex((value) => (value + direction + examples.length) % examples.length);
  }, [examples.length]);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        move(-1);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        move(1);
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [move, onClose]);

  const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="modal game-map-modal no-print" role="presentation" onMouseDown={onBackdropClick}>
      <div
        ref={dialogRef}
        className="modal__box game-map-modal__box"
        data-scale={scale}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="modal__header game-map-modal__header">
          <div>
            <p>{scaleLabel} · {dimensions}</p>
            <h2 id={titleId}>{en ? `Example map ${index + 1}` : `Mapa de ejemplo ${index + 1}`}</h2>
          </div>
          <button ref={closeRef} type="button" className="modal__close" aria-label={en ? 'Close map' : 'Cerrar mapa'} onClick={onClose}>
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="game-map-modal__stage">
          <button type="button" className="game-map-modal__nav game-map-modal__nav--previous" aria-label={en ? 'Previous map' : 'Mapa anterior'} onClick={() => move(-1)}>
            <span aria-hidden="true">‹</span>
          </button>
          <figure>
            <img
              key={current.id}
              src={current.image}
              alt={en
                ? `${scaleLabel} example map ${index + 1}, a ${dimensions} terrain layout.`
                : `Mapa de ejemplo ${index + 1} para ${scaleLabel.toLowerCase()}, con una disposición de ${dimensions}.`}
            />
            <figcaption id={descriptionId}>
              {en ? 'A visual guide from the rulebook. Adapt the terrain to the pieces you have available.' : 'Una guía visual del reglamento. Adapta la escenografía a las piezas que tengas disponibles.'}
            </figcaption>
          </figure>
          <button type="button" className="game-map-modal__nav game-map-modal__nav--next" aria-label={en ? 'Next map' : 'Mapa siguiente'} onClick={() => move(1)}>
            <span aria-hidden="true">›</span>
          </button>
        </div>

        <footer className="game-map-modal__footer">
          <span aria-live="polite">{String(index + 1).padStart(2, '0')} / {String(examples.length).padStart(2, '0')}</span>
          <div aria-hidden="true">
            {examples.map((example, dotIndex) => <i data-active={dotIndex === index ? 'true' : undefined} key={example.id} />)}
          </div>
          <span>{en ? 'Use ← → to browse' : 'Usa ← → para navegar'}</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
