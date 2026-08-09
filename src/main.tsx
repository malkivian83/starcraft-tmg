import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './i18n/config';
import { LocaleBootstrap } from './i18n/LocaleBootstrap';
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

// El SW se registra con skipWaiting + clientsClaim: cuando hay versión nueva
// toma el control de inmediato, pero la página ya cargada seguiría mostrando la
// anterior. Recargar al cambiar de controlador aplica la actualización en la
// misma visita en vez de en la siguiente.
if ('serviceWorker' in navigator) {
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return;
    recargando = true;
    window.location.reload();
  });
}
