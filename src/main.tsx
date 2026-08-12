import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './i18n/config';
import { LocaleBootstrap } from './i18n/LocaleBootstrap';
import { watchForNewDeployments } from './pwa/deploymentVersion';
import { watchForServiceWorkerUpdates } from './pwa/serviceWorkerUpdates';
import './styles/global.css';
import './styles/design-system.css';
import './ui/page-design.css';
import './ui/builder/builder-design.css';
import './ui/auth/auth-design.css';

const root = document.getElementById('root');
if (!root) throw new Error('Falta el elemento #root en index.html');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <LocaleBootstrap />
      <App />
    </BrowserRouter>
  </StrictMode>,
);

// `autoUpdate` activa la nueva versión y recarga la página. El registro
// explícito permite, además, volver a comprobarla cuando una PWA móvil sale del
// segundo plano sin que el navegador dispare un nuevo evento `load`.
registerSW({
  immediate: true,
  onRegisteredSW: (_serviceWorkerUrl, registration) => {
    if (!registration) return;
    watchForServiceWorkerUpdates(registration);
    // Segunda vía por si el relevo del service worker no llega a producirse.
    watchForNewDeployments(registration, __APP_BUILD_ID__);
  },
});
