import { supabase } from '../lib/supabaseClient';
import { applySearchOr, buildIlikeClauses, buildInClause, normalizeSearchTerm } from '../utils/searchHelpers';

export async function createTask(taskData) {
  const { assignee_ids = [], ...taskPayload } = taskData;

  const { data, error } = await supabase
    .from('tasks')
    .insert([taskPayload])
    .select(`
      *,
      departments:department_id (id, name),
      goals:goal_id (id, title),
      plans:plan_id (id, title)
    `)
    .single();

  if (error || !data) return { data, error };

  if (assignee_ids.length > 0) {
    const rows = assignee_ids.map((userId) => ({
      task_id: data.id,
      user_id: userId,
      assigned_by: taskPayload.created_by,
    }));

    const { error: assignError } = await supabase
      .from('task_assignees')
      .insert(rows);

    if (assignError) {
      return { data, error: assignError };
    }

    // Log activity
    await logTaskActivity(data.id, taskPayload.created_by, 'task_created', null, null, {
      assignees: assignee_ids,
    });
  }

  return { data, error: null };
}

async function getIdsBySearch(table, fields, search, idColumn = 'id') {
  const term = normalizeSearchTerm(search);
  if (!term) return [];

  const { data, error } = await applySearchOr(
    supabase.from(table).select(idColumn),
    buildIlikeClauses(fields, term)
  );

  if (error) return [];
  return (data || []).map((item) => item[idColumn]).filter(Boolean);
}

async function buildTaskSearchClauses(search) {
  const term = normalizeSearchTerm(search);
  if (!term) return [];

  const clauses = buildIlikeClauses([
    'title',
    'description',
    'expected_output',
    'priority',
    'status',
  ], term);

  const [departmentIds, goalIds, planIds, userIds] = await Promise.all([
    getIdsBySearch('departments', ['name', 'description', 'status'], term),
    getIdsBySearch('goals', ['title', 'description', 'success_metric', 'expected_deliverables', 'priority', 'status'], term),
    getIdsBySearch('department_plans', ['title', 'description', 'plan_type'], term),
    getIdsBySearch('users', ['full_name', 'display_name', 'email', 'phone_number', 'job_title', 'role', 'status'], term),
  ]);

  let assignedTaskIds = [];
  if (userIds.length > 0) {
    const { data } = await supabase
      .from('task_assignees')
      .select('task_id')
      .in('user_id', userIds);
    assignedTaskIds = (data || []).map((row) => row.task_id).filter(Boolean);
  }

  return [
    ...clauses,
    buildInClause('department_id', departmentIds),
    buildInClause('goal_id', goalIds),
    buildInClause('plan_id', planIds),
    buildInClause('created_by', userIds),
    buildInClause('id', assignedTaskIds),
  ].filter(Boolean);
}

export async function fetchTasks(filters = {}) {
  let query = supabase
    .from('tasks')
    .select(`
      *,
      departments:department_id (id, name),
      goals:goal_id (id, title),
      plans:plan_id (id, title),
      created_by_user:created_by (id, full_name, display_name, email, avatar_url),
      task_assignees (
        users:user_id (id, full_name, display_name, email, avatar_url, job_title)
      )
    `)
    .order(filters.sortBy || 'created_at', { ascending: filters.sortDirection === 'asc' });

  if (filters.department_id) {
    query = query.eq('department_id', filters.department_id);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }
  if (filters.goal_id) {
    query = query.eq('goal_id', filters.goal_id);
  }
  if (filters.plan_id) {
    query = query.eq('plan_id', filters.plan_id);
  }
  if (filters.archived !== undefined) {
    query = query.eq('archived', filters.archived);
  }
  if (filters.assignee_id) {
    const { data: assignments } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('user_id', filters.assignee_id);
    const taskIds = (assignments || []).map((row) => row.task_id).filter(Boolean);
    query = taskIds.length > 0 ? query.in('id', taskIds) : query.eq('id', '00000000-0000-0000-0000-000000000000');
  }
  if (filters.created_by) {
    query = query.eq('created_by', filters.created_by);
  }
  if (filters.dueDate) {
    query = query.eq('due_date', filters.dueDate);
  }
  if (filters.overdue) {
    query = query.lt('due_date', new Date().toISOString()).not('status', 'in', '(completed,cancelled)');
  }
  if (filters.search) {
    query = applySearchOr(query, await buildTaskSearchClauses(filters.search));
  }

  const { data, error } = await query;
  return { data, error };
}

export async function fetchTaskById(id) {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      departments:department_id (id, name),
      goals:goal_id (id, title, description, success_metric),
      plans:plan_id (id, title, description, plan_type),
      created_by_user:created_by (id, full_name, display_name, email, avatar_url),
      task_assignees (
        users:user_id (id, full_name, display_name, email, avatar_url, job_title)
      ),
      task_comments (
        *,
        user:user_id (id, full_name, display_name, email, avatar_url)
      )
    `)
    .eq('id', id)
    .single();

  return { data, error };
}

export async function fetchMyTasks(userId, filters = {}) {
  // First get the task IDs for this user
  const { data: assignments, error: assignError } = await supabase
    .from('task_assignees')
    .select('task_id')
    .eq('user_id', userId);

  if (assignError) return { data: null, error: assignError };

  if (!assignments || assignments.length === 0) return { data: [], error: null };

  const taskIds = assignments.map((a) => a.task_id);

  // Then fetch the tasks by IDs
  let taskQuery = supabase
    .from('tasks')
    .select(`
      *,
      departments:department_id (id, name),
      goals:goal_id (id, title),
      plans:plan_id (id, title),
      created_by_user:created_by (id, full_name, display_name, email, avatar_url)
    `)
    .in('id', taskIds)
    .order(filters.sortBy || 'created_at', { ascending: filters.sortDirection === 'asc' });

  if (filters.search) {
    taskQuery = applySearchOr(taskQuery, await buildTaskSearchClauses(filters.search));
  }
  if (filters.status) taskQuery = taskQuery.eq('status', filters.status);
  if (filters.priority) taskQuery = taskQuery.eq('priority', filters.priority);

  const { data: tasks, error: taskError } = await taskQuery;

  if (taskError) return { data: null, error: taskError };

  // Return in the same format the consumers expect
  const data = tasks.map((task) => ({ tasks: task }));
  return { data, error: null };
}

export async function updateTask(id, updates) {
  const { assignee_ids, ...taskUpdates } = updates;

  const { data, error } = await supabase
    .from('tasks')
    .update(taskUpdates)
    .eq('id', id)
    .select(`
      *,
      departments:department_id (id, name),
      goals:goal_id (id, title),
      plans:plan_id (id, title)
    `)
    .single();

  if (error || !data) return { data, error };

  if (Array.isArray(assignee_ids)) {
    // Replace all assignees
    const { error: deleteError } = await supabase
      .from('task_assignees')
      .delete()
      .eq('task_id', id);

    if (deleteError) return { data, error: deleteError };

    if (assignee_ids.length > 0) {
      const rows = assignee_ids.map((userId) => ({
        task_id: id,
        user_id: userId,
        assigned_by: taskUpdates.created_by,
      }));

      const { error: insertError } = await supabase
        .from('task_assignees')
        .insert(rows);

      if (insertError) return { data, error: insertError };
    }
  }

  return { data, error: null };
}

export async function updateTaskStatus(id, status, userId) {
  const { data: current } = await supabase
    .from('tasks')
    .select('status')
    .eq('id', id)
    .single();

  const updates = { status };
  if (status === 'completed') {
    updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (!error && current) {
    await logTaskActivity(id, userId, 'status_changed', current.status, status);
  }

  return { data, error };
}

export async function addTaskComment(taskId, userId, comment) {
  const { data, error } = await supabase
    .from('task_comments')
    .insert([{ task_id: taskId, user_id: userId, comment }])
    .select(`
      *,
      user:user_id (id, full_name, display_name, email, avatar_url)
    `)
    .single();

  if (!error) {
    await logTaskActivity(taskId, userId, 'comment_added');
  }

  return { data, error };
}

export async function archiveTask(id, userId) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ archived: true })
    .eq('id', id)
    .select()
    .single();

  if (!error) {
    await logTaskActivity(id, userId, 'task_archived');
  }

  return { data, error };
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  return { error };
}

export async function getTaskActivityLogs(taskId) {
  const { data, error } = await supabase
    .from('task_activity_logs')
    .select(`
      *,
      user:user_id (id, full_name, display_name, email, avatar_url)
    `)
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  return { data, error };
}

async function logTaskActivity(taskId, userId, action, previousValue, newValue, metadata) {
  return supabase.from('task_activity_logs').insert([
    { task_id: taskId, user_id: userId, action, previous_value: previousValue, new_value: newValue, metadata },
  ]);
}
