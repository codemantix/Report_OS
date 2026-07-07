import { Check, X } from 'lucide-react';
import styles from './Auth.module.css';

export function getPasswordChecks(password, confirmPassword = '') {
  return {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    match: Boolean(confirmPassword) && password === confirmPassword,
  };
}

export function isPasswordStrong(password) {
  const checks = getPasswordChecks(password);
  return checks.length && checks.lowercase && checks.uppercase && checks.number && checks.special;
}

export default function PasswordChecklist({ password, confirmPassword, showMatch = true }) {
  const checks = getPasswordChecks(password, confirmPassword);
  const requirements = [
    { key: 'length', label: 'At least 8 characters' },
    { key: 'lowercase', label: 'One lowercase letter' },
    { key: 'uppercase', label: 'One uppercase letter' },
    { key: 'number', label: 'One number' },
    { key: 'special', label: 'One special character' },
  ];

  if (showMatch) {
    requirements.push({ key: 'match', label: 'Passwords match' });
  }

  return (
    <div className={styles.passwordChecklist} aria-live="polite">
      <p className={styles.passwordChecklistTitle}>Password must include:</p>
      <ul className={styles.passwordChecklistList}>
        {requirements.map((item) => {
          const passed = checks[item.key];
          return (
            <li
              key={item.key}
              className={passed ? styles.passwordRequirementMet : styles.passwordRequirement}
            >
              {passed ? <Check className={styles.passwordRequirementIcon} /> : <X className={styles.passwordRequirementIcon} />}
              <span>{item.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
