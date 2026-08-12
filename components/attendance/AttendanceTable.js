import { format, parseISO } from 'date-fns';
import { Pencil } from 'lucide-react';
import {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_TYPE_LABELS,
} from '../../utils/attendanceConstants';
import styles from './Attendance.module.css';

function profileName(profile) {
  return profile?.display_name || profile?.full_name || profile?.email || 'Unknown';
}

function formatAttendanceDate(value) {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'MMM d, yyyy');
  } catch {
    return value;
  }
}

function formatRecordedAt(value) {
  if (!value) return '—';
  try {
    return format(new Date(value), 'MMM d, yyyy · h:mm a');
  } catch {
    return value;
  }
}

function StatusBadge({ status }) {
  const className = `${styles.statusBadge} ${styles[`status_${status}`] || styles.statusDefault}`;
  return <span className={className}>{ATTENDANCE_STATUS_LABELS[status] || status}</span>;
}

function EvaluationPeriod({ period }) {
  if (!period) return <span className={styles.muted}>Not associated</span>;
  return (
    <div className={styles.periodCell}>
      <span>{period.name}</span>
      <small>{period.start_date} – {period.end_date}</small>
    </div>
  );
}

export default function AttendanceTable({ records, canEdit, onEdit }) {
  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Meeting / Session</th>
              <th>Type</th>
              <th>Status</th>
              <th>Evaluation Period</th>
              <th>Recorded By</th>
              {canEdit && <th aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td className={styles.dateCell}>{formatAttendanceDate(record.attendance_date)}</td>
                <td>
                  <div className={styles.personCell}>
                    <span className={styles.avatar}>{profileName(record.employee).charAt(0).toUpperCase()}</span>
                    <span>
                      <strong>{profileName(record.employee)}</strong>
                      <small>{record.department?.name || 'No department'}</small>
                    </span>
                  </div>
                </td>
                <td>
                  <div className={styles.sessionCell}>
                    <strong>{record.meeting_session}</strong>
                    {record.notes && <small title={record.notes}>{record.notes}</small>}
                  </div>
                </td>
                <td>{ATTENDANCE_TYPE_LABELS[record.attendance_type] || record.attendance_type}</td>
                <td><StatusBadge status={record.attendance_status} /></td>
                <td><EvaluationPeriod period={record.evaluation_period} /></td>
                <td>
                  <div className={styles.recordedCell}>
                    <span>{profileName(record.recorder)}</span>
                    <small>{formatRecordedAt(record.recorded_at || record.created_at)}</small>
                  </div>
                </td>
                {canEdit && (
                  <td>
                    <button
                      type="button"
                      className={styles.editButton}
                      onClick={() => onEdit(record)}
                      aria-label={`Edit attendance for ${profileName(record.employee)}`}
                    >
                      <Pencil aria-hidden="true" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.mobileList}>
        {records.map((record) => (
          <article key={record.id} className={styles.mobileCard}>
            <div className={styles.mobileCardHeader}>
              <div>
                <span className={styles.mobileDate}>{formatAttendanceDate(record.attendance_date)}</span>
                <h3>{record.meeting_session}</h3>
              </div>
              <StatusBadge status={record.attendance_status} />
            </div>
            <dl className={styles.mobileDetails}>
              <div><dt>Employee</dt><dd>{profileName(record.employee)}</dd></div>
              <div><dt>Department</dt><dd>{record.department?.name || '—'}</dd></div>
              <div><dt>Type</dt><dd>{ATTENDANCE_TYPE_LABELS[record.attendance_type] || record.attendance_type}</dd></div>
              <div><dt>Evaluation</dt><dd>{record.evaluation_period?.name || 'Not associated'}</dd></div>
              <div><dt>Recorded by</dt><dd>{profileName(record.recorder)}</dd></div>
              <div><dt>Recorded</dt><dd>{formatRecordedAt(record.recorded_at || record.created_at)}</dd></div>
            </dl>
            {record.notes && <p className={styles.mobileNotes}>{record.notes}</p>}
            {canEdit && (
              <button type="button" className={styles.mobileEditButton} onClick={() => onEdit(record)}>
                <Pencil aria-hidden="true" /> Edit attendance
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
