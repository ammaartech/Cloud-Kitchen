import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { readDraft } from '@/lib/checkout/draft';
import { beginCheckout, ensureCustomer } from '@/lib/checkout/service';
import { configuredPaymentProviders } from '@/lib/env';

const bodySchema = z.object({
  addressId: z.string().uuid(),
  provider: z.enum(['razorpay', 'cashfree', 'sandbox']),
  fullName: z.string().min(1).max(120),
  phone: z.string().min(6).max(20),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });
  }

  const draft = await readDraft();
  if (!draft) {
    return NextResponse.json(
      { error: 'Your plan selection expired. Please choose a plan again.' },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'That request was not valid' }, { status: 400 });
  }

  // A provider without credentials is never offered, and is refused here too --
  // the client is not the authority on what is available.
  if (!configuredPaymentProviders().includes(parsed.data.provider)) {
    return NextResponse.json(
      { error: 'That payment method is not available' },
      { status: 400 },
    );
  }

  try {
    const customerId = await ensureCustomer(session, {
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
    });

    const result = await beginCheckout({
      customerId,
      draft,
      addressId: parsed.data.addressId,
      provider: parsed.data.provider,
      customer: {
        name: parsed.data.fullName,
        email: session.email,
        phone: parsed.data.phone,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout could not be started';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
