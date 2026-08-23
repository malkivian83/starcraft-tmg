import type { CatalogIndex } from '@/engine/catalogIndex';
import type { ArmyList, ValidationIssue } from '@/engine/types';
import { localizedText } from '@/i18n/localized-content';

export function ValidationIssueList({
  issues,
  list,
  index,
  locale,
  className = 'stack validation-issue-list',
}: {
  issues: ValidationIssue[];
  list: ArmyList;
  index: CatalogIndex;
  locale: 'es' | 'en';
  className?: string;
}) {
  return (
    <ul className={className}>
      {issues.map((issue, i) => {
        const affected = issue.entryInstanceId
          ? list.entries.find((entry) => entry.instanceId === issue.entryInstanceId)
          : undefined;
        const affectedUnit = affected
          ? index.unitEntries.get(affected.unitEntryId)?.name
          : undefined;
        const affectedPosition = affected ? list.entries.indexOf(affected) + 1 : 0;
        const affectedLabel = affected && affectedUnit
          ? affected.customLabel || `${affectedUnit} #${affectedPosition}`
          : undefined;
        return (
          <li key={`${issue.rule}-${issue.entryInstanceId ?? 'list'}-${i}`} className={`issue issue--${issue.severity}`}>
            <span className="issue__rule">{issue.rule} · {issue.ruleRef}</span>
            {affectedLabel && <span className="issue__affected">{affectedLabel}</span>}
            <div>{localizedText(issue.message, locale)}</div>
            {issue.remedy && (
              <div className="issue__remedy">→ {localizedText(issue.remedy, locale)}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
