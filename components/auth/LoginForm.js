import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { signInWithEmail } from '../../lib/authHelpers';
import BrandLogo from '../ui/BrandLogo';
import PasswordField from './PasswordField';
import { Home } from 'lucide-react';
import styles from './Auth.module.css';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await signInWithEmail(email, password);

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
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
          <p className={styles.subtitle}>Sign in to your account</p>
        </div>

        <div className={styles.authPanel}>
          {error && (
            <div className={styles.alertError}>{error}</div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
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
              placeholder="Enter your password"
              showPassword={showPassword}
              onToggleVisibility={() => setShowPassword((visible) => !visible)}
              autoComplete="current-password"
            />

            <div className="flex items-center justify-end">
              <Link href="/auth/forgot-password" className={styles.inlineLink}>
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={styles.submitBtn}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className={styles.footer}>
            <Link href="/auth/register" className={styles.footerLink}>
              Don&apos;t have an account? Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
