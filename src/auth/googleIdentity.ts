const GSI_SCRIPT = 'https://accounts.google.com/gsi/client';

export const googleClientId: string | null = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || null;
export const googleSignInEnabled = Boolean(googleClientId);

interface GoogleCredentialResponse { credential?: string }
interface GoogleButtonOptions { theme?: 'outline' | 'filled_blue' | 'filled_black'; size?: 'small' | 'medium' | 'large'; text?: 'signin_with' | 'signup_with' | 'continue_with'; width?: number; locale?: string }
interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void; auto_select?: boolean; cancel_on_tap_outside?: boolean; use_fedcm_for_prompt?: boolean }): void;
      renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
      disableAutoSelect(): void;
    };
  };
}

declare global {
  interface Window { google?: GoogleIdentityApi }
}

let loader: Promise<GoogleIdentityApi> | null = null;

/** Carga el script de Google una sola vez por sesión de página. */
export function loadGoogleIdentity(): Promise<GoogleIdentityApi> {
  if (!googleClientId) return Promise.reject(new Error('El acceso con Google no está configurado.'));
  if (loader) return loader;
  loader = new Promise<GoogleIdentityApi>((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SCRIPT}"]`);
    const script = existing ?? Object.assign(document.createElement('script'), { src: GSI_SCRIPT, async: true, defer: true });
    const fail = () => { loader = null; reject(new Error('No se pudo cargar el acceso con Google.')); };
    script.addEventListener('load', () => window.google?.accounts?.id ? resolve(window.google) : fail());
    script.addEventListener('error', fail);
    if (!existing) document.head.append(script);
  });
  return loader;
}

/**
 * Dibuja el botón oficial dentro de `container` y entrega el token a `onCredential`.
 * Devuelve una función para dejar de atender respuestas cuando el componente
 * desaparece: el script de Google conserva el último callback registrado.
 */
export async function renderGoogleButton(
  container: HTMLElement,
  onCredential: (credential: string) => void,
  options: GoogleButtonOptions = {},
): Promise<() => void> {
  const google = await loadGoogleIdentity();
  let active = true;
  google.accounts.id.initialize({
    client_id: googleClientId!,
    callback: (response) => { if (active && response.credential) onCredential(response.credential); },
    auto_select: false,
    cancel_on_tap_outside: true,
  });
  container.replaceChildren();
  google.accounts.id.renderButton(container, { theme: 'filled_black', size: 'large', text: 'continue_with', locale: 'es', ...options });
  return () => { active = false; };
}
