import { supabase } from '../lib/supabaseClient';
import { validateAvatarFile } from '../utils/validationHelpers';
import { applySearchOr, buildIlikeClauses, buildInClause, normalizeSearchTerm } from '../utils/searchHelpers';

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
    supabase.from('departments').select('id'),
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
  let query = supabase
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
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
  safePayload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
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

  const { data, error } = await supabase
    .from('departments')
    .select('id, name')
    .eq('id', departmentId)
    .single();

  return { data, error };
}

export async function updateUser(id, updates) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function fetchUsersByDepartment(departmentId) {
  const { data, error } = await supabase
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
    await supabase.from('task_assignees').delete().eq('user_id', id);
    await supabase.from('goal_assignees').delete().eq('user_id', id);

    // 2. Set historical creator/owner/reviewer IDs to null so historical data is preserved
    await supabase.from('reports').update({ user_id: null }).eq('user_id', id);
    await supabase.from('reports').update({ reviewed_by: null }).eq('reviewed_by', id);
    await supabase.from('tasks').update({ created_by: null }).eq('created_by', id);
    await supabase.from('goals').update({ owner_id: null }).eq('owner_id', id);
    await supabase.from('company_monthly_goals').update({ owner_id: null }).eq('owner_id', id);
    await supabase.from('company_monthly_goals').update({ created_by: null }).eq('created_by', id);

    // 3. Delete from public users table
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    return { error };
  } catch (err) {
    return { error: err };
  }
}
