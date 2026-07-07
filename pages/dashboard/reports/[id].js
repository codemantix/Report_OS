import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { fetchReportById, markReportReviewed, updateReport } from '../../../services/reportService';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import { formatDateTime } from '../../../utils/dateHelpers';
import { getScoreColor, getRiskBadgeColor, getRiskLabel } from '../../../utils/scoreHelpers';
import { getProfileDisplayName } from '../../../utils/profileHelpers';
import styles from '../../../components/reports/ReportDetails.module.css';

function getLatestAnalysis(analysis) {
  if (!Array.isArray(analysis)) return analysis || null;
  if (analysis.length === 0) return null;

  return [...analysis].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  })[0];
}

export default function ReportDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const autoAnalysisStartedRef = useRef(new Set());

  useEffect(() => {
    if (!id) return;
    async function init() {
      const profile = await getCurrentUserProfile();
      setCurrentUser(profile);
      loadReport();
    }
    init();
  }, [id]);

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await fetchReportById(id);
      if (fetchError) throw fetchError;
      if (!data) throw new Error('Report not found');
      setReport(data);
    } catch (err) {
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkReviewed() {
    try {
      const { error: updateError } = await markReportReviewed(id, currentUser?.id);
      if (updateError) throw updateError;
      toast.success('Report marked as reviewed');
      loadReport();
    } catch (err) {
      toast.error('Failed to update review status');
    }
  }

  async function runAnalysis({ silent = false } = {}) {
    const reportId = id;
    if (!reportId) return;

    setRetrying(true);
    setReport((prev) => (prev ? { ...prev, ai_status: 'processing' } : prev));

    try {
      const response = await fetch('/api/reports/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Analysis failed');
      if (!silent) toast.success('analysis completed');
      loadReport();
    } catch (err) {
      if (!silent) toast.error(err.message || 'analysis failed. Please try again.');
      setReport((prev) => (prev ? { ...prev, ai_status: 'failed' } : prev));
    } finally {
      setRetrying(false);
    }
  }

  async function handleRetryAnalysis() {
    await runAnalysis();
  }

  useEffect(() => {
    if (!id || !report) return;

    const analysis = getLatestAnalysis(report.report_ai_analysis);
    const shouldStartAnalysis = !analysis && report.ai_status === 'pending';

    if (!shouldStartAnalysis || autoAnalysisStartedRef.current.has(id)) return;

    autoAnalysisStartedRef.current.add(id);
    runAnalysis({ silent: true });
  }, [id, report?.id, report?.ai_status]);

  async function handleAddComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;

    setSubmittingComment(true);
    try {
      const response = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: id,
          comment: comment.trim(),
        }),
      });

      if (!response.ok) throw new Error('Failed to add comment');

      setComment('');
      toast.success('Comment added');
      loadReport();
    } catch (err) {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="skeleton h-6 w-48 mb-4" />
          <div className="card-premium p-6 space-y-4">
            <div className="skeleton h-8 w-64" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-3/4" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-5xl mx-auto text-center py-20">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => router.push('/dashboard/reports')} className="btn-primary">
            Back to Reports
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (!report) return null;

  const canReview = currentUser && (currentUser.role === 'admin' || currentUser.role === 'department_lead');
  const canViewAdminRecommendation = currentUser?.role === 'admin';
  const analysis = getLatestAnalysis(report.report_ai_analysis);
  const userName = getProfileDisplayName(report.users, 'Unknown');

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Back Button */}
        <button onClick={() => router.push('/dashboard/reports')} className={styles.backBtn}>
          ← Back to Reports
        </button>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className="text-2xl font-bold text-surface-dark">{report.project_name || 'Untitled Report'}</h1>
            <p className="text-gray-500">{report.report_type} report • {formatDateTime(report.submitted_at)}</p>
          </div>
          <div className="flex gap-2">
            {!report.reviewed && canReview && (
              <button onClick={handleMarkReviewed} className={styles.reviewBtn}>
                Mark as Reviewed
              </button>
            )}
            {report.reviewed && (
              <span className="badge px-3 py-1.5 text-xs font-medium rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
                Reviewed
              </span>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className={styles.metaGrid}>
          <div className={styles.metaItem}>
            <p className={styles.metaLabel}>Team Member</p>
            <p className={styles.metaValue}>{userName}</p>
          </div>
          <div className={styles.metaItem}>
            <p className={styles.metaLabel}>Department</p>
            <p className={styles.metaValue}>{report.departments?.name || 'N/A'}</p>
          </div>
          <div className={styles.metaItem}>
            <p className={styles.metaLabel}>Report Type</p>
            <p className={styles.metaValue}>{report.report_type}</p>
          </div>
          <div className={styles.metaItem}>
            <p className={styles.metaLabel}>Hours Worked</p>
            <p className={styles.metaValue}>{report.hours_worked || 'N/A'}</p>
          </div>
        </div>

        {/* Submitted Work */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Submitted Work</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-1">What You Worked On</h3>
              <p className={styles.textBlock}>{report.worked_on}</p>
            </div>
            {report.completed_tasks && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">Completed Tasks</h3>
                <p className={styles.textBlock}>{report.completed_tasks}</p>
              </div>
            )}
            {report.pending_tasks && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">Pending Tasks</h3>
                <p className={styles.textBlock}>{report.pending_tasks}</p>
              </div>
            )}
            {report.blockers && (
              <div>
                <h3 className="text-sm font-semibold text-red-500 mb-1">Blockers</h3>
                <p className={styles.textBlock}>{report.blockers}</p>
              </div>
            )}
            {report.support_needed && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">Support Needed</h3>
                <p className={styles.textBlock}>{report.support_needed}</p>
              </div>
            )}
            {report.additional_notes && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">Additional Notes</h3>
                <p className={styles.textBlock}>{report.additional_notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Goal & Plan Alignment */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {report.goals && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Related Goal</h2>
              <h3 className="font-semibold text-gray-900">{report.goals.title}</h3>
              {report.goals.description && (
                <p className="text-sm text-gray-600 mt-1">{report.goals.description}</p>
              )}
            </div>
          )}
          {report.plans && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Related Plan</h2>
              <h3 className="font-semibold text-gray-900">{report.plans.title}</h3>
              {report.plans.plan_type && (
                <p className="text-sm text-gray-500 mt-1 capitalize">{report.plans.plan_type} plan</p>
              )}
            </div>
          )}
        </div>

        {/* AI Analysis */}
        {analysis ? (
          <div className={styles.section}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={styles.sectionTitle} style={{ border: 'none', margin: 0, padding: 0 }}>Report Analysis</h2>
              <span className={getRiskBadgeColor(analysis.risk_level)}>
                {getRiskLabel(analysis.risk_level)}
              </span>
            </div>

            {analysis.summary && (
              <p className="text-sm text-gray-700 mb-6 leading-relaxed">{analysis.summary}</p>
            )}

            {/* Scores */}
            <div className={styles.scoreGrid}>
              <div className={styles.scoreCard}>
                <p className={`${styles.scoreValue} ${getScoreColor(analysis.progress_score)}`}>
                  {analysis.progress_score || 0}%
                </p>
                <p className={styles.scoreLabel}>Progress</p>
              </div>
              <div className={styles.scoreCard}>
                <p className={`${styles.scoreValue} ${getScoreColor(analysis.goal_alignment_score)}`}>
                  {analysis.goal_alignment_score || 0}%
                </p>
                <p className={styles.scoreLabel}>Goal Alignment</p>
              </div>
              <div className={styles.scoreCard}>
                <p className={`${styles.scoreValue} ${getScoreColor(analysis.report_quality_score)}`}>
                  {analysis.report_quality_score || 0}%
                </p>
                <p className={styles.scoreLabel}>Quality</p>
              </div>
              <div className={styles.scoreCard}>
                <p className={`${styles.scoreValue} ${getScoreColor(analysis.success_rate)}`}>
                  {analysis.success_rate || 0}%
                </p>
                <p className={styles.scoreLabel}>Success Rate</p>
              </div>
            </div>

            {/* Admin Recommendation */}
            {canViewAdminRecommendation && analysis.admin_recommendation && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-800 mb-1">Admin Recommendation</h3>
                <p className="text-sm text-blue-700 whitespace-pre-line">{analysis.admin_recommendation}</p>
              </div>
            )}

            {/* Analyzed Comment */}
            {analysis.ai_comment && (
              <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Analyzed Comment</h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">{analysis.ai_comment}</p>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Report Analysis</h2>

            {report.ai_status === 'failed' ? (
              <div className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-600 font-medium">AI analysis failed</p>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  The AI analysis encountered an error. You can retry the analysis.
                </p>
                {canReview && (
                  <button
                    onClick={handleRetryAnalysis}
                    disabled={retrying}
                    className="btn-primary text-sm inline-flex items-center gap-2"
                  >
                    {retrying ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Retry Analysis
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : report.ai_status === 'processing' ? (
              <div className="flex items-center gap-3 py-4">
                <div className="w-5 h-5 border-2 border-brand-deepblue border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Analysis in progress...</p>
              </div>
            ) : (
              <div className="py-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-5 h-5 border-2 border-brand-deepblue border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-500">
                    {retrying ? 'Starting analysis...' : 'analysis pending...'}
                  </p>
                </div>
                <button
                  onClick={handleRetryAnalysis}
                  disabled={retrying}
                  className="btn-primary text-sm inline-flex items-center gap-2"
                >
                  {retrying ? 'Analyzing...' : 'Start Analysis'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Admin Comments */}
        <div className={styles.reviewPanel}>
          <h2 className={styles.sectionTitle} style={{ border: 'none', margin: 0, padding: 0 }}>
            Admin Comments ({report.admin_comments?.length || 0})
          </h2>

          {/* Comment Form - only admin/lead */}
          {canReview && (
            <form onSubmit={handleAddComment} className={styles.commentBox}>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className={styles.commentInput}
                placeholder="Add a comment..."
              />
              <button
                type="submit"
                disabled={!comment.trim() || submittingComment}
                className="btn-primary text-sm"
              >
                {submittingComment ? 'Adding...' : 'Add Comment'}
              </button>
            </form>
          )}

          {/* Comments List */}
          <div className="mt-6 space-y-3">
            {(!report.admin_comments || report.admin_comments.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-4">No comments yet</p>
            )}
            {report.admin_comments?.map((c) => (
              <div key={c.id} className={styles.commentItem}>
                <div className="flex items-center justify-between">
                  <span className={styles.commentAuthor}>{getProfileDisplayName(c.admin, 'Admin')}</span>
                  <span className={styles.commentDate}>{formatDateTime(c.created_at)}</span>
                </div>
                <p className={styles.commentText}>{c.comment}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
