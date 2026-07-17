import { getAuthenticatedUser } from '../../../../lib/apiAuth';
import { getAdminClient } from '../../../../lib/supabaseAdmin';
import { hasReportValidationErrors, validateEditableReportFields } from '../../../../utils/reportValidation';

const EDITABLE_REPORT_FIELDS = [
  'report_type',
  'project_name',
  'task_id',
  'worked_on',
  'completed_tasks',
  'pending_tasks',
  'blockers',
  'support_needed',
  'hours_worked',
  'completion_percentage',
  'additional_notes',
];

function pickEditableFields(values = {}) {
  return EDITABLE_REPORT_FIELDS.reduce((payload, field) => {
    if (Object.prototype.hasOwnProperty.call(values, field)) {
      payload[field] = typeof values[field] === 'string' ? values[field].trim() : values[field];
    }
    return payload;
  }, {});
}

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const currentUser = await getAuthenticatedUser(req, res);
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access is required.' });
    }

    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Report ID is required.' });
    }

    const updates = pickEditableFields(req.body);
    updates.task_id = updates.task_id || null;
    const validationErrors = validateEditableReportFields(updates);
    if (hasReportValidationErrors(validationErrors)) {
      return res.status(400).json({
        error: 'Please complete every editable report field.',
        fields: validationErrors,
      });
    }

    const supabaseAdmin = getAdminClient();
    const { data, error } = await supabaseAdmin
      .from('reports')
      .update({
        ...updates,
        hours_worked: Number(updates.hours_worked),
        completion_percentage: Number(updates.completion_percentage),
        ai_status: 'pending',
      })
      .eq('id', id)
      .select(`
        *,
        tasks:task_id (id, title, status, priority, due_date)
      `)
      .single();

    if (error) {
      console.error('Admin report update failed:', error.message);
      return res.status(500).json({ error: 'Failed to update report.' });
    }

    const { error: oldTaskLinkError } = await supabaseAdmin
      .from('report_tasks')
      .delete()
      .eq('report_id', id);

    if (oldTaskLinkError) {
      console.error('Failed to clear previous report task link:', oldTaskLinkError.message);
      return res.status(500).json({ error: 'Report updated, but its previous task link could not be cleared.' });
    }

    if (updates.task_id) {
      const { error: taskLinkError } = await supabaseAdmin
        .from('report_tasks')
        .insert({ report_id: id, task_id: updates.task_id });

      if (taskLinkError) {
        console.error('Failed to create report task link:', taskLinkError.message);
        return res.status(500).json({ error: 'Report updated, but the related task link could not be saved.' });
      }
    }

    const { error: analysisDeleteError } = await supabaseAdmin
      .from('report_ai_analysis')
      .delete()
      .eq('report_id', id);

    if (analysisDeleteError) {
      console.error('Failed to invalidate report analysis:', analysisDeleteError.message);
      return res.status(500).json({ error: 'Report updated, but its previous AI analysis could not be invalidated.' });
    }

    return res.status(200).json({
      success: true,
      report: data,
      message: 'Report updated successfully.',
    });
  } catch (error) {
    console.error('Admin report update API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
