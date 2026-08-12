import { scopeManagementAnalyticsFilters } from '../../../utils/managementAnalyticsAccess';
import {
  fetchManagementAnalytics,
  fetchManagementAnalyticsOptions,
} from './managementAnalyticsRepository';

export async function getManagementAnalytics(supabaseAdmin, filters, currentUser) {
  const scoped = scopeManagementAnalyticsFilters(filters, currentUser);
  const [analytics, options] = await Promise.all([
    fetchManagementAnalytics(supabaseAdmin, scoped),
    fetchManagementAnalyticsOptions(supabaseAdmin, {
      departmentId: currentUser.role === 'admin' ? null : currentUser.department_id,
    }),
  ]);
  return {
    analytics,
    options: {
      ...options,
      performanceBands: analytics.performanceBandOptions || [],
    },
    appliedFilters: scoped,
  };
}
