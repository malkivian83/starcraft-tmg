import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePwaInstallPrompt } from './installPrompt';

export function PwaPrompt() {
  const { t } = useTranslation('pwa');
  const { canInstall, isIos, hasNativePrompt, install, dismiss } = usePwaInstallPrompt();

  if (!canInstall) return null;

  return (
    <aside className="pwa-prompt no-print" role="region" aria-label={t('installTitle')}>
      <div className="pwa-prompt__copy">
        <strong>{t('installTitle')}</strong>
        <span>{t(isIos ? 'iosDescription' : 'installDescription')}</span>
        {isIos && (
          <details className="pwa-prompt__guide">
            <summary>{t('iosInstructions')}</summary>
            <ol>
              <li>{t('iosStepOne')}</li>
              <li>{t('iosStepTwo')}</li>
              <li>{t('iosStepThree')}</li>
            </ol>
          </details>
        )}
        {!isIos && !hasNativePrompt && (
          <details className="pwa-prompt__guide">
            <summary>{t('androidInstructions')}</summary>
            <ol>
              <li>{t('androidStepOne')}</li>
              <li>{t('androidStepTwo')}</li>
              <li>{t('androidStepThree')}</li>
            </ol>
          </details>
        )}
      </div>
      {!isIos && hasNativePrompt && <button type="button" className="pwa-prompt__install" onClick={() => { void install(); }}>{t('installButton')}</button>}
      <button type="button" className="pwa-prompt__dismiss" onClick={dismiss} aria-label={t('dismissInstall')}>×</button>
    </aside>
  );
}

export function PwaNetworkStatus() {
  const { t } = useTranslation('pwa');
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online !== false) return null;
  return <aside className="pwa-network-status no-print" role="status">{t('offlineMessage')}</aside>;
}
