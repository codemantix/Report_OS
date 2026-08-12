import { useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Banknote,
  History,
  MessageSquare,
  ReceiptText,
  Scale,
  ScrollText,
  UserCheck,
} from 'lucide-react';
import {
  auditCategory,
  auditEntityLabel,
  auditEventLabel,
} from '../../utils/auditConstants';
import {
  changedAuditFields,
  formatAuditValue,
  prettifyAuditField,
} from '../../utils/auditEventClassification';
import styles from './Audit.module.css';

const CATEGORY_ICONS = {
  evaluation: Scale,
  review: MessageSquare,
  stipend: Banknote,
  payment: ReceiptText,
  attendance: Activity,
  period: ScrollText,
  config: UserCheck,
  other: History,
};

function personName(person) {
  return person?.full_name || person?.display_name || person?.email || '—';
}

function subjectName(row) {
  return row.employee?.full_name
    || row.employee?.display_name
    || row.employee?.email
    || row.evaluation?.employee_name_snapshot
    || null;
}

export default function AuditList({ rows }) {
  const [expanded, setExpanded] = useState(null);

  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <History />
        <strong>No audit records found</strong>
        <p>Adjust the filters to see evaluation, review, stipend, and payment actions.</p>
      </div>
    );
  }

  return (
    <div className={styles.timeline}>
      {rows.map((row) => {
        const category = auditCategory(row.event_type);
        const Icon = CATEGORY_ICONS[category] || History;
        const subject = subjectName(row);
        const changes = changedAuditFields(row.old_values || {}, row.new_values || {});
        const isExpanded = expanded === row.id;
        const isInsert = row.action === 'insert';

        return (
          <article className={styles.card} key={row.id}>
            <div className={styles.cardHeader}>
              <span className={`${styles.eventIcon} ${styles[`icon_${category}`]}`}><Icon /></span>
              <div className={styles.eventMain}>
                <h3>{auditEventLabel(row.event_type)}</h3>
                <p>
                  {auditEntityLabel(row.entity_type)}
                  {subject ? ` · ${subject}` : ''}
                  {row.department?.name ? ` · ${row.department.name}` : ''}
                </p>
              </div>
              <div className={styles.eventMeta}>
                <span className={styles.actor}><BadgeCheck /> {personName(row.actor)}</span>
                <span className={styles.timestamp}>{new Date(row.occurred_at).toLocaleString()}</span>
              </div>
            </div>

            {row.reason && <blockquote className={styles.reason}>Reason: {row.reason}</blockquote>}

            <div className={styles.changeSummary}>
              {isInsert ? (
                <p className={styles.muted}>Record created — {changes.length} field{changes.length === 1 ? '' : 's'} initialized.</p>
              ) : changes.length === 0 ? (
                <p className={styles.muted}>No tracked field changes.</p>
              ) : (
                <p className={styles.muted}>{changes.length} field{changes.length === 1 ? '' : 's'} changed.</p>
              )}
              {changes.length > 0 && (
                <button
                  type="button"
                  className={styles.detailButton}
                  onClick={() => setExpanded(isExpanded ? null : row.id)}
                >
                  {isExpanded ? 'Hide details' : 'Show details'}
                </button>
              )}
            </div>

            {isExpanded && changes.length > 0 && (
              <div className={styles.diffTable}>
                {changes.slice(0, 12).map((change) => (
                  <div className={styles.diffRow} key={change.field}>
                    <div className={styles.diffField}>{prettifyAuditField(change.field)}</div>
                    <div className={styles.diffOld}>{formatAuditValue(change.oldValue)}</div>
                    <div className={styles.diffArrow}>→</div>
                    <div className={styles.diffNew}>{formatAuditValue(change.newValue)}</div>
                  </div>
                ))}
                {changes.length > 12 && (
                  <p className={styles.muted}>… and {changes.length - 12} more fields.</p>
                )}
              </div>
            )}

            {row.request_id && <p className={styles.requestId}>Request {row.request_id}</p>}
          </article>
        );
      })}
    </div>
  );
}
