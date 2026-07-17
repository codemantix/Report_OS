import { useRouter } from 'next/router';
import { useRef } from 'react';
import { FileText } from 'lucide-react';
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
  onSelectionChange,
  isAdmin = false,
}) {
  const router = useRouter();

  const timerRef = useRef(null);
  const isLongPressRef = useRef(false);

  if (!reports || reports.length === 0) {
    return (
      <div className={styles.emptyState}>
        <FileText className={styles.emptyIcon} />
        <p className={styles.emptyText}>{emptyMessage}</p>
      </div>
    );
  }

  const isSelectionActive = isAdmin && selectedReportIds.length > 0;
  const allSelected = reports.length > 0 && reports.every((r) => selectedReportIds.includes(r.id));

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      onSelectionChange([...new Set([...selectedReportIds, ...reports.map((r) => r.id)])]);
    } else {
      const onPageIds = new Set(reports.map((r) => r.id));
      onSelectionChange(selectedReportIds.filter((id) => !onPageIds.has(id)));
    }
  };

  const handleSelectOne = (e, reportId) => {
    e.stopPropagation();
    if (e.target.checked) {
      onSelectionChange([...selectedReportIds, reportId]);
    } else {
      onSelectionChange(selectedReportIds.filter((id) => id !== reportId));
    }
  };

  const startPress = (e, reportId) => {
    if (!isAdmin) return;
    if (selectedReportIds.length > 0) return; // already in selection mode

    // Only handle left click on mouse
    if (e.type === 'mousedown' && e.button !== 0) return;

    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onSelectionChange([reportId]);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const cancelPress = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleRowClick = (e, report) => {
    // If a long press was triggered, absorb this click
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }

    if (selectedReportIds.length > 0) {
      e.preventDefault();
      if (selectedReportIds.includes(report.id)) {
        onSelectionChange(selectedReportIds.filter((id) => id !== report.id));
      } else {
        onSelectionChange([...selectedReportIds, report.id]);
      }
    } else {
      router.push(`/dashboard/reports/${report.id}`);
    }
  };

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {isSelectionActive && (
              <th className={styles.th} style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                  aria-label="Select all reports"
                />
              </th>
            )}
            <th className={styles.th}>Team Member</th>
            <th className={styles.th}>Department</th>
            <th className={styles.th}>Type</th>
            <th className={styles.th}>Report Title</th>
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
              <tr
                key={report.id}
                className={`${styles.tr} ${isSelected ? styles.trSelected : ''}`}
                onMouseDown={(e) => startPress(e, report.id)}
                onMouseUp={cancelPress}
                onMouseLeave={cancelPress}
                onTouchStart={(e) => startPress(e, report.id)}
                onTouchEnd={cancelPress}
                onTouchMove={cancelPress}
                onClick={(e) => handleRowClick(e, report)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                {isSelectionActive && (
                  <td className={styles.td} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleSelectOne(e, report.id)}
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
                <td className={styles.td}>
                  <span
                    className={styles.projectName}
                    title={report.project_name || 'N/A'}
                  >
                    {report.project_name || 'N/A'}
                  </span>
                </td>
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
                <td className={styles.td} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.actionGroup}>
                    <button
                      onClick={() => router.push(`/dashboard/reports/${report.id}`)}
                      className={styles.actionBtn}
                      title="View Report"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
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

