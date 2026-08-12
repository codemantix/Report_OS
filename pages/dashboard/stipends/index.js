import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Banknote } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import StipendBaseConfigPanel from '../../../components/stipends/StipendBaseConfigPanel';
import StipendFilters from '../../../components/stipends/StipendFilters';
import StipendRecommendationList from '../../../components/stipends/StipendRecommendationList';
import StipendSummary from '../../../components/stipends/StipendSummary';
import {
  fetchStipendManagement,
  saveBaseStipendConfig,
  submitStipendAction,
} from '../../../services/stipendService';
import styles from '../../../components/stipends/Stipends.module.css';

const INITIAL_FILTERS = { periodId: '', departmentId: '', employeeId: '', page: 1, pageSize: 12 };

export default function StipendManagementPage() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const requestSequence = useRef(0);

  useEffect(() => { load(); }, [filters.periodId, filters.departmentId, filters.employeeId, filters.page]);

  async function load() {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    setLoading(true);
    setError('');
    const result = await fetchStipendManagement(filters);
    if (requestId !== requestSequence.current) return;
    if (result.error) setError(result.error.message);
    else setData(result.data);
    setLoading(false);
  }

  function changeFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: 1,
      ...(name === 'departmentId' ? { employeeId: '', periodId: '' } : {}),
    }));
  }

  async function saveConfig(payload) {
    setConfigSaving(true);
    const result = await saveBaseStipendConfig(payload);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success('Base stipend configuration saved.');
      await load();
    }
    setConfigSaving(false);
    return result;
  }

  async function performAction(payload) {
    setSavingId(payload.evaluationId || payload.recommendationId);
    const result = await submitStipendAction(payload);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(payload.action === 'approve'
        ? 'Final stipend amount approved.'
        : 'Stipend recommendation created.');
      await load();
    }
    setSavingId(null);
    return result;
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <header className={styles.header}>
          <div><h1>Stipend Recommendations</h1><p>Calculate and authorize stipend recommendations from approved employee evaluations. Payment processing remains separate.</p></div>
          <Banknote aria-hidden="true" />
        </header>

        {loading && !data ? <div className={styles.loading}>{[1, 2, 3, 4].map((item) => <div className={styles.skeleton} key={item} />)}</div> : error || !data ? <div className={styles.errorState}><AlertCircle /><h2>Stipend management could not be loaded</h2><p>{error}</p><button type="button" className={styles.secondaryButton} onClick={load}>Try again</button></div> : <>
          <StipendSummary summary={data.summary} />
          <StipendFilters filters={filters} options={data.options} onChange={changeFilter} onReset={() => setFilters(INITIAL_FILTERS)} />
          <StipendBaseConfigPanel configs={data.baseConfigs} options={data.options} canManage={data.permissions.canManageBaseConfigs} saving={configSaving} onSave={saveConfig} />
          <StipendRecommendationList evaluations={data.evaluations} permissions={data.permissions} savingId={savingId} onAction={performAction} />
          <div className={styles.pagination}>
            <button type="button" className={styles.secondaryButton} disabled={data.pagination.page <= 1 || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
            <span>Page {data.pagination.page} of {data.pagination.totalPages}</span>
            <button type="button" className={styles.secondaryButton} disabled={data.pagination.page >= data.pagination.totalPages || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
          </div>
        </>}
      </div>
    </DashboardLayout>
  );
}
