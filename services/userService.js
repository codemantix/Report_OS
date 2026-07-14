import { supabase } from '../lib/supabaseClient';
import { getAdminClient } from '../lib/supabaseAdmin';
import { validateAvatarFile } from '../utils/validationHelpers';
import { applySearchOr, buildIlikeClauses, buildInClause, normalizeSearchTerm } from '../utils/searchHelpers';

function getClient() {
  if (typeof window === 'undefined') {
    try {
      return getAdminClient();
    } catch (e) {
      console.warn('Admin client fallback to anon client:', e.message);
    }
  }
  return supabase;
}

const editableProfileFields = [
  'full_name',
  'display_name',
  'phone_number',
  'job_title',
  'bio',
  'avatar_url',
];

function pickEditableProfileFields(payload = {}) {
  return editableProfileFields.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      acc[key] = payload[key] === '' ? null : payload[key];
    }
    return acc;
  }, {});
}

async function getDepartmentIdsBySearch(search) {
  const term = normalizeSearchTerm(search);
  if (!term) return [];

  const { data, error } = await applySearchOr(
    getClient().from('departments').select('id'),
    buildIlikeClauses(['name', 'description', 'status'], term)
  );

  if (error) return [];
  return (data || []).map((dept) => dept.id).filter(Boolean);
}

async function buildUserSearchClauses(search) {
  const term = normalizeSearchTerm(search);
  if (!term) return [];
  const departmentIds = await getDepartmentIdsBySearch(term);

  return [
    ...buildIlikeClauses(['full_name', 'display_name', 'email', 'phone_number', 'job_title', 'role', 'status'], term),
    buildInClause('department_id', departmentIds),
  ].filter(Boolean);
}

export async function fetchUsers(filters = {}) {
  let query = getClient()
    .from('users')
    .select(`
      *,
      departments:department_id (id, name)
    `)
    .order(filters.sortBy || 'full_name', { ascending: filters.sortDirection !== 'desc' });

  if (filters.department_id) {
    query = query.eq('department_id', filters.department_id);
  }

  if (filters.role) {
    query = query.eq('role', filters.role);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.search) {
    query = applySearchOr(query, await buildUserSearchClauses(filters.search));
  }

  const { data, error } = await query;
  return { data, error };
}

export async function fetchUserById(id) {
  const { data, error } = await getClient()
    .from('users')
    .select(`
      *,
      departments:department_id (id, name)
    `)
    .eq('id', id)
    .single();

  return { data, error };
}

export async function getCurrentUserProfile(userId) {
  const { data, error } = await getClient()
    .from('users')
    .select(`
      *,
      departments:department_id (id, name)
    `)
    .eq('id', userId)
    .single();

  return { data, error };
}

export async function updateCurrentUserProfile(userId, payload) {
  const safePayload = pickEditableProfileFields(payload);

  if (typeof window !== 'undefined') {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        return { data: null, error: new Error('Your session has expired. Please sign in again.') };
      }

      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(safePayload),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { data: null, error: new Error(result.error || 'Failed to update profile.') };
      }

      return { data: result.profile, error: null };
    } catch {
      return { data: null, error: new Error('Unable to update your profile. Please check your connection and try again.') };
    }
  }

  safePayload.updated_at = new Date().toISOString();

  const { data, error } = await getClient()
    .from('users')
    .update(safePayload)
    .eq('id', userId)
    .select(`
      *,
      departments:department_id (id, name)
    `)
    .single();

  return { data, error };
}

export async function uploadUserAvatar(userId, file) {
  const validationError = validateAvatarFile(file);
  if (validationError) {
    return { data: null, error: new Error(validationError) };
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    return {
      data: null,
      error: new Error('Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.'),
    };
  }

  const timestamp = Date.now();
  const extension = file.name.split('.').pop()?.toLowerCase() || 'image';
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', `avatars/${userId}`);
  formData.append('public_id', `${timestamp}-avatar.${extension}`);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error?.message || 'Avatar upload failed.');
    }

    return {
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        size: file.size,
        type: file.type,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error };
  }
}

export async function removeUserAvatar(userId) {
  return updateCurrentUserProfile(userId, { avatar_url: null });
}

export async function getUserDepartment(departmentId) {
  if (!departmentId) return { data: null, error: null };

  const { data, error } = await getClient()
    .from('departments')
    .select('id, name')
    .eq('id', departmentId)
    .single();

  return { data, error };
}

export async function updateUser(id, updates) {
  const { data, error } = await getClient()
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function fetchUsersByDepartment(departmentId) {
  const { data, error } = await getClient()
    .from('users')
    .select('*')
    .eq('department_id', departmentId)
    .eq('status', 'active')
    .order('full_name', { ascending: true });

  return { data, error };
}

/**
 * Delete a user from the public users table, clearing dependencies safely.
 * @param {string} id - User ID to delete
 */
export async function deleteUser(id) {
  try {
    // 1. Clean up pivot assignments
    await getClient().from('task_assignees').delete().eq('user_id', id);
    await getClient().from('goal_assignees').delete().eq('user_id', id);

    // 2. Set historical creator/owner/reviewer IDs to null so historical data is preserved
    await getClient().from('reports').update({ user_id: null }).eq('user_id', id);
    await getClient().from('reports').update({ reviewed_by: null }).eq('reviewed_by', id);
    await getClient().from('tasks').update({ created_by: null }).eq('created_by', id);
    await getClient().from('goals').update({ owner_id: null }).eq('owner_id', id);
    await getClient().from('company_monthly_goals').update({ owner_id: null }).eq('owner_id', id);
    await getClient().from('company_monthly_goals').update({ created_by: null }).eq('created_by', id);

    // 3. Delete from public users table
    const { error } = await getClient()
      .from('users')
      .delete()
      .eq('id', id);

    return { error };
  } catch (err) {
    return { error: err };
  }
}

/**
 * Verify that the user executing the request is an admin.
 * @param {string} adminId
 */
async function verifyIsAdmin(adminId) {
  const { data, error } = await getClient()
    .from('users')
    .select('role')
    .eq('id', adminId)
    .single();

  if (error || !data || data.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required');
  }
}

/**
 * Fetch team members available to the current user based on role and filters.
 * @param {object} currentUser
 * @param {object} filters
 */
export async function getTeamMembersForCurrentUser(currentUser, filters = {}) {
  if (!currentUser) {
    return { data: null, error: new Error('Unauthorized') };
  }

  const mergedFilters = { ...filters };

  if (currentUser.role === 'admin') {
    return fetchUsers(mergedFilters);
  } else if (currentUser.role === 'department_lead') {
    if (!currentUser.department_id) {
      return { data: [], error: null };
    }
    // Hard-enforce department boundary
    mergedFilters.department_id = currentUser.department_id;
    // Strip other restricted filters
    delete mergedFilters.role;
    return fetchUsers(mergedFilters);
  } else {
    return { data: null, error: new Error('Unauthorized: Team directory access is restricted') };
  }
}

/**
 * Fetch a target team member's profile, enforcing role permissions.
 */
export async function getTeamMemberProfile({ currentUser, targetUserId }) {
  if (!currentUser) {
    return { data: null, error: new Error('Unauthorized') };
  }

  if (currentUser.role !== 'admin' && currentUser.role !== 'department_lead') {
    return { data: null, error: new Error('Unauthorized') };
  }

  const { data, error } = await getClient()
    .from('users')
    .select('*, departments:department_id (id, name)')
    .eq('id', targetUserId)
    .single();

  if (error) return { data: null, error };
  if (!data) return { data: null, error: new Error('User not found') };

  if (currentUser.role === 'department_lead' && data.department_id !== currentUser.department_id) {
    return { data: null, error: new Error('Unauthorized: Cannot access member outside your department') };
  }

  return { data, error: null };
}

/**
 * Fetch team member stats (reports, tasks, success scores), enforcing role permissions.
 */
export async function getTeamMemberStats({ currentUser, targetUserId }) {
  if (!currentUser) {
    return { data: null, error: new Error('Unauthorized') };
  }

  if (currentUser.role !== 'admin' && currentUser.role !== 'department_lead') {
    return { data: null, error: new Error('Unauthorized') };
  }

  // First check department access
  const { data: targetUser, error: userError } = await getClient()
    .from('users')
    .select('department_id')
    .eq('id', targetUserId)
    .single();

  if (userError || !targetUser) {
    return { data: null, error: userError || new Error('User not found') };
  }

  if (currentUser.role === 'department_lead' && targetUser.department_id !== currentUser.department_id) {
    return { data: null, error: new Error('Unauthorized: Cannot access stats of member outside your department') };
  }

  // Fetch tasks and reports in parallel
  const [tasksRes, reportsRes] = await Promise.all([
    getClient()
      .from('task_assignees')
      .select('task_id, tasks(status)')
      .eq('user_id', targetUserId),
    getClient()
      .from('reports')
      .select(`
        id,
        created_at,
        report_ai_analysis (
          success_rate,
          task_alignment_score
        )
      `)
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
  ]);

  if (tasksRes.error) return { data: null, error: tasksRes.error };
  if (reportsRes.error) return { data: null, error: reportsRes.error };

  const tasks = tasksRes.data || [];
  const reports = reportsRes.data || [];

  const completedTasks = tasks.filter(t => t.tasks?.status === 'completed').length;
  const pendingTasks = tasks.filter(t => t.tasks?.status === 'pending' || t.tasks?.status === 'in_progress').length;
  const blockedTasks = tasks.filter(t => t.tasks?.status === 'blocked').length;

  const now = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(now.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const reportsThisWeek = reports.filter(r => new Date(r.created_at) >= oneWeekAgo).length;
  const reportsThisMonth = reports.filter(r => new Date(r.created_at) >= startOfMonth).length;

  // Calculate averages
  let successRateSum = 0;
  let successRateCount = 0;
  let taskAlignmentSum = 0;
  let taskAlignmentCount = 0;

  reports.forEach(r => {
    const ai = r.report_ai_analysis;
    if (ai) {
      if (typeof ai.success_rate === 'number') {
        successRateSum += ai.success_rate;
        successRateCount++;
      }
      if (typeof ai.task_alignment_score === 'number') {
        taskAlignmentSum += ai.task_alignment_score;
        taskAlignmentCount++;
      }
    }
  });

  const avgSuccessRate = successRateCount > 0 ? Math.round(successRateSum / successRateCount) : null;
  const avgTaskAlignment = taskAlignmentCount > 0 ? Math.round(taskAlignmentSum / taskAlignmentCount) : null;
  const lastReport = reports[0] || null;

  return {
    data: {
      totalTasks: tasks.length,
      completedTasks,
      pendingTasks,
      blockedTasks,
      totalReports: reports.length,
      reportsThisWeek,
      reportsThisMonth,
      avgSuccessRate,
      avgTaskAlignment,
      lastReport,
    },
    error: null
  };
}

/**
 * Edit allowed profile information as an admin.
 */
export async function updateTeamMemberByAdmin({ adminId, targetUserId, payload }) {
  try {
    await verifyIsAdmin(adminId);

    const { data, error } = await getClient()
      .from('users')
      .update(payload)
      .eq('id', targetUserId)
      .select()
      .single();

    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Change a team member's role as an admin.
 */
export async function changeUserRole({ adminId, targetUserId, role }) {
  try {
    await verifyIsAdmin(adminId);

    if (adminId === targetUserId) {
      throw new Error('Self-demotion: Administrators cannot modify their own roles.');
    }

    const { data, error } = await getClient()
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', targetUserId)
      .select()
      .single();

    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Change a team member's department assignment.
 */
export async function changeUserDepartment({ adminId, targetUserId, departmentId }) {
  try {
    await verifyIsAdmin(adminId);

    const { data, error } = await getClient()
      .from('users')
      .update({ department_id: departmentId || null, updated_at: new Date().toISOString() })
      .eq('id', targetUserId)
      .select()
      .single();

    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Update a user's active status (e.g. suspend or activate).
 */
export async function updateUserStatus({ adminId, targetUserId, status }) {
  try {
    await verifyIsAdmin(adminId);

    if (adminId === targetUserId && status !== 'active') {
      throw new Error('Account lock: Administrators cannot suspend or deactivate their own accounts.');
    }

    const { data, error } = await getClient()
      .from('users')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', targetUserId)
      .select()
      .single();

    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}
