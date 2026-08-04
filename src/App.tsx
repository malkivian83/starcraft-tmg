import { useEffect, useState } from 'react';
import { availableRaces } from '@/catalog/loader';
import type { Race, ScaleId } from '@/engine/types';
import { useListStore } from '@/store/listStore';
import { downloadJson, importListFromJson } from '@/store/persistence';
import { clonePublicList as cloneRemotePublicList, loadPublicList, saveRemoteList, setListPublic as setRemoteListPublic, type RemoteList } from '@/auth/listService';
import { useAuthStore } from '@/store/authStore';
import { AuthGate } from './ui/auth/AuthGate';
import { SavedListsPage } from './ui/lists/SavedListsPage';
import { PublicListPage } from './ui/lists/PublicListPage';
import { PublicListsPage } from './ui/lists/PublicListsPage';
import { HomePage } from './ui/home/HomePage';
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
type PageId = 'home' | 'builder' | 'lists' | 'public-lists' | 'profile' | 'public-list';
const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'cards', label: '1 · Cartas de mando' }, { id: 'units', label: '2 · Reclutamiento' },
  { id: 'scenario', label: '3 · Misión y despliegue' }, { id: 'review', label: '4 · Revisión e impresión' },
];
const RACE_LABEL: Record<Race, string> = { ZERG: 'Zerg', TERRAN: 'Terran', PROTOSS: 'Protoss' };
const publicListPath = () => {
  const match = window.location.pathname.match(/^\/public-lists\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

export function App() { return <AuthGate><ArmyBuilderApp /></AuthGate>; }

function ArmyBuilderApp() {
  const [step, setStep] = useState<StepId>('cards');
  const initialPublicListId = publicListPath();
  const [page, setPage] = useState<PageId>(initialPublicListId ? 'public-list' : 'home');
  const [publicList, setPublicList] = useState<RemoteList | null>(null);
  const [publicListId, setPublicListId] = useState<string | null>(initialPublicListId);
  const [listIsPublic, setListIsPublic] = useState(false);
  const [listVisibilityDirty, setListVisibilityDirty] = useState(false);
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

  useEffect(() => { if (user) { resetForRace(user.defaultRace); setListIsPublic(false); setListVisibilityDirty(false); } }, [resetForRace, user?.id]);
  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { if (!isDirty) return; event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 2600); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!publicListId) return;
    let active = true;
    void loadPublicList(publicListId)
      .then((loaded) => { if (active) setPublicList(loaded); })
      .catch((error: unknown) => {
        if (!active) return;
        setToast(error instanceof Error ? error.message : 'No se pudo cargar la lista pública.');
        window.history.replaceState({}, '', '/');
        setPublicListId(null);
        setPage('home');
      });
    return () => { active = false; };
  }, [publicListId]);
  useEffect(() => {
    const onPopState = () => {
      const id = publicListPath();
      setPublicListId(id);
      setPage(id ? 'public-list' : 'home');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const errorsByStep: Record<StepId, number> = {
    cards: validation.errors.filter((error) => ['R0', 'R2', 'R7', 'R11'].includes(error.rule)).length,
    units: validation.errors.filter((error) => ['R1', 'R3', 'R4', 'R6', 'R8', 'R9', 'R10'].includes(error.rule)).length,
    scenario: validation.errors.filter((error) => error.rule === 'R12').length, review: 0,
  };
  const confirmDiscard = (action: string) => (!isDirty && !listVisibilityDirty) || window.confirm(`${action} hará que se pierdan los cambios sin guardar de esta lista. ¿Quieres continuar?`);
  const changeListVisibility = (isPublic: boolean) => { setListIsPublic(isPublic); setListVisibilityDirty(true); };
  const navigateToPage = (nextPage: PageId, destination: string) => {
    if (page === nextPage) return;
    if (page === 'builder' && !confirmDiscard(`Ir a la sección «${destination}»`)) return;
    if (publicListId) window.history.pushState({}, '', '/');
    setPublicListId(null);
    setPublicList(null);
    setPage(nextPage);
  };
  const logoutFromApp = () => {
    if (!confirmDiscard('Cerrar sesión')) return;
    void logout();
  };
  const createList = (requestedRace?: unknown) => { const race: Race = requestedRace === 'ZERG' || requestedRace === 'TERRAN' || requestedRace === 'PROTOSS' ? requestedRace : (user?.defaultRace ?? 'ZERG'); if (!confirmDiscard('Crear una lista nueva')) return; resetForRace(race); setListIsPublic(false); setListVisibilityDirty(false); setSeedVisible(false); setPublicListId(null); setPublicList(null); if (window.location.pathname !== '/') window.history.pushState({}, '', '/'); setPage('builder'); };
  const onImportFile = async (file: File) => { const result = importListFromJson(await file.text()); if (result.list) { if (!confirmDiscard('Importar una lista')) return; setList(result.list); setListIsPublic(false); setListVisibilityDirty(false); setSeedVisible(false); setPublicListId(null); setPublicList(null); if (window.location.pathname !== '/') window.history.pushState({}, '', '/'); setPage('builder'); setToast('Lista importada.'); } else setToast(result.error ?? 'No se pudo importar el fichero.'); };
  const saveList = async () => {
    try {
      const saved = await saveRemoteList(list, remoteRevision);
      const visible = saved.isPublic === listIsPublic ? saved : await setRemoteListPublic(saved.id, listIsPublic);
      setListIsPublic(visible.isPublic);
      setListVisibilityDirty(false);
      setRemoteRevision(visible.revision);
      markSaved();
      setToast('Lista guardada en tu cuenta.');
    } catch (error) { setToast(error instanceof Error ? error.message : 'No se pudo guardar la lista.'); }
  };
  const loadList = (loaded: typeof list, revision: number) => { if (!confirmDiscard('Cargar otra lista')) return; setList(loaded); setListIsPublic(Boolean((loaded as Partial<RemoteList>).isPublic)); setListVisibilityDirty(false); setRemoteRevision(revision); markSaved(); setSeedVisible(false); setPublicListId(null); setPublicList(null); if (window.location.pathname !== '/') window.history.pushState({}, '', '/'); setPage('builder'); setToast('Lista cargada.'); };
  const openPublicList = async (id: string) => {
    if (!confirmDiscard('Abrir una lista pública')) return;
    try {
      const loaded = await loadPublicList(id);
      setPublicList(loaded);
      setPublicListId(id);
      window.history.pushState({}, '', `/public-lists/${encodeURIComponent(id)}`);
      setPage('public-list');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'No se pudo cargar la lista pública.');
    }
  };
  const clonePublicList = async (id: string) => {
    if (!confirmDiscard('Clonar una lista pública')) return;
    try {
      const cloned = await cloneRemotePublicList(id);
      setList(cloned);
      setListIsPublic(false);
      setListVisibilityDirty(false);
      setRemoteRevision(cloned.revision);
      markSaved();
      setPublicListId(null);
      setPublicList(null);
      if (window.location.pathname !== '/') window.history.pushState({}, '', '/');
      setPage('builder');
      setToast('Lista clonada. Ya puedes editarla.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'No se pudo clonar la lista pública.');
    }
  };
  const closePublicList = () => {
    window.history.pushState({}, '', '/');
    setPublicListId(null);
    setPublicList(null);
    setPage('home');
  };
  const changeRace = (race: Race) => { if (race !== list.race && !confirmDiscard('Cambiar de raza')) return; setRace(race); };
  const confirmFactionChange = () => {
    const hasDependentSelections = list.tacticalCardIds.length > 0 || list.entries.length > 0 || list.creepCardId !== null;
    return !hasDependentSelections || window.confirm('Cambiar de Carta de Faccion eliminara las unidades y cartas dependientes. Quieres continuar?');
  };

  return <div className="app" data-race={list.race}>
    <header className="topbar app-header no-print"><img className="topbar__logo" src="/logo.png" alt="StarCraft: The Miniatures Game" width={521} height={149} role="button" tabIndex={0} onClick={() => navigateToPage('home', 'Inicio')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigateToPage('home', 'Inicio'); }} /><span className="topbar__title">Listas de ejército</span><nav className="primary-nav" aria-label="Navegación principal"><button className={`primary-nav__item${page === 'home' ? ' primary-nav__item--active' : ''}`} onClick={() => navigateToPage('home', 'Inicio')}>Inicio</button><button className={`primary-nav__item${page === 'lists' ? ' primary-nav__item--active' : ''}`} onClick={() => navigateToPage('lists', 'Mis listas')}>Mis listas</button><button className={`primary-nav__item${page === 'public-lists' ? ' primary-nav__item--active' : ''}`} onClick={() => navigateToPage('public-lists', 'Listas públicas')}>Listas públicas</button><button className={`primary-nav__item${page === 'builder' ? ' primary-nav__item--active' : ''}`} onClick={() => createList()}>Nueva lista</button></nav><div className="topbar__spacer" />{user && <button className={`profile-trigger${page === 'profile' ? ' profile-trigger--active' : ''}`} onClick={() => navigateToPage('profile', 'tu perfil')} aria-label="Abrir perfil"><ProfileAvatar user={user} /><span className="profile-trigger__name">{profileName(user)}</span></button>}<button className="header-logout" onClick={logoutFromApp}>Salir</button></header>
    {page === 'builder' && <>
      <section className="builder-toolbar no-print" aria-label="Opciones de la lista"><div className="field"><label htmlFor="list-name">Nombre</label><input id="list-name" value={list.name} onChange={(event) => setName(event.target.value)} /></div><div className="field"><label htmlFor="race">Raza</label><select id="race" value={list.race} onChange={(event) => changeRace(event.target.value as Race)}>{availableRaces().map((race) => <option key={race} value={race}>{RACE_LABEL[race]}</option>)}</select></div><div className="field"><label htmlFor="scale">Escala</label><select id="scale" value={list.scaleId} onChange={(event) => setScale(event.target.value as ScaleId)}>{index.catalog.scales.map((scale) => <option key={scale.id} value={scale.id}>{scale.name.es}</option>)}</select></div><div className="field"><label htmlFor="minerals">Minerales</label><input id="minerals" type="number" min={100} step={50} value={list.mineralLimit} onChange={(event) => setMineralLimit(Number(event.target.value))} /></div><div className="list-visibility-control list-visibility-control--inline no-print"><span className="list-visibility-control__label">Visibilidad</span><label className="visibility-switch"><input type="checkbox" checked={listIsPublic} onChange={(event) => changeListVisibility(event.target.checked)} /><span className="visibility-switch__track" aria-hidden="true"><span className="visibility-switch__thumb" /></span><span className="visibility-switch__text">{listIsPublic ? 'Pública' : 'Privada'}</span></label></div><div className="builder-toolbar__actions"><button onClick={() => { void saveList(); }}>Guardar</button><button onClick={() => setSeedVisible((visible) => !visible)}>{seedVisible ? 'Cerrar seed' : 'Seed'}</button><label className="button-like">Importar<input type="file" accept="application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void onImportFile(file); event.target.value = ''; }} /></label><button onClick={() => downloadJson(list)}>Exportar</button></div></section>
      <ResourceBar summary={summary} hasErrors={!validation.legal} />
      <nav className="tabs no-print">{STEPS.map((item) => <button key={item.id} className={`tab${step === item.id ? ' tab--active' : ''}`} onClick={() => setStep(item.id)}>{item.label}{errorsByStep[item.id] > 0 && <span className="tab__badge">{errorsByStep[item.id]}</span>}</button>)}</nav>
      {seedVisible && <div className="content content--tool"><SeedPanel onImported={(imported) => { if (!confirmDiscard('Importar una lista desde la seed')) return; setList(imported); setListIsPublic(false); setListVisibilityDirty(false); setRemoteRevision(null); setToast('Lista importada desde seed.'); }} /></div>}
      <main className="content">{step === 'cards' && <StepCommandCards onBeforeFactionChange={confirmFactionChange} />}{step === 'units' && <StepMusterUnits />}{step === 'scenario' && <StepScenario />}{step === 'review' && <StepReview />}</main>
    </>}
    {page === 'home' && <HomePage onCreateRace={createList} onOpenOwn={(remote) => loadList(remote, remote.revision)} onViewPublic={(id) => { void openPublicList(id); }} onClonePublic={(id) => { void clonePublicList(id); }} onViewAllPublic={() => navigateToPage('public-lists', 'Listas públicas')} />}
    {page === 'lists' && <SavedListsPage onCreate={() => createList()} onLoad={loadList} onViewPublic={(id) => { void openPublicList(id); }} />}
    {page === 'public-lists' && <PublicListsPage onViewPublic={(id) => { void openPublicList(id); }} onClonePublic={(id) => { void clonePublicList(id); }} />}
    {page === 'profile' && <AccountPage />}
    {page === 'public-list' && publicList && <PublicListPage list={publicList} onBack={closePublicList} onClone={() => { void clonePublicList(publicList.id); }} />}
    {toast && <div className="toast no-print">{toast}</div>}
    <footer className="auth-page__footer app__footer no-print">Proyecto fanmade no oficial, creado por aficionados. StarCraft y sus elementos relacionados pertenecen a sus respectivos titulares. <a href="/terminos-y-condiciones">Términos y condiciones</a></footer>
  </div>;
}
