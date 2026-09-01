import { useTranslation } from 'react-i18next';
import { FAQ_SECTIONS } from '@/content/faqs';
import { routeLocale } from '@/i18n/routing';

const ORIGINAL_PDF = '/documents/StarCraft-TMG-FAQ_EN.pdf';

export function FaqPage() {
  const { t } = useTranslation('faqs');
  const locale = routeLocale(window.location.pathname);

  return <main className="content page-content faq-page no-print">
    <section className="page-heading faq-page__heading">
      <div><p className="eyebrow">{t('eyebrow')}</p><h1>{t('title')}</h1><p className="muted">{t('description')}</p></div>
      <a className="faq-page__pdf-button" href={ORIGINAL_PDF} target="_blank" rel="noreferrer">{t('originalPdf')} <span aria-hidden="true">↗</span></a>
    </section>
    <p className="faq-page__source">{t('source')}</p>
    <nav className="faq-page__index" aria-label={t('title')}>
      {FAQ_SECTIONS.map((section) => <a key={section.id} href={`#faq-${section.id}`}>{section.title[locale]}</a>)}
    </nav>
    <div className="faq-page__sections">
      {FAQ_SECTIONS.map((section) => <section className="faq-section" id={`faq-${section.id}`} key={section.id}>
        <h2>{section.title[locale]}</h2>
        <div className="faq-section__items">
          {section.items.map((item, index) => <details className="faq-item" key={`${section.id}-${index}`}>
            <summary>{item.question[locale]}</summary>
            <div className="faq-item__answer"><span>{t('answer')}</span><p>{item.answer[locale]}</p></div>
          </details>)}
        </div>
      </section>)}
    </div>
  </main>;
}
