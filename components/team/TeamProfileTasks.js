import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import { CheckSquare, Eye } from 'lucide-react';

export default function TeamProfileTasks({ targetUserId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTasks() {
      setLoading(true);
      try {
        // Query tasks through task_assignees pivot table
        const { data, error } = await supabase
          .from('task_assignees')
          .select(`
            task_id,
            tasks (
              id,
              title,
              due_date,
              status,
              priority
            )
          `)
          .eq('user_id', targetUserId);

        if (!error && data) {
          const list = data.map(item => item.tasks).filter(Boolean);
          // Sort tasks: Urgent -> High -> Medium -> Low
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          list.sort((a, b) => (priorityOrder[a.priority] || 9) - (priorityOrder[b.priority] || 9));
          setTasks(list);
        }
      } catch (err) {
        console.error('Failed to load user tasks:', err);
      } finally {
        setLoading(false);
      }
    }

    if (targetUserId) loadTasks();
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

  if (tasks.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-8 shadow-sm text-center">
        <CheckSquare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">No Tasks Found</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          No tasks are currently assigned to this team member.
        </p>
      </div>
    );
  }

  const priorityColors = {
    urgent: 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border-red-100 dark:border-red-900/30',
    high: 'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 border-orange-100 dark:border-orange-900/30',
    medium: 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border-blue-100 dark:border-blue-900/30',
    low: 'bg-gray-50 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border-gray-100 dark:border-gray-800/30',
  };

  const statusColors = {
    completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400',
    blocked: 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400',
    in_progress: 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400',
    pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400',
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden transition-colors duration-200">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800/60">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">
          Assigned Tasks
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-850 border-b border-gray-100 dark:border-gray-850/60 text-gray-400 dark:text-gray-500 text-xs font-semibold uppercase tracking-wider text-left">
              <th className="px-6 py-3.5">Task Description</th>
              <th className="px-6 py-3.5">Due Date</th>
              <th className="px-6 py-3.5">Priority</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40 text-gray-700 dark:text-gray-300">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-850/20 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                  <span className="truncate max-w-[200px] sm:max-w-xs">{task.title}</span>
                </td>
                <td className="px-6 py-4 text-xs text-gray-400">
                  {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : 'No due date'}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${priorityColors[task.priority] || priorityColors.medium}`}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs">
                  <span className={`inline-flex px-2 py-0.5 rounded-full font-medium ${statusColors[task.status] || statusColors.pending}`}>
                    {task.status?.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/dashboard/tasks/${task.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    <Eye size={12} />
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
