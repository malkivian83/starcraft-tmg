import { describe, expect, it, vi } from 'vitest';
import {
  DEPLOYMENT_CHECK_INTERVAL_MS,
  DEPLOYMENT_CHECK_THROTTLE_MS,
  RECOVERY_ATTEMPT_KEY,
  watchForNewDeployments,
} from '@/pwa/deploymentVersion';

const BUILD_ID_EN_EJECUCION = 'compilacion-antigua';

/** Deja correr las promesas pendientes: las comprobaciones son asíncronas. */
const settle = async () => {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
};

function testEnvironment(deployedBuildId: string | null = 'compilacion-nueva') {
  const browserWindow = new EventTarget();
  const browserDocument = new EventTarget();
  const pendingTimeouts = new Map<number, () => void>();
  let nextTimeoutId = 1;
  let now = 0;
  let online = true;
  let visibilityState: DocumentVisibilityState = 'visible';

  const setTimeout = vi.fn((callback: () => void) => {
    const id = nextTimeoutId;
    nextTimeoutId += 1;
    pendingTimeouts.set(id, callback);
    return id;
  });
  const clearTimeout = vi.fn((id: number) => pendingTimeouts.delete(id));
  const setInterval = vi.fn(() => 99);
  const clearInterval = vi.fn();
  Object.assign(browserWindow, { setTimeout, clearTimeout, setInterval, clearInterval });

  Object.defineProperties(browserDocument, {
    visibilityState: { get: () => visibilityState },
  });

  const navigatorMock = {};
  Object.defineProperty(navigatorMock, 'onLine', { get: () => online });

  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ version: '9.9.9', buildId: deployedBuildId }),
  });

  const cacheNames = ['workbox-precache-v2', 'card-images'];
  const caches = {
    keys: vi.fn().mockResolvedValue(cacheNames),
    delete: vi.fn().mockResolvedValue(true),
  };

  const stored = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value); },
  };

  const reload = vi.fn();

  return {
    environment: {
      window: browserWindow as unknown as Window,
      document: browserDocument as unknown as Document,
      navigator: navigatorMock as unknown as Navigator,
      now: () => now,
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      caches: caches as unknown as CacheStorage,
      sessionStorage: sessionStorage as unknown as Storage,
      reload,
    },
    browserWindow,
    browserDocument,
    fetchMock,
    caches,
    stored,
    reload,
    setInterval,
    clearInterval,
    runPendingTimeouts: () => {
      const callbacks = [...pendingTimeouts.values()];
      pendingTimeouts.clear();
      for (const callback of callbacks) callback();
    },
    advanceBy: (milliseconds: number) => { now += milliseconds; },
    setOnline: (value: boolean) => { online = value; },
    setVisibility: (value: DocumentVisibilityState) => { visibilityState = value; },
  };
}

function registration() {
  return {
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
    unregister: vi.fn().mockResolvedValue(true),
  } as unknown as ServiceWorkerRegistration;
}

describe('detección de despliegues nuevos', () => {
  it('no toca nada cuando el servidor sirve la misma compilación', async () => {
    const test = testEnvironment(BUILD_ID_EN_EJECUCION);
    const sw = registration();
    watchForNewDeployments(sw, BUILD_ID_EN_EJECUCION, test.environment);
    await settle();

    expect(test.fetchMock).toHaveBeenCalledWith('/version.json', { cache: 'no-store' });
    expect(sw.update).not.toHaveBeenCalled();
    test.runPendingTimeouts();
    expect(test.reload).not.toHaveBeenCalled();
  });

  it('pide una actualización al service worker cuando la compilación difiere', async () => {
    const test = testEnvironment();
    const sw = registration();
    watchForNewDeployments(sw, BUILD_ID_EN_EJECUCION, test.environment);
    await settle();

    expect(sw.update).toHaveBeenCalledOnce();
    expect(test.reload).not.toHaveBeenCalled();
  });

  it('descarta el service worker atascado si no se hace cargo del relevo', async () => {
    const test = testEnvironment();
    const sw = registration();
    watchForNewDeployments(sw, BUILD_ID_EN_EJECUCION, test.environment);
    await settle();

    test.runPendingTimeouts();
    await settle();

    expect(test.caches.delete).toHaveBeenCalledWith('workbox-precache-v2');
    expect(test.caches.delete).toHaveBeenCalledWith('card-images');
    expect(sw.unregister).toHaveBeenCalledOnce();
    expect(test.reload).toHaveBeenCalledOnce();
  });

  it('no repite la limpieza destructiva dentro de la misma sesión', async () => {
    const test = testEnvironment();
    test.stored.set(RECOVERY_ATTEMPT_KEY, '1');
    const sw = registration();
    watchForNewDeployments(sw, BUILD_ID_EN_EJECUCION, test.environment);
    await settle();

    test.runPendingTimeouts();
    await settle();

    expect(sw.unregister).not.toHaveBeenCalled();
    expect(test.reload).not.toHaveBeenCalled();
  });

  it('espera al intervalo mínimo y a tener conexión antes de repreguntar', async () => {
    const test = testEnvironment(BUILD_ID_EN_EJECUCION);
    watchForNewDeployments(registration(), BUILD_ID_EN_EJECUCION, test.environment);
    await settle();
    expect(test.fetchMock).toHaveBeenCalledOnce();

    test.browserWindow.dispatchEvent(new Event('focus'));
    await settle();
    expect(test.fetchMock).toHaveBeenCalledOnce();

    test.advanceBy(DEPLOYMENT_CHECK_THROTTLE_MS);
    test.setOnline(false);
    test.browserWindow.dispatchEvent(new Event('focus'));
    await settle();
    expect(test.fetchMock).toHaveBeenCalledOnce();

    test.setOnline(true);
    test.browserDocument.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(test.fetchMock).toHaveBeenCalledTimes(2);
  });

  it('instala la comprobación periódica y permite retirar todos los listeners', async () => {
    const test = testEnvironment(BUILD_ID_EN_EJECUCION);
    const stop = watchForNewDeployments(registration(), BUILD_ID_EN_EJECUCION, test.environment);
    await settle();

    expect(test.setInterval).toHaveBeenCalledWith(expect.any(Function), DEPLOYMENT_CHECK_INTERVAL_MS);

    stop();
    test.advanceBy(DEPLOYMENT_CHECK_THROTTLE_MS);
    test.browserWindow.dispatchEvent(new Event('focus'));
    await settle();

    expect(test.fetchMock).toHaveBeenCalledOnce();
    expect(test.clearInterval).toHaveBeenCalledWith(99);
  });
});
