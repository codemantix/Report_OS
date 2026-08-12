import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchManagementAnalytics } from '../services/managementAnalyticsService';

export default function useManagementAnalytics(enabled) {
  const requestRef = useRef(0);
  const [filters, setFilters] = useState({ periodId: '', departmentId: '', employeeId: '', performanceBand: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!enabled) return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError('');
    const result = await fetchManagementAnalytics(filters);
    if (requestId !== requestRef.current) return;
    if (result.error) {
      setError(result.error.message || 'Management analytics could not be loaded.');
      setData(null);
    } else {
      setData(result.data);
    }
    setLoading(false);
  }, [enabled, filters]);

  useEffect(() => { load(); }, [load]);

  const changeFilter = useCallback((name, value) => {
    setFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === 'departmentId' ? { employeeId: '', periodId: '' } : {}),
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ periodId: '', departmentId: '', employeeId: '', performanceBand: '' });
  }, []);

  return { data, loading, error, filters, changeFilter, clearFilters, retry: load };
}
