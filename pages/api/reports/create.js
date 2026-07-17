import { getAuthenticatedUser } from '../../../lib/apiAuth';
import { getAdminClient } from '../../../lib/supabaseAdmin';
import { hasReportValidationErrors, validateReportSubmission } from '../../../utils/reportValidation';

const REPORT_FIELDS = [
  'department_id',
  'goal_id',
  'plan_id',
  'task_id',
  'company_goal_id',
  'report_type',
  'project_name',
  'worked_on',
  'completed_tasks',
  'pending_tasks',
  'blockers',
  'support_needed',
  'hours_worked',
  'completion_percentage',
  'additional_notes',
  'attachments',
];

function pickReportFields(report = {}) {
  return REPORT_FIELDS.reduce((payload, field) => {
    if (Object.prototype.hasOwnProperty.call(report, field)) {
      payload[field] = report[field];
    }
    return payload;
  }, {});
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const currentUser = await getAuthenticatedUser(req, res);
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const report = pickReportFields(req.body?.report);
    const validationErrors = validateReportSubmission({
      ...report,
      period_start: req.body?.periodStart,
      period_end: req.body?.periodEnd,
    });

    if (hasReportValidationErrors(validationErrors)) {
      return res.status(400).json({
        error: 'Please complete all required report fields.',
        fields: validationErrors,
      });
    }

    const supabaseAdmin = getAdminClient();
    const { data, error } = await supabaseAdmin
      .from('reports')
      .insert([{
        ...report,
        user_id: currentUser.id,
        hours_worked: Number(report.hours_worked),
        completion_percentage: Number(report.completion_percentage),
        ai_status: 'pending',
      }])
      .select()
      .single();

    if (error) {
      console.error('Create report failed:', error.message);
      return res.status(500).json({ error: 'Failed to submit report.' });
    }

    return res.status(201).json({ success: true, report: data });
  } catch (error) {
    console.error('Create report API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
