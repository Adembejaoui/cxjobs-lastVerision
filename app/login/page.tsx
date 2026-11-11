import { Suspense } from 'react';
import LoginForm from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <main className="min-h-screen items-center justify-center flex bg-white">
      {/* LoginForm reads ?callbackUrl via useSearchParams, which requires a
          Suspense boundary for static rendering. */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
