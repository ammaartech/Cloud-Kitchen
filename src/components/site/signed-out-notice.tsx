'use client';

import { Alert } from '@/components/ui/primitives';
import { useAccount } from './account';

/**
 * Tells a visitor who has not signed in that they do not need to.
 *
 * Unlike the header, this waits for a definite answer before rendering
 * anything. The optimistic guess is wrong in the one direction that matters
 * here: showing the notice and then pulling it away is a block of text
 * appearing and vanishing under the reader, where the header's swap is two
 * buttons changing label in a place the eye is not resting.
 */
export function SignedOutNotice({ children }: { children: React.ReactNode }) {
  const { status, account } = useAccount();

  if (status !== 'ready' || account) return null;

  return (
    <div className="mt-8">
      <Alert tone="info" title="You do not need an account to browse">
        {children}
      </Alert>
    </div>
  );
}
