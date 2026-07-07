import { Eye, EyeOff } from 'lucide-react';
import styles from './Auth.module.css';

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  showPassword,
  onToggleVisibility,
  autoComplete,
  required = true,
  minLength,
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <div className={styles.passwordInputWrap}>
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          className={`${styles.input} ${styles.passwordInput}`}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
        />
        <button
          type="button"
          className={styles.passwordToggle}
          onClick={onToggleVisibility}
          aria-label={showPassword ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {showPassword ? <EyeOff className={styles.passwordToggleIcon} /> : <Eye className={styles.passwordToggleIcon} />}
        </button>
      </div>
    </div>
  );
}
