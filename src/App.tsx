import { useEffect, useState } from 'react';
import { availableRaces } from '@/catalog/loader';
import type { Race, ScaleId } from '@/engine/types';
import { useListStore } from '@/store/listStore';
import { downloadJson, importListFromJson } from '@/store/persistence';
import { saveRemoteList } from '@/auth/listService';
import { useAuthStore } from '@/store/authStore';
import { AuthGate } from './ui/auth/AuthGate';
import { SavedListsPage } from './ui/lists/SavedListsPage';
import { AccountPage } from './ui/account/AccountPage';
import { ProfileAvatar, profileName } from './ui/account/ProfileAvatar';
import { ResourceBar } from './ui/common/ResourceBar';
import { SeedPanel } from './ui/common/SeedPanel';
import { StepCommandCards } from './ui/builder/StepCommandCards';
import { StepMusterUnits } from './ui/builder/StepMusterUnits';
import { StepReview } from './ui/builder/StepReview';
import { StepScenario } from './ui/builder/StepScenario';
import './ui/app.css';

type StepId = 'cards' | 'units' | 'scenario' | 'review';
type PageId = 'builder' | 'lists' | 'profile';
const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'cards', label: '1 · Cartas de mando' }, { id: 'units', label: '2 · Reclutamiento' },
  { id: 'scenario', label: '3 · Misión y despliegue' }, { id: 'review', label: '4 · Revisión e impresión' },
];
const RACE_LABEL: Record<Race, string> = { ZERG: 'Zerg', TERRAN: 'Terran', PROTOSS: 'Protoss' };

export function App() { return <AuthGate><ArmyBuilderApp /></AuthGate>; }

function ArmyBuilderApp() {
  const [step, setStep] = useState<StepId>('cards');
  const [page, setPage] = useState<PageId>('builder');
  const [seedVisible, setSeedVisible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { list, index, summary, validation, remoteRevision, isDirty } = useListStore();
  const setRace = useListStore((state) => state.setRace);
  const setScale = useListStore((state) => state.setScale);
  const setMineralLimit = useListStore((state) => state.setMineralLimit);
  const setName = useListStore((state) => state.setName);
  const setList = useListStore((state) => state.setList);
  const setRemoteRevision = useListStore((state) => state.setRemoteRevision);
  const markSaved = useListStore((state) => state.markSaved);
  const resetForRace = useListStore((state) => state.resetForRace);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => { if (user) resetForRace(user.defaultRace); }, [resetForRace, user?.id]);
  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { if (!isDirty) return; event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 2600); return () => clearTimeout(timer); }, [toast]);
  const errorsByStep: Record<StepId, number> = {
    cards: validation.errors.filter((error) => ['R0', 'R2', 'R7', 'R11'].includes(error.rule)).length,
    units: validation.errors.filter((error) => ['R1', 'R3', 'R4', 'R6', 'R8', 'R9', 'R10'].includes(error.rule)).length,
    scenario: validation.errors.filter((error) => error.rule === 'R12').length, review: 0,
  };
  const confirmDiscard = (action: string) => !isDirty || window.confirm(`${action} reemplazara los cambios sin guardar de esta lista. Quieres continuar?`);
  const createList = () => { if (!confirmDiscard('Crear una lista nueva')) return; resetForRace(user?.defaultRace ?? 'ZERG'); setSeedVisible(false); setPage('builder'); };
  const onImportFile = async (file: File) => {
    // La confirmacion debe ocurrir antes de la lectura asincrona del fichero:
    // de otro modo puede aparecer cuando el usuario ya ha cambiado de vista.
    if (!confirmDiscard('Importar una lista')) return;
    const result = importListFromJson(await file.text());
    if (result.list) {
      setList(result.list);
      setSeedVisible(false);
      setPage('builder');
      setToast('Lista importada.');
    } else setToast(result.error ?? 'No se pudo importar el fichero.');
  };
  const saveList = async () => { try { const saved = await saveRemoteList(list, remoteRevision); setRemoteRevision(saved.revision); markSaved(); setToast('Lista guardada en tu cuenta.'); } catch (error) { setToast(error instanceof Error ? error.message : 'No se pudo guardar la lista.'); } };
  const loadList = (loaded: typeof list, revision: number) => { if (!confirmDiscard('Cargar otra lista')) return; setList(loaded); setRemoteRevision(revision); markSaved(); setSeedVisible(false); setPage('builder'); setToast('Lista cargada.'); };
  const changeRace = (race: Race) => { if (race !== list.race && !confirmDiscard('Cambiar de raza')) return; setRace(race); };
  const confirmFactionChange = () => {
    const hasDependentSelections = list.tacticalCardIds.length > 0 || list.entries.length > 0 || list.creepCardId !== null;
    return !hasDependentSelections || window.confirm('Cambiar de Carta de Faccion eliminara las unidades y cartas dependientes. Quieres continuar?');
  };

  return <div className="app" data-race={list.race}>
    <header className="topbar app-header no-print"><img className="topbar__logo" src="/logo.png" alt="StarCraft: The Miniatures Game" width={521} height={149} /><span className="topbar__title">Listas de ejército</span><nav className="primary-nav" aria-label="Navegación principal"><button className={`primary-nav__item${page === 'lists' ? ' primary-nav__item--active' : ''}`} onClick={() => setPage('lists')}>Mis listas</button><button className={`primary-nav__item${page === 'builder' ? ' primary-nav__item--active' : ''}`} onClick={createList}>Nueva lista</button></nav><div className="topbar__spacer" />{user && <button className={`profile-trigger${page === 'profile' ? ' profile-trigger--active' : ''}`} onClick={() => setPage('profile')} aria-label="Abrir perfil"><ProfileAvatar user={user} /><span className="profile-trigger__name">{profileName(user)}</span></button>}<button className="header-logout" onClick={() => { void logout(); }}>Salir</button></header>
    {page === 'builder' && <>
      <section className="builder-toolbar no-print" aria-label="Opciones de la lista"><div className="field"><label htmlFor="list-name">Nombre</label><input id="list-name" value={list.name} onChange={(event) => setName(event.target.value)} /></div><div className="field"><label htmlFor="race">Raza</label><select id="race" value={list.race} onChange={(event) => changeRace(event.target.value as Race)}>{availableRaces().map((race) => <option key={race} value={race}>{RACE_LABEL[race]}</option>)}</select></div><div className="field"><label htmlFor="scale">Escala</label><select id="scale" value={list.scaleId} onChange={(event) => setScale(event.target.value as ScaleId)}>{index.catalog.scales.map((scale) => <option key={scale.id} value={scale.id}>{scale.name.es}</option>)}</select></div><div className="field"><label htmlFor="minerals">Minerales</label><input id="minerals" type="number" min={100} step={50} value={list.mineralLimit} onChange={(event) => setMineralLimit(Number(event.target.value))} /></div><div className="builder-toolbar__actions"><button onClick={() => { void saveList(); }}>Guardar</button><button onClick={() => setSeedVisible((visible) => !visible)}>{seedVisible ? 'Cerrar seed' : 'Seed'}</button><label className="button-like">Importar<input type="file" accept="application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void onImportFile(file); event.target.value = ''; }} /></label><button onClick={() => downloadJson(list)}>Exportar</button><button onClick={() => window.print()}>Imprimir / PDF</button></div></section>
      <ResourceBar summary={summary} hasErrors={!validation.legal} />
      <nav className="tabs no-print">{STEPS.map((item) => <button key={item.id} className={`tab${step === item.id ? ' tab--active' : ''}`} onClick={() => setStep(item.id)}>{item.label}{errorsByStep[item.id] > 0 && <span className="tab__badge">{errorsByStep[item.id]}</span>}</button>)}</nav>
      {seedVisible && <div className="content content--tool"><SeedPanel onImported={(imported) => { if (!confirmDiscard('Importar una lista desde la seed')) return; setList(imported); setRemoteRevision(null); setToast('Lista importada desde seed.'); }} /></div>}
      <main className="content">{step === 'cards' && <StepCommandCards onBeforeFactionChange={confirmFactionChange} />}{step === 'units' && <StepMusterUnits />}{step === 'scenario' && <StepScenario />}{step === 'review' && <StepReview />}</main>
    </>}
    {page === 'lists' && <SavedListsPage onCreate={createList} onLoad={loadList} />}
    {page === 'profile' && <AccountPage />}
    {toast && <div className="toast no-print">{toast}</div>}
  </div>;
}
