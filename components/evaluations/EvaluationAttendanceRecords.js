import { CalendarCheck } from 'lucide-react';
import styles from './Evaluations.module.css';

export default function EvaluationAttendanceRecords({ evaluation, showAdministrativeDetails = true }) {
  const records = evaluation.source_records?.attendance || [];
  return <section className={styles.detailSection} id="attendance"><div className={styles.sectionHeader}><div><h3>Attendance</h3><p>Actual official attendance records within the evaluation period.</p></div></div>{records.length === 0 ? <p className={styles.noData}>No applicable official attendance records were found.</p> : <div className={styles.attendanceTableWrap}><table className={styles.attendanceTable}><thead><tr><th>Date</th><th>Session</th><th>Type</th><th>Status</th>{showAdministrativeDetails && <><th>Notes</th><th>Recorded by</th></>}</tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{record.attendance_date}</td><td><CalendarCheck aria-hidden="true" /> {record.meeting_session}</td><td>{record.attendance_type?.replaceAll('_', ' ')}</td><td><span className={`${styles.statusBadge} ${styles[`attendance_${record.attendance_status}`]}`}>{record.attendance_status}</span></td>{showAdministrativeDetails && <><td>{record.notes || '—'}</td><td>{record.recorder?.full_name || record.recorder?.display_name || 'System'}</td></>}</tr>)}</tbody></table></div>}</section>;
}
