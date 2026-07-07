import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import ThemeToggle from '../../../components/settings/ThemeToggle';
import ProfileSettingsForm from '../../../components/settings/ProfileSettingsForm';
import ProfileAvatarUploader from '../../../components/settings/ProfileAvatarUploader';
import ReadonlyAccountInfo from '../../../components/settings/ReadonlyAccountInfo';
import { useTheme } from '../../../context/ThemeContext';
import { getCurrentUser } from '../../../lib/authHelpers';
import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
  uploadUserAvatar,
  removeUserAvatar,
} from '../../../services/userService';
import styles from '../../../components/settings/Settings.module.css';

export default function SettingsPage() {
  const { theme, resolvedTheme } = useTheme();
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pageError, setPageError] = useState('');

  const themeLabels = {
    light: 'Light Mode',
    dark: 'Dark Mode',
    system: 'Use System Setting',
  };

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      setPageError('');

      const currentUser = await getCurrentUser();
      if (!currentUser) {
        setPageError('You must be signed in to view settings.');
        setLoading(false);
        return;
      }

      setAuthUser(currentUser);
      const { data, error } = await getCurrentUserProfile(currentUser.id);

      if (error) {
        setPageError(error.message || 'Failed to load your profile.');
        setLoading(false);
        return;
      }

      setProfile(data);
      setLoading(false);
    }

    loadSettings();
  }, []);

  async function handleProfileSave(payload) {
    if (!authUser?.id) return { error: new Error('No authenticated user found.') };

    setSaving(true);
    const { data, error } = await updateCurrentUserProfile(authUser.id, payload);
    setSaving(false);

    if (error) {
      toast.error(error.message || 'Failed to update profile');
      return { error };
    }

    setProfile(data);
    window.dispatchEvent(new CustomEvent('codemantix-profile-updated', { detail: { profile: data } }));
    toast.success('Profile updated');
    return { data };
  }

  async function handleAvatarUpload(file, validationError) {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!file || !authUser?.id) return;

    setAvatarUploading(true);
    const uploadResult = await uploadUserAvatar(authUser.id, file);

    if (uploadResult.error) {
      setAvatarUploading(false);
      toast.error(uploadResult.error.message || 'Avatar upload failed');
      return;
    }

    const updateResult = await updateCurrentUserProfile(authUser.id, {
      avatar_url: uploadResult.data.url,
    });
    setAvatarUploading(false);

    if (updateResult.error) {
      toast.error(updateResult.error.message || 'Failed to save avatar');
      return;
    }

    setProfile(updateResult.data);
    window.dispatchEvent(new CustomEvent('codemantix-profile-updated', { detail: { profile: updateResult.data } }));
    toast.success('Avatar updated');
  }

  async function handleAvatarRemove() {
    if (!authUser?.id) return;

    setAvatarUploading(true);
    const { data, error } = await removeUserAvatar(authUser.id);
    setAvatarUploading(false);

    if (error) {
      toast.error(error.message || 'Failed to remove avatar');
      return;
    }

    setProfile(data);
    window.dispatchEvent(new CustomEvent('codemantix-profile-updated', { detail: { profile: data } }));
    toast.success('Avatar removed');
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>Manage your profile, account details, and preferences.</p>
        </div>

        {loading ? (
          <div className={styles.loadingShell}>
            <div className={styles.spinner} />
          </div>
        ) : pageError ? (
          <div className={styles.section}>
            <div className={styles.alertError}>{pageError}</div>
          </div>
        ) : (
          <>
            <div className={styles.profileGrid}>
              <div className={styles.leftColumn}>
                <ProfileAvatarUploader
                  profile={profile}
                  avatarUrl={profile?.avatar_url}
                  uploading={avatarUploading}
                  onUpload={handleAvatarUpload}
                  onRemove={handleAvatarRemove}
                />
                <ReadonlyAccountInfo profile={profile} />
              </div>

              <div className={styles.rightColumn}>
                <ProfileSettingsForm
                  profile={profile}
                  saving={saving}
                  onSave={handleProfileSave}
                />
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Appearance</h2>
                <p className={styles.sectionDescription}>
                  Choose how Codemantix Reporting looks on this device.
                </p>
              </div>

              <ThemeToggle />
              <p className={styles.themeStatus}>
                Currently using:{' '}
                <span className={styles.themeStatusStrong}>{themeLabels[theme] || theme}</span>
                {theme === 'system' && (
                  <span>
                    {' '}· Resolved:{' '}
                    <span className={styles.themeStatusStrong}>{resolvedTheme}</span>
                  </span>
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
