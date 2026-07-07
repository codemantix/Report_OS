import Link from 'next/link';

export default function Custom404() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-extrabold text-brand-deepblue mb-4">404</h1>
        <h2 className="text-xl font-semibold text-surface-dark mb-2">Page Not Found</h2>
        <p className="text-brand-slate mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link href="/dashboard" className="btn-primary">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
