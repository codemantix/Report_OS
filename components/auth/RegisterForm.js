import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { signUpWithEmail } from '../../lib/authHelpers';
import BrandLogo from '../ui/BrandLogo';
import PasswordField from './PasswordField';
import PasswordChecklist, { isPasswordStrong } from './PasswordChecklist';
import { Home } from 'lucide-react';
import styles from './Auth.module.css';

export default function RegisterForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!isPasswordStrong(password)) {
      setError('Please choose a stronger password that meets all requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const { error: signUpError } = await signUpWithEmail(email, password, {
      full_name: fullName,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setSuccess('Registration successful! You can now sign in with your email and password.');
    setLoading(false);
  }

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.homeBtn}>
        <Home className="w-4 h-4" />
        <span>Home</span>
      </Link>
      <div className={styles.card}>
        <div className={styles.header}>
          <BrandLogo variant="authCompact" />
          <p className={styles.subtitle}>Create your account</p>
        </div>

        <div className={styles.authPanel}>
          {error && (
            <div className={styles.alertError}>{error}</div>
          )}

          {success && (
            <div className={styles.alertSuccess}>{success}</div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="fullName" className={styles.label}>Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={styles.input}
                  placeholder="Your Full Name"
                  required
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="email" className={styles.label}>Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  placeholder="youremail@gmail.com"
                  required
                />
              </div>

              <PasswordField
                id="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                showPassword={showPassword}
                onToggleVisibility={() => setShowPassword((visible) => !visible)}
                autoComplete="new-password"
                minLength={8}
              />

              <PasswordField
                id="confirmPassword"
                label="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                showPassword={showConfirmPassword}
                onToggleVisibility={() => setShowConfirmPassword((visible) => !visible)}
                autoComplete="new-password"
                minLength={8}
              />

              <PasswordChecklist password={password} confirmPassword={confirmPassword} />

              <button
                type="submit"
                disabled={loading || !isPasswordStrong(password) || password !== confirmPassword}
                className={styles.submitBtn}
              >
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          )}

          <div className={styles.footer}>
            <Link href="/auth/login" className={styles.footerLink}>
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
