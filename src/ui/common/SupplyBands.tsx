import type { SupplyBand } from '@/engine/types';
import { useTranslation } from 'react-i18next';
import './StatBlock.css';

/**
 * Tabla MODELS / SUPPLY de la carta: cuánto suministro vale la unidad según
 * cuántos modelos le queden en pie.
 *
 * No es un dato decorativo. El suministro actual decide quién controla un
 * Marcador de Misión y cuántos PV se lleva el rival al destruirte, así que en
 * mesa hay que poder mirar la lista y saber que un Roach con un solo modelo
 * vivo ya no puntúa. Se pinta con las casillas del `StatBlock` —el tramo de
 * modelos como rótulo y el suministro como valor— igual que en la carta.
 */
export function SupplyBands({
  bands,
  size = 'normal',
}: {
  bands: SupplyBand[];
  size?: 'normal' | 'small';
}) {
  const { t } = useTranslation('builder');
  if (bands.length === 0) return null;

  return (
    <div className={`supplybands supplybands--${size}`}>
      <span className="supplybands__caption">{t('stats.modelsSupply')}</span>
      <div className={`statblock statblock--${size}`}>
        {bands.map((band) => (
          <div className="statblock__cell" key={`${band.minModels}-${band.maxModels}`}>
            <span className="statblock__label">
              {band.minModels}-{band.maxModels}
            </span>
            <span className="statblock__value">{band.supply}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
