import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesSource = fs.readFileSync(new URL('../utils/evaluationNotificationRules.js', import.meta.url), 'utf8');
const rules = await import(`data:text/javascript;base64,${Buffer.from(rulesSource).toString('base64')}`);
const {
  EVALUATION_NOTIFICATION_TYPES,
  attendanceInputsMissing,
  canNotifyUser,
  isDuplicateNotification,
  notificationDestination,
  periodRecipients,
  reportingInputsMissing,
  reviewRecipients,
} = rules;

const templatesSource = fs.readFileSync(new URL('../utils/evaluationEmailTemplates.js', import.meta.url), 'utf8');
const templates = await import(`data:text/javascript;base64,${Buffer.from(templatesSource).toString('base64')}`);
const { buildEvaluationNotificationEmail } = templates;

const { sendEvaluationNotification, dispatchEvaluationNotifications } = await import('../lib/server/notifications/evaluationNotifier.js');

const period = {
  id: 'period-1',
  name: '2026-08 First Half',
  start_date: '2026-08-01',
  end_date: '2026-08-14',
  evaluation_deadline: '2026-08-21T17:00:00Z',
  department: { id: 'dept-1', name: 'Engineering' },
  evaluations: [
    {
      id: 'eval-1',
      employee: { id: 'user-1', email: 'alice@example.com', full_name: 'Alice', status: 'active', role: 'team_member' },
    },
    {
      id: 'eval-2',
      employee: { id: 'user-2', email: 'bob@example.com', full_name: 'Bob', status: 'active', role: 'team_member' },
    },
  ],
};

// Fake email sender that mimics the Resend client surface used by the notifier.
function fakeSender({ error = false } = {}) {
  const calls = [];
  return {
    calls,
    emails: {
      send: async (payload) => {
        calls.push(payload);
        return error
          ? { data: null, error: { message: 'resend rejected the email' } }
          : { data: { id: `email-${calls.length}` }, error: null };
      },
    },
  };
}

function mockSupabase({ failInsert = false } = {}) {
  const sentLogs = [];
  const inserted = [];
  return {
    _sentLogs: sentLogs,
    _inserted: inserted,
    from() {
      return {
        select() {
          return {
            eq() { return this; },
            limit() { return Promise.resolve({ data: sentLogs }); },
          };
        },
        insert(rows) {
          inserted.push(...rows);
          return failInsert
            ? Promise.reject(new Error('insert failed'))
            : Promise.resolve({ data: rows });
        },
      };
    },
  };
}

test('only active users with an email are notifiable', () => {
  assert.equal(canNotifyUser({ status: 'active', email: 'a@example.com' }), true);
  assert.equal(canNotifyUser({ status: 'inactive', email: 'a@example.com' }), false);
  assert.equal(canNotifyUser({ status: 'active', email: '' }), false);
  assert.equal(canNotifyUser({ status: 'active' }), false);
  assert.equal(canNotifyUser(null), false);
});

test('duplicate detection is scoped to type, entity, and recipient', () => {
  const sent = [
    { status: 'sent', notification_type: 'approved', entity_type: 'employee_evaluation', entity_id: 'eval-1', user_id: 'user-1' },
  ];
  assert.equal(isDuplicateNotification(sent, {
    type: 'approved', entityType: 'employee_evaluation', entityId: 'eval-1', recipientUserId: 'user-1',
  }), true);
  assert.equal(isDuplicateNotification(sent, {
    type: 'approved', entityType: 'employee_evaluation', entityId: 'eval-1', recipientUserId: 'user-2',
  }), false, 'different recipient is not a duplicate');
  assert.equal(isDuplicateNotification(sent, {
    type: 'returned_for_review', entityType: 'employee_evaluation', entityId: 'eval-1', recipientUserId: 'user-1',
  }), false, 'different type is not a duplicate');
  assert.equal(isDuplicateNotification(sent, {}), false, 'missing criteria is never a duplicate');
});

test('notification destinations link to the relevant Report OS page', () => {
  assert.equal(notificationDestination(EVALUATION_NOTIFICATION_TYPES.periodOpened), '/dashboard/evaluation-periods');
  assert.equal(notificationDestination(EVALUATION_NOTIFICATION_TYPES.reportMissing), '/dashboard/submit-report');
  assert.equal(notificationDestination(EVALUATION_NOTIFICATION_TYPES.attendanceMissing), '/dashboard/attendance');
  assert.equal(
    notificationDestination(EVALUATION_NOTIFICATION_TYPES.readyForReview, { evaluationId: 'eval-1' }),
    '/dashboard/evaluations/eval-1'
  );
  assert.equal(
    notificationDestination(EVALUATION_NOTIFICATION_TYPES.approved, { evaluationId: 'eval-1' }),
    '/dashboard/evaluations/eval-1'
  );
  assert.equal(notificationDestination(EVALUATION_NOTIFICATION_TYPES.stipendApproved), '/dashboard/my-performance');
  assert.equal(notificationDestination(EVALUATION_NOTIFICATION_TYPES.paymentRecorded), '/dashboard/my-performance');
  assert.equal(
    notificationDestination(EVALUATION_NOTIFICATION_TYPES.reportCommentAdded, { reportId: 'report-1' }),
    '/dashboard/reports/report-1'
  );
  assert.equal(notificationDestination(EVALUATION_NOTIFICATION_TYPES.reportCommentAdded), '/dashboard/reports');
});

test('period recipients come from the applicable evaluations only', () => {
  const recipients = periodRecipients(period);
  assert.equal(recipients.length, 2);
  assert.equal(recipients[0].id, 'user-1');
  assert.equal(recipients[1].id, 'user-2');
  assert.equal(periodRecipients(null).length, 0);
});

test('review recipients include admins and the department lead but exclude the actor', () => {
  const users = [
    { id: 'admin-1', email: 'admin@example.com', status: 'active', role: 'admin' },
    { id: 'lead-1', email: 'lead@example.com', status: 'active', role: 'department_lead', department_id: 'dept-1' },
    { id: 'lead-2', email: 'lead2@example.com', status: 'active', role: 'department_lead', department_id: 'dept-2' },
    { id: 'actor-1', email: 'actor@example.com', status: 'active', role: 'admin' },
    { id: 'member-1', email: 'member@example.com', status: 'active', role: 'team_member' },
  ];
  const recipients = reviewRecipients(users, { department_id: 'dept-1' }, { excludeUserId: 'actor-1' });
  const ids = recipients.map((user) => user.id);
  assert.ok(ids.includes('admin-1'), 'admins are notified');
  assert.ok(ids.includes('lead-1'), 'matching department lead is notified');
  assert.ok(!ids.includes('lead-2'), 'cross-department lead is excluded');
  assert.ok(!ids.includes('actor-1'), 'acting reviewer is excluded');
  assert.ok(!ids.includes('member-1'), 'team members are excluded');
});

test('missing-input detection uses the scoring breakdowns', () => {
  assert.equal(reportingInputsMissing({ submissionCompliance: { missingCount: 1 } }), true);
  assert.equal(reportingInputsMissing({ submissionCompliance: { missingCount: 0 } }), false);
  assert.equal(reportingInputsMissing({}), false);
  assert.equal(attendanceInputsMissing({ totalApplicableSessions: 0 }), true);
  assert.equal(attendanceInputsMissing({ totalApplicableSessions: 3 }), false);
  assert.equal(attendanceInputsMissing(null), true, 'no breakdown means no data recorded');
});

test('email templates build subject, message, and destination link', () => {
  const email = buildEvaluationNotificationEmail({
    type: 'approved',
    recipientName: 'Alice',
    period,
    evaluation: { employee_name_snapshot: 'Alice', id: 'eval-1', approved_score: 88 },
    ctaUrl: '/dashboard/evaluations/eval-1',
    appUrl: 'https://report.codemantixcollective.com/',
  });
  assert.ok(email.subject.includes('Alice'));
  assert.ok(email.html.includes('Evaluation Approved'));
  assert.ok(email.html.includes('Hi Alice'));
  assert.ok(email.html.includes('/dashboard/evaluations/eval-1'));
  assert.ok(email.html.includes('88'));

  const missing = buildEvaluationNotificationEmail({
    type: 'report_missing',
    recipientName: 'Bob',
    period,
    ctaUrl: '/dashboard/submit-report',
  });
  assert.ok(missing.subject.includes('Report missing'));
  assert.ok(missing.html.includes('/dashboard/submit-report'));

  const comment = buildEvaluationNotificationEmail({
    type: 'report_comment_added',
    recipientName: 'Carol',
    ctaUrl: '/dashboard/reports/report-1',
    details: { reportTitle: 'Weekly launch report', comment: 'Please add the missing evidence.' },
  });
  assert.ok(comment.subject.includes('New comment'));
  assert.ok(comment.html.includes('/dashboard/reports/report-1'));
  assert.ok(comment.html.includes('Please add the missing evidence.'));
});

test('dispatcher skips missing arguments and non-notifiable recipients without sending', async () => {
  const sender = fakeSender();
  const supabase = mockSupabase();
  const missingArgs = await sendEvaluationNotification(supabase, { type: 'approved', entityId: 'eval-1' }, sender);
  assert.equal(missingArgs.status, 'skipped');

  const notNotifiable = await sendEvaluationNotification(supabase, {
    type: 'approved',
    entityType: 'employee_evaluation',
    entityId: 'eval-1',
    recipient: { id: 'user-x', email: '', status: 'active' },
  }, sender);
  assert.equal(notNotifiable.status, 'skipped');
  assert.equal(notNotifiable.reason, 'recipient_not_notifiable');
  assert.equal(sender.calls.length, 0, 'no email is sent for skipped notifications');
});

test('dispatcher skips duplicates when a sent log already exists', async () => {
  const sender = fakeSender();
  const supabase = mockSupabase();
  supabase._sentLogs.push({
    status: 'sent', notification_type: 'approved',
    entity_type: 'employee_evaluation', entity_id: 'eval-1', user_id: 'user-1',
  });
  const result = await sendEvaluationNotification(supabase, {
    type: 'approved',
    entityType: 'employee_evaluation',
    entityId: 'eval-1',
    recipient: { id: 'user-1', email: 'alice@example.com', full_name: 'Alice', status: 'active' },
  }, sender);
  assert.equal(result.status, 'skipped');
  assert.equal(result.reason, 'duplicate');
  assert.equal(sender.calls.length, 0, 'no duplicate email is sent');
});

test('dispatcher sends successfully and records the log when the sender accepts the email', async () => {
  const sender = fakeSender();
  const supabase = mockSupabase();
  const result = await sendEvaluationNotification(supabase, {
    type: 'approved',
    entityType: 'employee_evaluation',
    entityId: 'eval-1',
    periodId: 'period-1',
    evaluationId: 'eval-1',
    recipient: { id: 'user-1', email: 'alice@example.com', full_name: 'Alice', status: 'active' },
    context: { period, evaluation: { employee_name_snapshot: 'Alice' } },
  }, sender);
  assert.equal(result.status, 'sent');
  assert.equal(sender.calls.length, 1);
  assert.equal(sender.calls[0].to, 'alice@example.com');
  assert.ok(sender.calls[0].html.includes('Evaluation Approved'));
  assert.equal(supabase._inserted.length, 1);
  assert.equal(supabase._inserted[0].status, 'sent');
  assert.equal(supabase._inserted[0].notification_type, 'approved');
  assert.equal(supabase._inserted[0].entity_id, 'eval-1');
  assert.equal(supabase._inserted[0].user_id, 'user-1');
});

test('dispatcher marks a rejected send as failed and still logs it', async () => {
  const sender = fakeSender({ error: true });
  const supabase = mockSupabase();
  const result = await sendEvaluationNotification(supabase, {
    type: 'approved',
    entityType: 'employee_evaluation',
    entityId: 'eval-1',
    recipient: { id: 'user-1', email: 'alice@example.com', full_name: 'Alice', status: 'active' },
  }, sender);
  assert.equal(result.status, 'failed');
  assert.equal(result.error, 'resend rejected the email');
  assert.equal(supabase._inserted.length, 1);
  assert.equal(supabase._inserted[0].status, 'failed');
});

test('dispatcher never throws even when logging the result fails', async () => {
  const sender = fakeSender();
  const supabase = mockSupabase({ failInsert: true });
  const result = await sendEvaluationNotification(supabase, {
    type: 'approved',
    entityType: 'employee_evaluation',
    entityId: 'eval-1',
    recipient: { id: 'user-1', email: 'alice@example.com', full_name: 'Alice', status: 'active' },
  }, sender);
  assert.ok(['sent', 'failed'].includes(result.status));
});

test('batch dispatch aggregates sent, skipped, and failed without throwing', async () => {
  const sender = fakeSender();
  const supabase = mockSupabase();
  const summary = await dispatchEvaluationNotifications(supabase, [
    { type: 'period_opened', entityType: 'evaluation_period', entityId: 'period-1', recipient: { id: 'u1', email: 'a@example.com', status: 'active', full_name: 'A' } },
    { type: 'period_opened', entityType: 'evaluation_period', entityId: 'period-1', recipient: null },
    { type: 'period_opened', entityType: 'evaluation_period', entityId: 'period-1', recipient: { id: 'u3', email: 'c@example.com', status: 'inactive' } },
  ], sender);
  assert.equal(summary.failed, 0);
  assert.equal(summary.skipped, 2);
  assert.equal(summary.sent, 1);
  assert.equal(sender.calls.length, 1);
  assert.equal(supabase._inserted.length, 1, 'only the sent notification is logged; pre-send skips return before logging');
});
