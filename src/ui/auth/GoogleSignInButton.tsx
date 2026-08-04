import { useEffect, useRef, useState } from 'react';
import { googleSignInEnabled, renderGoogleButton } from '@/auth/googleIdentity';

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

/** Botón oficial de Google. No se dibuja nada si el cliente no está configurado. */
export function GoogleSignInButton({ onCredential, text = 'continue_with' }: GoogleSignInButtonProps) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  // El callback se lee de una referencia para no volver a dibujar el botón
  // cada vez que el componente padre cambia de estado.
  const callback = useRef(onCredential);
  callback.current = onCredential;

  useEffect(() => {
    if (!googleSignInEnabled || !container.current) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    void renderGoogleButton(container.current, (credential) => callback.current(credential), { text })
      .then((stop) => { if (cancelled) stop(); else dispose = stop; })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message); });
    return () => { cancelled = true; dispose?.(); };
  }, [text]);

  if (!googleSignInEnabled) return null;
  return <div className="google-signin">
    <div className="google-signin__button" ref={container} />
    {error && <p className="issue issue--error">{error}</p>}
  </div>;
}
