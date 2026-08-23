import { useState } from 'react';
import { encodeSeed } from '@/engine/seed/codec';
import type { ArmyList } from '@/engine/types';
import { decodeSeedForAnyRace } from './seedImport';
import { useListStore } from '@/store/listStore';
import { useTranslation } from 'react-i18next';

export function SeedPanel({ onImported }: { onImported: (list: ArmyList) => void }) {
  const { t } = useTranslation('builderUi');
  const { list, index } = useListStore(); const [input, setInput] = useState(''); const [message, setMessage] = useState<string | null>(null); const [copied, setCopied] = useState(false); const seed = encodeSeed(list, index);
  const copy = async () => { await navigator.clipboard.writeText(seed); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const importSeed = () => { const result = decodeSeedForAnyRace(input); if (!result?.list) { setMessage(t('invalidSeed')); return; } onImported(result.list); setMessage(result.status === 'partial' ? t('importedPartial', { items: result.missing.join(', ') }) : result.status === 'version_mismatch' ? t('importedVersion') : t('importedOk')); };
  return <section className="panel seed-panel"><div className="card__head"><div><p className="eyebrow">{t('seedShare')}</p><h2>{t('seedTitle')}</h2></div></div><div className="seed-panel__grid"><section><h3 className="panel__title">{t('yourSeed')}</h3><textarea className="seed-box" readOnly value={seed} rows={4} /><div className="row"><button onClick={() => { void copy(); }}>{copied ? t('copied') : t('copySeed')}</button><span className="small muted">{t('characters', { count: seed.length })}</span></div></section><section><h3 className="panel__title">{t('importSeed')}</h3><textarea className="seed-box" rows={4} placeholder={t('pasteSeed')} value={input} onChange={(event) => setInput(event.target.value)} /><button onClick={importSeed} disabled={!input.trim()}>{t('import')}</button></section></div>{message && <p className="page-message">{message}</p>}</section>;
}
