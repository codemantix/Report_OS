import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import { FileText, Eye, MessageSquare } from 'lucide-react';

export default function TeamProfileReports({ targetUserId }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('reports')
          .select(`
            id,
            title,
            created_at,
            status,
            report_ai_analysis (
              success_rate,
              task_alignment_score
            ),
            admin_comments (id)
          `)
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setReports(data);
        }
      } catch (err) {
        console.error('Failed to load user reports:', err);
      } finally {
        setLoading(false);
      }
    }

    if (targetUserId) loadReports();
  }, [targetUserId]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm animate-pulse space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 dark:bg-gray-850 rounded w-full" />
        ))}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-8 shadow-sm text-center">
        <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">No Reports Found</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          No reports have been submitted by this team member yet.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden transition-colors duration-200">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800/60">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">
          Submitted Reports History
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-850 border-b border-gray-100 dark:border-gray-850/60 text-gray-400 dark:text-gray-500 text-xs font-semibold uppercase tracking-wider text-left">
              <th className="px-6 py-3.5">Report Title</th>
              <th className="px-6 py-3.5">Submitted Date</th>
              <th className="px-6 py-3.5 text-center">AI Success</th>
              <th className="px-6 py-3.5 text-center">AI Alignment</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40 text-gray-700 dark:text-gray-300">
            {reports.map((report) => {
              const ai = report.report_ai_analysis;
              const commentsCount = report.admin_comments?.length || 0;

              return (
                <tr key={report.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-850/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[200px] sm:max-w-xs">{report.title || 'Weekly Status Report'}</span>
                      {commentsCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-medium" title={`${commentsCount} comment(s)`}>
                          <MessageSquare size={10} />
                          {commentsCount}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-400">
                    {format(new Date(report.created_at), 'MMM d, yyyy h:mm a')}
                  </td>
                  <td className="px-6 py-4 text-center font-semibold text-xs">
                    {ai?.success_rate !== undefined && ai.success_rate !== null ? (
                      <span className={ai.success_rate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : ai.success_rate >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>
                        {ai.success_rate}%
                      </span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center font-semibold text-xs">
                    {ai?.task_alignment_score !== undefined && ai.task_alignment_score !== null ? (
                      <span className={ai.task_alignment_score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : ai.task_alignment_score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>
                        {ai.task_alignment_score}%
                      </span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <span className={`inline-flex px-2 py-0.5 rounded-full font-medium ${
                      report.status === 'reviewed' 
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' 
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                    }`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/dashboard/reports/${report.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      <Eye size={12} />
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
