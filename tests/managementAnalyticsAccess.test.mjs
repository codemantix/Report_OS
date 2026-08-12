import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../utils/managementAnalyticsAccess.js', import.meta.url), 'utf8');
const access = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { scopeManagementAnalyticsFilters } = access;

const ADMIN = { id: 'admin', role: 'admin', status: 'active', department_id: null };
const LEAD = { id: 'lead', role: 'department_lead', status: 'active', department_id: '11111111-1111-4111-8111-111111111111' };
const VALID_ID = '22222222-2222-4222-8222-222222222222';

test('management analytics rejects team members and inactive management users', () => {
  assert.throws(() => scopeManagementAnalyticsFilters({}, { role: 'team_member', status: 'active' }), /authorized management/i);
  assert.throws(() => scopeManagementAnalyticsFilters({}, { role: 'admin', status: 'inactive' }), /active account/i);
});

test('department leads are always scoped to their own department', () => {
  const scoped = scopeManagementAnalyticsFilters({ departmentId: VALID_ID, employeeId: VALID_ID }, LEAD);
  assert.equal(scoped.departmentId, LEAD.department_id);
  assert.equal(scoped.employeeId, VALID_ID);
});

test('admins may apply valid period department employee and band filters', () => {
  const scoped = scopeManagementAnalyticsFilters({ periodId: VALID_ID, departmentId: VALID_ID, employeeId: VALID_ID, performanceBand: 'Excellent' }, ADMIN);
  assert.deepEqual(scoped, { periodId: VALID_ID, departmentId: VALID_ID, employeeId: VALID_ID, performanceBand: 'Excellent' });
});

test('malformed identifiers and oversized performance bands are rejected', () => {
  assert.throws(() => scopeManagementAnalyticsFilters({ employeeId: 'not-a-uuid' }, ADMIN), /invalid/i);
  assert.throws(() => scopeManagementAnalyticsFilters({ performanceBand: 'x'.repeat(101) }, ADMIN), /invalid/i);
});
