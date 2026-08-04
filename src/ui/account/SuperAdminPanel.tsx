import { useEffect, useState, type FormEvent } from 'react';
import * as auth from '@/auth/authService';

const messageTypeLabel: Record<auth.EmailDeliveryLog['messageType'], string> = {
  VERIFY_EMAIL: 'Verificación',
  RESET_PASSWORD: 'Restablecimiento',
  SMTP_TEST: 'Prueba SMTP',
  ACCOUNT_VERIFIED: 'Verificada por admin',
};

export const AUTH_PROVIDER_LABEL: Record<auth.AuthProvider, string> = {
  PASSWORD: 'Correo y contraseña',
  GOOGLE: 'Google',
  BOTH: 'Google y contraseña',
};

type AdminSection = 'users' | 'smtp' | 'email-logs';

export function SuperAdminPanel() {
  const [users, setUsers] = useState<auth.AdminUser[]>([]);
  const [message, setMessage] = useState('Cargando usuarios…');
  const [smtp, setSmtp] = useState({ host: '', port: 587, secure: false, username: '', from: '', password: '' });
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [smtpPending, setSmtpPending] = useState(false);
  const [emailLogs, setEmailLogs] = useState<auth.EmailDeliveryLog[]>([]);
  const [activeSection, setActiveSection] = useState<AdminSection>('users');

  const refreshUsers = async () => {
    try {
      const loaded = await auth.listAdminUsers();
      setUsers(loaded);
      setMessage(loaded.length ? '' : 'No hay usuarios registrados.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron cargar los usuarios.');
    }
  };

  const refreshEmailLogs = async (reportError = true) => {
    try { setEmailLogs(await auth.getEmailDeliveryLogs()); }
    catch (error) {
      if (reportError) setMessage(error instanceof Error ? error.message : 'No se pudo cargar el historial de correos.');
    }
  };

  useEffect(() => {
    void refreshUsers();
    void refreshEmailLogs();
    void auth.getSmtpSettings().then((value) => {
      if (!value) return;
      setSmtp({ host: value.host, port: value.port, secure: value.secure, username: value.username, from: value.from, password: '' });
      setSmtpConfigured(value.passwordConfigured);
      setTestRecipient(value.from);
    }).catch((error) => setMessage(error instanceof Error ? error.message : 'No se pudo cargar la configuración SMTP.'));
  }, []);

  const toggleActive = async (user: auth.AdminUser) => {
    try { await auth.setAdminUserActive(user.id, !user.isActive); await refreshUsers(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el usuario.'); }
  };

  const toggleVerified = async (user: auth.AdminUser) => {
    const verify = !user.emailVerifiedAt;
    if (!verify && !window.confirm(`¿Retirar la verificación de ${user.email}? No podrá acceder hasta volver a verificarse.`)) return;
    try {
      const { emailDeliveryWarning } = await auth.setAdminUserVerified(user.id, verify);
      await refreshUsers();
      void refreshEmailLogs(false);
      if (!verify) setMessage(`Verificación retirada a ${user.email}.`);
      else setMessage(emailDeliveryWarning ?? `Cuenta de ${user.email} verificada manualmente. Se le ha avisado por correo.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la verificación.'); }
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
    setMessage('Guardando la configuración SMTP…');
    try {
      await persistSmtp();
      setMessage(`Conectando con ${smtp.host}:${smtp.port} y enviando el correo de prueba…`);
      const result = await auth.testSmtpSettings(testRecipient.trim());
      // Compatible con respuestas de servidores ya desplegados que no
      // incluyan el campo accepted en la prueba SMTP.
      result.accepted = Array.isArray(result.accepted) ? result.accepted : [testRecipient.trim()];
      const serverResponse = result.response ? ` Respuesta: ${result.response}` : '';
      setMessage(`El servidor SMTP aceptó el correo para ${result.accepted.join(', ')}${result.messageId ? ` (ID: ${result.messageId})` : ''}.${serverResponse}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'La prueba SMTP ha fallado.');
    } finally {
      setSmtpPending(false);
      void refreshEmailLogs(false);
    }
  };

  const failedEmailCount = emailLogs.filter((entry) => entry.status === 'FAILED').length;
  const tabs: Array<{ id: AdminSection; label: string; count?: number }> = [
    { id: 'users', label: 'Usuarios', count: users.length },
    { id: 'smtp', label: 'Configuración SMTP' },
    { id: 'email-logs', label: 'Historial de correos', count: failedEmailCount || undefined },
  ];

  return <section className="panel stack super-admin-panel">
    <div><p className="eyebrow">Acceso restringido</p><h2>Super administración</h2><p className="muted">Gestiona cuentas registradas, correo y listas guardadas.</p></div>
    <nav className="tabs admin-tabs" role="tablist" aria-label="Secciones de super administración">
      {tabs.map((tab) => <button
        className={`tab${activeSection === tab.id ? ' tab--active' : ''}`}
        id={`admin-tab-${tab.id}`}
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={activeSection === tab.id}
        aria-controls={`admin-panel-${tab.id}`}
        onClick={() => setActiveSection(tab.id)}
      >
        {tab.label}
        {tab.count !== undefined && <span className={tab.id === 'email-logs' ? 'tab__badge' : 'admin-tab-count'}>{tab.count}</span>}
      </button>)}
    </nav>
    {message && <p className="page-message" role="status">{message}</p>}

    {activeSection === 'users' && <section className="admin-section stack" id="admin-panel-users" role="tabpanel" aria-labelledby="admin-tab-users">
      <header className="admin-section__heading"><div><h3>Usuarios registrados</h3><p className="muted small">Administra el acceso de las cuentas y sus contraseñas.</p></div></header>
      <div className="admin-user-list">
        {users.map((user) => <article className="admin-user" key={user.id}>
          <div><strong>{user.nickname || user.email}</strong><span>{user.email}</span><small>Acceso: {AUTH_PROVIDER_LABEL[user.authProvider]} · Último acceso: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Nunca'} · Listas: {user.savedLists}{user.emailVerifiedAt && ` · Verificada: ${new Date(user.emailVerifiedAt).toLocaleString()}`}</small></div>
          <div className="row"><span className={`chip ${user.isActive ? '' : 'chip--unique'}`}>{user.isActive ? 'Activa' : 'Desactivada'}</span><span className="chip">{AUTH_PROVIDER_LABEL[user.authProvider]}</span><span className={`chip ${user.emailVerifiedAt ? '' : 'chip--unique'}`}>{user.emailVerifiedAt ? 'Verificada' : 'Sin verificar'}</span><button onClick={() => { void toggleVerified(user); }}>{user.emailVerifiedAt ? 'Quitar verificación' : 'Verificar'}</button><button onClick={() => { void toggleActive(user); }}>{user.isActive ? 'Desactivar' : 'Activar'}</button><button onClick={() => { void resetPassword(user); }}>Cambiar contraseña</button></div>
        </article>)}
      </div>
    </section>}

    {activeSection === 'smtp' && <form className="admin-section admin-smtp stack" id="admin-panel-smtp" role="tabpanel" aria-labelledby="admin-tab-smtp" onSubmit={saveSmtp}>
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
        <div className="row"><button type="submit" disabled={smtpPending}>Guardar SMTP</button><button type="button" disabled={smtpPending} onClick={() => { void testSmtp(); }}>{smtpPending ? 'Procesando…' : 'Probar conexión y envío'}</button></div>
      </div>
    </form>}

    {activeSection === 'email-logs' && <section className="admin-section email-log-section stack" id="admin-panel-email-logs" role="tabpanel" aria-labelledby="admin-tab-email-logs">
      <div className="row email-log-heading"><div><h3>Historial de correos</h3><p className="muted small">Últimos 100 intentos. No se guarda el contenido ni las contraseñas.</p></div><button onClick={() => { void refreshEmailLogs(); }}>Actualizar</button></div>
      {emailLogs.length === 0
        ? <p className="muted">Todavía no hay envíos registrados.</p>
        : <div className="email-log-list">{emailLogs.map((entry) => <article className="email-log-item" key={entry.id}>
          <div><strong>{entry.subject}</strong><span>{entry.recipient}</span><small>{new Date(entry.createdAt).toLocaleString()} · {messageTypeLabel[entry.messageType]}</small></div>
          <div className="email-log-result"><span className={`chip ${entry.status === 'FAILED' ? 'chip--unique' : ''}`}>{entry.status === 'SENT' ? 'Enviado' : 'Error'}</span>{entry.errorMessage && <small className="email-log-error">{entry.errorMessage}</small>}{entry.providerMessageId && <small>ID: {entry.providerMessageId}</small>}</div>
        </article>)}</div>}
    </section>}
  </section>;
}
