import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { FileText, ArrowUpRight, Sparkles, Clock, AlertTriangle } from 'lucide-react';
import { fetchUserReports } from '../../services/reportService';

// report_ai_analysis comes back as an array — pick the most recent entry
function getLatestAi(analysis) {
  if (!analysis) return null;
  if (!Array.isArray(analysis)) return analysis;
  if (analysis.length === 0) return null;
  return [...analysis].sort((a, b) => {
    const at = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bt - at;
  })[0];
}

function ScorePill({ value, label }) {
  const isNull = value === null || value === undefined;
  const color = isNull
    ? null
    : value >= 80
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
    : value >= 60
    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
    : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400';

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide leading-none">
        {label}
      </span>
      {isNull ? (
        <span className="text-xs text-gray-300 dark:text-gray-600 font-medium">—</span>
      ) : (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{value}%</span>
      )}
    </div>
  );
}

const TYPE_MAP = {
  daily:           { label: 'Daily',    cls: 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400' },
  weekly:          { label: 'Weekly',   cls: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400' },
  project:         { label: 'Project',  cls: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400' },
  task_completion: { label: 'Task',     cls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400' },
  blocker:         { label: 'Blocker',  cls: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400' },
};

function TypeBadge({ type }) {
  const t = TYPE_MAP[type] || {
    label: (type || 'Report').replace('_', ' '),
    cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${t.cls}`}>
      {t.label}
    </span>
  );
}

function AiStatusDot({ aiStatus }) {
  if (aiStatus === 'completed') {
    return <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="AI analysis complete" />;
  }
  if (aiStatus === 'failed') {
    return <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" title="AI analysis failed" />;
  }
  return <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" title="AI pending" />;
}

export default function TeamProfileReports({ targetUserId }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await fetchUserReports(targetUserId, 30);
        if (err) throw err;
        setReports(data || []);
      } catch (e) {
        console.error('TeamProfileReports error:', e);
        setError('Failed to load reports');
      } finally {
        setLoading(false);
      }
    }
    if (targetUserId) load();
  }, [targetUserId]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="h-4 w-36 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[68px] bg-gray-50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-8 shadow-sm text-center">
        <AlertTriangle className="w-10 h-10 mx-auto text-red-300 mb-3" />
        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{error}</p>
      </div>
    );
  }

  /* ── Empty ── */
  if (reports.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-10 shadow-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 flex items-center justify-center mx-auto mb-4 border border-blue-100/60 dark:border-blue-900/30">
          <FileText className="w-6 h-6 text-blue-400" />
        </div>
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">No Reports Yet</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500">No reports have been submitted by this team member yet.</p>
      </div>
    );
  }

  /* ── List ── */
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">

      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <FileText className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-white">Reports History</span>
          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
            {reports.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-blue-400" />
          <span className="text-[11px] text-blue-500 dark:text-blue-400 font-semibold">AI Scored</span>
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-50 dark:divide-gray-800/40">
        {reports.map((report) => {
          const ai = getLatestAi(report.report_ai_analysis);

          // Use the right field names from the actual schema
          const title = report.project_name || report.title || 'Status Report';
          const submittedAt = report.submitted_at ? new Date(report.submitted_at) : null;
          const isReviewed = report.reviewed === true;
          const aiStatus = report.ai_status || 'pending';
          const dept = report.departments?.name;
          const goal = report.goals?.title;
          const plan = report.plans?.title;

          return (
            <div
              key={report.id}
              className="group flex items-center gap-3 px-5 py-3.5 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-colors"
            >
              {/* Icon */}
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-800 dark:to-blue-950/20 border border-blue-100/50 dark:border-blue-900/20 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              </div>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                {/* Top row: badges */}
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <TypeBadge type={report.report_type} />
                  <AiStatusDot aiStatus={aiStatus} />
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                      isReviewed
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                    }`}
                  >
                    {isReviewed ? '✓ Reviewed' : 'Pending'}
                  </span>
                </div>

                {/* Title */}
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-snug">
                  {title}
                </p>

                {/* Meta row */}
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {submittedAt && (
                    <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDistanceToNow(submittedAt, { addSuffix: true })}
                      &nbsp;·&nbsp;{format(submittedAt, 'MMM d, yyyy')}
                    </span>
                  )}
                  {dept && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                      {dept}
                    </span>
                  )}
                  {(goal || plan) && (
                    <span className="text-[10px] text-indigo-400 dark:text-indigo-500 truncate">
                      {goal || plan}
                    </span>
                  )}
                </div>
              </div>

              {/* AI score pills — hidden on small screens */}
              {ai ? (
                <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                  <ScorePill value={ai.success_rate} label="Success" />
                  <ScorePill value={ai.task_alignment_score} label="Task" />
                  <ScorePill value={ai.goal_alignment_score} label="Goal" />
                  <ScorePill value={ai.progress_score} label="Progress" />
                </div>
              ) : (
                <span className="hidden md:block text-[10px] text-gray-300 dark:text-gray-600 italic flex-shrink-0 mr-2">
                  No AI yet
                </span>
              )}

              {/* View button */}
              <Link
                href={`/dashboard/reports/${report.id}`}
                className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                           bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400
                           border border-gray-200 dark:border-gray-700
                           hover:bg-blue-600 hover:text-white hover:border-blue-600 dark:hover:bg-blue-600 dark:hover:text-white dark:hover:border-blue-600
                           transition-all duration-150 group-hover:border-blue-200 dark:group-hover:border-blue-900/40"
                title="View Report"
              >
                <span className="hidden sm:inline">View</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
