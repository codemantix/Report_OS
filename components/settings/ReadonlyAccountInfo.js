import styles from './Settings.module.css';

function formatRole(role) {
  return role ? role.replace(/_/g, ' ') : 'Member';
}

function formatDate(value) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export default function ReadonlyAccountInfo({ profile }) {
  const departmentName = profile?.departments?.name || 'No department assigned';

  return (
    <div className={styles.accountCard}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Account Information</h2>
        <p className={styles.sectionDescription}>
          These details are managed by Codemantix admins and cannot be edited here.
        </p>
      </div>

      <div className={styles.infoList}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Email address</span>
          <span className={styles.infoValue}>{profile?.email || 'Unknown'}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>System role</span>
          <span className={`${styles.badge} ${styles.roleBadge}`}>{formatRole(profile?.role)}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Department</span>
          <span className={`${styles.badge} ${styles.departmentBadge}`}>{departmentName}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Account status</span>
          <span className={`${styles.badge} ${styles.statusBadge}`}>{profile?.status || 'active'}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Date joined</span>
          <span className={styles.infoValue}>{formatDate(profile?.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
