// JS mirror of public.classify_evaluation_audit_event() in
// supabase/migrations/202608110013_evaluation_audit_trail.sql.
// Keep the two implementations in sync. This mirror is used by the audit
// interface and by unit tests that cannot reach a live database.

function first(value, fallback = '') {
  return value === null || value === undefined ? fallback : value;
}

function distinct(left, right) {
  return left !== right;
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function classifyAuditEvent(entityType, action, oldValues = {}, newValues = {}) {
  const oldValue = (key) => oldValues[key];
  const newValue = (key) => newValues[key];

  switch (entityType) {
    case 'employee_evaluation':
      switch (action) {
        case 'insert': return 'evaluation_generated';
        case 'delete': return 'record_deleted';
        default:
          if (first(newValue('current_approval_status')) === 'changes_requested'
            && first(oldValue('current_approval_status')) !== 'changes_requested') {
            return 'returned_for_review';
          }
          if (first(newValue('status')) === 'approved'
            && first(oldValue('status')) !== 'approved') {
            return 'approval';
          }
          if (distinct(newValue('approved_score'), oldValue('approved_score'))
            || distinct(newValue('approved_stipend_percentage'), oldValue('approved_stipend_percentage'))
            || distinct(newValue('approved_performance_band'), oldValue('approved_performance_band'))) {
            return 'manual_adjustment';
          }
          if (distinct(newValue('overall_score'), oldValue('overall_score'))
            || distinct(newValue('performance_band'), oldValue('performance_band'))
            || distinct(newValue('calculation_status'), oldValue('calculation_status'))
            || distinct(newValue('calculation_revision'), oldValue('calculation_revision'))) {
            return 'evaluation_recalculated';
          }
          return 'record_updated';
      }

    case 'component_score':
      switch (action) {
        case 'insert': return 'record_created';
        case 'delete': return 'record_deleted';
        default:
          return distinct(newValue('raw_score'), oldValue('raw_score'))
            ? 'evaluation_recalculated'
            : 'record_updated';
      }

    case 'evaluation_review_round':
      switch (action) {
        case 'insert': return 'manager_review';
        case 'delete': return 'record_deleted';
        default:
          switch (first(newValue('status'))) {
            case 'approved': return 'approval';
            case 'changes_requested': return 'returned_for_review';
            case 'rejected': return 'approval_rejected';
            case 'cancelled': return 'approval_cancelled';
            default: return 'record_updated';
          }
      }

    case 'evaluation_review_comment':
      switch (action) {
        case 'insert': return 'manager_feedback';
        case 'delete': return 'record_deleted';
        default: return 'record_updated';
      }

    case 'evaluation_approval':
      switch (action) {
        case 'insert': return 'approval_stage_created';
        case 'delete': return 'record_deleted';
        default:
          switch (first(newValue('status'))) {
            case 'approved':
              return numeric(newValue('score_adjustment')) !== 0
                ? 'manual_adjustment'
                : 'approval';
            case 'changes_requested': return 'returned_for_review';
            case 'rejected': return 'approval_rejected';
            case 'cancelled': return 'approval_cancelled';
            default: return 'record_updated';
          }
      }

    case 'stipend_recommendation':
      switch (action) {
        case 'insert': return 'stipend_recommendation_created';
        case 'delete': return 'record_deleted';
        default:
          if (distinct(newValue('final_approved_amount'), oldValue('final_approved_amount'))
            || distinct(newValue('amount_adjustment'), oldValue('amount_adjustment'))) {
            return 'stipend_adjustment';
          }
          switch (first(newValue('status'))) {
            case 'approved': return 'stipend_approved';
            case 'rejected': return 'stipend_rejected';
            case 'superseded': return 'stipend_superseded';
            default: return 'record_updated';
          }
      }

    case 'payment':
      switch (action) {
        case 'insert': return 'payment_record_created';
        case 'delete': return 'record_deleted';
        default:
          switch (first(newValue('status'))) {
            case 'approved': return 'payment_approved';
            case 'held': return 'payment_held';
            case 'paid': return 'payment_marked_paid';
            case 'pending': return 'payment_released';
            default: return 'record_updated';
          }
      }

    case 'attendance':
      switch (action) {
        case 'insert': return 'attendance_recorded';
        case 'delete': return 'attendance_deleted';
        default: return 'attendance_updated';
      }

    case 'evaluation_period':
      switch (action) {
        case 'insert': return 'period_created';
        case 'delete': return 'record_deleted';
        default:
          return distinct(newValue('status'), oldValue('status'))
            ? 'period_status_changed'
            : 'record_updated';
      }

    case 'weight_config':
      switch (action) {
        case 'insert': return 'weight_config_created';
        case 'delete': return 'record_deleted';
        default: return 'record_updated';
      }

    case 'stipend_base_config':
      switch (action) {
        case 'insert': return 'base_config_created';
        case 'delete': return 'record_deleted';
        default: return 'record_updated';
      }

    default:
      switch (action) {
        case 'insert': return 'record_created';
        case 'delete': return 'record_deleted';
        default: return 'record_updated';
      }
  }
}

// Compare before/after JSON snapshots and return only the changed fields.
// Returns an array of { field, oldValue, newValue }.
export function changedAuditFields(oldValues = {}, newValues = {}) {
  const keys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
  const changes = [];
  keys.forEach((field) => {
    const oldValue = oldValues[field];
    const newValue = newValues[field];
    if (distinct(JSON.stringify(oldValue), JSON.stringify(newValue))) {
      changes.push({ field, oldValue, newValue });
    }
  });
  return changes;
}

// Human-readable label for a snake_case database column.
export function prettifyAuditField(field) {
  return String(field || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

// Format a raw JSON value for the audit history interface.
export function formatAuditValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable value]';
    }
  }
  return String(value);
}
