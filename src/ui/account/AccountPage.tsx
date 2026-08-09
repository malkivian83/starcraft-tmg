import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import * as auth from '@/auth/authService';
import { availableRaces } from '@/catalog/loader';
import { useAuthStore } from '@/store/authStore';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { AVATAR_OPTIONS, isEmojiAvatar, isUploadedAvatar, ProfileAvatar, profileName } from './ProfileAvatar';
import { authProviderLabel, SuperAdminPanel } from './SuperAdminPanel';
import { normalizeLocale } from '@/i18n/types';

const AVATAR_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const AVATAR_MAX_FILE_BYTES = 8 * 1024 * 1024;
const AVATAR_MAX_DATA_URL_LENGTH = 220_000;
const AVATAR_ERROR_MESSAGES: Record<'es' | 'en', Record<string, string>> = {
  es: {
    avatarTypeError: 'Elige una imagen PNG, JPG o WebP.',
    avatarSizeError: 'La imagen original no puede superar 8 MB.',
    avatarReadError: 'No se pudo leer la imagen.',
    avatarProcessError: 'La imagen no se puede procesar.',
    avatarDimensionsError: 'La imagen no tiene unas dimensiones válidas.',
    avatarBrowserError: 'El navegador no permite preparar la imagen.',
    avatarCompressError: 'No se ha podido comprimir la imagen por debajo de 150 KB.',
  },
  en: {
    avatarTypeError: 'Choose a PNG, JPG, or WebP image.',
    avatarSizeError: 'The original image cannot exceed 8 MB.',
    avatarReadError: 'The image could not be read.',
    avatarProcessError: 'The image could not be processed.',
    avatarDimensionsError: 'The image dimensions are not valid.',
    avatarBrowserError: 'The browser cannot prepare this image.',
    avatarCompressError: 'The image could not be compressed below 150 KB.',
  },
};
type ProfileFeedback = { kind: 'success' | 'error'; text: string };

function readFileAsDataUrl(file: File, translate: (key: string) => string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error(translate('avatarReadError')));
    reader.onerror = () => reject(new Error(translate('avatarReadError')));
    reader.readAsDataURL(file);
  });
}

async function prepareUploadedAvatar(file: File, translate: (key: string) => string): Promise<string> {
  if (!AVATAR_IMAGE_TYPES.has(file.type)) throw new Error(translate('avatarTypeError'));
  if (file.size > AVATAR_MAX_FILE_BYTES) throw new Error(translate('avatarSizeError'));

  const source = await readFileAsDataUrl(file, translate);
  const image = new Image();
  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error(translate('avatarProcessError')));
    image.src = source;
  });
  if (!dimensions.width || !dimensions.height) throw new Error(translate('avatarDimensionsError'));

  const maxDimension = 256;
  const scale = Math.min(1, maxDimension / Math.max(dimensions.width, dimensions.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(dimensions.width * scale));
  canvas.height = Math.max(1, Math.round(dimensions.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error(translate('avatarBrowserError'));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.84, 0.72, 0.6, 0.5]) {
    for (const type of ['image/webp', 'image/jpeg'] as const) {
      const candidate = canvas.toDataURL(type, quality);
      if (candidate.startsWith(`data:${type};`) && candidate.length <= AVATAR_MAX_DATA_URL_LENGTH) return candidate;
    }
  }
  const png = canvas.toDataURL('image/png');
  if (png.length <= AVATAR_MAX_DATA_URL_LENGTH) return png;
  throw new Error(translate('avatarCompressError'));
}

export function AccountPage() {
  const { t, i18n } = useTranslation('account');
  const locale = normalizeLocale(i18n.language) ?? 'es';
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
      setProfileFeedback({ kind: 'success', text: t('profileSaved') });
    } catch (error) {
      setProfileFeedback({ kind: 'error', text: error instanceof Error ? error.message : t('profileSaveError') });
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
    const translateAvatar = (key: string) => t(key, { defaultValue: AVATAR_ERROR_MESSAGES[locale][key] ?? t('avatarPrepareError') });
    try {
      setAvatar(await prepareUploadedAvatar(file, translateAvatar));
      setMessage(t('avatarPrepared'));
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : t('avatarPrepareError'));
    }
  };
  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    try { await auth.changePassword(currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); setMessage(t('passwordUpdated')); }
    catch (error) { setMessage(error instanceof Error ? error.message : t('changePasswordError')); }
  };
  const removeAccount = async () => {
    if (!window.confirm(t('deleteConfirm'))) return;
    if (!hasPassword) { setMessage(null); setGoogleAction('delete'); return; }
    const password = window.prompt(t('deletePasswordPrompt'));
    if (!password) return;
    try { await auth.deleteAccount({ password }); await logout(); }
    catch (error) { setMessage(error instanceof Error ? error.message : t('deleteError')); }
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
        setMessage(t('passwordSet'));
      } else if (action === 'delete') {
        await auth.deleteAccount({ credential });
        await logout();
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : t('googleConfirmError')); }
  };

  return <main className="content page-content profile-page no-print">
    <section className="page-heading"><div><p className="eyebrow">{t('accountEyebrow')}</p><h1>{t('profile')}</h1><p className="muted">{t('profileDescription')}</p></div><div className="profile-preview"><ProfileAvatar user={{ ...user, nickname, avatar }} /><div><strong>{nickname.trim() || profileName(user)}</strong><span>{user.email}</span></div></div></section>
    <div className="settings-grid">
      <form className="panel stack" onSubmit={saveProfile}>
        <h2>{t('preferences')}</h2>
        <label className="field">{t('nickname')}<input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder={t('nicknamePlaceholder')} maxLength={32} /></label>
        <fieldset className="avatar-picker"><legend>{t('avatar')}</legend><div>{AVATAR_OPTIONS.map((option) => <button className={`avatar-choice${avatar === option ? ' avatar-choice--selected' : ''}`} type="button" key={option} onClick={() => { setAvatar(option); setAvatarError(null); setProfileFeedback(null); }} aria-label={t('chooseAvatar', { avatar: option })}>{option}</button>)}</div><label className="avatar-picker__upload">{t('uploadImage')}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void handleAvatarUpload(event); }} /></label><div className="avatar-picker__actions">{isUploadedAvatar(avatar) && <button type="button" className="button-link button-link--compact" onClick={() => { setAvatar(null); setProfileFeedback(null); }}>{t('removeImage')}</button>}<span className="muted small">{t('imageHint')}</span></div>{avatarError && <p className="issue issue--error">{avatarError}</p>}</fieldset>
        <label className="field">{t('defaultFaction')}<select value={defaultRace} onChange={(event) => setDefaultRace(event.target.value as auth.Race)}>{availableRaces().map((race) => <option key={race} value={race}>{race === 'ZERG' ? 'Zerg' : race === 'TERRAN' ? 'Terran' : 'Protoss'}</option>)}</select></label>
        {profileFeedback && <p className={`page-message page-message--${profileFeedback.kind}`} role={profileFeedback.kind === 'error' ? 'alert' : 'status'} aria-live="polite">{profileFeedback.text}</p>}
        <button type="submit" disabled={profilePending}>{profilePending ? t('saving') : t('saveProfile')}</button>
      </form>
      <div className="stack">
        <form className="panel stack" onSubmit={hasPassword ? changePassword : startSetPassword}>
          <h2>{t('security')}</h2>
          <p className="muted small">{t('access', { provider: authProviderLabel(user.authProvider, locale) })}{!hasPassword && ` ${t('addPasswordHint')}`}</p>
          {hasPassword && <label className="field">{t('currentPassword')}<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required minLength={12} /></label>}
          <label className="field">{hasPassword ? t('newPassword') : t('password')}<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={12} /></label>
          <button type="submit">{hasPassword ? t('changePassword') : t('setPassword')}</button>
        </form>
        <section className="panel stack danger-zone"><h2>{t('deleteAccount')}</h2><p className="muted">{t('deleteDescription')}</p><button onClick={() => { void removeAccount(); }}>{t('deleteButton')}</button></section>
        {hasGoogle && googleAction && <section className="panel stack">
          <h2>{t('googleConfirm')}</h2>
          <p className="muted small">{googleAction === 'delete' ? t('googleDeleteHint') : t('googlePasswordHint')}</p>
          <GoogleSignInButton text="continue_with" onCredential={(credential) => { void confirmWithGoogle(credential); }} />
          <button type="button" onClick={() => setGoogleAction(null)}>{t('cancel')}</button>
        </section>}
      </div>
    </div>
    {user.email.trim().toLowerCase() === 'malkivian@gmail.com' && <SuperAdminPanel />}
    {message && <p className="page-message">{message}</p>}
  </main>;
}
