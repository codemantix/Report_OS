import React from 'react';
import { ClipboardList, CheckSquare, BarChart, Percent } from 'lucide-react';

export default function TeamProfileStats({ stats }) {
  if (!stats) return null;

  const cards = [
    {
      title: 'Submitted Reports',
      value: stats.totalReports || 0,
      subtext: `${stats.reportsThisMonth || 0} this month • ${stats.reportsThisWeek || 0} this week`,
      icon: ClipboardList,
      color: 'blue',
    },
    {
      title: 'Assigned Tasks',
      value: stats.totalTasks || 0,
      subtext: `${stats.completedTasks || 0} completed • ${stats.blockedTasks || 0} blocked`,
      icon: CheckSquare,
      color: 'emerald',
    },
    {
      title: 'Avg Success Rate',
      value: stats.avgSuccessRate !== null ? `${stats.avgSuccessRate}%` : 'N/A',
      subtext: 'Weighted success evaluation score',
      icon: Percent,
      color: 'purple',
    },
    {
      title: 'Avg Task Alignment',
      value: stats.avgTaskAlignment !== null ? `${stats.avgTaskAlignment}%` : 'N/A',
      subtext: 'Strategic direction alignment score',
      icon: BarChart,
      color: 'amber',
    },
  ];

  const colors = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-100 dark:border-blue-900/30',
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-100 dark:border-emerald-900/30',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-100 dark:border-purple-900/30',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-100 dark:border-amber-900/30',
    },
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        const clr = colors[c.color] || colors.blue;

        return (
          <div key={i} className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-colors duration-200">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {c.title}
              </span>
              <div className={`p-2 rounded-lg ${clr.bg} ${clr.text}`}>
                <Icon size={18} />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1.5">
                {c.value}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {c.subtext}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
