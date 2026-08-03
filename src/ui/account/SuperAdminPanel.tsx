import { useEffect, useState, type FormEvent } from 'react';
import * as auth from '@/auth/authService';

const messageTypeLabel: Record<auth.EmailDeliveryLog['messageType'], string> = {
  VERIFY_EMAIL: 'Verificación',
  RESET_PASSWORD: 'Restablecimiento',
  SMTP_TEST: 'Prueba SMTP',
};

export function SuperAdminPanel() {
  const [users, setUsers] = useState<auth.AdminUser[]>([]);
  const [message, setMessage] = useState('Cargando usuarios…');
  const [smtp, setSmtp] = useState({ host: '', port: 587, secure: false, username: '', from: '', password: '' });
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [smtpPending, setSmtpPending] = useState(false);
  const [emailLogs, setEmailLogs] = useState<auth.EmailDeliveryLog[]>([]);

  const refreshUsers = async () => {
    try {
      const loaded = await auth.listAdminUsers();
      setUsers(loaded);
      setMessage(loaded.length ? '' : 'No hay usuarios registrados.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron cargar los usuarios.');
    }
  };

  const refreshEmailLogs = async () => {
    try { setEmailLogs(await auth.getEmailDeliveryLogs()); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo cargar el historial de correos.'); }
  };

  useEffect(() => {
    void refreshUsers();
    void refreshEmailLogs();
    void auth.getSmtpSettings().then((value) => {
      if (!value) return;
      setSmtp({ host: value.host, port: value.port, secure: value.secure, username: value.username, from: value.from, password: '' });
      setSmtpConfigured(value.passwordConfigured);
      setTestRecipient(value.from);
    }).catch(() => undefined);
  }, []);

  const toggleActive = async (user: auth.AdminUser) => {
    try { await auth.setAdminUserActive(user.id, !user.isActive); await refreshUsers(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el usuario.'); }
  };

  const resetPassword = async (user: auth.AdminUser) => {
    const password = window.prompt(`Nueva contraseña para ${user.email} (mínimo 12 caracteres):`);
    if (!password) return;
    try {
      await auth.setAdminUserPassword(user.id, password);
      setMessage(`Contraseña actualizada para ${user.email}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.');
    }
  };

  const persistSmtp = async () => {
    await auth.saveSmtpSettings(smtp);
    setSmtp((value) => ({ ...value, password: '' }));
    setSmtpConfigured(true);
  };

  const saveSmtp = async (event: FormEvent) => {
    event.preventDefault();
    setSmtpPending(true);
    try {
      await persistSmtp();
      setMessage('Configuración SMTP guardada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar SMTP.');
    } finally {
      setSmtpPending(false);
    }
  };

  const testSmtp = async () => {
    if (!testRecipient.trim()) {
      setMessage('Indica un destinatario para la prueba SMTP.');
      return;
    }
    setSmtpPending(true);
    setMessage('Comprobando conexión y enviando correo de prueba…');
    try {
      await persistSmtp();
      const result = await auth.testSmtpSettings(testRecipient.trim());
      setMessage(`SMTP correcto. Correo de prueba enviado${result.messageId ? ` (${result.messageId})` : ''}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'La prueba SMTP ha fallado.');
    } finally {
      await refreshEmailLogs();
      setSmtpPending(false);
    }
  };

  return <section className="panel stack super-admin-panel">
    <div><p className="eyebrow">Acceso restringido</p><h2>Super administración</h2><p className="muted">Gestiona cuentas registradas, correo y listas guardadas.</p></div>
    {message && <p className="page-message" role="status">{message}</p>}

    <div className="admin-user-list">
      {users.map((user) => <article className="admin-user" key={user.id}>
        <div><strong>{user.nickname || user.email}</strong><span>{user.email}</span><small>Último acceso: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Nunca'} · Listas: {user.savedLists}</small></div>
        <div className="row"><span className={`chip ${user.isActive ? '' : 'chip--unique'}`}>{user.isActive ? 'Activa' : 'Desactivada'}</span><button onClick={() => { void toggleActive(user); }}>{user.isActive ? 'Desactivar' : 'Activar'}</button><button onClick={() => { void resetPassword(user); }}>Cambiar contraseña</button></div>
      </article>)}
    </div>

    <form className="admin-smtp stack" onSubmit={saveSmtp}>
      <div><h3>Envío de correos SMTP</h3><p className="muted small">La prueba guarda la configuración, comprueba la conexión y envía un mensaje real. La contraseña se cifra y no vuelve a mostrarse.</p></div>
      <div className="settings-grid">
        <label className="field">Servidor<input required value={smtp.host} onChange={(event) => setSmtp({ ...smtp, host: event.target.value })} placeholder="smtp.ejemplo.com" /></label>
        <label className="field">Puerto<input required type="number" min="1" max="65535" value={smtp.port} onChange={(event) => setSmtp({ ...smtp, port: Number(event.target.value) })} /></label>
        <label className="field">Usuario<input value={smtp.username} onChange={(event) => setSmtp({ ...smtp, username: event.target.value })} /></label>
        <label className="field">Remitente<input required type="email" value={smtp.from} onChange={(event) => setSmtp({ ...smtp, from: event.target.value })} /></label>
      </div>
      <label className="field">Contraseña {smtpConfigured && <span className="muted small">(dejar vacía para conservarla)</span>}<input type="password" value={smtp.password} onChange={(event) => setSmtp({ ...smtp, password: event.target.value })} /></label>
      <label className="row"><input type="checkbox" checked={smtp.secure} onChange={(event) => setSmtp({ ...smtp, secure: event.target.checked })} /> Usar TLS/SSL implícito (habitualmente puerto 465)</label>
      <div className="smtp-test-row">
        <label className="field">Destinatario de prueba<input type="email" value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} placeholder="tu@correo.com" /></label>
        <div className="row"><button type="submit" disabled={smtpPending}>Guardar SMTP</button><button type="button" disabled={smtpPending} onClick={() => { void testSmtp(); }}>Probar conexión y envío</button></div>
      </div>
    </form>

    <section className="email-log-section stack">
      <div className="row email-log-heading"><div><h3>Historial de correos</h3><p className="muted small">Últimos 100 intentos. No se guarda el contenido ni las contraseñas.</p></div><button onClick={() => { void refreshEmailLogs(); }}>Actualizar</button></div>
      {emailLogs.length === 0
        ? <p className="muted">Todavía no hay envíos registrados.</p>
        : <div className="email-log-list">{emailLogs.map((entry) => <article className="email-log-item" key={entry.id}>
          <div><strong>{entry.subject}</strong><span>{entry.recipient}</span><small>{new Date(entry.createdAt).toLocaleString()} · {messageTypeLabel[entry.messageType]}</small></div>
          <div className="email-log-result"><span className={`chip ${entry.status === 'FAILED' ? 'chip--unique' : ''}`}>{entry.status === 'SENT' ? 'Enviado' : 'Error'}</span>{entry.errorMessage && <small className="email-log-error">{entry.errorMessage}</small>}{entry.providerMessageId && <small>ID: {entry.providerMessageId}</small>}</div>
        </article>)}</div>}
    </section>
  </section>;
}
