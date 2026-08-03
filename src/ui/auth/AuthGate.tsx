import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { requestPasswordReset, requestVerification, resetPassword, verifyEmail } from '@/auth/authService';
import { useAuthStore } from '@/store/authStore';

export function AuthGate({ children }: { children: ReactNode }) {
  const { status, restore, user, developmentVerificationUrl, emailDeliveryWarning } = useAuthStore();
  useEffect(() => { void restore(); }, [restore]);
  if (status === 'checking') return <AuthLoading />;
  if (window.location.pathname === '/verify-email') return <VerifyEmail />;
  if (window.location.pathname === '/reset-password') return <ResetPassword />;
  if (status === 'authenticated') return <>{children}</>;
  if (status === 'unverified') return <UnverifiedEmail email={user?.email ?? ''} warning={emailDeliveryWarning} developmentVerificationUrl={developmentVerificationUrl} />;
  return <AuthForm />;
}

function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="auth-page"><main className="auth-page__main"><img className="auth-page__logo" src="/logo.png" alt="StarCraft: The Miniatures Game" width={521} height={149} /><section className="panel stack auth-page__panel">{children}</section></main><footer className="auth-page__footer">Proyecto fanmade no oficial, creado por aficionados. StarCraft y sus elementos relacionados pertenecen a sus respectivos titulares.</footer></div>;
}

function AuthLoading() {
  return <div className="auth-page auth-page--loading"><main className="auth-page__loading-main"><img className="auth-page__loading-logo" src="/logo.png" alt="StarCraft: The Miniatures Game" width={521} height={149} /></main><footer className="auth-page__footer">Proyecto fanmade no oficial, creado por aficionados. StarCraft y sus elementos relacionados pertenecen a sus respectivos titulares.</footer></div>;
}

function AuthForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login'); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [passwordVisible, setPasswordVisible] = useState(false); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState(false);
  const login = useAuthStore((state) => state.login); const register = useAuthStore((state) => state.register);
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(null); setPending(true); try { if (mode === 'login') await login(email, password); else await register(email, password); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo completar la solicitud.'); } finally { setPending(false); } };
  return <AuthLayout><h1>{mode === 'login' ? 'Iniciar sesion' : 'Crear cuenta'}</h1><form className="stack" onSubmit={submit}><label className="field">Correo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><label className="field">Contrasena<span className="password-field"><input type={passwordVisible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><button type="button" className="password-field__toggle" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? 'Ocultar contrasena' : 'Ver contrasena'} aria-pressed={passwordVisible}>{passwordVisible ? 'Ocultar' : 'Ver'}</button></span></label>{error && <p className="issue issue--error">{error}</p>}<button type="submit" disabled={pending}>{pending ? 'Procesando...' : mode === 'login' ? 'Entrar' : 'Registrarme'}</button></form>{mode === 'login' && <a href="/reset-password">He olvidado mi contrasena</a>}<button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} disabled={pending}>{mode === 'login' ? 'Crear una cuenta' : 'Ya tengo una cuenta'}</button></AuthLayout>;
}

function UnverifiedEmail({ email, warning, developmentVerificationUrl }: { email: string; warning: string | null; developmentVerificationUrl: string | null }) {
  const [message, setMessage] = useState<string | null>(warning); const [pending, setPending] = useState(false);
  const resend = async () => { setPending(true); setMessage(null); try { await requestVerification(email); setMessage('Si la cuenta sigue pendiente, te hemos enviado un nuevo enlace de verificacion.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo solicitar el correo.'); } finally { setPending(false); } };
  return <AuthLayout><h1>Verifica tu correo</h1><p>Abre el enlace de verificacion antes de acceder a la aplicacion.</p>{message && <p className="issue issue--error">{message}</p>}<button onClick={() => { void resend(); }} disabled={pending || !email}>{pending ? 'Solicitando...' : 'Reenviar correo'}</button>{developmentVerificationUrl && <a href={developmentVerificationUrl}>Verificar esta cuenta (desarrollo local)</a>}</AuthLayout>;
}

function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get('token'); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [message, setMessage] = useState<string | null>(null); const [pending, setPending] = useState(false);
  const submitRequest = async (event: FormEvent) => { event.preventDefault(); setPending(true); setMessage(null); try { await requestPasswordReset(email); setMessage('Si existe una cuenta activa con ese correo, recibiras un enlace para restablecer la contrasena.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo solicitar el enlace.'); } finally { setPending(false); } };
  const submitReset = async (event: FormEvent) => { event.preventDefault(); setPending(true); setMessage(null); try { await resetPassword(token!, password); setMessage('Contrasena actualizada. Ya puedes iniciar sesion.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo restablecer la contrasena.'); } finally { setPending(false); } };
  return <AuthLayout><h1>{token ? 'Restablecer contrasena' : 'Recuperar contrasena'}</h1><form className="stack" onSubmit={token ? submitReset : submitRequest}>{token ? <label className="field">Nueva contrasena<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} autoComplete="new-password" required /></label> : <label className="field">Correo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>}{message && <p className="issue">{message}</p>}<button type="submit" disabled={pending}>{pending ? 'Procesando...' : token ? 'Guardar contrasena' : 'Enviar enlace'}</button></form><a href="/">Volver al acceso</a></AuthLayout>;
}

function VerifyEmail() {
  const [message, setMessage] = useState('Verificando correo...');
  useEffect(() => { const token = new URLSearchParams(window.location.search).get('token'); if (!token) { setMessage('El enlace de verificacion no es valido.'); return; } void verifyEmail(token).then(() => setMessage('Correo verificado. Ya puedes iniciar sesion.')).catch((error: Error) => setMessage(error.message)); }, []);
  return <AuthLayout><p>{message}</p><a href="/">Volver al acceso</a></AuthLayout>;
}
