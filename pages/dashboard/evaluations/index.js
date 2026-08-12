import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ClipboardCheck } from 'lucide-react';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import EmptyState from '../../../components/common/EmptyState';
import PaginationControls from '../../../components/common/PaginationControls';
import EvaluationFilters from '../../../components/evaluations/EvaluationFilters';
import EvaluationSummary from '../../../components/evaluations/EvaluationSummary';
import EvaluationTable from '../../../components/evaluations/EvaluationTable';
import { getCurrentUserProfile } from '../../../lib/authHelpers';
import { fetchEvaluationDashboard } from '../../../services/evaluationDashboardService';
import styles from '../../../components/evaluations/Evaluations.module.css';

const EMPTY = { periodId: '', departmentId: '', employeeId: '', performanceBand: '', approvalStatus: '' };
export default function EvaluationsPage() {
  const [profile, setProfile] = useState(null); const [filters, setFilters] = useState(EMPTY);
  const requestRef = useRef(0);
  const [rows, setRows] = useState([]); const [summary, setSummary] = useState({}); const [options, setOptions] = useState({ departments: [], employees: [], periods: [], performanceBands: [] });
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10); const [pagination, setPagination] = useState({ totalCount: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { getCurrentUserProfile().then((user) => { setProfile(user); if (user?.role === 'department_lead') setFilters((f) => ({ ...f, departmentId: user.department_id || '' })); if (user?.role === 'team_member') setFilters((f) => ({ ...f, departmentId: user.department_id || '', employeeId: user.id })); }); }, []);
  useEffect(() => { if (profile) load(); }, [profile, filters, page, pageSize]);
  async function load() { const requestId = requestRef.current + 1; requestRef.current = requestId; setLoading(true); setError(''); const result = await fetchEvaluationDashboard({ ...filters, page, pageSize }); if (requestId !== requestRef.current) return; if (result.error) { setError(result.error.message); setRows([]); } else { const nextPagination = result.data.pagination || { totalCount: 0, totalPages: 1 }; if (page > nextPagination.totalPages) { setPage(nextPagination.totalPages); return; } setRows(result.data.evaluations || []); setSummary(result.data.summary || {}); setOptions(result.data.options || {}); setPagination(nextPagination); } setLoading(false); }
  function change(name, value) { setFilters((current) => ({ ...current, [name]: value, ...(name === 'departmentId' ? { employeeId: '', periodId: '' } : {}) })); setPage(1); }
  function clear() { setFilters({ ...EMPTY, departmentId: profile?.role === 'admin' ? '' : profile?.department_id || '', employeeId: profile?.role === 'team_member' ? profile.id : '' }); setPage(1); }
  return <DashboardLayout><div className={styles.page}><header className={styles.header}><div><h1>{profile?.role === 'team_member' ? 'My Evaluations' : 'Bi-Weekly Evaluations'}</h1><p>Real employee performance, stipend recommendations, and human approval state.</p></div></header>{!loading && !error && <EvaluationSummary summary={summary} />}<EvaluationFilters filters={filters} options={options} role={profile?.role} onChange={change} onClear={clear} /><section className={styles.contentCard}><div className={styles.contentHeader}><h2>Employee Evaluations</h2><span className={styles.muted}>{pagination.totalCount} results</span></div>{loading ? <div className={styles.loading}>{[1,2,3,4,5].map((i) => <div className={styles.skeleton} key={i} />)}</div> : error ? <div className={styles.state}><AlertCircle /><h3>Evaluations could not be loaded</h3><p>{error}</p><button className={styles.secondaryButton} onClick={load}>Try again</button></div> : rows.length === 0 ? <div className={styles.state}><EmptyState icon={<ClipboardCheck />} title="No evaluations found" message="No real evaluation records match the selected filters." /></div> : <><EvaluationTable evaluations={rows} /><div className={styles.pagination}><PaginationControls page={page} pageSize={pageSize} totalCount={pagination.totalCount} totalPages={pagination.totalPages} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></div></>}</section></div></DashboardLayout>;
}
