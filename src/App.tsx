import { useEffect, useState } from 'react';
import { availableRaces } from '@/catalog/loader';
import type { Race, ScaleId } from '@/engine/types';
import { useListStore } from '@/store/listStore';
import { downloadJson, importListFromJson, saveList } from '@/store/persistence';
import { ResourceBar } from './ui/common/ResourceBar';
import { SeedDialog } from './ui/common/SeedDialog';
import { StepCommandCards } from './ui/builder/StepCommandCards';
import { StepMusterUnits } from './ui/builder/StepMusterUnits';
import { StepReview } from './ui/builder/StepReview';
import { StepScenario } from './ui/builder/StepScenario';
import './ui/app.css';

type StepId = 'cards' | 'units' | 'scenario' | 'review';

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'cards', label: '1 · Cartas de mando' },
  { id: 'units', label: '2 · Reclutamiento' },
  { id: 'scenario', label: '3 · Misión y despliegue' },
  { id: 'review', label: '4 · Revisión e impresión' },
];

const RACE_LABEL: Record<Race, string> = {
  ZERG: 'Zerg',
  TERRAN: 'Terran',
  PROTOSS: 'Protoss',
};

export function App() {
  // Navegación NO lineal: se salta a cualquier paso sin perder lo hecho.
  const [step, setStep] = useState<StepId>('cards');
  const [seedOpen, setSeedOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { list, index, summary, validation } = useListStore();
  const setRace = useListStore((s) => s.setRace);
  const setScale = useListStore((s) => s.setScale);
  const setMineralLimit = useListStore((s) => s.setMineralLimit);
  const setName = useListStore((s) => s.setName);
  const setList = useListStore((s) => s.setList);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const errorsByStep: Record<StepId, number> = {
    cards: validation.errors.filter((e) =>
      ['R0', 'R2', 'R7', 'R11'].includes(e.rule),
    ).length,
    units: validation.errors.filter((e) =>
      ['R1', 'R3', 'R4', 'R6', 'R8', 'R9', 'R10'].includes(e.rule),
    ).length,
    scenario: validation.errors.filter((e) => e.rule === 'R12').length,
    review: 0,
  };

  const onImportFile = async (file: File) => {
    const result = importListFromJson(await file.text());
    if (result.list) {
      setList(result.list);
      setToast('Lista importada.');
    } else {
      setToast(result.error ?? 'No se pudo importar el fichero.');
    }
  };

  return (
    <div className="app">
      <header className="topbar no-print">
        <img
          className="topbar__logo"
          src="/logo.png"
          alt="StarCraft: The Miniatures Game"
          width={521}
          height={149}
        />
        <span className="topbar__title">Listas de ejército</span>

        <div className="field">
          <label htmlFor="list-name">Nombre</label>
          <input
            id="list-name"
            value={list.name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: 190 }}
          />
        </div>

        <div className="field">
          <label htmlFor="race">Raza</label>
          <select
            id="race"
            value={list.race}
            onChange={(e) => setRace(e.target.value as Race)}
          >
            {availableRaces().map((race) => (
              <option key={race} value={race}>
                {RACE_LABEL[race]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="scale">Escala</label>
          <select
            id="scale"
            value={list.scaleId}
            onChange={(e) => setScale(e.target.value as ScaleId)}
          >
            {index.catalog.scales.map((scale) => (
              <option key={scale.id} value={scale.id}>
                {scale.name.es}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="minerals">Minerales</label>
          <input
            id="minerals"
            type="number"
            min={100}
            step={50}
            value={list.mineralLimit}
            onChange={(e) => setMineralLimit(Number(e.target.value))}
            style={{ width: 96 }}
          />
        </div>

        <div className="topbar__spacer" />

        <div className="row">
          <button onClick={() => setSeedOpen(true)}>Seed</button>
          <button onClick={() => downloadJson(list)}>Exportar</button>
          <label className="button-like">
            Importar
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onImportFile(file);
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={async () => {
              await saveList(list);
              setToast('Lista guardada en este dispositivo.');
            }}
          >
            Guardar
          </button>
          <button onClick={() => window.print()}>Imprimir / PDF</button>
        </div>
      </header>

      {/* Requisito explícito: la barra de recursos nunca se oculta. */}
      <ResourceBar summary={summary} hasErrors={!validation.legal} />

      <nav className="tabs no-print">
        {STEPS.map((s) => (
          <button
            key={s.id}
            className={`tab${step === s.id ? ' tab--active' : ''}`}
            onClick={() => setStep(s.id)}
          >
            {s.label}
            {errorsByStep[s.id] > 0 && (
              <span className="tab__badge">{errorsByStep[s.id]}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="content">
        {step === 'cards' && <StepCommandCards />}
        {step === 'units' && <StepMusterUnits />}
        {step === 'scenario' && <StepScenario />}
        {step === 'review' && <StepReview />}
      </main>

      {seedOpen && <SeedDialog onClose={() => setSeedOpen(false)} />}
      {toast && <div className="toast no-print">{toast}</div>}
    </div>
  );
}
