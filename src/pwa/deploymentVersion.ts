export const DEPLOYMENT_CHECK_THROTTLE_MS = 60 * 1000;
export const DEPLOYMENT_CHECK_INTERVAL_MS = 15 * 60 * 1000;
export const SERVICE_WORKER_GRACE_MS = 10 * 1000;
export const RECOVERY_ATTEMPT_KEY = 'starcraft-tmg:recuperacion-de-version';

export const BUILD_MANIFEST_URL = '/version.json';

type DeploymentEnvironment = {
  window: Window;
  document: Document;
  navigator: Navigator;
  now: () => number;
  fetch: typeof globalThis.fetch;
  caches: CacheStorage | null;
  sessionStorage: Storage | null;
  reload: () => void;
};

const browserEnvironment = (): DeploymentEnvironment => ({
  window,
  document,
  navigator,
  now: Date.now,
  fetch: globalThis.fetch.bind(globalThis),
  caches: 'caches' in window ? window.caches : null,
  // Safari en navegación privada lanza al tocar `sessionStorage`.
  sessionStorage: readSessionStorage(),
  reload: () => window.location.reload(),
});

function readSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Detecta que el servidor tiene una compilación distinta de la que se está
 * ejecutando y fuerza el relevo.
 *
 * `registerType: 'autoUpdate'` ya recarga la página cuando el service worker se
 * actualiza, pero ese camino depende de que el navegador consiga descargar un
 * `sw.js` nuevo. Cuando no puede —una redirección en el script del worker, una
 * respuesta cacheada por un intermediario, o iOS suspendiendo la PWA durante
 * semanas— la instalación se queda servida desde su propio precacheo y no
 * vuelve a mirar la red por sí sola.
 *
 * `version.json` se pide siempre a la red y no forma parte del precacheo, así
 * que sirve de segunda opinión: si el identificador no coincide con el del
 * bundle en ejecución, se pide una actualización al service worker y, si no se
 * hace cargo, se vacía su caché y se retira para que la recarga vaya a la red.
 */
export function watchForNewDeployments(
  registration: ServiceWorkerRegistration,
  currentBuildId: string,
  environment: DeploymentEnvironment = browserEnvironment(),
): () => void {
  const { window: browserWindow, document: browserDocument } = environment;
  let lastCheckAt = Number.NEGATIVE_INFINITY;
  let checkInProgress = false;
  let recoveryTimeoutId: number | undefined;

  const readDeployedBuildId = async (): Promise<string | null> => {
    try {
      const response = await environment.fetch(BUILD_MANIFEST_URL, { cache: 'no-store' });
      if (!response.ok) return null;
      const manifest: unknown = await response.json();
      const buildId = (manifest as { buildId?: unknown })?.buildId;
      return typeof buildId === 'string' ? buildId : null;
    } catch {
      return null;
    }
  };

  /*
   * Vaciar la caché y desregistrar es destructivo, así que se hace una sola vez
   * por pestaña: si tras la recarga el desajuste siguiera ahí, repetirlo dejaría
   * la app en un bucle de recargas en lugar de mostrar algo.
   */
  const recoveryAlreadyAttempted = (): boolean => {
    const storage = environment.sessionStorage;
    if (!storage) return false;
    try {
      if (storage.getItem(RECOVERY_ATTEMPT_KEY)) return true;
      storage.setItem(RECOVERY_ATTEMPT_KEY, String(environment.now()));
      return false;
    } catch {
      return false;
    }
  };

  const discardStaleServiceWorker = async (): Promise<void> => {
    if (recoveryAlreadyAttempted()) return;

    const cacheStorage = environment.caches;
    if (cacheStorage) {
      const names = await cacheStorage.keys().catch(() => [] as string[]);
      await Promise.all(names.map((name) => cacheStorage.delete(name).catch(() => false)));
    }
    await registration.unregister().catch(() => undefined);
    environment.reload();
  };

  const scheduleRecovery = () => {
    if (recoveryTimeoutId !== undefined) return;
    recoveryTimeoutId = browserWindow.setTimeout(() => {
      recoveryTimeoutId = undefined;
      void discardStaleServiceWorker();
    }, SERVICE_WORKER_GRACE_MS);
  };

  const checkForNewDeployment = () => {
    const moment = environment.now();
    if (
      checkInProgress ||
      !environment.navigator.onLine ||
      moment - lastCheckAt < DEPLOYMENT_CHECK_THROTTLE_MS
    ) {
      return;
    }

    lastCheckAt = moment;
    checkInProgress = true;
    void (async () => {
      try {
        const deployedBuildId = await readDeployedBuildId();
        if (!deployedBuildId || deployedBuildId === currentBuildId) return;

        // El camino normal: el worker nuevo se activa y `autoUpdate` recarga.
        await registration.update().catch(() => undefined);
        scheduleRecovery();
      } finally {
        checkInProgress = false;
      }
    })();
  };

  const checkWhenVisible = () => {
    if (browserDocument.visibilityState === 'visible') checkForNewDeployment();
  };

  browserWindow.addEventListener('focus', checkForNewDeployment);
  browserWindow.addEventListener('pageshow', checkForNewDeployment);
  browserWindow.addEventListener('online', checkForNewDeployment);
  browserDocument.addEventListener('visibilitychange', checkWhenVisible);
  const intervalId = browserWindow.setInterval(checkForNewDeployment, DEPLOYMENT_CHECK_INTERVAL_MS);

  checkForNewDeployment();

  return () => {
    browserWindow.removeEventListener('focus', checkForNewDeployment);
    browserWindow.removeEventListener('pageshow', checkForNewDeployment);
    browserWindow.removeEventListener('online', checkForNewDeployment);
    browserDocument.removeEventListener('visibilitychange', checkWhenVisible);
    browserWindow.clearInterval(intervalId);
    if (recoveryTimeoutId !== undefined) browserWindow.clearTimeout(recoveryTimeoutId);
  };
}
