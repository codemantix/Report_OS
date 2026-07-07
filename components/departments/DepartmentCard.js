import { getProfileDisplayName } from '../../utils/profileHelpers';
import styles from './Departments.module.css';

export default function DepartmentCard({ department, onClick }) {
  return (
    <div
      className="card-premium p-6 cursor-pointer hover:shadow-card-hover transition-shadow"
      onClick={() => onClick?.(department)}
    >
      <h3 className="text-lg font-semibold text-surface-dark mb-2">{department.name}</h3>
      <p className="text-sm text-gray-500 mb-3 line-clamp-2">
        {department.description || 'No description'}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Lead: {department.lead ? getProfileDisplayName(department.lead, 'Not assigned') : 'Not assigned'}
        </span>
        <span
          className={`badge ${
            department.status === 'active' ? 'badge-success' : 'badge-neutral'
          }`}
        >
          {department.status}
        </span>
      </div>
    </div>
  );
}
