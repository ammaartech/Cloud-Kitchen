/**
 * What an account action hands back to the control that called it.
 *
 * Its own module because `actions.ts` is a `'use server'` file, which may only
 * export async functions -- the shape and its starting value live here, where
 * the islands that read them can import them too.
 */
export type AccountActionState = {
  status: 'idle' | 'ok' | 'error';
  message: string;
  /** Changes on every response, so two identical messages still count as two. */
  at: number;
};

export type AccountAction = (
  previous: AccountActionState,
  formData: FormData,
) => Promise<AccountActionState>;

export const IDLE: AccountActionState = { status: 'idle', message: '', at: 0 };
