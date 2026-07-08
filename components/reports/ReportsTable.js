import { useRouter } from 'next/router';
import { Eye, FileText, MessageSquare, CheckCircle } from 'lucide-react';
import { formatDateTime, timeAgo } from '../../utils/dateHelpers';
import { getProfileDisplayName, getProfileInitials } from '../../utils/profileHelpers';
import styles from './Reports.module.css';
import Image from 'next/image';

function getRiskBadge(riskLevel) {
  if (!riskLevel) return 'badge-neutral';
  const map = {
    high: 'badge-danger',
    medium: 'badge-warning',
    low: 'badge-success',
  };
  return map[riskLevel] || 'badge-neutral';
}

function getScoreBadge(score) {
  if (score === null || score === undefined) return 'badge-neutral';
  if (score >= 80) return 'badge-success';
  if (score >= 60) return 'badge-warning';
  return 'badge-danger';
}

function formatScore(score) {
  return score === null || score === undefined ? '—' : `${score}%`;
}

function getLatestAnalysis(analysis) {
  if (!Array.isArray(analysis)) return analysis || null;
  if (analysis.length === 0) return null;

  return [...analysis].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  })[0];
}

export default function ReportsTable({
  reports,
  emptyMessage = 'No reports found',
  selectedReportIds = [],
  onSelectReport,
  onSelectAll,
  isAdmin = false,
}) {
  const router = useRouter();

  if (!reports || reports.length === 0) {
    return (
      <div className={styles.emptyState}>
        <FileText className={styles.emptyIcon} />
        <p className={styles.emptyText}>{emptyMessage}</p>
      </div>
    );
  }

  const allSelected = reports.length > 0 && reports.every((r) => selectedReportIds.includes(r.id));

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {isAdmin && (
              <th className={styles.th} style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                  aria-label="Select all reports"
                />
              </th>
            )}
            <th className={styles.th}>Team Member</th>
            <th className={styles.th}>Department</th>
            <th className={styles.th}>Type</th>
            <th className={styles.th}>Project</th>
            <th className={styles.th}>Submitted</th>
            <th className={styles.th}>Goal Align.</th>
            <th className={styles.th}>Progress</th>
            <th className={styles.th}>Success</th>
            <th className={styles.th}>Risk</th>
            <th className={styles.th}>AI</th>
            <th className={styles.th}>Reviewed</th>
            <th className={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => {
            const userName = getProfileDisplayName(report.users, 'Unknown');
            const initials = getProfileInitials(report.users, 'U');
            const aiData = getLatestAnalysis(report.report_ai_analysis);
            const isSelected = selectedReportIds.includes(report.id);

            return (
              <tr key={report.id} className={styles.tr}>
                {isAdmin && (
                  <td className={styles.td}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelectReport(report.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                      aria-label={`Select report by ${userName}`}
                    />
                  </td>
                )}
                <td className={styles.td}>
                  <div className={styles.userCell}>
                    <div className={styles.userAvatar}>
                      {report.users?.avatar_url ? (
                        <Image src={report.users.avatar_url} alt={userName} className={styles.userAvatarImage} width={32} height={32} />
                      ) : (
                        initials
                      )}
                    </div>
                    <span className={styles.userName}>{userName}</span>
                  </div>
                </td>
                <td className={styles.td}>{report.departments?.name || 'N/A'}</td>
                <td className={styles.td}>
                  <span className={styles.typeBadge}>{report.report_type?.replace('_', ' ')}</span>
                </td>
                <td className={styles.td}>{report.project_name || 'N/A'}</td>
                <td className={styles.td} title={formatDateTime(report.submitted_at)}>
                  {timeAgo(report.submitted_at)}
                </td>
                <td className={styles.td}>
                  <span className={`${styles.scoreBadge} ${getScoreBadge(aiData?.goal_alignment_score)}`}>
                    {formatScore(aiData?.goal_alignment_score)}
                  </span>
                </td>
                <td className={styles.td}>
                  <span className={`${styles.scoreBadge} ${getScoreBadge(aiData?.progress_score)}`}>
                    {formatScore(aiData?.progress_score)}
                  </span>
                </td>
                <td className={styles.td}>
                  <span className={`${styles.scoreBadge} ${getScoreBadge(aiData?.success_rate)}`}>
                    {formatScore(aiData?.success_rate)}
                  </span>
                </td>
                <td className={styles.td}>
                  <span className={`${getRiskBadge(aiData?.risk_level)}`}>
                    {aiData?.risk_level || 'Pending'}
                  </span>
                </td>
                <td className={styles.td}>
                  <span className={report.ai_status === 'completed' ? styles.statusSuccess : report.ai_status === 'failed' ? styles.statusFailed : styles.statusPending}>
                    {report.ai_status || 'pending'}
                  </span>
                </td>
                <td className={styles.td}>
                  {report.reviewed ? (
                    <span className={styles.reviewedBadge}>Reviewed</span>
                  ) : (
                    <span className={styles.unreviewedBadge}>Unreviewed</span>
                  )}
                </td>
                <td className={styles.td}>
                  <div className={styles.actionGroup}>
                    <button
                      onClick={() => router.push(`/dashboard/reports/${report.id}`)}
                      className={styles.actionBtn}
                      title="View Report"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
