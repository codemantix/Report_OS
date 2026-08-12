import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ReceiptText } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import PaymentTrackingFilters from '../../../components/stipend-payments/PaymentTrackingFilters';
import PaymentTrackingList from '../../../components/stipend-payments/PaymentTrackingList';
import PaymentTrackingSummary from '../../../components/stipend-payments/PaymentTrackingSummary';
import {
  fetchStipendPayments,
  submitPaymentTrackingAction,
} from '../../../services/stipendPaymentService';
import styles from '../../../components/stipend-payments/StipendPayments.module.css';

const INITIAL_FILTERS = { periodId: '', departmentId: '', employeeId: '', page: 1, pageSize: 12 };

export default function StipendPaymentTrackingPage() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const requestSequence = useRef(0);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => { load(filters); }, [filters.periodId, filters.departmentId, filters.employeeId, filters.page]);

  async function load(requestFilters = filtersRef.current) {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    setLoading(true);
    setError('');
    const result = await fetchStipendPayments(requestFilters);
    if (requestId !== requestSequence.current) return;
    if (result.error) setError(result.error.message);
    else setData(result.data);
    setLoading(false);
  }

  function changeFilter(name, value) {
    setFilters((current) => ({
      ...current, [name]: value, page: 1,
      ...(name === 'departmentId' ? { employeeId: '', periodId: '' } : {}),
    }));
  }

  async function performAction(payload) {
    setSavingId(payload.paymentId || payload.recommendationId);
    const result = await submitPaymentTrackingAction(payload);
    if (result.error) toast.error(result.error.message);
    else {
      const messages = {
        create: 'Pending payment tracking record created.',
        approve: 'Payment approved.',
        hold: 'Payment placed on hold.',
        release: 'Payment hold released.',
        paid: 'Payment recorded as paid.',
      };
      toast.success(messages[payload.action]);
      await load(filtersRef.current);
    }
    setSavingId(null);
    return result;
  }

  return <DashboardLayout><div className={styles.page}>
    <header className={styles.header}><div><h1>Stipend Payment Tracking</h1><p>Internal status tracking for approved stipend decisions. No payment gateway or automatic transfer is connected.</p></div><ReceiptText /></header>
    {loading && !data ? <div className={styles.loading}>{[1, 2, 3, 4].map((item) => <div className={styles.skeleton} key={item} />)}</div> : error || !data ? <div className={styles.errorState}><AlertCircle /><h2>Payment tracking could not be loaded</h2><p>{error}</p><button type="button" className={styles.secondaryButton} onClick={() => load()}>Try again</button></div> : <>
      <PaymentTrackingSummary summary={data.summary} />
      <PaymentTrackingFilters filters={filters} options={data.options} onChange={changeFilter} onReset={() => setFilters(INITIAL_FILTERS)} />
      <PaymentTrackingList rows={data.rows} permissions={data.permissions} currentUserId={data.currentUserId} savingId={savingId} onAction={performAction} />
      <div className={styles.pagination}><button type="button" className={styles.secondaryButton} disabled={data.pagination.page <= 1 || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button><span>Page {data.pagination.page} of {data.pagination.totalPages}</span><button type="button" className={styles.secondaryButton} disabled={data.pagination.page >= data.pagination.totalPages || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button></div>
    </>}
  </div></DashboardLayout>;
}
