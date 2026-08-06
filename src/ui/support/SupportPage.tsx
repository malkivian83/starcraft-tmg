import { useEffect, useState, type FormEvent } from 'react';
import * as auth from '@/auth/authService';
import type { AuthenticatedUser } from '@/auth/authService';

export function SupportPage({ user }: { user: AuthenticatedUser | null }) {
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
      setFeedback({ kind: 'error', text: 'Debes aceptar las condiciones para enviar la solicitud.' });
      return;
    }
    setPending(true);
    try {
      const result = await auth.createSupport({ subject, contactEmail, message, termsAccepted });
      setSubject('');
      setMessage('');
      setTermsAccepted(false);
      setFeedback({ kind: result.emailDeliveryWarning ? 'error' : 'success', text: result.emailDeliveryWarning ?? 'Tu solicitud se ha enviado al equipo de soporte.' });
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo enviar la solicitud.' });
    } finally {
      setPending(false);
    }
  };

  return <main className="content page-content support-page no-print">
    <section className="page-heading support-page__heading">
      <div><p className="eyebrow">Ayuda</p><h1>Soporte</h1><p className="muted">Cuéntanos qué ha ocurrido y revisaremos tu solicitud lo antes posible.</p></div>
      <span className="support-page__aside">Respuesta por correo electrónico</span>
    </section>
    <section className="panel support-form-panel">
      <form className="stack" onSubmit={submit}>
        <div className="settings-grid support-form-grid">
          <label className="field">Asunto<input value={subject} onChange={(event) => setSubject(event.target.value)} required minLength={3} maxLength={160} autoComplete="off" /></label>
          <label className="field">Correo de contacto<input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} required maxLength={254} autoComplete="email" /></label>
        </div>
        <label className="field">Mensaje<textarea value={message} onChange={(event) => setMessage(event.target.value)} required minLength={10} maxLength={10000} rows={9} placeholder="Describe tu consulta con el mayor detalle posible." /></label>
        <label className="terms-check support-terms-check"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required /><span>Acepto los <a href="/terminos-y-condiciones" target="_blank" rel="noreferrer">términos y condiciones de uso</a>.</span></label>
        {feedback && <p className={`issue issue--${feedback.kind === 'error' ? 'error' : 'success'}`} role="status">{feedback.text}</p>}
        <div className="support-form__actions"><button type="submit" disabled={pending}>{pending ? 'Enviando…' : 'Enviar solicitud'}</button></div>
      </form>
    </section>
  </main>;
}
