import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth/session';
import { serverClient } from '@/lib/supabase/server';
import { bool, str } from '@/lib/admin/form';
import { ActionFeedback, done, fail, readable } from '@/lib/admin/feedback';

/**
 * These screens are per-user by definition -- a session decides not just what
 * they show but whether you may see them at all -- so there is no static shell
 * to prerender and no point pretending otherwise. `instant = false` says that
 * plainly: this segment is allowed to block.
 *
 * It is a statement about *this* route, not a global escape hatch. The public
 * storefront next door is held to the opposite standard.
 */
export const instant = false;
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  Input,
  SectionHeading,
  Textarea,
} from '@/components/ui/primitives';

export const metadata = { title: 'Your addresses' };

const PATH = '/account/addresses';

interface Address {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postal_code: string;
  delivery_instructions: string | null;
  is_default: boolean;
  is_active: boolean;
}

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
export default async function AddressesPage({ searchParams }: PageProps<'/account/addresses'>) {
  const session = await requireSession();
  const params = await searchParams;
  const supabase = await serverClient();

  if (!session.customerId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          title="No customer record yet"
          description="Addresses appear here once you have placed your first order."
          action={
            <ButtonLink href="/subscriptions">Browse plans</ButtonLink>
          }
        />
      </div>
    );
  }

  const customerId = session.customerId;

  const [addressesResult, subscriptionsResult] = await Promise.all([
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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <SectionHeading
        title="Your addresses"
        description="Where we deliver. Set a default and your next plan will use it automatically."
      />

      <ActionFeedback error={params.error as string} ok={params.ok as string} />

      {active.length === 0 ? (
        <EmptyState
          title="No addresses saved"
          description="Add one below and it will be ready at checkout."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {active.map((address) => (
            <Card key={address.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{address.label}</p>
                {address.is_default ? <Badge tone="brand">Default</Badge> : null}
                {inUse.has(address.id) ? <Badge tone="success">In use by a plan</Badge> : null}
              </div>

              <p className="mt-1 text-sm text-muted">
                {address.recipient_name} · {address.phone}
              </p>
              <p className="mt-1 text-sm text-muted">
                {[address.line1, address.line2, address.landmark].filter(Boolean).join(', ')},{' '}
                {address.city}, {address.state} {address.postal_code}
              </p>

              {address.delivery_instructions ? (
                <p className="mt-2 rounded-ck bg-sunken px-3 py-2 text-xs text-muted">
                  {address.delivery_instructions}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!address.is_default ? (
                  <form action={makeDefaultAddress}>
                    <input type="hidden" name="addressId" value={address.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Make default
                    </Button>
                  </form>
                ) : null}

                {!inUse.has(address.id) ? (
                  <form action={retireAddress} className="ml-auto">
                    <input type="hidden" name="addressId" value={address.id} />
                    <ConfirmButton confirmLabel="Really remove?">Remove</ConfirmButton>
                  </form>
                ) : (
                  <span className="ml-auto text-xs text-subtle">
                    Used by a live plan — change the plan first
                  </span>
                )}
              </div>

              <details className="mt-3 border-t border-line pt-3">
                <summary className="cursor-pointer text-sm text-muted hover:text-ink">
                  Edit this address
                </summary>

                <form action={saveAddress} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="addressId" value={address.id} />

                  <Field label="Label">
                    <Input name="label" defaultValue={address.label} />
                  </Field>
                  <Field label="Recipient" required>
                    <Input name="recipientName" defaultValue={address.recipient_name} required />
                  </Field>
                  <Field label="Phone" required>
                    <Input name="phone" defaultValue={address.phone} inputMode="tel" required />
                  </Field>
                  <Field label="Landmark">
                    <Input name="landmark" defaultValue={address.landmark ?? ''} />
                  </Field>

                  <div className="sm:col-span-2">
                    <Field label="Address line 1" required>
                      <Input name="line1" defaultValue={address.line1} required />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Address line 2">
                      <Input name="line2" defaultValue={address.line2 ?? ''} />
                    </Field>
                  </div>

                  <Field label="City" required>
                    <Input name="city" defaultValue={address.city} required />
                  </Field>
                  <Field label="State" required>
                    <Input name="state" defaultValue={address.state} required />
                  </Field>
                  <Field label="Postcode" required>
                    <Input name="postalCode" defaultValue={address.postal_code} required />
                  </Field>

                  <div className="sm:col-span-2">
                    <Field label="Delivery instructions" hint="Gate code, which bell, where to leave it.">
                      <Textarea
                        name="deliveryInstructions"
                        defaultValue={address.delivery_instructions ?? ''}
                        className="min-h-16"
                      />
                    </Field>
                  </div>

                  <label className="flex items-center gap-2 self-end text-sm">
                    <input
                      type="checkbox"
                      name="isDefault"
                      defaultChecked={address.is_default}
                      className="h-4 w-4"
                    />
                    Default address
                  </label>

                  <div className="flex items-end">
                    <Button type="submit" size="sm" variant="secondary">
                      Save changes
                    </Button>
                  </div>
                </form>
              </details>
            </Card>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Add                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Card className="mt-8 p-5">
        <h2 className="mb-4 font-semibold">Add an address</h2>

        <form action={saveAddress} className="grid gap-4 sm:grid-cols-3">
          <Field label="Label" hint="Home, Office, Mum’s…">
            <Input name="label" defaultValue="Home" />
          </Field>

          <Field label="Recipient" required>
            <Input name="recipientName" defaultValue={session.fullName} required />
          </Field>

          <Field label="Phone" required>
            <Input name="phone" defaultValue={session.phone ?? ''} inputMode="tel" required />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Address line 1" required>
              <Input name="line1" placeholder="Flat, building, street" required />
            </Field>
          </div>

          <Field label="Landmark">
            <Input name="landmark" />
          </Field>

          <div className="sm:col-span-3">
            <Field label="Address line 2">
              <Input name="line2" placeholder="Area, locality" />
            </Field>
          </div>

          <Field label="City" required>
            <Input name="city" required />
          </Field>
          <Field label="State" required>
            <Input name="state" required />
          </Field>
          <Field label="Postcode" required>
            <Input name="postalCode" inputMode="numeric" required />
          </Field>

          <div className="sm:col-span-3">
            <Field
              label="Delivery instructions"
              hint="Anything the rider needs to know. This reaches the kitchen too."
            >
              <Textarea name="deliveryInstructions" className="min-h-16" />
            </Field>
          </div>

          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              name="isDefault"
              className="h-4 w-4"
              defaultChecked={active.length === 0}
            />
            Make this my default
          </label>

          <div className="flex items-end">
            <Button type="submit">Save address</Button>
          </div>
        </form>
      </Card>

      {retired.length > 0 ? (
        <p className="mt-4 text-xs text-subtle">
          {retired.length} removed address(es) are kept out of sight so past deliveries still read
          correctly.
        </p>
      ) : null}
    </div>
  );
}
