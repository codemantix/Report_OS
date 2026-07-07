import styles from './EmptyState.module.css';

export default function EmptyState({ title, message, icon = '🔎' }) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>{icon}</div>
      {title && <h3 className={styles.emptyTitle}>{title}</h3>}
      <p className={styles.emptyText}>{message}</p>
    </div>
  );
}
