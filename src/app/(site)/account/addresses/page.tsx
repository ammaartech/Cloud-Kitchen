import { Suspense } from 'react';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth/session';
import { serverClient } from '@/lib/supabase/server';
import { bool, str } from '@/lib/admin/form';
import { done, fail, readable } from '@/lib/admin/feedback';
import { AccountHead } from '@/components/account/account-shell';
import { AddressesSkeleton } from '@/components/account/account-skeletons';
import { AddressesNoCustomer, AddressesView, type Address } from '@/components/account/addresses-view';

export const metadata = { title: 'Your addresses' };

const PATH = '/account/addresses';

/**
 * Saved addresses (PRD 6).
 *
 * Customers keep several and pick one per subscription. Removing an address
 * retires it rather than deleting it: subscriptions and past deliveries point
 * at these rows, and a delivered order has to stay readable.
 *
 * Every query and write here runs under the customer's own token, so RLS is
 * what confines them to their own addresses -- not a filter in this file.
 */
export default function AddressesPage({ searchParams }: PageProps<'/account/addresses'>) {
  // The heading is static and paints the moment the tab is pressed; the
  // customer's own rows stream in underneath it.
  return (
    <div className="acct-page mx-auto max-w-5xl px-4">
      <AccountHead eyebrow="Delivery" title="Your addresses">
        Where we deliver. Set a default and your next plan will use it automatically.
      </AccountHead>
      <div className="acct-body">
        <Suspense fallback={<AddressesSkeleton />}>
          <Addresses searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Addresses({ searchParams }: Pick<PageProps<'/account/addresses'>, 'searchParams'>) {
  const supabase = await serverClient();

  // The guard and the reads go out together. Both reads are already confined
  // to this customer by RLS, and a refused guard still redirects before render.
  const [session, params, addressesResult, subscriptionsResult] = await Promise.all([
    requireSession(),
    searchParams,
    supabase
      .from('customer_addresses')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at'),
    supabase
      .from('subscriptions')
      .select('delivery_address_id, status')
      .in('status', ['active', 'paused', 'past_due']),
  ]);

  if (!session.customerId) {
    return <AddressesNoCustomer />;
  }

  const customerId = session.customerId;

  const addresses = (addressesResult.data ?? []) as unknown as Address[];
  const inUse = new Set(
    ((subscriptionsResult.data ?? []) as Array<{ delivery_address_id: string | null }>)
      .map((row) => row.delivery_address_id)
      .filter(Boolean) as string[],
  );

  const active = addresses.filter((address) => address.is_active);
  const retired = addresses.filter((address) => !address.is_active);

  async function saveAddress(formData: FormData) {
    'use server';

    const addressId = str(formData, 'addressId');
    const makeDefault = bool(formData, 'isDefault');

    const payload = {
      customer_id: customerId,
      label: str(formData, 'label') || 'Home',
      recipient_name: str(formData, 'recipientName'),
      phone: str(formData, 'phone'),
      line1: str(formData, 'line1'),
      line2: str(formData, 'line2') || null,
      landmark: str(formData, 'landmark') || null,
      city: str(formData, 'city'),
      state: str(formData, 'state'),
      postal_code: str(formData, 'postalCode'),
      delivery_instructions: str(formData, 'deliveryInstructions') || null,
    };

    if (!payload.recipient_name || !payload.phone) {
      fail(PATH, 'We need a name and a number for the rider to call.');
    }
    if (!payload.line1 || !payload.city || !payload.postal_code) {
      fail(PATH, 'An address needs a first line, a city and a postcode.');
    }

    const db = await serverClient();

    // Exactly one address may be the default -- a partial unique index enforces
    // it -- so the incumbent stands down first.
    if (makeDefault) {
      await db.from('customer_addresses').update({ is_default: false }).eq('customer_id', customerId);
    }

    const { error } = addressId
      ? await db
          .from('customer_addresses')
          .update({ ...payload, is_default: makeDefault })
          .eq('id', addressId)
      : await db.from('customer_addresses').insert({ ...payload, is_default: makeDefault });

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidatePath('/account');
    done(PATH, 'Address saved.');
  }

  async function makeDefaultAddress(formData: FormData) {
    'use server';

    const db = await serverClient();
    await db.from('customer_addresses').update({ is_default: false }).eq('customer_id', customerId);

    const { error } = await db
      .from('customer_addresses')
      .update({ is_default: true })
      .eq('id', str(formData, 'addressId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidatePath('/account');
  }

  async function retireAddress(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db
      .from('customer_addresses')
      .update({ is_active: false, is_default: false })
      .eq('id', str(formData, 'addressId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidatePath('/account');
    done(PATH, 'Address removed. Past deliveries to it are unaffected.');
  }

  return (
    <AddressesView
      active={active}
      retiredCount={retired.length}
      inUse={[...inUse]}
      recipient={{ name: session.fullName, phone: session.phone }}
      feedback={{ error: params.error as string | undefined, ok: params.ok as string | undefined }}
      actions={{ save: saveAddress, makeDefault: makeDefaultAddress, retire: retireAddress }}
    />
  );
}
