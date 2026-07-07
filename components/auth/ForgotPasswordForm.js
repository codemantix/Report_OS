import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, KeyRound, Lock, CheckCircle } from 'lucide-react';
import { sendOtp, verifyOtp } from '../../lib/authHelpers';
import BrandLogo from '../ui/BrandLogo';
import PasswordField from './PasswordField';
import PasswordChecklist, { isPasswordStrong } from './PasswordChecklist';
import authStyles from './Auth.module.css';
import styles from './ForgotPassword.module.css';

const STEP_EMAIL = 1;
const STEP_OTP = 2;
const STEP_PASSWORD = 3;
const STEP_DONE = 4;

export default function ForgotPasswordForm() {
  const [step, setStep] = useState(STEP_EMAIL);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef([]);

  // Focus first OTP input when step changes to OTP
  useEffect(() => {
    if (step === STEP_OTP && otpRefs.current[0]) {
      otpRefs.current[0].focus();
    }
  }, [step]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // ===== STEP 1: Send OTP =====
  async function handleSendOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: sendError } = await sendOtp(email);

    if (sendError) {
      setError(sendError.message);
      setLoading(false);
      return;
    }

    setStep(STEP_OTP);
    setCooldown(60);
    setLoading(false);
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError('');
    setLoading(true);

    const { error: sendError } = await sendOtp(email);

    if (sendError) {
      setError(sendError.message);
      setLoading(false);
      return;
    }

    setCooldown(60);
    setLoading(false);
  }

  // ===== STEP 2: Verify OTP =====
  function handleOtpChange(index, value) {
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index, e) {
    // Backspace: go to previous input
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    // Enter: submit if all filled
    if (e.key === 'Enter' && otp.every((d) => d !== '')) {
      handleVerifyOtp();
    }
  }

  function handleOtpPaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);
    // Focus the next empty input or the last one
    const nextIndex = Math.min(pasted.length, 5);
    otpRefs.current[nextIndex]?.focus();
  }

  async function handleVerifyOtp() {
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setError('');
    setLoading(true);

    const { error: verifyError } = await verifyOtp(email, code);

    if (verifyError) {
      setError(verifyError.message || 'Invalid or expired code. Please try again.');
      setLoading(false);
      return;
    }

    setStep(STEP_PASSWORD);
    setLoading(false);
  }

  // ===== STEP 3: New Password =====
  async function handleResetPassword(e) {
    e.preventDefault();
    setError('');

    if (!isPasswordStrong(password)) {
      setError('Please choose a stronger password that meets all requirements.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const { error: updateError } = await verifyOtp(email, otp.join(''), password);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setStep(STEP_DONE);
    setLoading(false);
  }

  function renderStepIndicator() {
    return (
      <div className={styles.steps}>
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`${styles.step} ${
              step > s ? styles.stepComplete : step === s ? styles.stepActive : ''
            }`}
          />
        ))}
      </div>
    );
  }

  // ===== STEP DONE =====
  if (step === STEP_DONE) {
    return (
      <div className={styles.page}>
        <div className={styles.wrapper}>
          <div className={styles.header}>
            <BrandLogo variant="auth" />
          </div>
          <div className={styles.card}>
            <CheckCircle className={styles.successIcon} />
            <h2 className={styles.title}>
              Password Reset Successful
            </h2>
            <p className={styles.description}>
              Your password has been updated. Sign in with your new password.
            </p>
            <Link href="/auth/login" className={styles.signInLink}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrapper}>
        <Link href="/auth/login" className={styles.backLink}>
          <ArrowLeft className="w-4 h-4" /> Back to Sign In
        </Link>

        <div className={styles.header}>
          <BrandLogo variant="auth" className="mb-4" />
          <p className={styles.subtitle}>
            {step === STEP_EMAIL && 'Enter your email to receive a reset code'}
            {step === STEP_OTP && 'Enter the 6-digit code sent to your email'}
            {step === STEP_PASSWORD && 'Choose your new password'}
          </p>
        </div>

        {renderStepIndicator()}

        <div className={styles.card}>
          {error && <div className={authStyles.alertError}>{error}</div>}

          {/* STEP 1: Email */}
          {step === STEP_EMAIL && (
            <form onSubmit={handleSendOtp} className={authStyles.form}>
              <div className={authStyles.field}>
                <label htmlFor="email" className={authStyles.label}>Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={authStyles.input}
                  placeholder="youremail@gmail.com"
                  required
                />
              </div>
              <button type="submit" disabled={loading || !email} className={authStyles.submitBtn}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Send OTP Code
                  </span>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: OTP */}
          {step === STEP_OTP && (
            <div className="space-y-6">
              <p className={styles.helperText}>
                We sent a 6-digit code to <strong className={styles.strongText}>{email}</strong>
              </p>

              <div className={styles.otpRow} onPaste={handleOtpPaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (otpRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className={`${styles.otpInput} ${digit ? styles.otpInputFilled : ''}`}
                    autoComplete="one-time-code"
                  />
                ))}
              </div>

              <div className={styles.resendRow}>
                <span>Didn&apos;t receive it?</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  className={styles.resendBtn}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                </button>
              </div>

              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={loading || otp.some((d) => d === '')}
                className={authStyles.submitBtn}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    Verify Code
                  </span>
                )}
              </button>
            </div>
          )}

          {/* STEP 3: New Password */}
          {step === STEP_PASSWORD && (
            <form onSubmit={handleResetPassword} className={authStyles.form}>
              <PasswordField
                id="password"
                label="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                showPassword={showPassword}
                onToggleVisibility={() => setShowPassword((visible) => !visible)}
                autoComplete="new-password"
                minLength={8}
              />
              <PasswordField
                id="confirm"
                label="Confirm Password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                showPassword={showConfirmPassword}
                onToggleVisibility={() => setShowConfirmPassword((visible) => !visible)}
                autoComplete="new-password"
                minLength={8}
              />
              <PasswordChecklist password={password} confirmPassword={confirm} />
              <button type="submit" disabled={loading || !isPasswordStrong(password) || password !== confirm} className={authStyles.submitBtn}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Updating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Reset Password
                  </span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
