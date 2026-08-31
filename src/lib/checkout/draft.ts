import { cookies } from 'next/headers';
import { z } from 'zod';

/**
 * The in-progress subscription choice, held between the configure page and
 * checkout.
 *
 * It lives in a cookie rather than the database because the customer may not
 * have an account yet -- account creation happens late in checkout (PRD 6).
 *
 * Nothing here is trusted. The price is recomputed by `quote_subscription`,
 * the plan/window pairing and meal selections are re-validated by
 * `begin_subscription_checkout`, and the address is checked to belong to the
 * signed-in customer. A tampered cookie can at worst select a different plan
 * the customer could have chosen anyway.
 */

export const DRAFT_COOKIE = 'ck_draft';

export const draftSchema = z.object({
  /**
   * Generated once, when the configuration is saved, and reused for every
   * retry. This is what makes a double-submit, a browser crash mid-payment or
   * a refresh of the checkout page produce one subscription rather than
   * several (PRD 7, PRD 11).
   */
  idempotencyKey: z.string().min(16).max(64),
  planId: z.string().uuid(),
  planSlug: z.string(),
  deliveryWindowId: z.string().uuid(),
  /** Postgres dow ordering: 0 = Sunday. Empty means every day. */
  deliveryDays: z.array(z.number().int().min(0).max(6)).max(7),
  selectedMeals: z
    .array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(5) }))
    .max(20),
  couponCode: z.string().max(40).nullable(),
  deliveryInstructions: z.string().max(500).nullable(),
});

export type CheckoutDraft = z.infer<typeof draftSchema>;

export async function saveDraft(draft: CheckoutDraft): Promise<void> {
  const store = await cookies();
  store.set(DRAFT_COOKIE, JSON.stringify(draft), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 2,
  });
}

export async function readDraft(): Promise<CheckoutDraft | null> {
  const store = await cookies();
  const raw = store.get(DRAFT_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  const store = await cookies();
  store.delete(DRAFT_COOKIE);
}
