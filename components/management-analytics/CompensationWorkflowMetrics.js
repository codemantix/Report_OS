import { Banknote, CircleDollarSign } from 'lucide-react';
import styles from './ManagementAnalytics.module.css';

const STIPEND_CHIPS = {
  Approved: styles.chipApproved,
  Issued: styles.chipApproved,
  Recommended: styles.chipPaid,
  Draft: styles.chipDraft,
  Rejected: styles.chipRejected,
  'Awaiting recommendation': styles.chipPending,
  'Manual mode issued': styles.chipHeld,
};

const PAYMENT_CHIPS = {
  Paid: styles.chipApproved,
  Approved: styles.chipPaid,
  Pending: styles.chipPending,
  Held: styles.chipHeld,
};

function StatusGrid({ items, chipMap = {} }) {
  return (
    <div className={styles.statusGrid}>
      {items.map((item) => (
        <div key={item.label} className={styles.statusCard}>
          <div className={styles.statusCardHeader}>
            <span>{item.label}</span>
            {chipMap[item.label] && <span className={`${styles.statusChip} ${chipMap[item.label]}`} />}
          </div>
          <strong>{item.value ?? 0}</strong>
        </div>
      ))}
    </div>
  );
}

export default function CompensationWorkflowMetrics({ stipends, payments }) {
  return (
    <section className={styles.workflowGrid} aria-label="Stipend and payment workflow metrics">
      <article className={styles.workflowCard}>
        <header>
          <span><Banknote size={19} aria-hidden="true" /></span>
          <div>
            <h3>Stipend recommendations</h3>
            <p>Latest current recommendation per filtered evaluation</p>
          </div>
        </header>
        <StatusGrid
          chipMap={STIPEND_CHIPS}
          items={[
            { label: 'Current records', value: stipends.totalCurrentRecords },
            { label: 'Draft', value: stipends.draft },
            { label: 'Issued', value: stipends.issued },
            { label: 'Recommended', value: stipends.recommended },
            { label: 'Approved', value: stipends.approved },
            { label: 'Rejected', value: stipends.rejected },
            { label: 'Manual mode issued', value: stipends.manualModeRecommendations },
            { label: 'Awaiting recommendation', value: stipends.awaitingRecommendation },
          ]}
        />
      </article>
      <article className={styles.workflowCard}>
        <header>
          <span><CircleDollarSign size={19} aria-hidden="true" /></span>
          <div>
            <h3>Payment statuses</h3>
            <p>Latest internal tracking record per filtered evaluation</p>
          </div>
        </header>
        <StatusGrid
          chipMap={PAYMENT_CHIPS}
          items={[
            { label: 'Total records', value: payments.total },
            { label: 'Pending', value: payments.pending },
            { label: 'Approved', value: payments.approved },
            { label: 'Paid', value: payments.paid },
            { label: 'Held', value: payments.held },
          ]}
        />
      </article>
    </section>
  );
}
