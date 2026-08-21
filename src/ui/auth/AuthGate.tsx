import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ApiError, requestPasswordReset, requestVerification, resetPassword, verifyEmail } from '@/auth/authService';
import { googleSignInEnabled } from '@/auth/googleIdentity';
import { useAuthStore } from '@/store/authStore';
import { GoogleSignInButton } from './GoogleSignInButton';
import { TermsPage } from './TermsPage';
import { localizedPath, pageFromPath, routeLocale } from '@/i18n/routing';
import { LanguageSelector } from '../common/LanguageSelector';
import { AppVersion } from '../common/AppVersion';

export function AuthGate({ children }: { children: ReactNode }) {
  const { status, restore, user, developmentVerificationUrl, emailDeliveryWarning } = useAuthStore();
  useEffect(() => { void restore(); }, [restore]);
  const refreshSession = useAuthStore((state) => state.refreshSession);
  useEffect(() => {
    if (status !== 'authenticated') return undefined;

    const refresh = () => {
      void refreshSession().catch((error) => {
        if (error instanceof ApiError && error.status === 401) void restore();
      });
    };
    const onVisibilityChange = () => {
      if (!document.hidden) refresh();
    };
    const interval = window.setInterval(refresh, 5 * 60 * 1000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshSession, restore, status]);
  if (pageFromPath(window.location.pathname) === 'terms') return <TermsPage />;
  if (status === 'checking') return <AuthLoading />;
  if (pageFromPath(window.location.pathname) === 'verify-email') return <VerifyEmail />;
  if (pageFromPath(window.location.pathname) === 'reset-password') return <ResetPassword />;
  if (status === 'authenticated') return <>{children}</>;
  if (status === 'unverified') return <UnverifiedEmail email={user?.email ?? ''} warning={emailDeliveryWarning} developmentVerificationUrl={developmentVerificationUrl} />;
  return <AuthForm />;
}

function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthShell mainClassName="auth-page__main--compact"><section className="panel stack auth-page__panel auth-page__panel--single">{children}</section></AuthShell>;
}

function AuthShell({ children, mainClassName = '' }: { children: ReactNode; mainClassName?: string }) {
  return <div className="auth-page"><main className={`auth-page__main ${mainClassName}`.trim()}><div className="auth-page__locale"><LanguageSelector /></div><AuthBrand />{children}</main><AuthFooter /></div>;
}

function AuthBrand() {
  return <header className="auth-page__brand"><img className="auth-page__logo" src="/logo.png" alt="StarCraft: The Miniatures Game" width={521} height={149} /><span className="auth-page__brand-line" aria-hidden="true" /></header>;
}

function AuthLoading() {
  const { t } = useTranslation('common');
  return <AuthShell mainClassName="auth-page__main--loading"><span className="sr-only" role="status">{t('loading')}</span></AuthShell>;
}

function AuthFooter() {
  const { t: tLegal } = useTranslation('legal');
  const { t: tNavigation } = useTranslation('navigation');
  const locale = routeLocale(window.location.pathname);
  return <footer className="auth-page__footer"><span>{tLegal('footer')}</span><span className="auth-page__footer-links"><a href={localizedPath('support', locale)}>{tNavigation('support')}</a><span aria-hidden="true">·</span><a href={localizedPath('terms', locale)}>{tLegal('terms')}</a><span aria-hidden="true">·</span><AppVersion /></span></footer>;
}

export function AuthModeTabs({ mode, onSelect, loginLabel, registerLabel, accessModeLabel, disabled }: {
  mode: 'login' | 'register';
  onSelect: (mode: 'login' | 'register') => void;
  loginLabel: string;
  registerLabel: string;
  accessModeLabel: string;
  disabled: boolean;
}) {
  return <div className="auth-page__mode-tabs" role="tablist" aria-label={accessModeLabel}>
    <button type="button" role="tab" aria-selected={mode === 'login'} aria-controls="auth-form" className="auth-mode-tab" onClick={() => onSelect('login')} disabled={disabled}>{loginLabel}</button>
    <button type="button" role="tab" aria-selected={mode === 'register'} aria-controls="auth-form" className="auth-mode-tab" onClick={() => onSelect('register')} disabled={disabled}>{registerLabel}</button>
  </div>;
}

function AuthForm() {
  const { t } = useTranslation('auth');
  const locale = routeLocale(window.location.pathname);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const selectMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === 'register' && !termsAccepted) {
      setError(t('termsRequired'));
      return;
    }
    setError(null);
    setPending(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('genericError'));
    } finally {
      setPending(false);
    }
  };

  const enterWithGoogle = async (credential: string) => {
    if (mode === 'register' && !termsAccepted) {
      setError(t('termsRequired'));
      return;
    }
    setError(null);
    setPending(true);
    try {
      await loginWithGoogle(credential, mode === 'register');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('googleError'));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell mainClassName="auth-page__main--split">
      <div className="auth-page__panels">
        <section className="panel stack auth-page__panel auth-page__panel--account">
          <h1>{mode === 'login' ? t('login') : t('register')}</h1>
          <form id="auth-form" className="stack auth-form" onSubmit={submit}>
            <label className="field">
              {t('email')}
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
            </label>
            <label className="field">
              {t('password')}
              <span className="password-field">
                <input type={passwordVisible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" className="password-field__toggle" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? t('hidePassword') : t('showPassword')} aria-pressed={passwordVisible}>{passwordVisible ? t('hidePassword') : t('showPassword')}</button>
              </span>
            </label>
            {mode === 'register' && (
              <label className="terms-check">
                <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required />
                <span>{t('acceptTermsPrefix')} <a href={localizedPath('terms', locale)}>{t('acceptTermsLink')}</a>.</span>
              </label>
            )}
            {error && <p className="issue issue--error">{error}</p>}
            <button className="auth-action auth-action--primary" type="submit" disabled={pending}>{pending ? t('processing') : mode === 'login' ? t('enter') : t('registerAction')}</button>
          </form>
          {googleSignInEnabled && <><p className="auth-separator">{t('or')}</p><GoogleSignInButton text={mode === 'login' ? 'signin_with' : 'signup_with'} onCredential={(credential) => { void enterWithGoogle(credential); }} locale={locale} /><p className="muted small">{t('googleNote')}</p></>}
          <div className="auth-page__account-links">
            {mode === 'login' && <a href={localizedPath('reset-password', locale)}> {t('forgotPassword')}</a>}
            <AuthModeTabs mode={mode} onSelect={selectMode} loginLabel={t('login')} registerLabel={t('register')} accessModeLabel={t('accessMode')} disabled={pending} />
          </div>
        </section>

        <section className="panel stack auth-page__panel auth-page__panel--guest" aria-labelledby="guest-panel-title">
          <p className="auth-panel__eyebrow">{t('noAccount')}</p>
          <h2 id="guest-panel-title">{t('guestTitle')}</h2>
          <p className="muted">{t('guestDescription')}</p>
          <Link className="auth-guest-button" to={localizedPath('guest-builder', locale)}>
            <span className="auth-guest-button__label">{t('openBuilder')}</span>
            <span className="auth-guest-button__hint">{t('loginLater')}</span>
          </Link>
        </section>
      </div>
    </AuthShell>
  );
}

function UnverifiedEmail({ email, warning, developmentVerificationUrl }: { email: string; warning: string | null; developmentVerificationUrl: string | null }) {
  const { t } = useTranslation('auth');
  const locale = routeLocale(window.location.pathname);
  const [message, setMessage] = useState<string | null>(warning); const [pending, setPending] = useState(false);
  const resend = async () => { setPending(true); setMessage(null); try { await requestVerification(email, locale); setMessage(t('resendConfirmation')); } catch (error) { setMessage(error instanceof Error ? error.message : t('genericError')); } finally { setPending(false); } };
  return <AuthLayout><h1>{t('verifyTitle')}</h1><p>{t('verifyMessage')}</p>{message && <p className="issue issue--error">{message}</p>}<button className="auth-action auth-action--primary" onClick={() => { void resend(); }} disabled={pending || !email}>{pending ? t('requesting') : t('resend')}</button>{developmentVerificationUrl && <a href={developmentVerificationUrl}>{t('verifyLocal')}</a>}</AuthLayout>;
}

function ResetPassword() {
  const { t } = useTranslation('auth');
  const locale = routeLocale(window.location.pathname);
  const token = new URLSearchParams(window.location.search).get('token'); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [message, setMessage] = useState<string | null>(null); const [pending, setPending] = useState(false);
  const submitRequest = async (event: FormEvent) => { event.preventDefault(); setPending(true); setMessage(null); try { await requestPasswordReset(email, locale); setMessage(t('resetRequestConfirmation')); } catch (error) { setMessage(error instanceof Error ? error.message : t('genericError')); } finally { setPending(false); } };
  const submitReset = async (event: FormEvent) => { event.preventDefault(); setPending(true); setMessage(null); try { await resetPassword(token!, password); setMessage(t('passwordUpdated')); } catch (error) { setMessage(error instanceof Error ? error.message : t('genericError')); } finally { setPending(false); } };
  return <AuthLayout><h1>{token ? t('resetTitle') : t('recoverTitle')}</h1><form className="stack auth-form" onSubmit={token ? submitReset : submitRequest}>{token ? <label className="field">{t('newPassword')}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} autoComplete="new-password" required /></label> : <label className="field">{t('email')}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>}{message && <p className="issue">{message}</p>}<button className="auth-action auth-action--primary" type="submit" disabled={pending}>{pending ? t('processing') : token ? t('savePassword') : t('sendLink')}</button></form><a href={localizedPath('home', locale)}>{t('backToAccess')}</a></AuthLayout>;
}

function VerifyEmail() {
  const { t } = useTranslation('auth');
  const locale = routeLocale(window.location.pathname);
  const [message, setMessage] = useState(t('verifying'));
  useEffect(() => { const token = new URLSearchParams(window.location.search).get('token'); if (!token) { setMessage(t('invalidVerification')); return; } void verifyEmail(token).then(() => setMessage(t('emailVerified'))).catch((error: Error) => setMessage(error.message)); }, [t]);
  return <AuthLayout><p>{message}</p><a href={localizedPath('home', locale)}>{t('backToAccess')}</a></AuthLayout>;
}
