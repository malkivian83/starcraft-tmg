import { useEffect, useState, type FormEvent } from 'react';
import * as auth from '@/auth/authService';

export function SuperAdminPanel() {
  const [users, setUsers] = useState<auth.AdminUser[]>([]);
  const [message, setMessage] = useState('Cargando usuarios…');
  const [smtp, setSmtp] = useState({ host: '', port: 587, secure: false, username: '', from: '', password: '' });
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const refresh = async () => {
    try { const loaded = await auth.listAdminUsers(); setUsers(loaded); setMessage(loaded.length ? '' : 'No hay usuarios registrados.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudieron cargar los usuarios.'); }
  };
  useEffect(() => { void refresh(); void auth.getSmtpSettings().then((value) => { if (value) { setSmtp({ host: value.host, port: value.port, secure: value.secure, username: value.username, from: value.from, password: '' }); setSmtpConfigured(value.passwordConfigured); } }).catch(() => undefined); }, []);
  const toggleActive = async (user: auth.AdminUser) => {
    try { await auth.setAdminUserActive(user.id, !user.isActive); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el usuario.'); }
  };
  const resetPassword = async (user: auth.AdminUser) => {
    const password = window.prompt(`Nueva contraseña para ${user.email} (mínimo 12 caracteres):`);
    if (!password) return;
    try { await auth.setAdminUserPassword(user.id, password); setMessage(`Contraseña actualizada para ${user.email}.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.'); }
  };
  const saveSmtp = async (event: FormEvent) => { event.preventDefault(); try { await auth.saveSmtpSettings(smtp); setSmtp((value) => ({ ...value, password: '' })); setSmtpConfigured(true); setMessage('Configuración SMTP guardada.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar SMTP.'); } };
  return <section className="panel stack super-admin-panel">
    <div><p className="eyebrow">Acceso restringido</p><h2>Super administración</h2><p className="muted">Gestiona cuentas registradas y sus listas guardadas.</p></div>
    {message && <p className="page-message">{message}</p>}
    <div className="admin-user-list">
      {users.map((user) => <article className="admin-user" key={user.id}>
        <div><strong>{user.nickname || user.email}</strong><span>{user.email}</span><small>Último acceso: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Nunca'} · Listas: {user.savedLists}</small></div>
        <div className="row"><span className={`chip ${user.isActive ? '' : 'chip--unique'}`}>{user.isActive ? 'Activa' : 'Desactivada'}</span><button onClick={() => { void toggleActive(user); }}>{user.isActive ? 'Desactivar' : 'Activar'}</button><button onClick={() => { void resetPassword(user); }}>Cambiar contraseña</button></div>
      </article>)}
    </div>
    <form className="admin-smtp stack" onSubmit={saveSmtp}>
      <div><h3>Envío de correos SMTP</h3><p className="muted small">La contraseña se guarda cifrada y no vuelve a mostrarse.</p></div>
      <div className="settings-grid"><label className="field">Servidor<input required value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.ejemplo.com" /></label><label className="field">Puerto<input required type="number" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })} /></label><label className="field">Usuario<input value={smtp.username} onChange={(e) => setSmtp({ ...smtp, username: e.target.value })} /></label><label className="field">Remitente<input required type="email" value={smtp.from} onChange={(e) => setSmtp({ ...smtp, from: e.target.value })} /></label></div>
      <label className="field">Contraseña {smtpConfigured && <span className="muted small">(dejar vacía para conservarla)</span>}<input type="password" value={smtp.password} onChange={(e) => setSmtp({ ...smtp, password: e.target.value })} /></label>
      <label className="row"><input type="checkbox" checked={smtp.secure} onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })} /> Usar TLS/SSL</label><button type="submit">Guardar SMTP</button>
    </form>
  </section>;
}
