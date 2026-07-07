import { useState } from 'react';
import { Pencil, X, Check, ShieldAlert } from 'lucide-react';
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

export default function TeamTable({ users, currentUser = null, departments = [], onUserUpdate }) {
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // { user, newRole }

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

  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Name</th>
              <th className={styles.th}>Email</th>
              <th className={styles.th}>Department</th>
              <th className={styles.th}>Role</th>
              <th className={styles.th}>Status</th>
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
                  <td className={styles.td}>
                    {user.departments?.name || 'N/A'}
                  </td>
                  <td className={styles.td}>
                    <span className={`${styles.roleBadge} ${roleStyles[user.role] || styles.roleMember}`}>
                      {roleLabels[user.role] || user.role?.replace('_', ' ') || 'Member'}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={`${styles.statusBadge} ${statusStyles[user.status] || styles.statusActive}`}>
                      {user.status || 'active'}
                    </span>
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
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className={styles.actionBtn}
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(user)}
                          className={styles.actionBtn}
                          title="Edit user"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Edit panel */}
        {editingUserId && (() => {
          const user = users.find((u) => u.id === editingUserId);
          if (!user) return null;

          return (
            <div className={styles.editPanel}>
              <div className={styles.editPanelContent}>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                    className={styles.select}
                    disabled={saving}
                  >
                    <option value="team_member">Team Member</option>
                    <option value="department_lead">Department Lead</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className={styles.editField}>
                  <label className={styles.editLabel}>Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                    className={styles.select}
                    disabled={saving}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                <div className={styles.editField}>
                  <label className={styles.editLabel}>Department</label>
                  <select
                    value={editForm.department_id}
                    onChange={(e) => setEditForm((f) => ({ ...f, department_id: e.target.value }))}
                    className={styles.select}
                    disabled={saving}
                  >
                    <option value="">No Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.editActions}>
                  <button
                    onClick={() => handleSave(user.id)}
                    disabled={saving}
                    className={styles.saveBtn}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    className={styles.cancelBtn}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
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
    </>
  );
}
