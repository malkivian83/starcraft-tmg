import { useCallback, useEffect, useState } from 'react';

const DISMISSED_STORAGE_KEY = 'sctmg-pwa-install-dismissed';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PwaInstallState {
  canInstall: boolean;
  isIos: boolean;
  hasNativePrompt: boolean;
  install: () => Promise<void>;
  dismiss: () => void;
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return Boolean(
    standaloneNavigator.standalone ||
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches,
  );
}

export function isIosUserAgent(userAgent: string, platform = ''): boolean {
  return /iphone|ipad|ipod/i.test(userAgent) || (platform === 'MacIntel' && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
}

export function isMobileInstallDevice(userAgent: string, platform = ''): boolean {
  return isIosUserAgent(userAgent, platform) || /android/i.test(userAgent);
}

function wasDismissed(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(DISMISSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberDismissal(): void {
  try {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, '1');
  } catch {
    // La instalación sigue disponible aunque el almacenamiento esté bloqueado.
  }
}

export function usePwaInstallPrompt(): PwaInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneDisplayMode());
    setDismissed(wasDismissed());
    setIsIos(isIosUserAgent(navigator.userAgent, navigator.platform));
    setIsMobile(isMobileInstallDevice(navigator.userAgent, navigator.platform));

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    rememberDismissal();
    setDismissed(true);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return {
    canInstall: isMobile && !installed && !dismissed,
    isIos,
    hasNativePrompt: Boolean(deferredPrompt),
    install,
    dismiss,
  };
}
