import { useState, type FormEvent } from 'react';
import * as auth from '@/auth/authService';
import { availableRaces } from '@/catalog/loader';
import { useAuthStore } from '@/store/authStore';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { AVATAR_OPTIONS, ProfileAvatar, profileName } from './ProfileAvatar';
import { AUTH_PROVIDER_LABEL, SuperAdminPanel } from './SuperAdminPanel';

export function AccountPage() {
  const user = useAuthStore((state) => state.user)!;
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const [message, setMessage] = useState<string | null>(null);
  const [nickname, setNickname] = useState(user.nickname ?? '');
  const [avatar, setAvatar] = useState(user.avatar);
  const [defaultRace, setDefaultRace] = useState(user.defaultRace);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [googleAction, setGoogleAction] = useState<'set-password' | 'delete' | null>(null);
  const hasPassword = user.authProvider !== 'GOOGLE';
  const hasGoogle = user.authProvider !== 'PASSWORD';

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setUser(await auth.updateProfile({ defaultRace, nickname: nickname.trim() || null, avatar }));
      setMessage('Perfil actualizado.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el perfil.'); }
  };
  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    try { await auth.changePassword(currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); setMessage('Contraseña actualizada.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.'); }
  };
  const removeAccount = async () => {
    if (!window.confirm('La cuenta se desactivará y se cerrarán todas las sesiones. ¿Continuar?')) return;
    if (!hasPassword) { setMessage(null); setGoogleAction('delete'); return; }
    const password = window.prompt('Escribe tu contraseña para borrar la cuenta de forma lógica.');
    if (!password) return;
    try { await auth.deleteAccount({ password }); await logout(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo borrar la cuenta.'); }
  };
  const startSetPassword = (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setGoogleAction('set-password');
  };
  // Un único botón de Google activo por pantalla: el script conserva sólo el
  // último callback registrado y confundir «borrar» con «guardar» sería grave.
  const confirmWithGoogle = async (credential: string) => {
    const action = googleAction;
    setGoogleAction(null);
    try {
      if (action === 'set-password') {
        setUser(await auth.setPassword(credential, newPassword));
        setNewPassword('');
        setMessage('Contraseña establecida. Ya puedes entrar con Google o con tu contraseña.');
      } else if (action === 'delete') {
        await auth.deleteAccount({ credential });
        await logout();
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo confirmar con Google.'); }
  };

  return <main className="content page-content no-print">
    <section className="page-heading"><div><p className="eyebrow">Cuenta</p><h1>Perfil</h1><p className="muted">Personaliza cómo apareces en la aplicación y ajusta tus preferencias.</p></div><div className="profile-preview"><ProfileAvatar user={{ ...user, nickname, avatar }} /><div><strong>{nickname.trim() || profileName(user)}</strong><span>{user.email}</span></div></div></section>
    <div className="settings-grid">
      <form className="panel stack" onSubmit={saveProfile}>
        <h2>Identidad y preferencias</h2>
        <label className="field">Apodo<input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Tu apodo" maxLength={32} /></label>
        <fieldset className="avatar-picker"><legend>Avatar</legend><div>{AVATAR_OPTIONS.map((option) => <button className={`avatar-choice${avatar === option ? ' avatar-choice--selected' : ''}`} type="button" key={option} onClick={() => setAvatar(option)} aria-label={`Elegir avatar ${option}`}>{option}</button>)}</div></fieldset>
        <label className="field">Facción predeterminada<select value={defaultRace} onChange={(event) => setDefaultRace(event.target.value as auth.Race)}>{availableRaces().map((race) => <option key={race} value={race}>{race === 'ZERG' ? 'Zerg' : race === 'TERRAN' ? 'Terran' : 'Protoss'}</option>)}</select></label>
        <button type="submit">Guardar perfil</button>
      </form>
      <div className="stack">
        <form className="panel stack" onSubmit={hasPassword ? changePassword : startSetPassword}>
          <h2>Seguridad</h2>
          <p className="muted small">Acceso: {AUTH_PROVIDER_LABEL[user.authProvider]}.{!hasPassword && ' Puedes añadir una contraseña para entrar también sin Google.'}</p>
          {hasPassword && <label className="field">Contraseña actual<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required minLength={12} /></label>}
          <label className="field">{hasPassword ? 'Nueva contraseña' : 'Contraseña'}<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={12} /></label>
          <button type="submit">{hasPassword ? 'Cambiar contraseña' : 'Establecer contraseña'}</button>
        </form>
        <section className="panel stack danger-zone"><h2>Eliminar cuenta</h2><p className="muted">La cuenta se desactiva de forma lógica y las listas dejan de estar accesibles.</p><button onClick={() => { void removeAccount(); }}>Borrar cuenta</button></section>
        {hasGoogle && googleAction && <section className="panel stack">
          <h2>Confirma con Google</h2>
          <p className="muted small">{googleAction === 'delete' ? 'Vuelve a identificarte con Google para borrar la cuenta.' : 'Vuelve a identificarte con Google para guardar la contraseña.'}</p>
          <GoogleSignInButton text="continue_with" onCredential={(credential) => { void confirmWithGoogle(credential); }} />
          <button type="button" onClick={() => setGoogleAction(null)}>Cancelar</button>
        </section>}
      </div>
    </div>
    {user.email.trim().toLowerCase() === 'malkivian@gmail.com' && <SuperAdminPanel />}
    {message && <p className="page-message">{message}</p>}
  </main>;
}
