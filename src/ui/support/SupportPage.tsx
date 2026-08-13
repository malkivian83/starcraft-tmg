import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import * as auth from '@/auth/authService';
import type { AuthenticatedUser } from '@/auth/authService';
import { routeLocale } from '@/i18n/routing';
import { localizedPath } from '@/i18n/routing';

export function SupportPage({ user }: { user: AuthenticatedUser | null }) {
  const { t } = useTranslation('support');
  const locale = routeLocale(window.location.pathname);
  const [subject, setSubject] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email ?? '');
  const [message, setMessage] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user?.email) setContactEmail(user.email);
  }, [user?.email]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    if (!termsAccepted) {
      setFeedback({ kind: 'error', text: t('termsRequired') });
      return;
    }
    setPending(true);
    try {
      const result = await auth.createSupport({ subject, contactEmail, message, termsAccepted, locale });
      setSubject('');
      setMessage('');
      setTermsAccepted(false);
      setFeedback({ kind: result.emailDeliveryWarning ? 'error' : 'success', text: result.emailDeliveryWarning ?? t('sent') });
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : t('sendError') });
    } finally {
      setPending(false);
    }
  };

  return <main className="content page-content support-page no-print">
    <section className="page-heading support-page__heading">
      <div><p className="eyebrow">{t('eyebrow')}</p><h1>{t('title')}</h1><p className="muted">{t('description')}</p></div>
      <span className="support-page__aside">{t('emailReply')}</span>
    </section>
    <section className="panel support-form-panel">
      <form className="stack" onSubmit={submit}>
        <div className="settings-grid support-form-grid">
          <label className="field">{t('subject')}<input value={subject} onChange={(event) => setSubject(event.target.value)} required minLength={3} maxLength={160} autoComplete="off" /></label>
          <label className="field">{t('contactEmail')}<input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} required maxLength={254} autoComplete="email" /></label>
        </div>
        <label className="field">{t('message')}<textarea value={message} onChange={(event) => setMessage(event.target.value)} required minLength={10} maxLength={10000} rows={9} placeholder={t('messagePlaceholder')} /></label>
        <label className="terms-check support-terms-check"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required /><span>{t('termsPrefix')} <a href={localizedPath('terms', locale)} target="_blank" rel="noreferrer">{t('termsLink')}</a>.</span></label>
        {feedback && <p className={`issue issue--${feedback.kind === 'error' ? 'error' : 'success'}`} role="status">{feedback.text}</p>}
        <div className="support-form__actions"><button type="submit" disabled={pending}>{pending ? t('sending') : t('submit')}</button></div>
      </form>
    </section>
  </main>;
}
