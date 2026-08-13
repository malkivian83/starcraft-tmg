import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { loadCatalog } from '@/catalog/loader';
import { buildCatalogIndex } from '@/engine/catalogIndex';
import type { Race } from '@/engine/types';
import { normalizeLocale, type SupportedLocale } from '@/i18n/types';
import type { MatchRecord, MatchResult, MatchRecordInput } from '@/auth/listService';
import { groupByOpponentRace, winRatePercent } from './matchStats';
import { MatchDonut } from './MatchDonut';
import { useMatchRecords } from './useMatchRecords';

const RACES: Race[] = ['ZERG', 'TERRAN', 'PROTOSS'];
const RACE_LABEL: Record<Race, string> = { ZERG: 'Zerg', TERRAN: 'Terran', PROTOSS: 'Protoss' };
const RESULT_LABEL: Record<MatchResult, 'statsWin' | 'statsLoss' | 'statsDraw'> = {
  WIN: 'statsWin',
  LOSS: 'statsLoss',
  DRAW: 'statsDraw',
};

interface MatchFormState {
  result: MatchResult | null;
  playedOn: string;
  opponentRace: Race | null;
  opponentFactionCardId: string;
  opponentName: string;
}

function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function emptyForm(playedOn = localToday()): MatchFormState {
  return { result: null, playedOn, opponentRace: null, opponentFactionCardId: '', opponentName: '' };
}

function formFromMatch(match: MatchRecord): MatchFormState {
  return {
    result: match.result,
    playedOn: match.playedOn ?? '',
    opponentRace: match.opponentRace,
    opponentFactionCardId: match.opponentFactionCardId ?? '',
    opponentName: match.opponentName ?? '',
  };
}

export function formatPlayedOn(value: string | null, locale: SupportedLocale): string {
  if (!value) return '—';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString(locale);
}

function matchInput(form: MatchFormState): MatchRecordInput | null {
  if (!form.result) return null;
  return {
    result: form.result,
    playedOn: form.playedOn || null,
    opponentRace: form.opponentRace,
    opponentFactionCardId: form.opponentFactionCardId || null,
    opponentName: form.opponentName,
  };
}

export function StepStatistics({ listId }: { listId: string }) {
  const { t, i18n } = useTranslation('builderUi');
  const { t: tCommon } = useTranslation('common');
  const locale = normalizeLocale(i18n.language) ?? 'es';
  const { matches, summary, status, error, isMutating, create, update, remove, reload } = useMatchRecords(listId);
  const [form, setForm] = useState<MatchFormState>(() => emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const today = localToday();

  const opponentFactions = useMemo(
    () => form.opponentRace
      ? buildCatalogIndex(loadCatalog(form.opponentRace).catalog).catalog.factionCards
      : [],
    [form.opponentRace],
  );
  const factionNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const race of RACES) {
      for (const card of buildCatalogIndex(loadCatalog(race).catalog).catalog.factionCards) names.set(card.id, card.name);
    }
    return names;
  }, []);
  const factionGroups = useMemo(() => groupByOpponentRace(matches), [matches]);

  if (status === 'loading') return <section className="panel empty no-print">{tCommon('loading')}</section>;
  if (status === 'error') return (
    <section className="panel empty no-print">
      <p>{error ?? t('statsLoadError')}</p>
      <button type="button" onClick={() => { void reload(); }}>{t('statsRetry')}</button>
    </section>
  );

  const winRate = winRatePercent(summary);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const input = matchInput(form);
    if (!input) return;
    const saved = editingId ? await update(editingId, input) : await create(input);
    if (!saved) return;
    setEditingId(null);
    setForm(emptyForm(input.playedOn ?? ''));
  };
  const edit = (match: MatchRecord) => {
    setEditingId(match.id);
    setForm(formFromMatch(match));
  };
  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm(form.playedOn || localToday()));
  };
  const deleteMatch = async (match: MatchRecord) => {
    if (!window.confirm(t('statsDeleteConfirm'))) return;
    const deleted = await remove(match.id);
    if (deleted && editingId === match.id) cancelEdit();
  };

  return (
    <div className="stats-layout no-print">
      <section className="panel no-print">
        <h2 className="panel__title">{t('statsTitle')}</h2>
        <p className="small muted stats-hint">{t('statsHint')}</p>
        <h3 className="stats-section-title">{t('statsBalance')}</h3>
        <dl className="stats-summary">
          <div><dt>{t('statsPlayed')}</dt><dd>{summary.played}</dd></div>
          <div className="stats-summary__win"><dt>{t('statsWins')}</dt><dd>{summary.wins}</dd></div>
          <div className="stats-summary__loss"><dt>{t('statsLosses')}</dt><dd>{summary.losses}</dd></div>
          <div className="stats-summary__draw"><dt>{t('statsDraws')}</dt><dd>{summary.draws}</dd></div>
          <div><dt>{t('statsWinRate')}</dt><dd>{winRate === null ? t('noValue') : `${winRate} %`}</dd></div>
        </dl>
        {factionGroups.length > 0 && (
          <div className="stats-chart-section">
            <h3 className="stats-section-title">{t('statsByFaction')}</h3>
            <div className="stats-chart-legend">
              <span><i className="stats-chart-legend__swatch stats-chart-legend__swatch--win" aria-hidden="true" />{t('statsWins')}</span>
              <span><i className="stats-chart-legend__swatch stats-chart-legend__swatch--loss" aria-hidden="true" />{t('statsLosses')}</span>
              <span><i className="stats-chart-legend__swatch stats-chart-legend__swatch--draw" aria-hidden="true" />{t('statsDraws')}</span>
            </div>
            <div className="stats-donuts">
              {factionGroups.map((group) => {
                const faction = group.id === 'UNKNOWN' ? t('statsUnknownFaction') : RACE_LABEL[group.id];
                return (
                  <MatchDonut
                    key={group.id}
                    group={group}
                    factionLabel={t('statsVs', { faction })}
                    playedLabel={t('statsPlayed').toLowerCase()}
                    ariaLabel={t('statsDonutAria', { faction, wins: group.wins, losses: group.losses, draws: group.draws, played: group.played })}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="panel no-print">
        <h2 className="panel__title">{editingId ? t('statsSaveChanges') : t('statsAdd')}</h2>
        <form className="stack stats-form" onSubmit={(event) => { void submit(event); }}>
          <fieldset className="stats-result-field">
            <legend>{t('statsResult')}</legend>
            <div className="stats-result-options">
              {(['WIN', 'LOSS', 'DRAW'] as MatchResult[]).map((result) => (
                <button
                  key={result}
                  type="button"
                  className={`stats-result-option stats-result--${result.toLowerCase()}${form.result === result ? ' stats-result-option--selected' : ''}`}
                  aria-pressed={form.result === result}
                  onClick={() => setForm((current) => ({ ...current, result }))}
                >
                  {t(RESULT_LABEL[result])}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="stats-form-grid">
            <label className="field">
              {t('statsDate')}
              <input type="date" value={form.playedOn} max={today} onChange={(event) => setForm((current) => ({ ...current, playedOn: event.target.value }))} />
            </label>
            <label className="field">
              {t('statsOpponentRace')}
              <select value={form.opponentRace ?? ''} onChange={(event) => {
                const value = event.target.value;
                setForm((current) => ({ ...current, opponentRace: value ? value as Race : null, opponentFactionCardId: '' }));
              }}>
                <option value="">{t('noValue')}</option>
                {RACES.map((race) => <option key={race} value={race}>{RACE_LABEL[race]}</option>)}
              </select>
            </label>
            <label className="field">
              {t('statsOpponentFaction')}
              <select
                value={form.opponentFactionCardId}
                disabled={!form.opponentRace}
                onChange={(event) => setForm((current) => ({ ...current, opponentFactionCardId: event.target.value }))}
              >
                <option value="">{form.opponentRace ? t('noValue') : t('statsChooseRaceFirst')}</option>
                {opponentFactions.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="stats-field-label">
                {t('statsOpponentName')} <span className="small muted">({t('statsOpponentNameHint')})</span>
              </span>
              <input maxLength={80} value={form.opponentName} onChange={(event) => setForm((current) => ({ ...current, opponentName: event.target.value }))} />
            </label>
          </div>
          {error && <p className="issue issue--error stats-form-error">{error}</p>}
          <div className="row">
            <button type="submit" disabled={!form.result || isMutating}>{editingId ? t('statsSaveChanges') : t('statsAdd')}</button>
            {editingId && <button type="button" onClick={cancelEdit} disabled={isMutating}>{t('statsCancel')}</button>}
          </div>
        </form>
      </section>

      <section className="panel no-print">
        <h2 className="panel__title">{t('statsHistory')}</h2>
        {matches.length === 0 ? <p className="empty">{t('statsEmpty')}</p> : (
          <div className="stats-history-table">
            <table>
              <thead>
                <tr><th>{t('statsResult')}</th><th>{t('statsDate')}</th><th>{t('statsOpponentRace')} / {t('statsOpponentFaction')}</th><th>{t('statsOpponentName')}</th><th>{t('statsActions')}</th></tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr key={match.id}>
                    <td><span className={`chip stats-result ${`stats-result--${match.result.toLowerCase()}`}`}>{t(RESULT_LABEL[match.result])}</span></td>
                    <td>{formatPlayedOn(match.playedOn, locale)}</td>
                    <td>
                      <div>{match.opponentRace ? RACE_LABEL[match.opponentRace] : t('noValue')}</div>
                      <div className="small muted">{match.opponentFactionCardId ? factionNames.get(match.opponentFactionCardId) ?? match.opponentFactionCardId : t('noValue')}</div>
                    </td>
                    <td>{match.opponentName || t('noValue')}</td>
                    <td>
                      <div className="row stats-actions">
                        <button type="button" className="card-action" onClick={() => edit(match)} disabled={isMutating}>{t('statsEdit')}</button>
                        <button type="button" className="card-action stats-delete-button" onClick={() => { void deleteMatch(match); }} disabled={isMutating}>{t('statsDelete')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
