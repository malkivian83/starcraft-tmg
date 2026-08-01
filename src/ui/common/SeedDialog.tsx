import { useState } from 'react';
import { decodeSeed, encodeSeed } from '@/engine/seed/codec';
import { useListStore } from '@/store/listStore';
import { loadCatalog } from '@/catalog/loader';
import { buildCatalogIndex } from '@/engine/catalogIndex';
import type { Race } from '@/engine/types';

/** Compartir la lista por seed: exportar e importar sin servidor. */
export function SeedDialog({ onClose }: { onClose: () => void }) {
  const { list, index } = useListStore();
  const setList = useListStore((s) => s.setList);

  const [input, setInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const seed = encodeSeed(list, index);

  const copy = async () => {
    await navigator.clipboard.writeText(seed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const importSeed = () => {
    // El seed lleva su propia raza: hay que decodificar con el catálogo
    // correcto, no con el que esté cargado en ese momento.
    for (const race of ['ZERG', 'TERRAN', 'PROTOSS'] as Race[]) {
      let candidateIndex;
      try {
        candidateIndex = buildCatalogIndex(loadCatalog(race).catalog);
      } catch {
        continue;
      }

      const result = decodeSeed(input, candidateIndex);
      if (result.status === 'corrupt') continue;
      if (!result.list) continue;
      if (result.list.race !== race) continue;

      setList(result.list);
      if (result.status === 'partial') {
        setMessage(
          `Importada parcialmente. El catálogo actual no reconoce: ${result.missing.join(', ')}.`,
        );
      } else if (result.status === 'version_mismatch') {
        setMessage(
          'Importada, pero el seed se creó con otra versión del catálogo. Revisa los costes.',
        );
      } else {
        setMessage('Lista importada correctamente.');
      }
      return;
    }

    setMessage(
      'El seed está incompleto o alterado. Cópialo entero de nuevo, sin recortes.',
    );
  };

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__box">
        <div className="card__head">
          <h2>Compartir por seed</h2>
          <button onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <section style={{ marginTop: 12 }}>
          <h3 className="panel__title">Tu lista actual</h3>
          <textarea className="seed-box" readOnly value={seed} rows={4} />
          <div className="row">
            <button onClick={copy}>
              {copied ? '✓ Copiado' : 'Copiar seed'}
            </button>
            <span className="small muted">{seed.length} caracteres</span>
          </div>
        </section>

        <section style={{ marginTop: 18 }}>
          <h3 className="panel__title">Importar un seed</h3>
          <textarea
            className="seed-box"
            rows={4}
            placeholder="Pega aquí un seed que te hayan pasado (SCT1-…)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <div className="row">
            <button onClick={importSeed} disabled={input.trim().length === 0}>
              Importar
            </button>
          </div>
          {message && (
            <p className="small" style={{ marginTop: 8 }}>
              {message}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
