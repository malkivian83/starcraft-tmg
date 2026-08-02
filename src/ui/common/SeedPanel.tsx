import { useState } from 'react';
import { decodeSeed, encodeSeed } from '@/engine/seed/codec';
import { loadCatalog } from '@/catalog/loader';
import { buildCatalogIndex } from '@/engine/catalogIndex';
import type { ArmyList, Race } from '@/engine/types';
import { useListStore } from '@/store/listStore';

export function SeedPanel({ onImported }: { onImported: (list: ArmyList) => void }) {
  const { list, index } = useListStore(); const [input, setInput] = useState(''); const [message, setMessage] = useState<string | null>(null); const [copied, setCopied] = useState(false); const seed = encodeSeed(list, index);
  const copy = async () => { await navigator.clipboard.writeText(seed); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const importSeed = () => { for (const race of ['ZERG', 'TERRAN', 'PROTOSS'] as Race[]) { try { const result = decodeSeed(input, buildCatalogIndex(loadCatalog(race).catalog)); if (!result.list || result.status === 'corrupt' || result.list.race !== race) continue; onImported(result.list); setMessage(result.status === 'partial' ? `Importada parcialmente. Falta: ${result.missing.join(', ')}.` : result.status === 'version_mismatch' ? 'Importada, pero fue creada con otra versión del catálogo.' : 'Lista importada correctamente.'); return; } catch { /* Se prueba la siguiente raza. */ } } setMessage('El seed está incompleto o alterado. Cópialo entero de nuevo.'); };
  return <section className="panel seed-panel"><div className="card__head"><div><p className="eyebrow">Compartir</p><h2>Seed de la lista</h2></div></div><div className="seed-panel__grid"><section><h3 className="panel__title">Tu seed</h3><textarea className="seed-box" readOnly value={seed} rows={4} /><div className="row"><button onClick={() => { void copy(); }}>{copied ? '✓ Copiado' : 'Copiar seed'}</button><span className="small muted">{seed.length} caracteres</span></div></section><section><h3 className="panel__title">Importar seed</h3><textarea className="seed-box" rows={4} placeholder="Pega aquí un seed (SCT1-…)" value={input} onChange={(event) => setInput(event.target.value)} /><button onClick={importSeed} disabled={!input.trim()}>Importar seed</button></section></div>{message && <p className="page-message">{message}</p>}</section>;
}
