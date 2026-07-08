import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { ShieldAlert, RefreshCw, UserCheck, AlertTriangle } from 'lucide-react';
import styles from './Team.module.css';

export default function TeamProfileAdminActions({ user, currentUser, onRefreshProfile }) {
  const [departments, setDepartments] = useState([]);
  const [saving, setSaving] = useState(false);

  // Form states
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  // Confirmation Modals
  const [modalConfig, setModalConfig] = useState(null); // { action, value, title, text, confirmText, isDanger }

  useEffect(() => {
    async function loadDepartments() {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name', { ascending: true });
      if (!error && data) setDepartments(data);
    }
    loadDepartments();
  }, []);

  useEffect(() => {
    if (user) {
      setRole(user.role || 'team_member');
      setStatus(user.status || 'active');
      setDepartmentId(user.department_id || '');
    }
  }, [user]);

  if (!user || !currentUser) return null;

  const isMe = user.id === currentUser.id;

  const handleAction = async (action, value) => {
    // 1. Configure confirmations for sensitive changes
    if (action === 'change_role') {
      if (value === 'admin') {
        setModalConfig({
          action,
          value,
          title: 'Promote to Admin?',
          text: `Are you sure you want to promote ${user.full_name} to Administrator? They will gain unrestricted access to all data, settings, and user permissions.`,
          confirmText: 'Yes, Promote to Admin',
          isDanger: true
        });
        return;
      }
    } else if (action === 'change_status') {
      if (value === 'suspended') {
        setModalConfig({
          action,
          value,
          title: 'Suspend Account?',
          text: `Are you sure you want to suspend ${user.full_name}'s account? They will be immediately blocked from signing in or submitting work reports.`,
          confirmText: 'Yes, Suspend Account',
          isDanger: true
        });
        return;
      }
    }

    // Direct execute for non-sensitive changes
    await executeAdminAction(action, value);
  };

  const executeAdminAction = async (action, value) => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`/api/team/${user.id}/admin-actions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ action, value })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update account setting');
      }

      toast.success(payload.message || 'Updated successfully');
      
      // Update local states
      if (action === 'change_role') setRole(value);
      if (action === 'change_status') setStatus(value);
      if (action === 'change_department') setDepartmentId(value);

      onRefreshProfile();
    } catch (err) {
      toast.error(err.message || 'Action failed');
    } finally {
      setSaving(false);
      setModalConfig(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6 transition-colors duration-200">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1.5">
          Account Administration Controls
        </h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
          Manage system security role, department assignments, and login status.
        </p>
      </div>

      {isMe ? (
        <div className="flex gap-3 p-4 border border-purple-100 dark:border-purple-950/30 bg-purple-50/50 dark:bg-purple-950/10 rounded-xl">
          <ShieldAlert className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          <p className="text-xs text-purple-800 dark:text-purple-300 font-normal leading-relaxed">
            <strong>Self-Management Protection:</strong> You are currently viewing your own profile. Modifying your own administrative role, active status, or department must be performed by another administrator to prevent accidental locked states.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Role assignment */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Access Control Role</span>
            <select
              value={role}
              onChange={(e) => handleAction('change_role', e.target.value)}
              className={styles.select}
              disabled={saving}
            >
              <option value="team_member">Team Member</option>
              <option value="department_lead">Department Lead</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          {/* Department assignment */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Department Assignment</span>
            <select
              value={departmentId}
              onChange={(e) => handleAction('change_department', e.target.value)}
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

          {/* Status assignment */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account Active Status</span>
            <select
              value={status}
              onChange={(e) => handleAction('change_status', e.target.value)}
              className={styles.select}
              disabled={saving}
            >
              <option value="active">Active (Full access)</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended (Blocked login)</option>
            </select>
          </div>

        </div>
      )}

      {/* Confirmation Modal */}
      {modalConfig && (
        <div className={styles.overlay} onClick={() => setModalConfig(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className={modalConfig.isDanger ? 'text-red-500' : 'text-amber-500'} size={20} />
              <div className={styles.modalTitle}>{modalConfig.title}</div>
            </div>

            <p className={styles.modalText}>
              {modalConfig.text}
            </p>

            <div className={styles.modalActions}>
              <button
                onClick={() => setModalConfig(null)}
                className={styles.cancelBtn}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={() => executeAdminAction(modalConfig.action, modalConfig.value)}
                disabled={saving}
                className={modalConfig.isDanger ? styles.dangerBtn : styles.confirmBtn}
              >
                {saving ? 'Updating...' : modalConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
