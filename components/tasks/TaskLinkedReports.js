import { ExternalLink, FileText } from 'lucide-react';
import { useRouter } from 'next/router';
import { formatDateTime } from '../../utils/dateHelpers';
import { getProfileDisplayName } from '../../utils/profileHelpers';
import styles from './Tasks.module.css';

export default function TaskLinkedReports({ reports = [] }) {
  const router = useRouter();

  if (reports.length === 0) {
    return <p className={styles.linkedReportsEmpty}>No reports have been submitted for this task yet.</p>;
  }

  return (
    <div className={styles.linkedReportsList}>
      {reports.map((report) => (
        <button
          key={report.id}
          type="button"
          className={styles.linkedReportCard}
          onClick={() => router.push(`/dashboard/reports/${report.id}`)}
        >
          <span className={styles.linkedReportIcon} aria-hidden="true">
            <FileText size={18} />
          </span>
          <span className={styles.linkedReportContent}>
            <span className={styles.linkedReportTitle}>{report.project_name || 'Untitled report'}</span>
            <span className={styles.linkedReportMeta}>
              {report.report_type?.replace(/_/g, ' ')} · {getProfileDisplayName(report.users, 'Unknown')} · {formatDateTime(report.submitted_at)}
            </span>
          </span>
          <span className={styles.linkedReportStats}>
            {report.completion_percentage !== null && report.completion_percentage !== undefined && (
              <span className={styles.linkedReportProgress}>{report.completion_percentage}% complete</span>
            )}
            <ExternalLink size={16} aria-hidden="true" />
          </span>
        </button>
      ))}
    </div>
  );
}
