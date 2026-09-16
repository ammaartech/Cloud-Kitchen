'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { FlowProgress } from './flow-progress';

/**
 * The one piece of checkout state that crosses from the page into its shell:
 * whether the payment has been confirmed.
 *
 * The verdict arrives in the payment step, in the browser, and deliberately
 * never becomes a server render (a confirmed payment clears the draft, and a
 * re-render without a draft is the empty checkout). The header's progress still
 * has to move to "Confirmed" when it lands, so the layout wraps everything in
 * this and the payment step reports up.
 */

interface CheckoutStageValue {
  confirmed: boolean;
  setConfirmed: (confirmed: boolean) => void;
}

const CheckoutStageContext = createContext<CheckoutStageValue>({
  confirmed: false,
  setConfirmed: () => {},
});

export function CheckoutStage({ children }: { children: ReactNode }) {
  const [confirmed, setConfirmed] = useState(false);
  const value = useMemo(() => ({ confirmed, setConfirmed }), [confirmed]);

  return <CheckoutStageContext value={value}>{children}</CheckoutStageContext>;
}

export function useCheckoutStage(): CheckoutStageValue {
  return useContext(CheckoutStageContext);
}

export function CheckoutProgress({ className }: { className?: string }) {
  const { confirmed } = useCheckoutStage();
  return <FlowProgress current={confirmed ? 3 : 2} className={className} />;
}
