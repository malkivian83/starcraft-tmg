import type { SupportedLocale } from '@/i18n/types';
import i18n from '@/i18n/config';
import { apiBaseUrl } from './apiBase';

export type Race = 'ZERG' | 'TERRAN' | 'PROTOSS';

export type AuthProvider = 'PASSWORD' | 'GOOGLE' | 'BOTH';

export interface AuthenticatedUser {
  id: string;
  email: string;
  emailVerified: boolean;
  authProvider: AuthProvider;
  locale: SupportedLocale;
  defaultRace: Race;
  nickname: string | null;
  avatar: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  nickname: string | null;
  isActive: boolean;
  emailVerifiedAt: string | null;
  authProvider: AuthProvider;
  locale: SupportedLocale;
  lastLoginAt: string | null;
  savedLists: number;
}
export interface SmtpSettings { host: string; port: number; secure: boolean; username: string; from: string; passwordConfigured: boolean; password?: string; }
export interface EmailDeliveryLog {
  id: number;
  recipient: string;
  messageType: 'VERIFY_EMAIL' | 'RESET_PASSWORD' | 'SMTP_TEST' | 'ACCOUNT_VERIFIED' | 'SUPPORT_CREATED' | 'SUPPORT_REPLY';
  subject: string;
  status: 'SENT' | 'FAILED';
  providerMessageId: string | null;
  errorMessage: string | null;
  locale: SupportedLocale;
  createdAt: string;
}

export type SupportStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';
export interface SupportMessage {
  id: string;
  ticketId: string;
  authorType: 'USER' | 'ADMIN';
  authorUserId: string | null;
  body: string;
  deliveryStatus: 'PENDING' | 'SENT' | 'FAILED' | 'NOT_APPLICABLE';
  providerMessageId: string | null;
  deliveryError: string | null;
  deliveredAt: string | null;
  createdAt: string;
}
export interface SupportTicket {
  id: string;
  userId: string | null;
  contactEmail: string;
  subject: string;
  locale: SupportedLocale;
  status: SupportStatus;
  termsVersion: string;
  termsAcceptedAt: string;
  createdAt: string;
  updatedAt: string;
  messages?: SupportMessage[];
}

export interface RegistrationResult {
  user: AuthenticatedUser;
  developmentVerificationUrl: string | null;
  emailDeliveryWarning: string | null;
}

const avatarDataUrlPattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const avatarPathPattern = /^\/auth\/avatars\/[0-9a-f-]{36}\.(?:png|jpe?g|webp)$/i;

export function avatarUrl(value: string | null): string | null {
  if (!value) return null;
  if (avatarDataUrlPattern.test(value)) return value;
  if (avatarPathPattern.test(value)) return `${apiBaseUrl.replace(/\/$/, '')}${value}`;
  return null;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly code: string | null = null) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError(0, i18n.language.startsWith('en')
        ? `The server did not respond within ${Math.round(timeoutMs / 1000)} seconds. Check the server logs and SMTP connectivity.`
        : `El servidor no respondió en ${Math.round(timeoutMs / 1000)} segundos. Revisa los registros del servidor y la conectividad SMTP.`);
    }
    throw new ApiError(0, i18n.language.startsWith('en') ? 'The application server could not be reached.' : 'No se puede conectar con el servidor de la aplicación.');
  } finally {
    globalThis.clearTimeout(timeout);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    const code = payload?.error?.code ?? null;
    throw new ApiError(response.status, localizedApiErrorMessage(code, payload?.error?.message ?? (i18n.language.startsWith('en') ? 'The request could not be completed.' : 'No se pudo completar la solicitud.')), code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function currentUser(): Promise<AuthenticatedUser> {
  return (await request<{ user: AuthenticatedUser }>('/auth/me')).user;
}

export async function login(email: string, password: string): Promise<AuthenticatedUser> {
  return (await request<{ user: AuthenticatedUser }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  })).user;
}

export async function register(email: string, password: string, locale: SupportedLocale = 'es'): Promise<RegistrationResult> {
  return request<RegistrationResult>('/auth/register', {
    method: 'POST', body: JSON.stringify({ email, password, locale, termsAccepted: true }),
  });
}

export async function loginWithGoogle(credential: string, locale: SupportedLocale = 'es', termsAccepted = false): Promise<AuthenticatedUser> {
  return (await request<{ user: AuthenticatedUser }>('/auth/google', {
    method: 'POST', body: JSON.stringify({ credential, locale, termsAccepted }),
  })).user;
}

const API_ERROR_MESSAGES: Record<string, { es: string; en: string }> = {
  UNAUTHENTICATED: { es: 'Inicia sesión para continuar.', en: 'Sign in to continue.' },
  EMAIL_NOT_VERIFIED: { es: 'Verifica tu correo para acceder a la aplicación.', en: 'Verify your email to access the application.' },
  FORBIDDEN: { es: 'No tienes permiso para realizar esta acción.', en: 'You do not have permission to perform this action.' },
  INVALID_INPUT: { es: 'Los datos enviados no son válidos.', en: 'The submitted data is not valid.' },
  INVALID_CREDENTIALS: { es: 'El correo o la contraseña no son correctos.', en: 'The email or password is incorrect.' },
  EMAIL_UNAVAILABLE: { es: 'No se pudo crear la cuenta con ese correo.', en: 'The account could not be created with that email.' },
  TERMS_REQUIRED: { es: 'Debes aceptar los términos y condiciones para crear una cuenta.', en: 'You must accept the terms and conditions to create an account.' },
  GOOGLE_DISABLED: { es: 'El acceso con Google no está configurado en este servidor.', en: 'Google sign-in is not configured on this server.' },
  GOOGLE_ALREADY_LINKED: { es: 'Ese correo ya está vinculado a otra cuenta de Google.', en: 'That email is already linked to another Google account.' },
  ACCOUNT_UNAVAILABLE: { es: 'Esa cuenta no está disponible. Contacta con el administrador.', en: 'That account is unavailable. Contact the administrator.' },
  INVALID_TOKEN: { es: 'El enlace no es válido o ha caducado.', en: 'The link is invalid or has expired.' },
  INVALID_AVATAR: { es: 'La imagen del avatar no es válida.', en: 'The avatar image is not valid.' },
  AVATAR_MIGRATION_REQUIRED: { es: 'La base de datos necesita la migración de avatares. Ejecuta «npm run db:migrate» y vuelve a intentarlo.', en: 'The database needs the avatar migration. Run “npm run db:migrate” and try again.' },
  PASSWORD_NOT_SET: { es: 'Esta cuenta todavía no tiene contraseña. Usa «Establecer contraseña».', en: 'This account does not have a password yet. Use “Set password”.' },
  PASSWORD_ALREADY_SET: { es: 'Esta cuenta ya tiene contraseña. Usa «Cambiar contraseña».', en: 'This account already has a password. Use “Change password”.' },
  REAUTHENTICATION_REQUIRED: { es: 'Confirma tu identidad para borrar la cuenta.', en: 'Confirm your identity to delete the account.' },
  PUBLIC_LIST_NOT_FOUND: { es: 'No existe esa lista pública.', en: 'That public list does not exist.' },
  LIST_NOT_FOUND: { es: 'No existe esa lista.', en: 'That list does not exist.' },
  INVALID_LIST: { es: 'La lista no tiene un formato válido.', en: 'The list format is not valid.' },
  LIST_EXISTS: { es: 'Ya existe una lista con ese identificador.', en: 'A list with that identifier already exists.' },
  LIST_CONFLICT: { es: 'La lista fue modificada o eliminada desde otra sesión.', en: 'The list was changed or deleted in another session.' },
  INVALID_VISIBILITY: { es: 'La visibilidad indicada no es válida.', en: 'The selected visibility is not valid.' },
  INVALID_MATCH: { es: 'Revisa los datos de la partida.', en: 'Check the match details.' },
  MATCH_NOT_FOUND: { es: 'Esa partida ya no existe.', en: 'That match no longer exists.' },
  MATCH_LIMIT_REACHED: { es: 'Esta lista ya tiene el máximo de partidas registradas.', en: 'This list already has the maximum number of recorded matches.' },
  REVISION_REQUIRED: { es: 'Incluye la revisión actual de la lista.', en: 'Include the current list revision.' },
  RATE_LIMITED: { es: 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.', en: 'Too many attempts. Wait a few minutes before trying again.' },
  NOT_FOUND: { es: 'No se ha encontrado el recurso solicitado.', en: 'The requested resource was not found.' },
  INVALID_CURSOR: { es: 'El cursor de paginación no es válido.', en: 'The pagination cursor is not valid.' },
  INVALID_GAME: { es: 'La configuración de la partida no es válida.', en: 'The game configuration is not valid.' },
  INVALID_MISSION: { es: 'La misión seleccionada no existe.', en: 'The selected mission does not exist.' },
  INVALID_GAME_COMMAND: { es: 'La acción de la partida no es válida.', en: 'The game action is not valid.' },
  INVALID_GAME_LINK: { es: 'La asociación de la partida no es válida.', en: 'The game link is not valid.' },
  GAME_NOT_FOUND: { es: 'No existe esa partida.', en: 'That game does not exist.' },
  GAME_NOT_ACTIVE: { es: 'La partida ya no está activa.', en: 'The game is no longer active.' },
  GAME_NOT_FINISHED: { es: 'Solo se pueden asociar partidas finalizadas.', en: 'Only finished games can be linked.' },
  GAME_CONFLICT: { es: 'La partida fue modificada desde otra sesión.', en: 'The game was changed in another session.' },
  FIRST_ROUND: { es: 'La partida ya está en la primera ronda.', en: 'The game is already in round one.' },
  FINAL_ROUND: { es: 'La partida ya está en la ronda final.', en: 'The game is already in the final round.' },
  INVALID_RESULT: { es: 'El resultado de la partida no es válido.', en: 'The game result is not valid.' },
  LIST_RACE_MISMATCH: { es: 'La raza de la lista no coincide con el jugador elegido.', en: 'The list race does not match the selected player.' },
  GUEST_IDENTITY_NOT_FOUND: { es: 'No se encontró la identidad invitada de este navegador.', en: 'This browser guest identity was not found.' },
  GUEST_IDENTITY_UNAVAILABLE: { es: 'No se pudo crear la identidad invitada.', en: 'The guest identity could not be created.' },
};

export function localizedApiErrorMessage(code: string | null | undefined, fallback: string): string {
  const messages = code ? API_ERROR_MESSAGES[code] : undefined;
  return messages ? messages[i18n.language.startsWith('en') ? 'en' : 'es'] : fallback;
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' });
}

export async function refreshSession(): Promise<void> {
  await request('/auth/refresh', { method: 'POST' });
}

export async function verifyEmail(token: string): Promise<void> {
  await request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
}

export async function requestVerification(email: string, locale: SupportedLocale = 'es'): Promise<void> {
  await request('/auth/request-verification', { method: 'POST', body: JSON.stringify({ email, locale }) });
}

export async function requestPasswordReset(email: string, locale: SupportedLocale = 'es'): Promise<void> {
  await request('/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email, locale }) });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
}

export async function updateDefaultRace(defaultRace: Race): Promise<AuthenticatedUser> {
  return (await request<{ user: AuthenticatedUser }>('/auth/profile/default-race', {
    method: 'PUT', body: JSON.stringify({ defaultRace }),
  })).user;
}

export async function updateProfile(profile: Pick<AuthenticatedUser, 'defaultRace' | 'nickname' | 'avatar'>): Promise<AuthenticatedUser> {
  return (await request<{ user: AuthenticatedUser }>('/auth/profile', {
    method: 'PUT', body: JSON.stringify(profile),
  })).user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
}

export async function setPassword(credential: string, newPassword: string): Promise<AuthenticatedUser> {
  return (await request<{ user: AuthenticatedUser }>('/auth/set-password', {
    method: 'POST', body: JSON.stringify({ credential, newPassword }),
  })).user;
}

export async function deleteAccount(reauthentication: { password: string } | { credential: string }): Promise<void> {
  await request('/auth/account', { method: 'DELETE', body: JSON.stringify(reauthentication) });
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  return (await request<{ users: AdminUser[] }>('/admin/users')).users;
}

export async function setAdminUserActive(id: string, isActive: boolean): Promise<void> {
  await request(`/admin/users/${id}/active`, { method: 'PUT', body: JSON.stringify({ isActive }) });
}

export async function setAdminUserVerified(id: string, isVerified: boolean): Promise<{ emailDeliveryWarning: string | null }> {
  return request(`/admin/users/${id}/verified`, { method: 'PUT', body: JSON.stringify({ isVerified }) });
}

export async function setAdminUserPassword(id: string, password: string): Promise<void> {
  await request(`/admin/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) });
}
export async function getSmtpSettings(): Promise<SmtpSettings | null> { return (await request<{ smtp: SmtpSettings | null }>('/admin/smtp')).smtp; }
export async function saveSmtpSettings(settings: Omit<SmtpSettings, 'passwordConfigured'>): Promise<void> { await request('/admin/smtp', { method: 'PUT', body: JSON.stringify(settings) }); }
export interface SmtpTestResult { ok: boolean; messageId: string | null; accepted: string[]; rejected: string[]; response: string | null; }
export async function testSmtpSettings(recipient: string): Promise<SmtpTestResult> {
  return (await request<{ result: SmtpTestResult }>('/admin/smtp/test', {
    method: 'POST', body: JSON.stringify({ recipient }),
  }, 40_000)).result;
}
export async function getEmailDeliveryLogs(limit = 100): Promise<EmailDeliveryLog[]> {
  return (await request<{ logs: EmailDeliveryLog[] }>(`/admin/smtp/logs?limit=${limit}`)).logs;
}

export async function updateLocale(locale: SupportedLocale): Promise<AuthenticatedUser> {
  return (await request<{ user: AuthenticatedUser }>('/auth/profile/locale', {
    method: 'PUT', body: JSON.stringify({ locale }),
  })).user;
}

export interface SupportCreationResult { ticketId: string; emailDeliveryWarning: string | null; }
export async function createSupport(input: { subject: string; contactEmail: string; message: string; termsAccepted: boolean; locale?: SupportedLocale }): Promise<SupportCreationResult> {
  return request<SupportCreationResult>('/support', { method: 'POST', body: JSON.stringify(input) });
}
export async function listSupportTickets(status?: SupportStatus): Promise<{ tickets: SupportTicket[]; openCount: number }> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request<{ tickets: SupportTicket[]; openCount: number }>(`/admin/support${query}`);
}
export async function getSupportTicket(id: string): Promise<SupportTicket> {
  return (await request<{ ticket: SupportTicket }>(`/admin/support/${encodeURIComponent(id)}`)).ticket;
}
export async function replyToSupport(id: string, body: string): Promise<{ message: SupportMessage | null; emailDeliveryWarning: string | null }> {
  return request<{ message: SupportMessage | null; emailDeliveryWarning: string | null }>(`/admin/support/${encodeURIComponent(id)}/replies`, { method: 'POST', body: JSON.stringify({ body }) });
}
export async function setSupportStatus(id: string, status: SupportStatus): Promise<void> {
  await request(`/admin/support/${encodeURIComponent(id)}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
}
