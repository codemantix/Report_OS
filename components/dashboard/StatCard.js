import { FileText, Calendar, TrendingUp, Target, Activity, AlertTriangle, Eye, CheckCircle } from 'lucide-react';
import styles from './StatCard.module.css';

const iconMap = {
  fileText: FileText,
  calendar: Calendar,
  trendingUp: TrendingUp,
  target: Target,
  activity: Activity,
  alertTriangle: AlertTriangle,
  eye: Eye,
  checkCircle: CheckCircle,
};

const variantStyles = {
  default: 'border-l-blue-600',
  danger: 'border-l-red-500',
  warning: 'border-l-amber-500',
  success: 'border-l-emerald-500',
  info: 'border-l-blue-500',
};

export default function StatCard({ title, value, icon, trend, variant = 'default' }) {
  // Support both Lucide component references and string keys
  const Icon = typeof icon === 'function' || (icon && typeof icon === 'object')
    ? icon
    : (iconMap[icon] || FileText);

  const borderClass = variantStyles[variant] || variantStyles.default;

  return (
    <div className={`${styles.card} ${borderClass}`}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <div className={styles.iconWrapper}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className={styles.value}>{value}</div>
      {trend && (
        <div className={styles.trend}>
          {trend === 'up' && <span className={styles.trendUp}>↑</span>}
          {trend === 'down' && <span className={styles.trendDown}>↓</span>}
          {trend === 'neutral' && <span className={styles.trendNeutral}>→</span>}
        </div>
      )}
    </div>
  );
}
