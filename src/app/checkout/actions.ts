'use server';

import { refresh } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { readDraft, saveDraft } from '@/lib/checkout/draft';
import { couponReason, normaliseCode } from '@/lib/checkout/coupons';
import { checkDelivery, storedMobile, type FieldErrors } from '@/lib/checkout/fields';
import { readable } from '@/lib/admin/feedback';
import { serverClient } from '@/lib/supabase/server';

/**
 * Checkout's two mutations that are not the payment itself.
 *
 * They return their outcome instead of redirecting with it in the query string
 * (the pattern the admin screens use). Checkout is one page the customer stays
 * on, and a refused PIN code has to come back as an error under the PIN field
 * with everything else still typed in -- not as a banner on a reloaded page.
 * `refresh()` then re-renders the page on the same round trip, so a saved
 * address or an applied code is on screen as soon as the answer is.
 *
 * Both are reachable by a direct POST, so neither trusts the form: the delivery
 * rules run again here, and RLS confines every write to the caller's own rows.
 */

export interface DeliveryState {
  status: 'idle' | 'invalid' | 'error' | 'saved';
  errors?: FieldErrors;
  message?: string;
  /** The new address, so the form's owner can select it. */
  addressId?: string;
}

export async function saveDelivery(
  _previous: DeliveryState,
  formData: FormData,
): Promise<DeliveryState> {
  const session = await getSession();
  if (!session) {
    return {
      status: 'error',
      message: 'You were signed out. Sign in again and your details will still be here.',
    };
  }

  const field = (name: string) => String(formData.get(name) ?? '').trim();
  const values = {
    fullName: field('fullName'),
    phone: field('phone'),
    line1: field('line1'),
    line2: field('line2'),
    landmark: field('landmark'),
    postalCode: field('postalCode').replace(/\s/g, ''),
    city: field('city'),
    state: field('state'),
    label: field('label') || 'Home',
    instructions: field('instructions'),
  };

  const errors = checkDelivery(values);
  if (Object.keys(errors).length > 0) {
    return { status: 'invalid', errors };
  }

  const db = await serverClient();
  const phone = storedMobile(values.phone);
  let customerId = session.customerId;

  // The customer record appears here, with the first address, rather than as a
  // step of its own: a name and a number are part of "where do we deliver",
  // and asking for them on a separate screen was asking twice.
  //
  // Through the RPC rather than a direct insert: `customers` has no insert
  // policy for the person the record is about, and should not have one -- see
  // migration 0107. The RPC decides `phone_verified` and the email itself.
  if (!customerId) {
    const { data, error } = await db.rpc('ensure_customer_record', {
      p_full_name: values.fullName,
      p_phone: phone,
      // Separate from the account, and recorded either way (PRD 14).
      p_marketing_consent: formData.get('marketingConsent') === 'on',
    });

    if (error) {
      // A number already on another account is something to change in the
      // field, not a failure to report at the top of the form.
      if (error.code === '23505') {
        return {
          status: 'invalid',
          errors: {
            phone:
              'That mobile number is already on another account. Sign in to it, or use a different number.',
          },
        };
      }
      return { status: 'error', message: readable(error) };
    }

    customerId = data as string;
  }

  // The first address becomes the default. A later one does not quietly take
  // that over: choosing it for this plan is not the same as changing where
  // everything else is sent, and the account page is where that is decided.
  const { count } = await db
    .from('customer_addresses')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('is_active', true);

  const { data: address, error } = await db
    .from('customer_addresses')
    .insert({
      customer_id: customerId,
      label: values.label,
      recipient_name: values.fullName,
      phone,
      line1: values.line1,
      line2: values.line2 || null,
      landmark: values.landmark || null,
      city: values.city,
      state: values.state,
      postal_code: values.postalCode,
      delivery_instructions: values.instructions || null,
      is_default: !count,
    })
    .select('id')
    .single();

  if (error) return { status: 'error', message: readable(error) };

  refresh();
  return { status: 'saved', addressId: address.id as string };
}

export interface CouponState {
  status: 'idle' | 'applied' | 'rejected' | 'removed';
  message?: string;
  code?: string;
}

/**
 * Applies or removes a code on the in-progress plan.
 *
 * ## Why the idempotency key changes with the code
 *
 * The draft's key is what makes a retried payment reuse the first attempt
 * rather than create a second subscription. But a replay returns the payment
 * exactly as it was first priced -- so a customer who opened the gateway,
 * closed it, then added a code would be sent back to pay the old amount. A
 * different code is a different order, and gets a key of its own. The attempt
 * it replaces was never paid, and stays in `pending_payment` like any other
 * abandoned one.
 */
export async function updateCoupon(
  _previous: CouponState,
  formData: FormData,
): Promise<CouponState> {
  const draft = await readDraft();
  if (!draft) {
    return {
      status: 'rejected',
      message: 'Your plan selection expired. Choose the plan again, then add the code.',
    };
  }

  if (formData.get('intent') === 'remove') {
    if (draft.couponCode) {
      await saveDraft({ ...draft, couponCode: null, idempotencyKey: crypto.randomUUID() });
    }
    refresh();
    return { status: 'removed', message: 'Code removed.' };
  }

  const code = normaliseCode(String(formData.get('code') ?? ''));
  if (!code) return { status: 'rejected', message: 'Enter a code first.' };
  if (code.length > 40) {
    return { status: 'rejected', code, message: 'That is longer than any code we issue.' };
  }

  const session = await getSession();

  // A code can only be checked against a customer: most offers are about who
  // is using them. Before the customer record exists it is kept, and the quote
  // checks it the moment there is someone to check it for.
  if (session?.customerId) {
    const db = await serverClient();
    const { data, error } = await db.rpc('quote_subscription', {
      p_plan_id: draft.planId,
      p_customer_id: session.customerId,
      p_coupon_code: code,
    });

    if (error) {
      return {
        status: 'rejected',
        code,
        message: 'We could not check that code just now. Try again in a moment.',
      };
    }

    const quote = data as { coupon_applied: boolean; coupon_message: string | null };
    if (!quote.coupon_applied) {
      return { status: 'rejected', code, message: couponReason(quote.coupon_message) };
    }
  }

  if (draft.couponCode !== code) {
    await saveDraft({ ...draft, couponCode: code, idempotencyKey: crypto.randomUUID() });
  }

  refresh();
  return {
    status: 'applied',
    code,
    message: session?.customerId
      ? `${code} applied.`
      : `${code} saved. We check it as soon as your delivery details are in.`,
  };
}
