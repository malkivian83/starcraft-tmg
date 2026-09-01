import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { capabilitiesFor, type AccessMode } from '@/auth/access';
import { availableRaces } from '@/catalog/loader';
import type { Race, ScaleId } from '@/engine/types';
import { encodeSeed } from '@/engine/seed/codec';
import { useListStore } from '@/store/listStore';
import { clearDraft, loadDraft, saveDraft, type DraftScope } from '@/store/draftPersistence';
import { downloadJson, importListFromJson } from '@/store/persistence';
import { clonePublicList as cloneRemotePublicList, loadPublicList, loadRemoteList, saveRemoteList, setListPublic as setRemoteListPublic, type RemoteList } from '@/auth/listService';
import { useAuthStore } from '@/store/authStore';
import { copyToClipboard } from './ui/common/clipboard';
import { decodeSeedForAnyRace } from './ui/common/seedImport';
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
import { ReviewErrorsModal } from './ui/builder/ReviewErrorsModal';
import { StepScenario } from './ui/builder/StepScenario';
import { StepStatistics } from './ui/builder/StepStatistics';
import { PrintSheet } from './ui/print/PrintSheet';
import { formatListAsText } from './ui/print/listText';
import { SupportPage } from './ui/support/SupportPage';
import { FaqPage } from './ui/faq/FaqPage';
import { LanguageSelector } from './ui/common/LanguageSelector';
import { AppVersion } from './ui/common/AppVersion';
import { ChangelogLink } from './ui/common/ChangelogLink';
import { GamePage } from './ui/game/GamePage';
import { PwaNetworkStatus, PwaPrompt } from './pwa/PwaPrompt';
import { CookieConsent } from './privacy/CookieConsent';
import { SeoMetadata } from './seo/SeoMetadata';
import './ui/app.css';
import { findPublicListId, localizedPath, pageFromPath, routeLocale, type LocalizedPage } from './i18n/routing';

type StepId = 'cards' | 'units' | 'scenario' | 'review' | 'stats';
type PageId = 'home' | 'builder' | 'lists' | 'public-lists' | 'games' | 'profile' | 'public-list' | 'support' | 'faqs';
const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'cards', label: 'commandCards' }, { id: 'units', label: 'recruitment' },
  { id: 'scenario', label: 'mission' }, { id: 'review', label: 'review' },
];
const STATS_STEP = { id: 'stats' as const, label: 'statistics' };

export function statisticsAvailable(mode: AccessMode, remoteRevision: number | null): boolean {
  return capabilitiesFor(mode).saveRemoteLists && remoteRevision !== null;
}
const RACE_LABEL: Record<Race, string> = { ZERG: 'Zerg', TERRAN: 'Terran', PROTOSS: 'Protoss' };
const NAV_ICON_THEME: Record<Race, string> = { ZERG: 'organico', TERRAN: 'industrial', PROTOSS: 'cristal' };
const NAV_ITEMS = [
  { page: 'home' as const, key: 'home', icon: 'inicio' },
  { page: 'lists' as const, key: 'lists', icon: 'mis-listas' },
  { page: 'games' as const, key: 'games', icon: 'partidas' },
  { page: 'public-lists' as const, key: 'publicLists', icon: 'listas-publicas' },
  { page: 'builder' as const, key: 'newList', icon: 'nueva-lista' },
  { page: 'faqs' as const, key: 'faqs', icon: null },
  { page: 'support' as const, key: 'support', icon: null },
];
const NAV_ICON_SOURCES = import.meta.glob('./assets/navigation/**/*.svg', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

function NavigationIcon({ race, icon }: { race: Race; icon: string }) {
  const sourcePath = `./assets/navigation/${NAV_ICON_THEME[race]}/${icon}.svg`;
  const dataUri = `data:image/svg+xml,${encodeURIComponent(NAV_ICON_SOURCES[sourcePath] ?? '')}`;
  return <span
    className="primary-nav__icon"
    style={{ backgroundImage: `url("${dataUri}")` }}
    aria-hidden="true"
  />;
}

function MobileNavigation({ page, race, onNavigate, onCreate }: { page: PageId; race: Race; onNavigate: (page: PageId, label: string) => void; onCreate: () => void }) {
  const { t } = useTranslation('navigation');
  const current = NAV_ITEMS.find((item) => item.page === page) ?? NAV_ITEMS[0]!;
  const selectItem = (item: typeof NAV_ITEMS[number], event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.closest('details')?.removeAttribute('open');
    if (item.page === 'builder') onCreate();
    else onNavigate(item.page, t(item.key));
  };
  const marker = (item: typeof NAV_ITEMS[number]) => item.icon ? <NavigationIcon race={race} icon={item.icon} /> : <span className="primary-nav__support-mark" aria-hidden="true">{item.page === 'faqs' ? 'FAQ' : '?'}</span>;
  return <details className="primary-nav__mobile">
    <summary>{marker(current)}<span>{t(current.key)}</span></summary>
    <div className="primary-nav__mobile-menu">
      {NAV_ITEMS.map((item) => <button key={item.page} aria-current={item.page === page ? 'page' : undefined} className={item.page === page ? 'primary-nav__mobile-item--active' : ''} onClick={(event) => selectItem(item, event)}>{marker(item)}<span>{t(item.key)}</span></button>)}
    </div>
  </details>;
}
const publicListPath = () => {
  return findPublicListId(window.location.pathname) ?? (window.location.pathname.match(/^\/public-lists\/([^/]+)$/)?.[1] ?? null);
};

const PAGE_PATHS: Record<Exclude<PageId, 'public-list'>, string> = {
  home: '/',
  builder: '/nueva-lista',
  lists: '/mis-listas',
  'public-lists': '/listas-publicas',
  games: '/partidas',
  profile: '/perfil',
  support: '/soporte',
  faqs: '/faqs',
};

function pathForPage(page: PageId, publicListId?: string | null): string {
  const locale = routeLocale(typeof window === 'undefined' ? '/' : window.location.pathname);
  if (page === 'public-list' && publicListId) return localizedPath('public-list', locale, publicListId);
  return localizedPath(page === 'public-list' ? 'home' : page, locale);
}

export function pageForPathname(pathname: string, publicListId: string | null = null): PageId {
  if (publicListId) return 'public-list';
  const localizedPage = pageFromPath(pathname);
  if (localizedPage === 'public-list') return 'public-list';
  if (localizedPage === 'builder') return 'builder';
  if (localizedPage === 'lists') return 'lists';
  if (localizedPage === 'public-lists') return 'public-lists';
  if (localizedPage === 'games') return 'games';
  if (localizedPage === 'profile') return 'profile';
  if (localizedPage === 'support') return 'support';
  if (localizedPage === 'faqs') return 'faqs';
  if (pathname === PAGE_PATHS.builder) return 'builder';
  if (pathname === PAGE_PATHS.lists) return 'lists';
  if (pathname === PAGE_PATHS['public-lists']) return 'public-lists';
  if (pathname === PAGE_PATHS.games) return 'games';
  if (pathname === PAGE_PATHS.profile) return 'profile';
  if (pathname === PAGE_PATHS.support) return 'support';
  if (pathname === PAGE_PATHS.faqs) return 'faqs';
  return 'home';
}

interface DraftNavigationState {
  preserveGuestDraft?: boolean;
}

export function initialPageFor(mode: AccessMode, preserveGuestDraft: boolean, publicListId: string | null): PageId {
  if (mode === 'guest' || preserveGuestDraft) return 'builder';
  return publicListId ? 'public-list' : 'home';
}

export function App() {
  return <>
    <CookieConsent />
    <PwaPrompt />
    <PwaNetworkStatus />
    <Routes>
      <Route path="/crear-lista" element={<GuestBuilderRoute />} />
      <Route path="/:locale/crear-lista" element={<GuestBuilderRoute />} />
      <Route path="/:locale/create-list" element={<GuestBuilderRoute />} />
      <Route path="/registro" element={<AccountRoute />} />
      <Route path="/:locale/registro" element={<AccountRoute />} />
      <Route path="/:locale/register" element={<AccountRoute />} />
      <Route path="/revisa-tu-correo" element={<AccountRoute />} />
      <Route path="/:locale/revisa-tu-correo" element={<AccountRoute />} />
      <Route path="/:locale/check-your-email" element={<AccountRoute />} />
      <Route path="/soporte" element={<SupportRoute />} />
      <Route path="/:locale/soporte" element={<SupportRoute />} />
      <Route path="/:locale/support" element={<SupportRoute />} />
      <Route path="/faqs" element={<FaqRoute />} />
      <Route path="/:locale/faqs" element={<FaqRoute />} />
      <Route path="/partida" element={<GameRoute />} />
      <Route path="/:locale/partida" element={<GameRoute />} />
      <Route path="/:locale/game" element={<GameRoute />} />
      <Route path="/partidas" element={<GameRoute />} />
      <Route path="/:locale/partidas" element={<GameRoute />} />
      <Route path="/:locale/partidas/nueva" element={<GameRoute />} />
      <Route path="/:locale/games" element={<GameRoute />} />
      <Route path="/:locale/games/new" element={<GameRoute />} />
      <Route path="/:locale/partidas/:id" element={<GameRoute />} />
      <Route path="/:locale/games/:id" element={<GameRoute />} />
      <Route path="*" element={<AccountRoute />} />
    </Routes>
  </>;
}

function GameRoute() {
  const status = useAuthStore((state) => state.status);
  const restore = useAuthStore((state) => state.restore);
  const locale = routeLocale(window.location.pathname);
  const noIndex = isGameSubpage(window.location.pathname);
  useEffect(() => { if (status === 'checking') void restore(); }, [restore, status]);
  const surface = gameRouteSurface(status);
  if (surface === 'loading') return <><SeoMetadata page="games" locale={locale} noIndex={noIndex} /><div className="game-page game-empty">Cargando…</div></>;
  if (surface === 'account-shell') return <AccountRoute />;
  return <><SeoMetadata page="games" locale={locale} noIndex={noIndex} /><GamePage mode="guest" /></>;
}

function isGameSubpage(pathname: string): boolean {
  return /\/(?:partidas|games)\/[^/]+\/?$/.test(pathname);
}

export function gameRouteSurface(status: 'checking' | 'anonymous' | 'unverified' | 'authenticated'): 'loading' | 'account-shell' | 'guest-page' {
  if (status === 'checking') return 'loading';
  return status === 'authenticated' ? 'account-shell' : 'guest-page';
}

function SupportRoute() {
  const { t: tCommon } = useTranslation('common');
  const { t: tNavigation } = useTranslation('navigation');
  const { t: tLegal } = useTranslation('legal');
  const status = useAuthStore((state) => state.status);
  const restore = useAuthStore((state) => state.restore);
  useEffect(() => {
    if (status === 'checking') void restore();
  }, [restore, status]);
  if (status === 'authenticated') return <AccountRoute />;
  const locale = routeLocale(window.location.pathname);
  if (status === 'checking') return <><SeoMetadata page="support" locale={locale} /><div className="support-standalone support-standalone--loading"><img src="/logo.png" alt="StarCraft: The Miniatures Game" /></div></>;
  return <div className="support-standalone">
    <SeoMetadata page="support" locale={locale} />
    <header className="support-standalone__header"><a href={localizedPath('home', locale)} aria-label={tCommon('appName')}><img src="/logo.png" alt="StarCraft: The Miniatures Game" /></a><LanguageSelector /><a className="support-standalone__back" href={localizedPath('home', locale)}>{tNavigation('home')}</a></header>
    <SupportPage user={null} />
    <footer className="auth-page__footer">{tLegal('footer')} <a href={localizedPath('terms', locale)}>{tLegal('terms')}</a> · <ChangelogLink /> · <AppVersion /></footer>
  </div>;
}

function FaqRoute() {
  const { t: tCommon } = useTranslation('common');
  const { t: tNavigation } = useTranslation('navigation');
  const { t: tLegal } = useTranslation('legal');
  const status = useAuthStore((state) => state.status);
  const restore = useAuthStore((state) => state.restore);
  useEffect(() => { if (status === 'checking') void restore(); }, [restore, status]);
  const locale = routeLocale(window.location.pathname);
  if (status === 'authenticated') return <AccountRoute />;
  if (status === 'checking') return <><SeoMetadata page="faqs" locale={locale} /><div className="support-standalone support-standalone--loading"><img src="/logo.png" alt="StarCraft: The Miniatures Game" /></div></>;
  return <div className="support-standalone">
    <SeoMetadata page="faqs" locale={locale} />
    <header className="support-standalone__header"><a href={localizedPath('home', locale)} aria-label={tCommon('appName')}><img src="/logo.png" alt="StarCraft: The Miniatures Game" /></a><LanguageSelector /><a className="support-standalone__back" href={localizedPath('home', locale)}>{tNavigation('home')}</a></header>
    <FaqPage />
    <footer className="auth-page__footer">{tLegal('footer')} <a href={localizedPath('terms', locale)}>{tLegal('terms')}</a> · <ChangelogLink /> · <AppVersion /></footer>
  </div>;
}

function GuestBuilderRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);
  const restore = useAuthStore((state) => state.restore);
  const locale = routeLocale(location.pathname);
  const initialSeed = new URLSearchParams(location.search).get('seed');
  useEffect(() => {
    if (status === 'checking') void restore();
  }, [restore, status]);
  if (status === 'authenticated') return <Navigate to={`${localizedPath('builder', locale)}${location.search}${location.hash}`} replace />;
  return <ArmyBuilderApp
    mode="guest"
    initialSeed={initialSeed}
    onCloseGuestBuilder={() => navigate(localizedPath('home', locale), { replace: true })}
    onRequestAuthentication={() => navigate('/', { state: { preserveGuestDraft: true } satisfies DraftNavigationState })}
  />;
}

function AccountRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);
  const routePage = pageFromPath(location.pathname);
  const locale = routeLocale(location.pathname);
  const resetForRace = useListStore((state) => state.resetForRace);
  const previousStatus = useRef(status);
  const navigationState = location.state as DraftNavigationState | null;
  const preserveGuestDraft = navigationState?.preserveGuestDraft === true;
  const initialSeed = new URLSearchParams(location.search).get('seed');
  const initialListId = new URLSearchParams(location.search).get('list');
  const consumeGuestDraft = useCallback(() => {
    if (!preserveGuestDraft) return;
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, navigate, preserveGuestDraft]);
  useEffect(() => {
    const priorStatus = previousStatus.current;
    previousStatus.current = status;
    if (priorStatus === 'authenticated' && status === 'anonymous') resetForRace('ZERG');
  }, [resetForRace, status]);

  const appOwnsSeo = status === 'authenticated' && !AUTH_GATE_ONLY_PAGES.has(routePage);
  return <>
    {!appOwnsSeo && <SeoMetadata page={routePage} locale={locale} />}
    <AuthGate>
      <ArmyBuilderApp
        mode="account"
        initialSeed={initialSeed}
        initialListId={initialListId}
        preserveDraftOnMount={preserveGuestDraft}
        onDraftClaimed={consumeGuestDraft}
      />
    </AuthGate>
  </>;
}

const AUTH_GATE_ONLY_PAGES = new Set<LocalizedPage>([
  'terms',
  'register',
  'check-email',
  'verify-email',
  'reset-password',
]);

function ArmyBuilderApp({ mode, initialSeed = null, initialListId = null, preserveDraftOnMount = false, onDraftClaimed, onCloseGuestBuilder, onRequestAuthentication }: {
  mode: AccessMode;
  initialSeed?: string | null;
  initialListId?: string | null;
  preserveDraftOnMount?: boolean;
  onDraftClaimed?: () => void;
  onCloseGuestBuilder?: () => void;
  onRequestAuthentication?: () => void;
}) {
  const { t: tBuilder } = useTranslation('builder');
  const { t: tBuilderUi } = useTranslation('builderUi');
  const { t: tPrint } = useTranslation('print');
  const { t: tNavigation } = useTranslation('navigation');
  const { t: tCommon } = useTranslation('common');
  const { t: tLegal } = useTranslation('legal');
  const { t: tPwa } = useTranslation('pwa');
  const locale = routeLocale(typeof window === 'undefined' ? '/' : window.location.pathname);
  const [step, setStep] = useState<StepId>('cards');
  const initialPublicListId = mode === 'account' ? publicListPath() : null;
  const initialPage = mode === 'account' && !preserveDraftOnMount
    ? pageForPathname(window.location.pathname, initialPublicListId)
    : initialPageFor(mode, preserveDraftOnMount, initialPublicListId);
  const [page, setPage] = useState<PageId>(initialPage);
  const [publicList, setPublicList] = useState<RemoteList | null>(null);
  const [publicListId, setPublicListId] = useState<string | null>(initialPublicListId);
  const [listIsPublic, setListIsPublic] = useState(false);
  const [listVisibilityDirty, setListVisibilityDirty] = useState(false);
  const [seedVisible, setSeedVisible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reviewErrorsOpen, setReviewErrorsOpen] = useState(false);
  const reviewTabRef = useRef<HTMLButtonElement>(null);
  const previousReviewVisible = useRef(false);
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
  const capabilities = capabilitiesFor(mode);
  const statsAvailable = statisticsAvailable(mode, remoteRevision);
  const steps = statsAvailable ? [...STEPS, STATS_STEP] : STEPS;
  const draftScope: DraftScope | null = mode === 'account' && user
    ? `account:${user.id}`
    : mode === 'guest'
      ? 'guest'
      : null;
  const hydratedDraftScope = useRef<DraftScope | null>(null);
  const hydratedDirectList = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== 'account' || !initialListId || hydratedDirectList.current === initialListId) return;
    hydratedDirectList.current = initialListId;
    let active = true;
    void loadRemoteList(initialListId)
      .then((loaded) => {
        if (!active) return;
        setList(loaded);
        setListIsPublic(loaded.isPublic);
        setListVisibilityDirty(false);
        setRemoteRevision(loaded.revision);
        markSaved();
        setSeedVisible(false);
        setPublicListId(null);
        setPublicList(null);
        setPage('builder');
        setToast(tBuilder('listLoaded'));
      })
      .catch((error: unknown) => {
        if (!active) return;
        setToast(error instanceof Error ? error.message : tBuilderUi('listSaveError'));
      });
    return () => { active = false; };
  }, [initialListId, markSaved, mode, setList, setRemoteRevision, tBuilder, tBuilderUi]);

  useEffect(() => {
    if (!draftScope || hydratedDraftScope.current === draftScope) return;
    hydratedDraftScope.current = draftScope;
    if (mode === 'account' && initialListId) return;

    // Al pasar del constructor invitado al login se conserva el estado vivo
    // del store; el borrador de invitado se conserva localmente y el de cuenta
    // se mantiene separado por usuario para no mezclar dispositivos/cuentas.
    if (mode === 'account' && preserveDraftOnMount) {
      clearDraft('guest');
      onDraftClaimed?.();
      return;
    }

    const importedSeed = initialSeed ? decodeSeedForAnyRace(initialSeed) : null;
    if (importedSeed?.list) {
      clearDraft('guest');
      setList(importedSeed.list);
      setListIsPublic(false);
      setListVisibilityDirty(false);
      setRemoteRevision(null);
      setSeedVisible(false);
      setToast(importedSeed.status === 'partial'
        ? tBuilderUi('importedPartial', { items: importedSeed.missing.join(', ') })
        : importedSeed.status === 'version_mismatch'
          ? tBuilderUi('importedVersion')
          : tBuilderUi('importedOk'));
      onDraftClaimed?.();
      return;
    }

      const draft = loadDraft(draftScope);
      if (draft) {
        setList(draft.list);
      if (window.location.pathname === pathForPage('home') || window.location.pathname === PAGE_PATHS.home) {
        window.history.replaceState({}, '', pathForPage('builder'));
        setPage('builder');
      }
      setListIsPublic(draft.isPublic);
      setListVisibilityDirty(false);
      setRemoteRevision(draft.remoteRevision);
      setSeedVisible(false);
      setToast(tBuilderUi('draftRecovered', { defaultValue: locale === 'en' ? 'Your list draft was recovered.' : 'Se ha recuperado tu borrador de lista.' }));
    } else if (mode === 'account' && user) {
      resetForRace(user.defaultRace);
      setListIsPublic(false);
      setListVisibilityDirty(false);
    }
    if (initialSeed) setToast(tBuilderUi('invalidSeed'));
    onDraftClaimed?.();
  }, [draftScope, initialListId, initialSeed, mode, onDraftClaimed, preserveDraftOnMount, resetForRace, setList, setRemoteRevision, tBuilderUi, user]);
  useEffect(() => {
    if (!draftScope || hydratedDraftScope.current !== draftScope) return;
    if (isDirty || listVisibilityDirty) saveDraft(draftScope, { list, remoteRevision, isPublic: listIsPublic });
    else clearDraft(draftScope);
  }, [draftScope, isDirty, list, listIsPublic, listVisibilityDirty, remoteRevision]);
  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty && !listVisibilityDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty, listVisibilityDirty]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 2600); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (mode !== 'account' || !publicListId) return;
    let active = true;
    void loadPublicList(publicListId)
      .then((loaded) => { if (active) setPublicList(loaded); })
      .catch((error: unknown) => {
        if (!active) return;
        setToast(error instanceof Error ? error.message : tBuilderUi('listSaveError'));
        window.history.replaceState({}, '', pathForPage('home'));
        setPublicListId(null);
        setPage('home');
      });
    return () => { active = false; };
  }, [mode, publicListId]);
  useEffect(() => {
    if (mode !== 'account') return;
    const onPopState = () => {
      const id = publicListPath();
      setPublicListId(id);
      setPage(pageForPathname(window.location.pathname, id));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [mode]);
  useEffect(() => {
    if (!statsAvailable && step === 'stats') setStep('cards');
  }, [statsAvailable, step]);
  const reviewVisible = page === 'builder' && step === 'review';
  useEffect(() => {
    if (!reviewVisible) {
      if (reviewErrorsOpen) setReviewErrorsOpen(false);
      previousReviewVisible.current = false;
      return;
    }
    if (reviewErrorsOpen && validation.errors.length === 0) {
      setReviewErrorsOpen(false);
      return;
    }
    const enteredReview = !previousReviewVisible.current && reviewVisible;
    previousReviewVisible.current = reviewVisible;
    if (enteredReview && validation.errors.length > 0) setReviewErrorsOpen(true);
  }, [reviewVisible, reviewErrorsOpen, validation.errors.length]);
  const closeReviewErrors = useCallback(() => {
    setReviewErrorsOpen(false);
    const restoreFocus = () => reviewTabRef.current?.focus();
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(restoreFocus);
    else restoreFocus();
  }, []);
  const errorsByStep: Record<StepId, number> = {
    cards: validation.errors.filter((error) => ['R0', 'R2', 'R7', 'R11'].includes(error.rule)).length,
    units: validation.errors.filter((error) => ['R1', 'R3', 'R4', 'R6', 'R8', 'R9', 'R10'].includes(error.rule)).length,
    scenario: validation.errors.filter((error) => error.rule === 'R12').length, review: 0, stats: 0,
  };
  const confirmDiscard = (action: string) => (!isDirty && !listVisibilityDirty) || window.confirm(tBuilderUi('discardConfirm', { action }));
  const changeListVisibility = (isPublic: boolean) => { setListIsPublic(isPublic); setListVisibilityDirty(true); };
  const navigateToPage = (nextPage: PageId, destination: string) => {
    if (page === nextPage) return;
    if (page === 'builder' && !confirmDiscard(locale === 'en' ? `Go to “${destination}”` : `Ir a la sección «${destination}»`)) return;
    const nextPath = pathForPage(nextPage);
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);
    setPublicListId(null);
    setPublicList(null);
    setPage(nextPage);
  };
  const logoutFromApp = () => {
    if (!confirmDiscard(tBuilderUi('logout'))) return;
    void logout();
  };
  const createList = (requestedRace?: unknown) => { const race: Race = requestedRace === 'ZERG' || requestedRace === 'TERRAN' || requestedRace === 'PROTOSS' ? requestedRace : (user?.defaultRace ?? 'ZERG'); if (!confirmDiscard(tBuilderUi('newList'))) return; resetForRace(race); setListIsPublic(false); setListVisibilityDirty(false); setSeedVisible(false); setPublicListId(null); setPublicList(null); if (window.location.pathname !== pathForPage('builder')) window.history.pushState({}, '', pathForPage('builder')); setPage('builder'); };
  const onImportFile = async (file: File) => {
    if (!confirmDiscard(tBuilderUi('import'))) return;
    const result = importListFromJson(await file.text(), locale);
    if (result.list) {
      setList(result.list);
      setListIsPublic(false);
      setListVisibilityDirty(false);
      setSeedVisible(false);
      setPublicListId(null);
      setPublicList(null);
      if (mode === 'account' && window.location.pathname !== pathForPage('builder')) window.history.pushState({}, '', pathForPage('builder'));
      setPage('builder');
      setToast(tBuilderUi('imported'));
    } else setToast(result.error ?? tBuilderUi('listSaveError'));
  };
  const copyListAsText = async () => {
    try {
      const seed = encodeSeed(list, index);
      const shareUrl = new URL(localizedPath('guest-builder', locale), window.location.origin);
      shareUrl.searchParams.set('seed', seed);
      await copyToClipboard(formatListAsText({ list, index, summary, validation }, tPrint, locale, { url: shareUrl.toString() }));
      setToast(tBuilderUi('textCopied'));
    } catch {
      setToast(tBuilderUi('textCopyError'));
    }
  };
  const saveList = async () => {
    if (!capabilities.saveRemoteLists) {
      onRequestAuthentication?.();
      return;
    }
    try {
      const saved = await saveRemoteList(list, remoteRevision);
      const visible = saved.isPublic === listIsPublic ? saved : await setRemoteListPublic(saved.id, listIsPublic);
      setListIsPublic(visible.isPublic);
      setListVisibilityDirty(false);
      setRemoteRevision(visible.revision);
      markSaved();
      setToast(tBuilder('listSaved'));
    } catch (error) { setToast(error instanceof Error ? error.message : tBuilderUi('listSaveError')); }
  };
  const loadList = (loaded: typeof list, revision: number) => { if (!confirmDiscard(tBuilderUi('loadList'))) return; setList(loaded); setListIsPublic(Boolean((loaded as Partial<RemoteList>).isPublic)); setListVisibilityDirty(false); setRemoteRevision(revision); markSaved(); setSeedVisible(false); setPublicListId(null); setPublicList(null); if (window.location.pathname !== pathForPage('builder')) window.history.pushState({}, '', pathForPage('builder')); setPage('builder'); setToast(tBuilder('listLoaded')); };
  const openPublicList = async (id: string) => {
    if (!confirmDiscard(tBuilderUi('openPublic'))) return;
    try {
      const loaded = await loadPublicList(id);
      setPublicList(loaded);
      setPublicListId(id);
      window.history.pushState({}, '', pathForPage('public-list', id));
      setPage('public-list');
    } catch (error) {
      setToast(error instanceof Error ? error.message : tBuilderUi('listSaveError'));
    }
  };
  const clonePublicList = async (id: string) => {
    if (!confirmDiscard(tBuilderUi('clonePublic'))) return;
    try {
      const cloned = await cloneRemotePublicList(id);
      setList(cloned);
      setListIsPublic(false);
      setListVisibilityDirty(false);
      setRemoteRevision(cloned.revision);
      markSaved();
      setPublicListId(null);
      setPublicList(null);
      if (window.location.pathname !== pathForPage('builder')) window.history.pushState({}, '', pathForPage('builder'));
      setPage('builder');
      setToast(tBuilder('listCloned'));
    } catch (error) {
      setToast(error instanceof Error ? error.message : tBuilderUi('listSaveError'));
    }
  };
  const closePublicList = () => {
    window.history.pushState({}, '', pathForPage('home'));
    setPublicListId(null);
    setPublicList(null);
    setPage('home');
  };
  const changeRace = (race: Race) => { if (race !== list.race && !confirmDiscard(tBuilderUi('changeRace'))) return; setRace(race); };
  const confirmFactionChange = () => {
    const hasDependentSelections = list.tacticalCardIds.length > 0 || list.entries.length > 0 || list.creepCardId !== null;
    return !hasDependentSelections || window.confirm(tBuilderUi('factionChangeConfirm'));
  };

  return (
    <div className={`app${reviewErrorsOpen ? ' app--modal-open' : ''}`} data-race={list.race}>
      <SeoMetadata page={mode === 'guest' ? 'guest-builder' : page} locale={locale} noIndex={page === 'games' && isGameSubpage(window.location.pathname)} />
      <header className="topbar app-header no-print">
        {mode === 'account' ? (
          <button
            type="button"
            className="topbar__brand"
            aria-label={tCommon('appName')}
            onClick={() => navigateToPage('home', tNavigation('home'))}
          >
            <img className="topbar__logo" src="/logo.png" alt="" width={521} height={149} />
            <span className="topbar__title">{tCommon('appName')}</span>
          </button>
        ) : (
          <div className="topbar__brand">
            <img className="topbar__logo" src="/logo.png" alt="StarCraft: The Miniatures Game" width={521} height={149} />
            <span className="topbar__title">{tCommon('appName')}</span>
          </div>
        )}
        <nav className="primary-nav" aria-label={tNavigation('main')}>
          {mode === 'guest' ? (
            <button className="primary-nav__item" onClick={onCloseGuestBuilder}>{tCommon('close')}</button>
          ) : (
            <>
            <div className="primary-nav__buttons">
              <button aria-current={page === 'home' ? 'page' : undefined} className={`primary-nav__item${page === 'home' ? ' primary-nav__item--active' : ''}`} onClick={() => navigateToPage('home', tNavigation('home'))}><NavigationIcon race={list.race} icon="inicio" />{tNavigation('home')}</button>
              <button aria-current={page === 'lists' ? 'page' : undefined} className={`primary-nav__item${page === 'lists' ? ' primary-nav__item--active' : ''}`} onClick={() => navigateToPage('lists', tNavigation('lists'))}><NavigationIcon race={list.race} icon="mis-listas" />{tNavigation('lists')}</button>
              <button aria-current={page === 'games' ? 'page' : undefined} className={`primary-nav__item${page === 'games' ? ' primary-nav__item--active' : ''}`} onClick={() => navigateToPage('games', tNavigation('games'))}><NavigationIcon race={list.race} icon="partidas" />{tNavigation('games')}</button>
              <button aria-current={page === 'public-lists' ? 'page' : undefined} className={`primary-nav__item${page === 'public-lists' ? ' primary-nav__item--active' : ''}`} onClick={() => navigateToPage('public-lists', tNavigation('publicLists'))}><NavigationIcon race={list.race} icon="listas-publicas" />{tNavigation('publicLists')}</button>
              <button aria-current={page === 'builder' ? 'page' : undefined} className={`primary-nav__item${page === 'builder' ? ' primary-nav__item--active' : ''}`} onClick={() => createList()}><NavigationIcon race={list.race} icon="nueva-lista" />{tNavigation('newList')}</button>
              <button aria-current={page === 'faqs' ? 'page' : undefined} className={`primary-nav__item${page === 'faqs' ? ' primary-nav__item--active' : ''}`} onClick={() => navigateToPage('faqs', tNavigation('faqs'))}><span className="primary-nav__support-mark" aria-hidden="true">FAQ</span>{tNavigation('faqs')}</button>
            </div>
            <span className="primary-nav__divider" aria-hidden="true" />
            <button aria-current={page === 'support' ? 'page' : undefined} className={`primary-nav__support${page === 'support' ? ' primary-nav__support--active' : ''}`} onClick={() => navigateToPage('support', tNavigation('support'))}><span className="primary-nav__support-mark" aria-hidden="true">?</span>{tNavigation('support')}</button>
            <MobileNavigation page={page} race={list.race} onNavigate={navigateToPage} onCreate={() => createList()} />
            <select
              className="primary-nav__select"
              aria-label={tNavigation('main')}
              value={page === 'public-list' ? 'home' : page}
              onChange={(event) => {
                const destination = event.target.value as PageId;
                if (destination === 'builder') createList();
                else navigateToPage(destination, tNavigation(destination === 'home' ? 'home' : destination === 'lists' ? 'lists' : destination === 'games' ? 'games' : destination === 'public-lists' ? 'publicLists' : destination === 'faqs' ? 'faqs' : 'support'));
              }}
            >
              <option value="home">{tNavigation('home')}</option>
              <option value="lists">{tNavigation('lists')}</option>
              <option value="games">{tNavigation('games')}</option>
              <option value="public-lists">{tNavigation('publicLists')}</option>
              <option value="builder">{tNavigation('newList')}</option>
              <option value="faqs">{tNavigation('faqs')}</option>
              <option value="support">{tNavigation('support')}</option>
            </select>
            </>
          )}
        </nav>
        <div className="topbar__spacer" />
        <div className="topbar__account">
          {mode === 'guest' && <span className="guest-mode">{tBuilder('guestMode')}</span>}
          {capabilities.manageAccount && user && (
            <button className={`profile-trigger${page === 'profile' ? ' profile-trigger--active' : ''}`} onClick={() => navigateToPage('profile', tNavigation('profile'))} aria-label={tNavigation('openProfile')}>
              <ProfileAvatar user={user} />
              <span className="profile-trigger__name">{profileName(user)}</span>
            </button>
          )}
          {mode === 'account' && <LanguageSelector />}
          {mode === 'account' && <button className="header-logout" onClick={logoutFromApp}>{tNavigation('logout')}</button>}
        </div>
      </header>

      {mode === 'guest' && (
        <aside className="guest-notice no-print" role="status">
          {tPwa('guestDraftMessage')}
        </aside>
      )}

      {page === 'builder' && (
        <>
          <section className="builder-toolbar no-print" aria-label={tBuilderUi('listOptions')}>
            <div className="field">
              <label htmlFor="list-name">{tBuilderUi('name')}</label>
              <input id="list-name" value={list.name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="race">{tBuilderUi('race')}</label>
              <select id="race" value={list.race} onChange={(event) => changeRace(event.target.value as Race)}>
                {availableRaces().map((race) => <option key={race} value={race}>{RACE_LABEL[race]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="scale">{tBuilderUi('scale')}</label>
              <select id="scale" value={list.scaleId} onChange={(event) => setScale(event.target.value as ScaleId)}>
                {index.catalog.scales.map((scale) => <option key={scale.id} value={scale.id}>{scale.name[locale]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="minerals">{tBuilderUi('minerals')}</label>
              <input id="minerals" type="number" min={100} step={50} value={list.mineralLimit} onChange={(event) => setMineralLimit(Number(event.target.value))} />
            </div>
            {capabilities.saveRemoteLists && (
              <div className="list-visibility-control list-visibility-control--inline no-print">
                <span className="list-visibility-control__label">{tBuilderUi('visibility')}</span>
                <label className="visibility-switch">
                  <input type="checkbox" checked={listIsPublic} onChange={(event) => changeListVisibility(event.target.checked)} />
                  <span className="visibility-switch__track" aria-hidden="true"><span className="visibility-switch__thumb" /></span>
                  <span className="visibility-switch__text">{listIsPublic ? tBuilderUi('public') : tBuilderUi('private')}</span>
                </label>
              </div>
            )}
            <div className="builder-toolbar__actions">
              <button onClick={() => { void saveList(); }}>{capabilities.saveRemoteLists ? tBuilder('save') : tBuilder('signInToSave')}</button>
              {capabilities.usePortableFormats && (
                <>
                  <button onClick={() => setSeedVisible((visible) => !visible)}>{seedVisible ? tBuilderUi('closeSeed') : tBuilderUi('seed')}</button>
                  <label className="button-like builder-toolbar__portable-action">
                    {tBuilderUi('import')}
                    <input type="file" accept="application/json" hidden onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void onImportFile(file);
                      event.target.value = '';
                    }} />
                  </label>
                  <button className="builder-toolbar__portable-action" onClick={() => downloadJson(list)}>{tBuilderUi('export')}</button>
                  <button onClick={() => { void copyListAsText(); }}>{tBuilderUi('copyAsText')}</button>
                  {mode === 'guest' && <button onClick={() => window.print()}>{tBuilderUi('printPdf')}</button>}
                </>
              )}
            </div>
          </section>
          <ResourceBar summary={summary} hasErrors={!validation.legal} />
          <nav className="tabs no-print">
            {steps.map((item) => (
              <button ref={item.id === 'review' ? reviewTabRef : undefined} key={item.id} className={`tab${step === item.id ? ' tab--active' : ''}`} onClick={() => setStep(item.id)}>
                {tBuilder(item.label)}
                {errorsByStep[item.id] > 0 && <span className="tab__badge">{errorsByStep[item.id]}</span>}
              </button>
            ))}
          </nav>
          {seedVisible && (
            <div className="content content--tool no-print">
              <SeedPanel onImported={(imported) => {
                if (!confirmDiscard(tBuilderUi('importSeed'))) return;
                setList(imported);
                setListIsPublic(false);
                setListVisibilityDirty(false);
                setRemoteRevision(null);
                setToast(tBuilder('seedImported'));
              }} />
            </div>
          )}
          <main className="content no-print">
            {step === 'cards' && <StepCommandCards onBeforeFactionChange={confirmFactionChange} />}
            {step === 'units' && <StepMusterUnits />}
            {step === 'scenario' && <StepScenario />}
            {step === 'review' && <StepReview />}
            {step === 'stats' && statsAvailable && <StepStatistics listId={list.id} />}
          </main>
          {reviewErrorsOpen && reviewVisible && (
            <ReviewErrorsModal
              errors={validation.errors}
              list={list}
              index={index}
              onClose={closeReviewErrors}
            />
          )}
          <div className={`content print-sheet-host${step === 'review' ? ' print-sheet-host--preview' : ''}`}>
            <PrintSheet />
          </div>
        </>
      )}

      {mode === 'account' && page === 'home' && <HomePage onCreateRace={createList} onOpenOwn={(remote) => loadList(remote, remote.revision)} onViewPublic={(id) => { void openPublicList(id); }} onClonePublic={(id) => { void clonePublicList(id); }} onViewAllPublic={() => navigateToPage('public-lists', tNavigation('publicLists'))} onOpenGames={() => navigateToPage('games', tNavigation('games'))} />}
      {mode === 'account' && page === 'lists' && <SavedListsPage onCreate={() => createList()} onLoad={loadList} onViewPublic={(id) => { void openPublicList(id); }} />}
      {mode === 'account' && page === 'games' && <GamePage mode="account" embedded />}
      {mode === 'account' && page === 'public-lists' && <PublicListsPage onViewPublic={(id) => { void openPublicList(id); }} onClonePublic={(id) => { void clonePublicList(id); }} />}
      {mode === 'account' && page === 'support' && <SupportPage user={user} />}
      {mode === 'account' && page === 'faqs' && <FaqPage />}
      {mode === 'account' && page === 'profile' && <AccountPage />}
      {mode === 'account' && page === 'public-list' && publicList && <PublicListPage list={publicList} onBack={closePublicList} onClone={() => { void clonePublicList(publicList.id); }} />}
      {toast && <div className="toast no-print">{toast}</div>}
      <footer className="auth-page__footer app__footer no-print">{tLegal('footer')} <a href={localizedPath('faqs', locale)}>{tNavigation('faqs')}</a> · <a href={localizedPath('support', locale)}>{tNavigation('support')}</a> · <a href={localizedPath('terms', locale)}>{tLegal('terms')}</a> · <ChangelogLink /> · <AppVersion /></footer>
    </div>
  );
}
