import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { localizedPath, routeLocale } from '@/i18n/routing';
import { ChangelogLink } from '@/ui/common/ChangelogLink';

const lastUpdated = '5 de agosto de 2026';
const siteDomain = 'starcraft-builder.com';

function TermsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="terms-page__section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function TermsPage() {
  const { t } = useTranslation('legal');
  const { t: tCookies } = useTranslation('cookies');
  const locale = routeLocale(window.location.pathname);
  return (
    <div className="terms-page">
      <main className="terms-page__main">
        <a className="terms-page__logo-link" href={localizedPath('home', locale)} aria-label={t('backHome')}>
          <img className="terms-page__logo" src="/logo.png" alt="StarCraft: The Miniatures Game" width={521} height={149} />
        </a>
        <article className="panel terms-page__article">
          <header className="terms-page__header">
            <p className="eyebrow">{t('eyebrow')}</p>
            <h1>{t('terms')}</h1>
            <p className="muted">{t('updated', { date: locale === 'en' ? 'August 5, 2026' : lastUpdated })}</p>
          </header>

          <div className="terms-page__content">
            <TermsSection title={t('sections.ownership.title')}>
              <p>{t('sections.ownership.p1', { domain: siteDomain })}</p>
              <p>{t('sections.ownership.p2')}</p>
            </TermsSection>

            <TermsSection title={t('sections.account.title')}>
              <p>{t('sections.account.p1')}</p>
              <p>{t('sections.account.p2')}</p>
            </TermsSection>

            <TermsSection title={tCookies('policyTitle')}>
              <p>{tCookies('policyText')}</p>
              <p>{tCookies('policyConsent')}</p>
            </TermsSection>

            <TermsSection title={t('sections.lists.title')}>
              <p>{t('sections.lists.p1')}</p>
              <p>{t('sections.lists.p2')}</p>
            </TermsSection>

            <TermsSection title={t('sections.ip.title')}>
              <p>{t('sections.ip.p1')}</p>
              <p>{t('sections.ip.p2')}</p>
            </TermsSection>

            <TermsSection title={t('sections.availability.title')}>
              <p>{t('sections.availability.p1')}</p>
            </TermsSection>

            <TermsSection title={t('sections.contact.title')}>
              <p>{t('sections.contact.p1', { domain: siteDomain })}</p>
            </TermsSection>
          </div>

          <footer className="terms-page__footer">
            <a href={localizedPath('home', locale)}>{t('backAccess')}</a>
            <span aria-hidden="true">·</span>
            <ChangelogLink />
          </footer>
        </article>
      </main>
    </div>
  );
}
