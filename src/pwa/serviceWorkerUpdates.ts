export const UPDATE_CHECK_THROTTLE_MS = 60 * 1000;
export const PERIODIC_UPDATE_CHECK_MS = 60 * 60 * 1000;

type UpdateEnvironment = {
  window: Window;
  document: Document;
  navigator: Navigator;
  now: () => number;
};

const browserEnvironment = (): UpdateEnvironment => ({
  window,
  document,
  navigator,
  now: Date.now,
});

/**
 * Vuelve a comprobar el service worker cuando una PWA instalada recupera el
 * foco. En móvil la ventana suele quedar suspendida en segundo plano, por lo
 * que al abrirla otra vez no se dispara ni `load` ni un nuevo registro.
 */
export function watchForServiceWorkerUpdates(
  registration: ServiceWorkerRegistration,
  environment: UpdateEnvironment = browserEnvironment(),
): () => void {
  const { window: browserWindow, document: browserDocument } = environment;
  let lastCheckAt = environment.now();
  let updateInProgress = false;

  const checkForUpdate = () => {
    const now = environment.now();
    if (
      updateInProgress ||
      registration.installing ||
      !environment.navigator.onLine ||
      now - lastCheckAt < UPDATE_CHECK_THROTTLE_MS
    ) {
      return;
    }

    lastCheckAt = now;
    updateInProgress = true;
    void registration
      .update()
      .catch(() => undefined)
      .finally(() => {
        updateInProgress = false;
      });
  };

  const checkWhenVisible = () => {
    if (browserDocument.visibilityState === 'visible') checkForUpdate();
  };

  browserWindow.addEventListener('focus', checkForUpdate);
  browserWindow.addEventListener('pageshow', checkForUpdate);
  browserWindow.addEventListener('online', checkForUpdate);
  browserDocument.addEventListener('visibilitychange', checkWhenVisible);
  const intervalId = browserWindow.setInterval(checkForUpdate, PERIODIC_UPDATE_CHECK_MS);

  return () => {
    browserWindow.removeEventListener('focus', checkForUpdate);
    browserWindow.removeEventListener('pageshow', checkForUpdate);
    browserWindow.removeEventListener('online', checkForUpdate);
    browserDocument.removeEventListener('visibilitychange', checkWhenVisible);
    browserWindow.clearInterval(intervalId);
  };
}
