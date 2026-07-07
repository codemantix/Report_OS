import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { fetchUsers } from '../../services/userService';
import { getProfileDisplayName } from '../../utils/profileHelpers';
import styles from './Departments.module.css';

export default function DepartmentForm({ initialData, onSubmit, onCancel, loading }) {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    lead_user_id: '',
    status: 'active',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        description: initialData.description || '',
        lead_user_id: initialData.lead_user_id || '',
        status: initialData.status || 'active',
      });
    }
  }, [initialData]);

  async function loadUsers() {
    const { data, error } = await fetchUsers({ status: 'active' });
    if (error) {
      toast.error('Failed to load users');
      return;
    }
    setUsers(data || []);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }

  function validate() {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Department name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      name: formData.name.trim(),
      description: formData.description.trim(),
      lead_user_id: formData.lead_user_id || null,
      status: formData.status,
    });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="name">
          Department Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className={styles.input}
          placeholder="e.g. Engineering"
          value={formData.name}
          onChange={handleChange}
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          className={styles.textarea}
          placeholder="Brief description of the department..."
          value={formData.description}
          onChange={handleChange}
          rows={3}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="lead_user_id">
          Department Lead
        </label>
        <select
          id="lead_user_id"
          name="lead_user_id"
          className={styles.select}
          value={formData.lead_user_id}
          onChange={handleChange}
        >
          <option value="">-- Select a Lead --</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {getProfileDisplayName(user, 'User')} ({user.email})
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="status">
          Status
        </label>
        <select
          id="status"
          name="status"
          className={styles.select}
          value={formData.status}
          onChange={handleChange}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-150"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-deepblue rounded-lg hover:bg-brand-deepblue/90 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {initialData ? 'Update Department' : 'Create Department'}
        </button>
      </div>
    </form>
  );
}
