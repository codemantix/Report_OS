import { useEffect, useMemo, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { validateProfilePayload, hasValidationErrors } from '../../utils/validationHelpers';
import styles from './Settings.module.css';

function normalizeProfile(profile = {}) {
  return {
    full_name: profile.full_name || '',
    display_name: profile.display_name || '',
    phone_number: profile.phone_number || '',
    job_title: profile.job_title || '',
    bio: profile.bio || '',
  };
}

export default function ProfileSettingsForm({ profile, saving, onSave }) {
  const initialValues = useMemo(() => normalizeProfile(profile), [profile]);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues);
  const bioCount = values.bio.length;

  function updateField(key, value) {
    setSuccess('');
    setError('');
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function resetForm() {
    setValues(initialValues);
    setErrors({});
    setSuccess('');
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSuccess('');
    setError('');

    const nextErrors = validateProfilePayload(values);
    setErrors(nextErrors);

    if (hasValidationErrors(nextErrors)) return;

    const result = await onSave({
      full_name: values.full_name.trim(),
      display_name: values.display_name.trim(),
      phone_number: values.phone_number.trim(),
      job_title: values.job_title.trim(),
      bio: values.bio.trim(),
    });

    if (result?.error) {
      setError(result.error.message || 'Failed to update profile.');
      return;
    }

    setSuccess('Profile updated successfully.');
  }

  return (
    <form className={styles.section} onSubmit={handleSubmit}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Profile Information</h2>
        <p className={styles.sectionDescription}>
          Update your personal details and how your profile appears inside Codemantix.
        </p>
      </div>

      {success && <div className={styles.alertSuccess}>{success}</div>}
      {error && <div className={styles.alertError}>{error}</div>}

      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="full_name">Full name</label>
          <input
            id="full_name"
            className={styles.input}
            value={values.full_name}
            onChange={(e) => updateField('full_name', e.target.value)}
            placeholder="Your full name"
          />
          {errors.full_name && <p className={styles.errorText}>{errors.full_name}</p>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="display_name">Display name</label>
          <input
            id="display_name"
            className={styles.input}
            value={values.display_name}
            onChange={(e) => updateField('display_name', e.target.value)}
            placeholder="How teammates should see your name"
            maxLength={50}
          />
          {errors.display_name && <p className={styles.errorText}>{errors.display_name}</p>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="phone_number">Phone number</label>
          <input
            id="phone_number"
            className={styles.input}
            value={values.phone_number}
            onChange={(e) => updateField('phone_number', e.target.value)}
            placeholder="+1 555 000 0000"
          />
          {errors.phone_number && <p className={styles.errorText}>{errors.phone_number}</p>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="job_title">Job title</label>
          <input
            id="job_title"
            className={styles.input}
            value={values.job_title}
            onChange={(e) => updateField('job_title', e.target.value)}
            placeholder="Frontend Developer, Designer, Project Manager…"
            maxLength={80}
          />
          {errors.job_title && <p className={styles.errorText}>{errors.job_title}</p>}
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="bio">Bio</label>
          <textarea
            id="bio"
            className={styles.textarea}
            value={values.bio}
            onChange={(e) => updateField('bio', e.target.value)}
            placeholder="Write a short profile summary…"
            maxLength={300}
          />
          <p className={styles.sectionDescription}>{bioCount}/300 characters</p>
          {errors.bio && <p className={styles.errorText}>{errors.bio}</p>}
        </div>
      </div>

      <div className={styles.formActions}>
        <button type="button" className={styles.secondaryBtn} onClick={resetForm} disabled={saving || !isDirty}>
          <RotateCcw size={16} />
          Cancel changes
        </button>
        <button type="submit" className={styles.primaryBtn} disabled={saving || !isDirty}>
          <Save size={16} />
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
