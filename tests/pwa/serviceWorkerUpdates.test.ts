import { describe, expect, it, vi } from 'vitest';
import {
  PERIODIC_UPDATE_CHECK_MS,
  UPDATE_CHECK_THROTTLE_MS,
  watchForServiceWorkerUpdates,
} from '@/pwa/serviceWorkerUpdates';

function testEnvironment() {
  const browserWindow = new EventTarget();
  const browserDocument = new EventTarget();
  const clearInterval = vi.fn();
  const setInterval = vi.fn(() => 7);
  let now = 0;
  let online = true;
  let visibilityState: DocumentVisibilityState = 'visible';

  Object.assign(browserWindow, { clearInterval, setInterval });
  Object.defineProperties(browserDocument, {
    visibilityState: { get: () => visibilityState },
  });

  const navigatorMock = {};
  Object.defineProperty(navigatorMock, 'onLine', { get: () => online });

  return {
    environment: {
      window: browserWindow as unknown as Window,
      document: browserDocument as unknown as Document,
      navigator: navigatorMock as unknown as Navigator,
      now: () => now,
    },
    browserWindow,
    browserDocument,
    clearInterval,
    setInterval,
    advanceBy: (milliseconds: number) => { now += milliseconds; },
    setOnline: (value: boolean) => { online = value; },
    setVisibility: (value: DocumentVisibilityState) => { visibilityState = value; },
  };
}

function registration(update = vi.fn().mockResolvedValue(undefined)) {
  return {
    installing: null,
    update,
  } as unknown as ServiceWorkerRegistration;
}

describe('actualización de la PWA al reanudarla', () => {
  it('comprueba una versión nueva al recuperar el foco tras el intervalo mínimo', () => {
    const test = testEnvironment();
    const sw = registration();
    watchForServiceWorkerUpdates(sw, test.environment);

    test.browserWindow.dispatchEvent(new Event('focus'));
    expect(sw.update).not.toHaveBeenCalled();

    test.advanceBy(UPDATE_CHECK_THROTTLE_MS);
    test.browserWindow.dispatchEvent(new Event('focus'));
    expect(sw.update).toHaveBeenCalledOnce();
  });

  it('espera a estar visible y con conexión', () => {
    const test = testEnvironment();
    const sw = registration();
    watchForServiceWorkerUpdates(sw, test.environment);
    test.advanceBy(UPDATE_CHECK_THROTTLE_MS);

    test.setVisibility('hidden');
    test.browserDocument.dispatchEvent(new Event('visibilitychange'));
    test.setOnline(false);
    test.browserWindow.dispatchEvent(new Event('pageshow'));
    expect(sw.update).not.toHaveBeenCalled();

    test.setVisibility('visible');
    test.setOnline(true);
    test.browserDocument.dispatchEvent(new Event('visibilitychange'));
    expect(sw.update).toHaveBeenCalledOnce();
  });

  it('instala la comprobación periódica y permite retirar todos los listeners', () => {
    const test = testEnvironment();
    const sw = registration();
    const stop = watchForServiceWorkerUpdates(sw, test.environment);

    expect(test.setInterval).toHaveBeenCalledWith(expect.any(Function), PERIODIC_UPDATE_CHECK_MS);
    stop();
    test.advanceBy(UPDATE_CHECK_THROTTLE_MS);
    test.browserWindow.dispatchEvent(new Event('focus'));

    expect(sw.update).not.toHaveBeenCalled();
    expect(test.clearInterval).toHaveBeenCalledWith(7);
  });
});
