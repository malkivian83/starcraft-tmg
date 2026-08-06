import { useState, type ChangeEvent, type FormEvent } from 'react';
import * as auth from '@/auth/authService';
import { availableRaces } from '@/catalog/loader';
import { useAuthStore } from '@/store/authStore';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { AVATAR_OPTIONS, isEmojiAvatar, isUploadedAvatar, ProfileAvatar, profileName } from './ProfileAvatar';
import { AUTH_PROVIDER_LABEL, SuperAdminPanel } from './SuperAdminPanel';

const AVATAR_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const AVATAR_MAX_FILE_BYTES = 8 * 1024 * 1024;
const AVATAR_MAX_DATA_URL_LENGTH = 220_000;
type ProfileFeedback = { kind: 'success' | 'error'; text: string };

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('No se pudo leer la imagen.'));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

async function prepareUploadedAvatar(file: File): Promise<string> {
  if (!AVATAR_IMAGE_TYPES.has(file.type)) throw new Error('Elige una imagen PNG, JPG o WebP.');
  if (file.size > AVATAR_MAX_FILE_BYTES) throw new Error('La imagen original no puede superar 8 MB.');

  const source = await readFileAsDataUrl(file);
  const image = new Image();
  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('La imagen no se puede procesar.'));
    image.src = source;
  });
  if (!dimensions.width || !dimensions.height) throw new Error('La imagen no tiene unas dimensiones válidas.');

  const maxDimension = 256;
  const scale = Math.min(1, maxDimension / Math.max(dimensions.width, dimensions.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(dimensions.width * scale));
  canvas.height = Math.max(1, Math.round(dimensions.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('El navegador no permite preparar la imagen.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.84, 0.72, 0.6, 0.5]) {
    for (const type of ['image/webp', 'image/jpeg'] as const) {
      const candidate = canvas.toDataURL(type, quality);
      if (candidate.startsWith(`data:${type};`) && candidate.length <= AVATAR_MAX_DATA_URL_LENGTH) return candidate;
    }
  }
  const png = canvas.toDataURL('image/png');
  if (png.length <= AVATAR_MAX_DATA_URL_LENGTH) return png;
  throw new Error('No se ha podido comprimir la imagen por debajo de 150 KB.');
}

export function AccountPage() {
  const user = useAuthStore((state) => state.user)!;
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const [message, setMessage] = useState<string | null>(null);
  const [nickname, setNickname] = useState(user.nickname ?? '');
  const [avatar, setAvatar] = useState(() => user.avatar && (isUploadedAvatar(user.avatar) || isEmojiAvatar(user.avatar)) ? user.avatar : null);
  const [defaultRace, setDefaultRace] = useState(user.defaultRace);
  const [profilePending, setProfilePending] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<ProfileFeedback | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [googleAction, setGoogleAction] = useState<'set-password' | 'delete' | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const hasPassword = user.authProvider !== 'GOOGLE';
  const hasGoogle = user.authProvider !== 'PASSWORD';

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setProfilePending(true);
    setProfileFeedback(null);
    setMessage(null);
    try {
      setUser(await auth.updateProfile({ defaultRace, nickname: nickname.trim() || null, avatar }));
      setProfileFeedback({ kind: 'success', text: 'Perfil guardado correctamente.' });
    } catch (error) {
      setProfileFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar el perfil.' });
    } finally {
      setProfilePending(false);
    }
  };
  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setAvatarError(null);
    setProfileFeedback(null);
    try {
      setAvatar(await prepareUploadedAvatar(file));
      setMessage('Avatar preparado. Guarda el perfil para aplicarlo.');
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'No se pudo preparar el avatar.');
    }
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

  return <main className="content page-content profile-page no-print">
    <section className="page-heading"><div><p className="eyebrow">Cuenta</p><h1>Perfil</h1><p className="muted">Personaliza cómo apareces en la aplicación y ajusta tus preferencias.</p></div><div className="profile-preview"><ProfileAvatar user={{ ...user, nickname, avatar }} /><div><strong>{nickname.trim() || profileName(user)}</strong><span>{user.email}</span></div></div></section>
    <div className="settings-grid">
      <form className="panel stack" onSubmit={saveProfile}>
        <h2>Identidad y preferencias</h2>
        <label className="field">Apodo<input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Tu apodo" maxLength={32} /></label>
        <fieldset className="avatar-picker"><legend>Avatar</legend><div>{AVATAR_OPTIONS.map((option) => <button className={`avatar-choice${avatar === option ? ' avatar-choice--selected' : ''}`} type="button" key={option} onClick={() => { setAvatar(option); setAvatarError(null); setProfileFeedback(null); }} aria-label={`Elegir avatar ${option}`}>{option}</button>)}</div><label className="avatar-picker__upload">Subir imagen<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void handleAvatarUpload(event); }} /></label><div className="avatar-picker__actions">{isUploadedAvatar(avatar) && <button type="button" className="button-link button-link--compact" onClick={() => { setAvatar(null); setProfileFeedback(null); }}>Quitar imagen</button>}<span className="muted small">PNG, JPG o WebP · se optimiza a 256 px</span></div>{avatarError && <p className="issue issue--error">{avatarError}</p>}</fieldset>
        <label className="field">Facción predeterminada<select value={defaultRace} onChange={(event) => setDefaultRace(event.target.value as auth.Race)}>{availableRaces().map((race) => <option key={race} value={race}>{race === 'ZERG' ? 'Zerg' : race === 'TERRAN' ? 'Terran' : 'Protoss'}</option>)}</select></label>
        {profileFeedback && <p className={`page-message page-message--${profileFeedback.kind}`} role={profileFeedback.kind === 'error' ? 'alert' : 'status'} aria-live="polite">{profileFeedback.text}</p>}
        <button type="submit" disabled={profilePending}>{profilePending ? 'Guardando…' : 'Guardar perfil'}</button>
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
