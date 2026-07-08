import { useState } from 'react';
import { Pencil, X, Check, ShieldAlert, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';
import { getProfileDisplayName, getProfileInitials } from '../../utils/profileHelpers';
import styles from './Team.module.css';
import Image from 'next/image';

const roleLabels = {
  admin: 'Admin',
  department_lead: 'Dept. Lead',
  team_member: 'Member',
};

const roleStyles = {
  admin: styles.roleAdmin,
  department_lead: styles.roleLead,
  team_member: styles.roleMember,
};

const statusStyles = {
  active: styles.statusActive,
  inactive: styles.statusInactive,
  suspended: styles.statusSuspended,
};

export default function TeamTable({ users, currentUser = null, departments = [], onUserUpdate, onUserDelete }) {
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // { user, newRole }
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null); // user object

  const isAdmin = currentUser?.role === 'admin';

  function startEdit(user) {
    setEditingUserId(user.id);
    setEditForm({
      role: user.role || 'team_member',
      status: user.status || 'active',
      department_id: user.department_id || '',
    });
  }

  function cancelEdit() {
    setEditingUserId(null);
    setEditForm({});
  }

  async function handleSave(userId) {
    const updates = {};
    if (editForm.role) updates.role = editForm.role;
    if (editForm.status) updates.status = editForm.status;
    if (editForm.department_id !== undefined) {
      updates.department_id = editForm.department_id || null;
    }

    // If promoting to admin, show confirmation first
    const user = users.find((u) => u.id === userId);
    if (editForm.role === 'admin' && user?.role !== 'admin') {
      setConfirmModal({ user, newRole: 'admin', updates });
      return;
    }

    await performUpdate(userId, updates);
  }

  async function performUpdate(userId, updates) {
    setSaving(true);
    try {
      await onUserUpdate(userId, updates);
      cancelEdit();
    } catch {
      // Error already handled by parent
    } finally {
      setSaving(false);
    }
  }

  function handleConfirmPromotion() {
    if (!confirmModal) return;
    performUpdate(confirmModal.user.id, confirmModal.updates);
    setConfirmModal(null);
  }

  async function handleConfirmDelete() {
    if (!deleteConfirmModal) return;
    setSaving(true);
    try {
      await onUserDelete(deleteConfirmModal.id);
      setDeleteConfirmModal(null);
    } catch {
      // Handled by parent
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Name</th>
              <th className={styles.th}>Email</th>
              {isAdmin && <th className={styles.th}>Department</th>}
              <th className={styles.th}>Role</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Job Title</th>
              <th className={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isEditing = editingUserId === user.id;
              const displayName = getProfileDisplayName(user, 'User');
              const initials = getProfileInitials(user);

              return (
                <tr key={user.id} className={styles.tr}>
                  <td className={styles.td}>
                    <div className={styles.userCell}>
                      <div className={styles.userAvatar}>
                        {user.avatar_url ? (
                          <Image src={user.avatar_url} alt={displayName} className={styles.userAvatarImage} width={32} height={32} />
                        ) : (
                          initials
                        )}
                      </div>
                      <span className={styles.userName}>
                        {displayName}
                        {currentUser && user.id === currentUser.id && (
                          <span className={styles.currentUserTag}>(you)</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className={styles.td}>{user.email}</td>
                  {isAdmin && (
                    <td className={styles.td}>
                      {isEditing ? (
                        <select
                          value={editForm.department_id}
                          onChange={(e) => setEditForm((f) => ({ ...f, department_id: e.target.value }))}
                          className={styles.select}
                          style={{ padding: '4px 8px', fontSize: '12px', minWidth: '140px' }}
                          disabled={saving}
                        >
                          <option value="">No Department</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        user.departments?.name || 'N/A'
                      )}
                    </td>
                  )}
                  <td className={styles.td}>
                    {isEditing ? (
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                        className={styles.select}
                        style={{ padding: '4px 8px', fontSize: '12px', minWidth: '120px' }}
                        disabled={saving}
                      >
                        <option value="team_member">Team Member</option>
                        <option value="department_lead">Department Lead</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`${styles.roleBadge} ${roleStyles[user.role] || styles.roleMember}`}>
                        {roleLabels[user.role] || user.role?.replace('_', ' ') || 'Member'}
                      </span>
                    )}
                  </td>
                  <td className={styles.td}>
                    {isEditing ? (
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                        className={styles.select}
                        style={{ padding: '4px 8px', fontSize: '12px', minWidth: '110px' }}
                        disabled={saving}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    ) : (
                      <span className={`${styles.statusBadge} ${statusStyles[user.status] || styles.statusActive}`}>
                        {user.status || 'active'}
                      </span>
                    )}
                  </td>
                  <td className={styles.td}>
                    {user.job_title || 'No Title'}
                  </td>
                  <td className={styles.td}>
                    <div className={styles.actions}>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSave(user.id)}
                            disabled={saving}
                            className={styles.actionBtn}
                            title="Save"
                            style={{ color: '#10B981' }}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className={styles.actionBtn}
                            title="Cancel"
                            style={{ color: '#EF4444' }}
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/dashboard/team/${user.id}`}
                            className={styles.actionBtn}
                            title="View Profile"
                          >
                            <Eye size={16} />
                          </Link>
                          {isAdmin && (
                            <button
                              onClick={() => startEdit(user)}
                              className={styles.actionBtn}
                              title="Edit user"
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          {/* {currentUser?.role === 'admin' && user.id !== currentUser.id && (
                            <button
                              onClick={() => setDeleteConfirmModal(user)}
                              className={styles.actionBtn}
                              title="Remove team member"
                              style={{ color: '#EF4444' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )} */}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirmation modal for admin promotion */}
      {confirmModal && (
        <div className={styles.overlay} onClick={() => setConfirmModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Promote to Admin?</div>

            <div className={styles.warningBanner}>
              <ShieldAlert className={styles.warningIcon} />
              <span className={styles.warningText}>
                Admins have full access to all data, settings, and user management. This action cannot be undone easily.
              </span>
            </div>

            <p className={styles.modalText}>
              Are you sure you want to promote <strong>{getProfileDisplayName(confirmModal.user, 'this user')}</strong> ({confirmModal.user.email}) to <strong>Admin</strong>?
            </p>

            <div className={styles.modalActions}>
              <button
                onClick={() => setConfirmModal(null)}
                className={styles.cancelBtn}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPromotion}
                disabled={saving}
                className={styles.confirmBtn}
              >
                {saving ? 'Promoting...' : 'Yes, Promote to Admin'}
              </button>
            </div>

            <p className={styles.roleInfo}>
              They will immediately gain access to all reports, departments, and system settings.
            </p>
          </div>
        </div>
      )}

      {/* Confirmation modal for user deletion */}
      {deleteConfirmModal && (
        <div className={styles.overlay} onClick={() => setDeleteConfirmModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle} style={{ color: '#EF4444' }}>Remove Team Member?</div>

            <p className={styles.modalText}>
              Are you sure you want to remove <strong>{getProfileDisplayName(deleteConfirmModal, 'this user')}</strong> ({deleteConfirmModal.email}) from the team?
              <br /><br />
              This will remove their assignments and details from active goals and tasks. Historical work reports submitted by them will be preserved, but will display as unassigned.
            </p>

            <div className={styles.modalActions}>
              <button
                onClick={() => setDeleteConfirmModal(null)}
                className={styles.cancelBtn}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={saving}
                className={styles.dangerBtn}
              >
                {saving ? 'Removing...' : 'Yes, Remove Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
