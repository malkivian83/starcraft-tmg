import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '@/i18n/config';
import { CardImageModal, CardPreviewButton } from '@/ui/common/CardImagePreview';

describe('visor de carta original', () => {
  it('renderiza una lupa accesible como botón independiente', () => {
    const html = renderToStaticMarkup(
      <CardPreviewButton cardName="Zergling" onOpen={() => undefined} />,
    );
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-label="Ver carta original de Zergling"');
    expect(html).toContain('<svg');
  });

  it('conserva el orden anverso → reverso y deja el contenido localizado debajo', () => {
    const html = renderToStaticMarkup(
      <CardImageModal
        title="Zergling"
        images={[
          { src: 'cards/zerg/unit-zergling-front.webp', alt: 'Anverso de Zergling' },
          { src: 'cards/zerg/unit-zergling-back.webp', alt: 'Reverso de Zergling' },
        ]}
        onClose={() => undefined}
      >
        <p>Descripción localizada</p>
      </CardImageModal>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html.indexOf('unit-zergling-front.webp')).toBeLessThan(
      html.indexOf('unit-zergling-back.webp'),
    );
    expect(html.indexOf('unit-zergling-back.webp')).toBeLessThan(
      html.indexOf('Descripción localizada'),
    );
  });
});
