import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/layout/DashboardLayout';
import SearchInput from '../../components/common/SearchInput';
import useDebounce from '../../hooks/useDebounce';
import { getCurrentUserProfile } from '../../lib/authHelpers';
import { fetchReportsPaginated } from '../../services/reportService';
import { fetchTasks } from '../../services/taskService';
import { fetchGoals } from '../../services/goalService';
import { fetchPlans } from '../../services/planService';
import { fetchDepartments } from '../../services/departmentService';
import { fetchUsers } from '../../services/userService';
import { formatDate } from '../../utils/dateHelpers';

function ResultSection({ title, count, viewAllHref, children }) {
  return (
    <section className="rounded-xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>{title}</h2>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{count} result{count === 1 ? '' : 's'}</p>
        </div>
        {viewAllHref && count > 0 && (
          <a href={viewAllHref} className="text-sm font-medium text-blue-600 hover:text-blue-700">View all</a>
        )}
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
        {children}
      </div>
    </section>
  );
}

function ResultItem({ title, meta, href }) {
  return (
    <a href={href} className="block px-5 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{title}</p>
      {meta && <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>{meta}</p>}
    </a>
  );
}

function EmptySection({ message }) {
  return <p className="px-5 py-6 text-sm" style={{ color: 'var(--color-muted)' }}>{message}</p>;
}

export default function GlobalSearchPage() {
  const router = useRouter();
  const initialQuery = typeof router.query.q === 'string' ? router.query.q : '';
  const [search, setSearch] = useState(initialQuery);
  const debouncedSearch = useDebounce(search, 400);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState({ reports: [], tasks: [], goals: [], plans: [], departments: [], users: [] });
  const [counts, setCounts] = useState({ reports: 0, tasks: 0, goals: 0, plans: 0, departments: 0, users: 0 });

  useEffect(() => {
    setSearch(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    async function loadUser() {
      const profile = await getCurrentUserProfile();
      if (!profile) {
        router.push('/auth/login');
        return;
      }
      setUser(profile);
    }
    loadUser();
  }, [router]);

  useEffect(() => {
    const query = debouncedSearch.trim();
    if (!user || !query) {
      setResults({ reports: [], tasks: [], goals: [], plans: [], departments: [], users: [] });
      setCounts({ reports: 0, tasks: 0, goals: 0, plans: 0, departments: 0, users: 0 });
      return;
    }

    async function runSearch() {
      setLoading(true);
      setError(null);
      try {
        const departmentFilter = user.role !== 'admin' ? user.department_id : undefined;
        const reportFilters = { search: query, sortBy: 'submitted_at', sortDirection: 'desc' };
        const taskFilters = { search: query, sortBy: 'created_at', sortDirection: 'desc' };
        const sharedDeptFilters = { search: query };

        if (user.role === 'team_member') {
          reportFilters.user_id = user.id;
          taskFilters.assignee_id = user.id;
        } else if (departmentFilter) {
          reportFilters.department_id = departmentFilter;
          taskFilters.department_id = departmentFilter;
          sharedDeptFilters.department_id = departmentFilter;
        }

        const [reportsRes, tasksRes, goalsRes, plansRes, departmentsRes, usersRes] = await Promise.all([
          fetchReportsPaginated(reportFilters, 1, 5),
          fetchTasks(taskFilters),
          fetchGoals({ search: query, department_id: departmentFilter, sortBy: 'created_at', sortDirection: 'desc' }),
          fetchPlans({ search: query, department_id: departmentFilter, sortBy: 'created_at', sortDirection: 'desc' }),
          fetchDepartments(sharedDeptFilters),
          user.role === 'team_member'
            ? Promise.resolve({ data: [], error: null })
            : fetchUsers({ search: query, department_id: departmentFilter }),
        ]);

        const firstError = reportsRes.error || tasksRes.error || goalsRes.error || plansRes.error || departmentsRes.error || usersRes.error;
        if (firstError) throw firstError;

        setResults({
          reports: reportsRes.data || [],
          tasks: (tasksRes.data || []).slice(0, 5),
          goals: (goalsRes.data || []).slice(0, 5),
          plans: (plansRes.data || []).slice(0, 5),
          departments: (departmentsRes.data || []).slice(0, 5),
          users: (usersRes.data || []).slice(0, 5),
        });
        setCounts({
          reports: reportsRes.count || 0,
          tasks: tasksRes.data?.length || 0,
          goals: goalsRes.data?.length || 0,
          plans: plansRes.data?.length || 0,
          departments: departmentsRes.data?.length || 0,
          users: usersRes.data?.length || 0,
        });
      } catch (err) {
        console.error('Global search failed:', err);
        setError(err.message || 'Search failed');
      } finally {
        setLoading(false);
      }
    }

    runSearch();
  }, [debouncedSearch, user, router]);

  function handleSearchChange(value) {
    setSearch(value);
    const query = value.trim();
    router.replace(query ? `/dashboard/search?q=${encodeURIComponent(query)}` : '/dashboard/search', undefined, { shallow: true });
  }

  const totalResults = useMemo(
    () => Object.values(counts).reduce((sum, count) => sum + count, 0),
    [counts]
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Global Search</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
            Search reports, tasks, goals, plans, departments, and team members.
          </p>
        </div>

        <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search reports, tasks, goals..."
            loading={loading || search !== debouncedSearch}
            label="Global dashboard search"
          />
        </div>

        {!debouncedSearch.trim() ? (
          <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Enter a keyword to search across Codemantix Report OS.</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl" style={{ background: 'var(--color-border)' }} />
            ))}
          </div>
        ) : totalResults === 0 ? (
          <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>No matching results found</h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>Try adjusting your search keyword or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ResultSection title="Reports" count={counts.reports} viewAllHref={`/dashboard/reports?search=${encodeURIComponent(debouncedSearch)}`}>
              {results.reports.length === 0 ? <EmptySection message="No matching reports." /> : results.reports.map((report) => (
                <ResultItem
                  key={report.id}
                  title={report.project_name || 'Untitled Report'}
                  meta={`${report.users?.display_name || report.users?.full_name || report.users?.email || 'Unknown'} • ${report.report_type?.replace(/_/g, ' ') || 'report'} • ${formatDate(report.submitted_at)}`}
                  href={`/dashboard/reports/${report.id}`}
                />
              ))}
            </ResultSection>

            <ResultSection title="Tasks" count={counts.tasks} viewAllHref={`/dashboard/tasks?search=${encodeURIComponent(debouncedSearch)}`}>
              {results.tasks.length === 0 ? <EmptySection message="No matching tasks." /> : results.tasks.map((task) => (
                <ResultItem
                  key={task.id}
                  title={task.title || 'Untitled Task'}
                  meta={`${task.departments?.name || 'No department'} • ${task.status?.replace(/_/g, ' ') || 'no status'} • ${task.priority || 'no priority'}`}
                  href={`/dashboard/tasks/${task.id}`}
                />
              ))}
            </ResultSection>

            <ResultSection title="Goals" count={counts.goals} viewAllHref={`/dashboard/goals?search=${encodeURIComponent(debouncedSearch)}`}>
              {results.goals.length === 0 ? <EmptySection message="No matching goals." /> : results.goals.map((goal) => (
                <ResultItem
                  key={goal.id}
                  title={goal.title || 'Untitled Goal'}
                  meta={`${goal.departments?.name || 'No department'} • ${goal.status?.replace(/_/g, ' ') || 'no status'}`}
                  href={`/dashboard/goals/${goal.id}`}
                />
              ))}
            </ResultSection>

            <ResultSection title="Department Plans" count={counts.plans} viewAllHref={`/dashboard/plans?search=${encodeURIComponent(debouncedSearch)}`}>
              {results.plans.length === 0 ? <EmptySection message="No matching plans." /> : results.plans.map((plan) => (
                <ResultItem
                  key={plan.id}
                  title={plan.title || 'Untitled Plan'}
                  meta={`${plan.departments?.name || 'No department'} • ${plan.plan_type || 'plan'}`}
                  href={`/dashboard/plans/${plan.id}`}
                />
              ))}
            </ResultSection>

            <ResultSection title="Departments" count={counts.departments} viewAllHref={`/dashboard/departments?search=${encodeURIComponent(debouncedSearch)}`}>
              {results.departments.length === 0 ? <EmptySection message="No matching departments." /> : results.departments.map((department) => (
                <ResultItem
                  key={department.id}
                  title={department.name || 'Untitled Department'}
                  meta={`Lead: ${department.lead?.display_name || department.lead?.full_name || department.lead?.email || 'Not assigned'} • ${department.status || 'active'}`}
                  href={`/dashboard/departments/${department.id}`}
                />
              ))}
            </ResultSection>

            {user?.role !== 'team_member' && (
              <ResultSection title="Team Members" count={counts.users} viewAllHref={`/dashboard/team?search=${encodeURIComponent(debouncedSearch)}`}>
                {results.users.length === 0 ? <EmptySection message="No matching team members." /> : results.users.map((member) => (
                  <ResultItem
                    key={member.id}
                    title={member.display_name || member.full_name || member.email || 'Team member'}
                    meta={`${member.email || 'No email'} • ${member.departments?.name || 'No department'} • ${member.role?.replace(/_/g, ' ') || 'member'}`}
                    href="/dashboard/team"
                  />
                ))}
              </ResultSection>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
