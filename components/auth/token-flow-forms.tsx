'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { extractOneTimeToken, stripOneTimeToken } from '@/lib/security/token-url';

const inputClass =
  'w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-900 focus:border-transparent bg-white';
const buttonClass = 'w-full h-12 bg-indigo-900 hover:bg-indigo-800 text-white font-semibold text-base rounded-lg';

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
      {subtitle && <p className="text-slate-600 mb-6">{subtitle}</p>}
      {children}
      <div className="text-center mt-6">
        <Link href="/login" className="text-sm text-indigo-900 hover:underline font-medium">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

function Notice({ kind, children }: { kind: 'ok' | 'error'; children: React.ReactNode }) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`rounded-lg px-4 py-3 text-sm mb-4 ${kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}
    >
      {children}
    </div>
  );
}

/**
 * One-time tokens arrive in the URL FRAGMENT (`#token=…`), which browsers
 * never send to the server, so they cannot appear in access logs, proxies or
 * Referer headers. See lib/security/token-url.ts.
 */
function readTokenFromLocation(): string {
  return extractOneTimeToken(window.location.href);
}

/** Remove the one-time token from the address bar and history (no setState). */
function useScrubTokenFromUrl() {
  useEffect(() => {
    const cleaned = stripOneTimeToken(window.location.href);
    if (cleaned !== null) window.history.replaceState(null, '', cleaned);
  }, []);
}

const noopSubscribe = () => () => {};
/** false during SSR/hydration, true on the client — without setState-in-effect. */
function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** Also used by the company invitation page (components/auth/company-invitation.tsx). */
export function ClientTokenGate({ render }: { render: (token: string) => React.ReactNode }) {
  const isClient = useIsClient();
  if (!isClient) {
    return <div className="w-full max-w-md px-6 py-10 text-slate-500">Loading…</div>;
  }
  return <TokenReader render={render} />;
}

function TokenReader({ render }: { render: (token: string) => React.ReactNode }) {
  // Lazy initialiser: read once per mount (pure — scrubbing happens in an effect).
  const [token] = useState(readTokenFromLocation);
  useScrubTokenFromUrl();
  return <>{render(token)}</>;
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        setError('Too many requests. Please wait a few minutes and try again.');
        setState('error');
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError('Please enter a valid email address.');
        setState('error');
        return;
      }
      setState('sent');
    } catch {
      setError('Something went wrong. Please try again.');
      setState('error');
    }
  };

  return (
    <Card title="Forgot your password?" subtitle="Enter your account email and we'll send you a reset link.">
      {state === 'sent' ? (
        <Notice kind="ok">
          If an account with that email exists, we&apos;ve sent a password reset link. It expires in 1 hour.
        </Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {state === 'error' && <Notice kind="error">{error}</Notice>}
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
          <Button type="submit" disabled={state === 'loading'} className={buttonClass}>
            {state === 'loading' ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </Card>
  );
}

export function ResetPasswordForm() {
  return <ClientTokenGate render={(token) => <ResetPasswordFormInner token={token} />} />;
}

function ResetPasswordFormInner({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  if (!token) {
    return (
      <Card title="Reset link invalid">
        <Notice kind="error">This reset link is missing or malformed.</Notice>
        <Link href="/forgot-password" className="text-sm text-indigo-900 hover:underline font-medium">
          Request a new link
        </Link>
      </Card>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      setState('error');
      return;
    }
    setState('loading');
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setState('done');
        return;
      }
      if (res.status === 429) setError('Too many attempts. Please wait a few minutes and try again.');
      else if (json.details?.password?.[0]) setError(json.details.password[0]);
      else setError('This reset link is invalid or has expired. Please request a new one.');
      setState('error');
    } catch {
      setError('Something went wrong. Please try again.');
      setState('error');
    }
  };

  return (
    <Card title="Choose a new password">
      {state === 'done' ? (
        <>
          <Notice kind="ok">Your password has been reset. All other sessions have been signed out.</Notice>
          <Link href="/login" className={`${buttonClass} inline-flex items-center justify-center`}>
            Sign in
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {state === 'error' && <Notice kind="error">{error}</Notice>}
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
          <Button type="submit" disabled={state === 'loading'} className={buttonClass}>
            {state === 'loading' ? 'Saving…' : 'Reset password'}
          </Button>
        </form>
      )}
    </Card>
  );
}

export function VerifyEmailPanel() {
  return <ClientTokenGate render={(token) => <VerifyEmailPanelInner token={token} />} />;
}

function VerifyEmailPanelInner({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendState, setResendState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');

  // Verification requires an explicit click: link scanners that prefetch
  // URLs from emails must not consume the token.
  const verify = async () => {
    setState('loading');
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setState('done');
        return;
      }
      setMessage(
        res.status === 429
          ? 'Too many attempts. Please wait a few minutes.'
          : json.code === 'TOKEN_EXPIRED'
            ? 'This verification link has expired. Request a new one below.'
            : 'This verification link is invalid or was already used.'
      );
      setState('error');
    } catch {
      setMessage('Something went wrong. Please try again.');
      setState('error');
    }
  };

  const resend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendState('loading');
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
      setResendState(res.ok ? 'sent' : 'error');
    } catch {
      setResendState('error');
    }
  };

  return (
    <Card title="Verify your email">
      {state === 'done' ? (
        <>
          <Notice kind="ok">Your email address is verified.</Notice>
          <Link href="/login" className={`${buttonClass} inline-flex items-center justify-center`}>
            Sign in
          </Link>
        </>
      ) : (
        <>
          {state === 'error' && <Notice kind="error">{message}</Notice>}
          {token ? (
            <Button onClick={verify} disabled={state === 'loading'} className={buttonClass}>
              {state === 'loading' ? 'Verifying…' : 'Confirm my email address'}
            </Button>
          ) : (
            <Notice kind="error">This verification link is missing or malformed.</Notice>
          )}
          <form onSubmit={resend} className="space-y-3 mt-8">
            <p className="text-sm text-slate-600">Need a new link?</p>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="name@company.com"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              className={inputClass}
            />
            <Button type="submit" disabled={resendState === 'loading'} variant="outline" className="w-full h-11 rounded-lg">
              {resendState === 'loading' ? 'Sending…' : 'Resend verification email'}
            </Button>
            {resendState === 'sent' && (
              <Notice kind="ok">If the email exists and is not yet verified, a new link has been sent.</Notice>
            )}
            {resendState === 'error' && <Notice kind="error">Could not send right now. Please try again later.</Notice>}
          </form>
        </>
      )}
    </Card>
  );
}
