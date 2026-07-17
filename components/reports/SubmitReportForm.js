import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import { getCurrentUserProfile } from '../../lib/authHelpers';
import { fetchDepartments } from '../../services/departmentService';
import { fetchGoals } from '../../services/goalService';
import { fetchPlans } from '../../services/planService';
import { fetchTasks } from '../../services/taskService';
import { fetchActiveCompanyGoals } from '../../services/companyGoalService';
import { createReport } from '../../services/reportService';
import { uploadFiles } from '../../services/uploadService';
import { getDefaultDateRange, isInPeriod, isDateInPeriod } from '../../utils/reportDateRange';
import { validateReportSubmission } from '../../utils/reportValidation';
import ReportPeriodSelector from './ReportPeriodSelector';
import FileUpload from '../common/FileUpload';
import styles from './ReportForm.module.css';

const reportTypes = [
  { value: 'daily', label: 'Daily Report' },
  { value: 'weekly', label: 'Weekly Report' },
  { value: 'project', label: 'Project Report' },
  { value: 'task_completion', label: 'Task Completion' },
  { value: 'blocker', label: 'Blocker Report' },
];

export default function SubmitReportForm() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [allGoals, setAllGoals] = useState([]);
  const [allPlans, setAllPlans] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [plans, setPlans] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [companyGoals, setCompanyGoals] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDept, setSelectedDept] = useState('');
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);

  // Period state — auto-set from report type, editable by user
  const defaultRange = getDefaultDateRange('weekly');
  const [periodStart, setPeriodStart] = useState(defaultRange.start);
  const [periodEnd, setPeriodEnd] = useState(defaultRange.end);

  const [formData, setFormData] = useState({
    report_type: 'weekly',
    department_id: '',
    project_name: '',
    goal_id: '',
    plan_id: '',
    task_id: '',
    company_goal_id: '',
    worked_on: '',
    completed_tasks: '',
    pending_tasks: '',
    blockers: '',
    support_needed: '',
    hours_worked: '',
    completion_percentage: '',
    additional_notes: '',
  });

  useEffect(() => {
    async function loadData() {
      const profile = await getCurrentUserProfile();
      if (!profile) {
        router.push('/auth/login');
        return;
      }
      setUser(profile);

      const { data: depts } = await fetchDepartments();
      setDepartments(depts || []);

      // Auto-select user's department
      if (profile.department_id) {
        setSelectedDept(profile.department_id);
        setFormData((prev) => ({ ...prev, department_id: profile.department_id }));
      }

      setLoading(false);
    }
    loadData();
  }, [router]);

  // Load company goals
  useEffect(() => {
    async function loadCompanyGoals() {
      try {
        const { data } = await fetchActiveCompanyGoals();
        setCompanyGoals(data || []);
      } catch {
        // Non-critical
      }
    }
    loadCompanyGoals();
  }, []);

  // Fetch all department data when department changes
  useEffect(() => {
    async function loadRelatedData() {
      if (selectedDept) {
        setLoadingRelated(true);
        const [goalsData, plansData, tasksData] = await Promise.all([
          fetchGoals({ department_id: selectedDept }),
          fetchPlans({ department_id: selectedDept }),
          fetchTasks({ department_id: selectedDept, archived: false }),
        ]);
        setAllGoals(goalsData.data || []);
        setAllPlans(plansData.data || []);
        const rawTasks = tasksData?.data || [];
        setAllTasks(rawTasks.filter((t) =>
          t.status !== 'completed' && t.status !== 'cancelled'
        ));
        setLoadingRelated(false);
      } else {
        setAllGoals([]);
        setAllPlans([]);
        setAllTasks([]);
        setGoals([]);
        setPlans([]);
        setTasks([]);
      }
    }
    loadRelatedData();
  }, [selectedDept]);

  // Filter goals, plans, and tasks by the selected period (client-side)
  const filterByPeriod = useCallback(() => {
    const filteredGoals = allGoals.filter((g) =>
      isInPeriod(g.start_date, g.due_date, periodStart, periodEnd)
    );
    const filteredPlans = allPlans.filter((p) =>
      isInPeriod(p.start_date, p.end_date, periodStart, periodEnd)
    );
    const filteredTasks = allTasks.filter((t) =>
      isDateInPeriod(t.due_date, periodStart, periodEnd)
    );

    setGoals(filteredGoals);
    setPlans(filteredPlans);
    setTasks(filteredTasks);
  }, [allGoals, allPlans, allTasks, periodStart, periodEnd]);

  useEffect(() => {
    filterByPeriod();
  }, [filterByPeriod]);

  // Recalculate default date range when report type changes
  function handleReportTypeChange(newType) {
    const range = getDefaultDateRange(newType);
    setPeriodStart(range.start);
    setPeriodEnd(range.end);
    // Clear stale goal/plan/task selections since period changed
    setFormData((prev) => ({ ...prev, goal_id: '', plan_id: '', task_id: '' }));
    setSelectedTask(null);
  }

  // Handle period date changes
  function handlePeriodStartChange(value) {
    setPeriodStart(value);
    setErrors((prev) => ({ ...prev, period_start: undefined }));
    setFormData((prev) => ({ ...prev, goal_id: '', plan_id: '', task_id: '' }));
    setSelectedTask(null);
  }

  function handlePeriodEndChange(value) {
    setPeriodEnd(value);
    setErrors((prev) => ({ ...prev, period_end: undefined }));
    setFormData((prev) => ({ ...prev, goal_id: '', plan_id: '', task_id: '' }));
    setSelectedTask(null);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));

    if (name === 'report_type') {
      handleReportTypeChange(value);
    }

    if (name === 'department_id') {
      setSelectedDept(value);
      setFormData((prev) => ({ ...prev, goal_id: '', plan_id: '', task_id: '', company_goal_id: '' }));
      setSelectedTask(null);
    }

    // Auto-inherit company_goal_id from selected task
    if (name === 'task_id' && value) {
      const taskItem = tasks.find((t) => t.id === value);
      if (taskItem?.company_goal_id) {
        setFormData((prev) => ({ ...prev, company_goal_id: taskItem.company_goal_id }));
      }
    }

    // Auto-inherit company_goal_id from selected goal
    if (name === 'goal_id' && value) {
      const selectedGoal = goals.find((g) => g.id === value);
      if (selectedGoal?.company_goal_id) {
        setFormData((prev) => ({ ...prev, company_goal_id: selectedGoal.company_goal_id }));
      }
    }
  }

  function validateForm() {
    return validateReportSubmission({
      ...formData,
      period_start: periodStart,
      period_end: periodEnd,
      attachments: files,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setSubmitted(true);
    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      // Upload files first (if any)
      let attachments = [];
      if (files.length > 0) {
        setUploadProgress({ uploaded: 0, total: files.length });
        try {
          attachments = await uploadFiles(files, (progress) => {
            setUploadProgress({ ...progress });
          });
        } catch (uploadErr) {
          setUploadProgress(null);
          throw new Error(uploadErr.message || 'The required attachment could not be uploaded.');
        }
        setUploadProgress(null);
      }

      const reportPayload = {
        department_id: formData.department_id || null,
        goal_id: formData.goal_id || null,
        plan_id: formData.plan_id || null,
        task_id: formData.task_id || null,
        company_goal_id: formData.company_goal_id || null,
        report_type: formData.report_type,
        project_name: formData.project_name || null,
        worked_on: formData.worked_on,
        completed_tasks: formData.completed_tasks || null,
        pending_tasks: formData.pending_tasks || null,
        blockers: formData.blockers || null,
        support_needed: formData.support_needed || null,
        hours_worked: formData.hours_worked ? parseFloat(formData.hours_worked) : null,
        completion_percentage: formData.completion_percentage ? parseInt(formData.completion_percentage) : null,
        additional_notes: formData.additional_notes || null,
        attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
        ai_status: 'pending',
      };

      const { data, error } = await createReport(reportPayload, { periodStart, periodEnd });

      if (error) {
        if (error.fields && Object.keys(error.fields).length > 0) {
          setErrors(error.fields);
          setSubmitted(true);
        }
        toast.error(error.message || 'Failed to submit report');
        setSubmitting(false);
        return;
      }

      // Submit background processing (email, task linking)
      try {
        await fetch('/api/reports/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportId: data.id,
            taskId: formData.task_id || null,
          }),
        });
      } catch (apiErr) {
        console.error('Background processing error:', apiErr);
      }

      toast.success('Report submitted successfully!');
      setSubmitted(false);

      router.push('/dashboard/reports');
    } catch (err) {
      toast.error(err.message || 'Something went wrong');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-deepblue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Submit Report</h1>
        <p className={styles.subtitle}>Document your work and progress</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Report Type & Department */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Report Information</h2>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={`${styles.label} ${styles.required}`}>Report Type</label>
              <select
                name="report_type"
                value={formData.report_type}
                onChange={handleChange}
                className={`${styles.select} ${errors.report_type && submitted ? styles.inputError : ''}`}
                required
              >
                {reportTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              {errors.report_type && submitted && <p className={styles.fieldError}>{errors.report_type}</p>}
            </div>
            <div className={styles.field}>
              <label className={`${styles.label} ${styles.required}`}>Department</label>
              <select
                name="department_id"
                value={formData.department_id}
                onChange={handleChange}
                className={`${styles.select} ${errors.department_id && submitted ? styles.inputError : ''}`}
                required
              >
                <option value="">Select department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
              {errors.department_id && submitted && <p className={styles.fieldError}>{errors.department_id}</p>}
            </div>
          </div>
          <div className={styles.field}>
            <label className={`${styles.label} ${styles.required}`}>Report Title</label>
            <input
              type="text"
              name="project_name"
              value={formData.project_name}
              onChange={handleChange}
              className={`${styles.input} ${errors.project_name && submitted ? styles.inputError : ''}`}
              placeholder="e.g., Website Redesign Progress"
              required
            />
            {errors.project_name && submitted && <p className={styles.fieldError}>{errors.project_name}</p>}
          </div>
        </div>

        {/* Reporting Period */}
        <ReportPeriodSelector
          periodStart={periodStart}
          periodEnd={periodEnd}
          onStartChange={handlePeriodStartChange}
          onEndChange={handlePeriodEndChange}
          goalsCount={goals.length}
          plansCount={plans.length}
          tasksCount={tasks.length}
          loadingRelated={loadingRelated}
          disabled={!selectedDept}
          errors={errors}
          submitted={submitted}
        />

        {/* Goal, Plan & Task */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Goal, Plan &amp; Task Alignment</h2>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Related Goal</label>
              <select
                name="goal_id"
                value={formData.goal_id}
                onChange={handleChange}
                className={styles.select}
                disabled={!selectedDept || goals.length === 0}
              >
                <option value="">Select goal</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>{goal.title}</option>
                ))}
              </select>
              {!selectedDept && <p className={styles.hint}>Select a department first</p>}
              {selectedDept && goals.length === 0 && !loadingRelated && <p className={styles.hint}>No goals found for this period</p>}

            </div>
            <div className={styles.field}>
              <label className={styles.label}>Related Plan</label>
              <select
                name="plan_id"
                value={formData.plan_id}
                onChange={handleChange}
                className={styles.select}
                disabled={!selectedDept || plans.length === 0}
              >
                <option value="">Select plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.title}</option>
                ))}
              </select>
              {selectedDept && plans.length === 0 && !loadingRelated && <p className={styles.hint}>No plans found for this period</p>}

            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Related Task</label>
              <select
                name="task_id"
                value={formData.task_id}
                onChange={(e) => {
                  handleChange(e);
                  const taskItem = tasks.find((t) => t.id === e.target.value);
                  setSelectedTask(taskItem || null);
                }}
                className={styles.select}
                disabled={!selectedDept || tasks.length === 0}
              >
                <option value="">Select task</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
              {selectedDept && tasks.length === 0 && !loadingRelated && <p className={styles.hint}>No tasks found for this period</p>}

            </div>
            <div className={styles.field}>
              <label className={styles.label}>Task Info</label>
              <div className={styles.taskInfo}>
                {selectedTask ? (
                  <div className="space-y-1">
                    <p className="font-medium" style={{ color: 'var(--color-text)' }}>{selectedTask.title}</p>
                    {selectedTask.expected_output && <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Expected: {selectedTask.expected_output}</p>}
                    {selectedTask.due_date && <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Due: {new Date(selectedTask.due_date).toLocaleDateString()}</p>}
                    <p className="text-xs capitalize" style={{ color: 'var(--color-muted)' }}>Priority: {selectedTask.priority} · Status: {selectedTask.status?.replace(/_/g, ' ')}</p>
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>No task selected</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Company Goal Link */}
        <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Company Direction</h2>
            <div className={styles.field}>
              <label className={`${styles.label} ${styles.required}`}>Related Company Goal</label>
              <select
                name="company_goal_id"
                value={formData.company_goal_id}
                onChange={handleChange}
                className={`${styles.select} ${errors.company_goal_id && submitted ? styles.inputError : ''}`}
                disabled={companyGoals.length === 0}
                required
              >
                <option value="">{companyGoals.length === 0 ? 'No active company goals available' : 'Select company goal'}</option>
                {companyGoals.map((cg) => (
                  <option key={cg.id} value={cg.id}>
                    {cg.title} ({cg.month}/{cg.year})
                  </option>
                ))}
              </select>
              {formData.company_goal_id && (
                <p className={styles.hint} style={{ color: 'var(--color-muted)', marginTop: '4px', fontSize: '12px' }}>
                  This report is linked to a company-wide monthly goal.
                </p>
              )}
              {companyGoals.length === 0 && <p className={styles.hint}>No active company goals are available.</p>}
              {errors.company_goal_id && submitted && <p className={styles.fieldError}>{errors.company_goal_id}</p>}
            </div>
          </div>

        {/* Work Details */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Work Details</h2>
          <div className={styles.field}>
            <label className={`${styles.label} ${styles.required}`}>What did you work on?</label>
            <textarea
              name="worked_on"
              value={formData.worked_on}
              onChange={handleChange}
              className={`${styles.textarea} ${errors.worked_on && submitted ? styles.inputError : ''}`}
              placeholder="Describe the work you did..."
              required
            />
            {errors.worked_on && submitted && <p className={styles.fieldError}>{errors.worked_on}</p>}
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={`${styles.label} ${styles.required}`}>What did you complete?</label>
              <textarea
                name="completed_tasks"
                value={formData.completed_tasks}
                onChange={handleChange}
                className={`${styles.textarea} ${errors.completed_tasks && submitted ? styles.inputError : ''}`}
                placeholder="List completed tasks..."
                required
              />
              {errors.completed_tasks && submitted && <p className={styles.fieldError}>{errors.completed_tasks}</p>}
            </div>
            <div className={styles.field}>
              <label className={`${styles.label} ${styles.required}`}>What is still pending?</label>
              <textarea
                name="pending_tasks"
                value={formData.pending_tasks}
                onChange={handleChange}
                className={`${styles.textarea} ${errors.pending_tasks && submitted ? styles.inputError : ''}`}
                placeholder="List pending items or enter None"
                required
              />
              {errors.pending_tasks && submitted && <p className={styles.fieldError}>{errors.pending_tasks}</p>}
            </div>
          </div>
        </div>

        {/* Blockers & Support */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Challenges & Support</h2>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={`${styles.label} ${styles.required}`}>Blockers or Challenges</label>
              <textarea
                name="blockers"
                value={formData.blockers}
                onChange={handleChange}
                className={`${styles.textarea} ${errors.blockers && submitted ? styles.inputError : ''}`}
                placeholder="Describe blockers or enter None"
                required
              />
              {errors.blockers && submitted && <p className={styles.fieldError}>{errors.blockers}</p>}
            </div>
            <div className={styles.field}>
              <label className={`${styles.label} ${styles.required}`}>Support Needed</label>
              <textarea
                name="support_needed"
                value={formData.support_needed}
                onChange={handleChange}
                className={`${styles.textarea} ${errors.support_needed && submitted ? styles.inputError : ''}`}
                placeholder="Describe support needed or enter None"
                required
              />
              {errors.support_needed && submitted && <p className={styles.fieldError}>{errors.support_needed}</p>}
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Metrics</h2>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={`${styles.label} ${styles.required}`}>Hours Worked</label>
              <input
                type="number"
                name="hours_worked"
                value={formData.hours_worked}
                onChange={handleChange}
                className={`${styles.input} ${errors.hours_worked && submitted ? styles.inputError : ''}`}
                placeholder="e.g., 8"
                min="0"
                step="0.5"
                required
              />
              {errors.hours_worked && submitted && <p className={styles.fieldError}>{errors.hours_worked}</p>}
            </div>
            <div className={styles.field}>
              <label className={`${styles.label} ${styles.required}`}>Completion %</label>
              <input
                type="number"
                name="completion_percentage"
                value={formData.completion_percentage}
                onChange={handleChange}
                className={`${styles.input} ${errors.completion_percentage && submitted ? styles.inputError : ''}`}
                placeholder="e.g., 75"
                min="0"
                max="100"
                required
              />
              {errors.completion_percentage && submitted && <p className={styles.fieldError}>{errors.completion_percentage}</p>}
            </div>
          </div>
          <div className={styles.field}>
            <label className={`${styles.label} ${styles.required}`}>Additional Notes</label>
            <textarea
              name="additional_notes"
              value={formData.additional_notes}
              onChange={handleChange}
              className={`${styles.textarea} ${errors.additional_notes && submitted ? styles.inputError : ''}`}
              placeholder="Add notes or enter None"
              required
            />
            {errors.additional_notes && submitted && <p className={styles.fieldError}>{errors.additional_notes}</p>}
          </div>
        </div>

        {/* Attachments */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Attachments</h2>
          <FileUpload
            files={files}
            onFilesChange={setFiles}
            disabled={submitting}
            label="Upload supporting documents"
          />
        </div>

        {/* Submit */}
        <div className={styles.submitSection}>
          <button type="button" onClick={() => router.back()} className={styles.cancelBtn}>
            Cancel
          </button>
          <button type="submit" disabled={submitting} className={styles.submitBtn}>
            {submitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {uploadProgress
                  ? `Uploading files (${uploadProgress.uploaded}/${uploadProgress.total})...`
                  : 'Submitting...'}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Submit Report
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
