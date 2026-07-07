import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * This page is no longer used — password reset now uses the OTP flow
 * via /auth/forgot-password. This page redirects there.
 */
export default function ResetPasswordForm() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auth/forgot-password');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface dark:bg-dark-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted">Redirecting...</p>
      </div>
    </div>
  );
}
