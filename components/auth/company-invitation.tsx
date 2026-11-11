'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SignupForm from '@/components/auth/signup-form';
import { ClientTokenGate } from '@/components/auth/token-flow-forms';

/**
 * Company invitation onboarding (H3).
 *
 * The invitation token arrives in the URL fragment (`#token=…`), which the
 * browser never sends to the server. ClientTokenGate reads it once and scrubs
 * it from the address bar/history (a legacy `?token=` link is accepted and
 * scrubbed too). The token is then sent ONLY in POST bodies: here to validate
 * it, and later by SignupForm to register (which consumes it atomically).
 */

type Invitation = { companyName: string; managerName: string | null; managerEmail: string | null };
type State =
  | { kind: 'loading' }
  | { kind: 'ready'; invitation: Invitation }
  | { kind: 'error'; title: string; message: string };

export default function CompanyInvitation() {
  return <ClientTokenGate render={(token) => <InvitationLoader token={token} />} />;
}

function InvitationLoader({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    // No token at all: nothing to validate (same destination as before).
    if (!token) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    fetch('/api/auth/invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && json.success) {
          setState({ kind: 'ready', invitation: json.data as Invitation });
        } else if (res.status === 429) {
          setState({ kind: 'error', title: 'Please wait', message: 'Too many attempts. Please try again in a minute.' });
        } else {
          setState({
            kind: 'error',
            title: 'Invitation Unavailable',
            message: typeof json.error === 'string' ? json.error : 'This invitation link is invalid.',
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ kind: 'error', title: 'Invitation Unavailable', message: 'Could not check the invitation. Please try again.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (!token || state.kind === 'loading') {
    return (
      <div className="min-h-screen bg-[#F8F9FB] py-12 px-4">
        <div className="max-w-md mx-auto text-center text-[#6B7280]">Checking your invitation…</div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="min-h-screen bg-[#F8F9FB] py-12 px-4">
        <div className="max-w-md mx-auto">
          <div role="alert" className="bg-white rounded-[16px] shadow-sm border border-[#E5E7EB] p-8 text-center">
            <h1 className="text-2xl font-bold text-[#111827] mb-2">{state.title}</h1>
            <p className="text-[#6B7280]">{state.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const { invitation } = state;
  return (
    <div className="min-h-screen bg-[#F8F9FB] py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-[16px] shadow-sm border border-[#E5E7EB] p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#111827] mb-2">Create your company account</h1>
            <p className="text-[#6B7280]">
              You&apos;ve been invited to create a company account for{' '}
              <span className="font-semibold text-[#111827]">{invitation.companyName}</span>.
            </p>
          </div>
          <SignupForm
            defaultFullName={invitation.managerName ?? ''}
            defaultEmail={invitation.managerEmail ?? ''}
            invitationToken={token}
            isInvitationMode={true}
          />
        </div>
      </div>
    </div>
  );
}
