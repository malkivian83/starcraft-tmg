import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import * as auth from '@/auth/authService';
import { normalizeLocale } from '@/i18n/types';

export const AUTH_PROVIDER_LABEL: Record<auth.AuthProvider, string> = {
  PASSWORD: 'Correo y contraseña',
  GOOGLE: 'Google',
  BOTH: 'Google y contraseña',
};

export function authProviderLabel(provider: auth.AuthProvider, locale: 'es' | 'en'): string {
  if (locale === 'en') {
    return provider === 'PASSWORD' ? 'Email and password' : provider === 'GOOGLE' ? 'Google' : 'Google and password';
  }
  return AUTH_PROVIDER_LABEL[provider];
}

type AdminSection = 'users' | 'support' | 'smtp' | 'email-logs' | 'match-stats';
export function SuperAdminPanel() {
  const { t, i18n } = useTranslation('admin');
  const locale = normalizeLocale(i18n.language) ?? 'es';
  const supportStatusLabel: Record<auth.SupportStatus, string> = { OPEN: t('open'), ANSWERED: t('answered'), CLOSED: t('closed') };
  const [users, setUsers] = useState<auth.AdminUser[]>([]);
  const [message, setMessage] = useState(t('loadingUsers'));
  const [smtp, setSmtp] = useState({ host: '', port: 587, secure: false, username: '', from: '', password: '' });
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [smtpPending, setSmtpPending] = useState(false);
  const [emailLogs, setEmailLogs] = useState<auth.EmailDeliveryLog[]>([]);
  const [supportTickets, setSupportTickets] = useState<auth.SupportTicket[]>([]);
  const [supportOpenCount, setSupportOpenCount] = useState(0);
  const [supportStatusFilter, setSupportStatusFilter] = useState<auth.SupportStatus | ''>('');
  const [selectedSupportId, setSelectedSupportId] = useState<string | null>(null);
  const [selectedSupport, setSelectedSupport] = useState<auth.SupportTicket | null>(null);
  const [supportReply, setSupportReply] = useState('');
  const [supportPending, setSupportPending] = useState(false);
  const [matchStats, setMatchStats] = useState<auth.AdminGameStats | null>(null);
  const [matchStatsPending, setMatchStatsPending] = useState(false);
  const [activeSection, setActiveSection] = useState<AdminSection>('users');

  const refreshUsers = async () => {
    try {
      const loaded = await auth.listAdminUsers();
      setUsers(loaded);
      setMessage(loaded.length ? '' : t('noUsers'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('usersLoadError'));
    }
  };

  const refreshEmailLogs = async (reportError = true) => {
    try { setEmailLogs(await auth.getEmailDeliveryLogs()); }
    catch (error) {
      if (reportError) setMessage(error instanceof Error ? error.message : t('emailHistoryError'));
    }
  };

  const refreshSupport = async (reportError = true) => {
    try {
      const result = await auth.listSupportTickets(supportStatusFilter || undefined);
      setSupportTickets(result.tickets);
      setSupportOpenCount(result.openCount);
      setSelectedSupportId((current) => current && result.tickets.some((ticket) => ticket.id === current) ? current : result.tickets[0]?.id ?? null);
    } catch (error) {
      if (reportError) setMessage(error instanceof Error ? error.message : t('supportLoadError'));
    }
  };

  const refreshSelectedSupport = async (id: string) => {
    try { setSelectedSupport(await auth.getSupportTicket(id)); }
    catch (error) { setMessage(error instanceof Error ? error.message : t('supportTicketError')); }
  };

  const refreshMatchStats = async (reportError = true) => {
    setMatchStatsPending(true);
    try {
      setMatchStats(await auth.getAdminGameStats());
    } catch (error) {
      if (reportError) setMessage(error instanceof Error ? error.message : t('matchStatsLoadError'));
    } finally {
      setMatchStatsPending(false);
    }
  };

  useEffect(() => {
    void refreshUsers();
    void refreshEmailLogs();
    void refreshSupport();
    void auth.getSmtpSettings().then((value) => {
      if (!value) return;
      setSmtp({ host: value.host, port: value.port, secure: value.secure, username: value.username, from: value.from, password: '' });
      setSmtpConfigured(value.passwordConfigured);
      setTestRecipient(value.from);
    }).catch((error) => setMessage(error instanceof Error ? error.message : t('smtpSaveError')));
  }, []);

  useEffect(() => {
    if (!selectedSupportId) { setSelectedSupport(null); return; }
    void refreshSelectedSupport(selectedSupportId);
  }, [selectedSupportId]);

  useEffect(() => { if (activeSection === 'support') void refreshSupport(false); }, [activeSection, supportStatusFilter]);
  useEffect(() => {
    if (activeSection === 'match-stats' && !matchStats) void refreshMatchStats();
  }, [activeSection, matchStats]);

  const toggleActive = async (user: auth.AdminUser) => {
    try { await auth.setAdminUserActive(user.id, !user.isActive); await refreshUsers(); }
    catch (error) { setMessage(error instanceof Error ? error.message : t('userUpdateError')); }
  };

  const toggleVerified = async (user: auth.AdminUser) => {
    const verify = !user.emailVerifiedAt;
    if (!verify && !window.confirm(t('removeVerificationConfirm', { email: user.email }))) return;
    try {
      const { emailDeliveryWarning } = await auth.setAdminUserVerified(user.id, verify);
      await refreshUsers();
      void refreshEmailLogs(false);
      if (!verify) setMessage(t('verificationRemoved', { email: user.email }));
      else setMessage(emailDeliveryWarning ?? t('manuallyVerified', { email: user.email }));
    } catch (error) { setMessage(error instanceof Error ? error.message : t('verificationUpdateError')); }
  };

  const resetPassword = async (user: auth.AdminUser) => {
    const password = window.prompt(t('passwordPrompt', { email: user.email }));
    if (!password) return;
    try {
      await auth.setAdminUserPassword(user.id, password);
      setMessage(t('passwordUpdated', { email: user.email }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('passwordUpdateError'));
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
      setMessage(t('smtpSaved'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('smtpSaveError'));
    } finally {
      setSmtpPending(false);
    }
  };

  const testSmtp = async () => {
    if (!testRecipient.trim()) {
      setMessage(t('indicateRecipient'));
      return;
    }
    setSmtpPending(true);
    setMessage(t('savingSmtp'));
    try {
      await persistSmtp();
      setMessage(`${t('testConnection')}: ${smtp.host}:${smtp.port}`);
      const result = await auth.testSmtpSettings(testRecipient.trim());
      // Compatible con respuestas de servidores ya desplegados que no
      // incluyan el campo accepted en la prueba SMTP.
      result.accepted = Array.isArray(result.accepted) ? result.accepted : [testRecipient.trim()];
      setMessage(`${t('smtpAccepted', { recipients: result.accepted.join(', ') })}${result.messageId ? ` ${t('id', { id: result.messageId })}` : ''}${result.response ? ` · ${result.response}` : ''}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('smtpTestFailed'));
    } finally {
      setSmtpPending(false);
      void refreshEmailLogs(false);
    }
  };

  const failedEmailCount = emailLogs.filter((entry) => entry.status === 'FAILED').length;
  const tabs: Array<{ id: AdminSection; label: string; count?: number }> = [
    { id: 'users', label: t('sections.users'), count: users.length },
    { id: 'support', label: t('sections.support'), count: supportOpenCount || undefined },
    { id: 'match-stats', label: t('sections.matchStats'), count: matchStats?.totals.users || undefined },
    { id: 'smtp', label: t('sections.smtp') },
    { id: 'email-logs', label: t('sections.logs'), count: failedEmailCount || undefined },
  ];

  return <section className="panel stack super-admin-panel">
    <div><p className="eyebrow">{t('restricted')}</p><h2>{t('title')}</h2><p className="muted">{t('description')}</p></div>
    <nav className="tabs admin-tabs" role="tablist" aria-label={t('title')}>
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
      <header className="admin-section__heading"><div><h3>{t('usersTitle')}</h3><p className="muted small">{t('usersDescription')}</p></div></header>
      <div className="admin-user-list">
        {users.map((user) => <article className="admin-user" key={user.id}>
          <div><strong>{user.nickname || user.email}</strong><span>{user.email}</span><small>{t('access', { provider: authProviderLabel(user.authProvider, locale) })} · {t('lastAccess', { date: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString(locale) : t('never') })} · {t('savedLists', { count: user.savedLists })}{user.emailVerifiedAt && ` · ${t('verifiedAt', { date: new Date(user.emailVerifiedAt).toLocaleString(locale) })}`}</small></div>
          <div className="row"><span className={`chip ${user.isActive ? '' : 'chip--unique'}`}>{user.isActive ? t('active') : t('inactive')}</span><span className="chip">{authProviderLabel(user.authProvider, locale)}</span><span className={`chip ${user.emailVerifiedAt ? '' : 'chip--unique'}`}>{user.emailVerifiedAt ? t('verified') : t('unverified')}</span><button onClick={() => { void toggleVerified(user); }}>{user.emailVerifiedAt ? t('removeVerification') : t('verify')}</button><button onClick={() => { void toggleActive(user); }}>{user.isActive ? t('deactivate') : t('activate')}</button><button onClick={() => { void resetPassword(user); }}>{t('changePassword')}</button></div>
        </article>)}
      </div>
    </section>}

    {activeSection === 'support' && <section className="admin-section admin-support stack" id="admin-panel-support" role="tabpanel" aria-labelledby="admin-tab-support">
      <div className="row email-log-heading"><div><h3>{t('supportRequests')}</h3><p className="muted small">{t('supportDescription', { count: supportOpenCount })}</p></div><div className="row"><select aria-label={t('filterStatus')} value={supportStatusFilter} onChange={(event) => setSupportStatusFilter(event.target.value as auth.SupportStatus | '')}><option value="">{t('allStatuses')}</option><option value="OPEN">{t('open')}</option><option value="ANSWERED">{t('answered')}</option><option value="CLOSED">{t('closed')}</option></select><button type="button" onClick={() => { void refreshSupport(); }}>{t('refresh')}</button></div></div>
      <div className="admin-support-layout">
        <div className="admin-support-list">
          {supportTickets.length === 0 ? <p className="muted">{t('noSupport')}</p> : supportTickets.map((ticket) => <button type="button" className={`admin-support-ticket${ticket.id === selectedSupportId ? ' admin-support-ticket--active' : ''}`} key={ticket.id} onClick={() => setSelectedSupportId(ticket.id)}><strong>{ticket.subject}</strong><span>{ticket.contactEmail}</span><small>{supportStatusLabel[ticket.status]} · {new Date(ticket.updatedAt).toLocaleString(locale)}</small></button>)}
        </div>
        <article className="admin-support-detail">
          {!selectedSupport ? <p className="muted">{t('selectSupport')}</p> : <>
            <header className="admin-support-detail__heading"><div><p className="eyebrow">{t('ticket', { id: selectedSupport.id })}</p><h4>{selectedSupport.subject}</h4><p className="muted small">{selectedSupport.contactEmail} · {t('created', { date: new Date(selectedSupport.createdAt).toLocaleString(locale) })}</p></div><select aria-label={t('status')} value={selectedSupport.status} onChange={async (event) => { const status = event.target.value as auth.SupportStatus; try { await auth.setSupportStatus(selectedSupport.id, status); setSelectedSupport({ ...selectedSupport, status }); await refreshSupport(false); } catch (error) { setMessage(error instanceof Error ? error.message : t('statusUpdateError')); } }}><option value="OPEN">{t('open')}</option><option value="ANSWERED">{t('answered')}</option><option value="CLOSED">{t('closed')}</option></select></header>
            <div className="admin-support-thread">{selectedSupport.messages?.map((item) => <div className={`admin-support-message admin-support-message--${item.authorType.toLowerCase()}`} key={item.id}><div className="admin-support-message__meta"><strong>{item.authorType === 'ADMIN' ? t('administrator') : selectedSupport.contactEmail}</strong><span>{new Date(item.createdAt).toLocaleString(locale)}</span>{item.authorType === 'ADMIN' && <span className={`chip ${item.deliveryStatus === 'FAILED' ? 'chip--unique' : ''}`}>{item.deliveryStatus === 'SENT' ? t('emailSent') : item.deliveryStatus === 'FAILED' ? t('emailFailed') : t('pending')}</span>}</div><p>{item.body}</p>{item.deliveryError && <small className="email-log-error">{item.deliveryError}</small>}</div>)}</div>
            <form className="admin-support-reply stack" onSubmit={async (event) => { event.preventDefault(); if (!supportReply.trim()) return; setSupportPending(true); try { const result = await auth.replyToSupport(selectedSupport.id, supportReply.trim()); setSupportReply(''); await refreshSelectedSupport(selectedSupport.id); await refreshSupport(false); setMessage(result.emailDeliveryWarning ?? t('replySaved')); } catch (error) { setMessage(error instanceof Error ? error.message : t('replySaveError')); } finally { setSupportPending(false); } }}><label className="field">{t('reply')}<textarea value={supportReply} onChange={(event) => setSupportReply(event.target.value)} required maxLength={10000} rows={5} placeholder={t('replyPlaceholder')} /></label><div className="row"><button type="submit" disabled={supportPending}>{supportPending ? t('sending') : t('sendReply')}</button></div></form>
          </>}
        </article>
      </div>
    </section>}

    {activeSection === 'match-stats' && <section className="admin-section admin-match-stats stack" id="admin-panel-match-stats" role="tabpanel" aria-labelledby="admin-tab-match-stats">
      <div className="row email-log-heading"><div><h3>{t('matchStatsTitle')}</h3><p className="muted small">{t('matchStatsDescription')}</p></div><button type="button" onClick={() => { void refreshMatchStats(); }} disabled={matchStatsPending}>{matchStatsPending ? t('loadingMatchStats') : t('matchStatsRefresh')}</button></div>
      {matchStatsPending && !matchStats ? <p className="muted">{t('loadingMatchStats')}</p> : matchStats && <>
        <div className="admin-match-stats-summary" aria-label={t('matchStatsTitle')}>
          <div className="admin-match-stat"><span>{t('matchStatsUsers')}</span><strong>{matchStats.totals.users}</strong></div>
          <div className="admin-match-stat"><span>{t('matchStatsGames')}</span><strong>{matchStats.totals.sessions}</strong></div>
          <div className="admin-match-stat"><span>{t('matchStatsActive')}</span><strong>{matchStats.totals.active}</strong></div>
          <div className="admin-match-stat"><span>{t('matchStatsFinished')}</span><strong>{matchStats.totals.finished}</strong></div>
          <div className="admin-match-stat"><span>{t('matchStatsAbandoned')}</span><strong>{matchStats.totals.abandoned}</strong></div>
          <div className="admin-match-stat"><span>{t('matchStatsGuests')}</span><strong>{matchStats.totals.guestSessions}</strong></div>
        </div>
        {matchStats.users.length === 0 ? <p className="muted">{t('matchStatsNoUsers')}</p> : <div className="admin-match-stats-table-wrap">
          <table className="admin-match-stats-table">
            <caption className="sr-only">{t('matchStatsTitle')}</caption>
            <thead><tr><th scope="col">{t('matchStatsUser')}</th><th scope="col">{t('matchStatsGames')}</th><th scope="col">{t('matchStatsConfiguration')}</th><th scope="col">{t('matchStatsActive')}</th><th scope="col">{t('matchStatsFinished')}</th><th scope="col">{t('matchStatsAbandoned')}</th><th scope="col">{t('matchStatsLastActivity')}</th></tr></thead>
            <tbody>{matchStats.users.map((user) => <tr key={user.userId}>
              <th scope="row"><strong>{user.nickname || user.email}</strong>{user.nickname && <small>{user.email}</small>}</th>
              <td>{user.sessions}</td><td>{user.configuration}</td><td>{user.active}</td><td>{user.finished}</td><td>{user.abandoned}</td>
              <td>{user.lastActivityAt ? new Date(user.lastActivityAt).toLocaleString(locale) : t('never')}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </>}
    </section>}

    {activeSection === 'smtp' && <form className="admin-section admin-smtp stack" id="admin-panel-smtp" role="tabpanel" aria-labelledby="admin-tab-smtp" onSubmit={saveSmtp}>
      <div><h3>{t('smtpTitle')}</h3><p className="muted small">{t('smtpDescription')}</p></div>
      <div className="settings-grid">
        <label className="field">{t('server')}<input required value={smtp.host} onChange={(event) => setSmtp({ ...smtp, host: event.target.value })} placeholder="smtp.example.com" /></label>
        <label className="field">{t('port')}<input required type="number" min="1" max="65535" value={smtp.port} onChange={(event) => setSmtp({ ...smtp, port: Number(event.target.value) })} /></label>
        <label className="field">{t('username')}<input value={smtp.username} onChange={(event) => setSmtp({ ...smtp, username: event.target.value })} /></label>
        <label className="field">{t('sender')}<input required type="email" value={smtp.from} onChange={(event) => setSmtp({ ...smtp, from: event.target.value })} /></label>
      </div>
      <label className="field">{t('smtpPassword')} {smtpConfigured && <span className="muted small">{t('preservePassword')}</span>}<input type="password" value={smtp.password} onChange={(event) => setSmtp({ ...smtp, password: event.target.value })} /></label>
      <label className="row"><input type="checkbox" checked={smtp.secure} onChange={(event) => setSmtp({ ...smtp, secure: event.target.checked })} /> {t('implicitTls')}</label>
      <div className="smtp-test-row">
        <label className="field">{t('testRecipient')}<input type="email" value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} placeholder="you@example.com" /></label>
        <div className="row"><button type="submit" disabled={smtpPending}>{t('saveSmtp')}</button><button type="button" disabled={smtpPending} onClick={() => { void testSmtp(); }}>{smtpPending ? t('testing') : t('testConnection')}</button></div>
      </div>
    </form>}

    {activeSection === 'email-logs' && <section className="admin-section email-log-section stack" id="admin-panel-email-logs" role="tabpanel" aria-labelledby="admin-tab-email-logs">
      <div className="row email-log-heading"><div><h3>{t('emailHistory')}</h3><p className="muted small">{t('emailHistoryDescription')}</p></div><button onClick={() => { void refreshEmailLogs(); }}>{t('refresh')}</button></div>
      {emailLogs.length === 0
        ? <p className="muted">{t('noEmails')}</p>
        : <div className="email-log-list">{emailLogs.map((entry) => <article className="email-log-item" key={entry.id}>
          <div><strong>{entry.subject}</strong><span>{entry.recipient}</span><small>{new Date(entry.createdAt).toLocaleString(locale)} · {t(`messageType.${entry.messageType}`)}</small></div>
          <div className="email-log-result"><span className={`chip ${entry.status === 'FAILED' ? 'chip--unique' : ''}`}>{entry.status === 'SENT' ? t('sent') : t('failed')}</span>{entry.errorMessage && <small className="email-log-error">{entry.errorMessage}</small>}{entry.providerMessageId && <small>{t('id', { id: entry.providerMessageId })}</small>}</div>
        </article>)}</div>}
    </section>}
  </section>;
}
