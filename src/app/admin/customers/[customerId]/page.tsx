import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAnyPermission, can } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import {
  dateOnly,
  dateTime,
  money,
  SUBSCRIPTION_STATUS_LABELS,
} from '@/lib/format';
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
  Alert,
  Badge,
  Button,
  Card,
  ConfirmButton,
  Field,
  Input,
  SectionHeading,
  Textarea,
} from '@/components/ui/primitives';


export async function generateMetadata({ params }: PageProps<'/admin/customers/[customerId]'>) {
  const { customerId } = await params;
  const supabase = await serverClient();
  const { data } = await supabase
    .from('customers')
    .select('full_name')
    .eq('id', customerId)
    .maybeSingle();

  return { title: data ? (data as { full_name: string }).full_name : 'Customer' };
}

interface Customer {
  id: string;
  profile_id: string | null;
  full_name: string;
  email: string | null;
  phone: string;
  phone_verified: boolean;
  marketing_consent: boolean;
  marketing_consent_updated_at: string | null;
  marketing_consent_source: string | null;
  created_source: string;
  notes: string | null;
  is_active: boolean;
  deleted_at: string | null;
  deletion_reason: string | null;
  created_at: string;
}

/**
 * One customer (PRD 14).
 *
 * Two rules from the PRD shape this screen and are worth stating outright:
 * deactivating an account disables the login while every order, invoice and
 * payment behind it stays intact; and marketing consent is tracked separately
 * from account status, so switching one never quietly switches the other.
 */
export default async function CustomerDetailPage({
  params,
  searchParams,
}: PageProps<'/admin/customers/[customerId]'>) {
  const session = await requireAnyPermission([
    PERMISSIONS.customersView,
    PERMISSIONS.customersManage,
  ]);

  const { customerId } = await params;
  const query = await searchParams;
  const path = `/admin/customers/${customerId}`;
  const supabase = await serverClient();

  const [
    customerResult,
    addressesResult,
    subscriptionsResult,
    ordersResult,
    invoicesResult,
    reviewsResult,
    refundsResult,
  ] = await Promise.all([
    supabase.from('customers').select('*').eq('id', customerId).maybeSingle(),
    supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_default', { ascending: false }),
    supabase
      .from('subscriptions')
      .select(
        'id, subscription_number, status, price_paid, starts_on, current_period_end, created_at, subscription_plans ( name )',
      )
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('id, order_number, source, status, grand_total, placed_at')
      .eq('customer_id', customerId)
      .order('placed_at', { ascending: false })
      .limit(10),
    supabase
      .from('invoices')
      .select('id, invoice_number, issued_at, total')
      .eq('customer_id', customerId)
      .order('issued_at', { ascending: false })
      .limit(10),
    supabase
      .from('reviews')
      .select('id, rating, title, status, created_at, products ( name )')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    supabase
      .from('refund_requests')
      .select('id, status, reason, requested_amount, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
  ]);

  const customer = customerResult.data as Customer | null;
  if (!customer) notFound();

  // Captured before the actions below close over it -- an Owner-created
  // customer has no login at all, and deactivation has to cope with that.
  const customerProfileId = customer.profile_id;

  const addresses = (addressesResult.data ?? []) as Array<{
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
  }>;

  const subscriptions = (subscriptionsResult.data ?? []) as unknown as Array<{
    id: string;
    subscription_number: string;
    status: string;
    price_paid: string;
    starts_on: string | null;
    current_period_end: string | null;
    subscription_plans: { name: string } | null;
  }>;

  const orders = (ordersResult.data ?? []) as Array<{
    id: string;
    order_number: number;
    source: string;
    status: string;
    grand_total: string;
    placed_at: string;
  }>;

  const invoices = (invoicesResult.data ?? []) as Array<{
    id: string;
    invoice_number: string;
    issued_at: string;
    total: string;
  }>;

  const reviews = (reviewsResult.data ?? []) as unknown as Array<{
    id: string;
    rating: number;
    title: string;
    status: string;
    created_at: string;
    products: { name: string } | null;
  }>;

  const refunds = (refundsResult.data ?? []) as Array<{
    id: string;
    status: string;
    reason: string;
    requested_amount: string | null;
    created_at: string;
  }>;

  const canManage = can(session, PERMISSIONS.customersManage);

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */

  async function saveCustomer(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db
      .from('customers')
      .update({
        full_name: str(formData, 'fullName'),
        phone: str(formData, 'phone'),
        email: str(formData, 'email') || null,
        notes: str(formData, 'notes') || null,
      })
      .eq('id', customerId);

    if (error) fail(path, readable(error));

    revalidatePath(path);
    done(path, 'Customer details saved.');
  }

  async function setConsent(formData: FormData) {
    'use server';

    const consent = bool(formData, 'marketingConsent');

    const db = await serverClient();
    const { error } = await db
      .from('customers')
      .update({
        marketing_consent: consent,
        marketing_consent_updated_at: new Date().toISOString(),
        marketing_consent_source: 'owner_admin',
      })
      .eq('id', customerId);

    if (error) fail(path, readable(error));

    revalidatePath(path);
    done(path, consent ? 'Marketing consent recorded.' : 'Marketing consent withdrawn.');
  }

  async function setAccountActive(formData: FormData) {
    'use server';

    const activate = str(formData, 'activate') === 'true';
    const reason = str(formData, 'reason');

    if (!activate && !reason) fail(path, 'Give a reason before deactivating an account.');

    const db = await serverClient();
    const { error } = await db
      .from('customers')
      .update({
        is_active: activate,
        // Never a hard delete: the orders, invoices and payments behind this
        // account remain legitimate business records (PRD 14).
        deleted_at: activate ? null : new Date().toISOString(),
        deletion_reason: activate ? null : reason,
      })
      .eq('id', customerId);

    if (error) fail(path, readable(error));

    // Disable the login too, where one exists. Marketing consent is
    // deliberately left alone -- it is not a function of account status.
    if (customerProfileId) {
      const { error: profileError } = await db
        .from('auth_profiles')
        .update({
          is_active: activate,
          disabled_at: activate ? null : new Date().toISOString(),
          disabled_reason: activate ? null : reason,
        })
        .eq('id', customerProfileId);

      if (profileError) fail(path, readable(profileError));
    }

    revalidatePath(path);
    revalidatePath('/admin/customers');
    done(path, activate ? 'Account reactivated.' : 'Account deactivated. History is preserved.');
  }

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

    if (!payload.recipient_name || !payload.line1 || !payload.city || !payload.postal_code) {
      fail(path, 'An address needs a recipient, a first line, a city and a postcode.');
    }

    const db = await serverClient();

    // Only one address may be the default (a partial unique index enforces it),
    // so the old one is stood down before the new one is raised.
    if (makeDefault) {
      await db
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('customer_id', customerId);
    }

    const { error } = addressId
      ? await db
          .from('customer_addresses')
          .update({ ...payload, is_default: makeDefault })
          .eq('id', addressId)
      : await db.from('customer_addresses').insert({ ...payload, is_default: makeDefault });

    if (error) fail(path, readable(error));

    revalidatePath(path);
    done(path, 'Address saved.');
  }

  async function removeAddress(formData: FormData) {
    'use server';

    const db = await serverClient();
    // Subscriptions reference an address with ON DELETE RESTRICT, so retiring
    // it is the only safe removal for an address that has been delivered to.
    const { error } = await db
      .from('customer_addresses')
      .update({ is_active: false, is_default: false })
      .eq('id', str(formData, 'addressId'));

    if (error) fail(path, readable(error));

    revalidatePath(path);
    done(path, 'Address retired.');
  }

  const activeAddresses = addresses.filter((address) => address.is_active);
  const retiredAddresses = addresses.filter((address) => !address.is_active);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/admin/customers" className="text-sm text-muted hover:text-ink">
        ← All customers
      </Link>

      <div className="mt-3">
        <SectionHeading
          title={customer.full_name}
          description={
            <>
              {customer.phone}
              {customer.phone_verified ? ' (verified)' : ''}
              {customer.email ? ` · ${customer.email}` : ''} · customer since{' '}
              {dateOnly(customer.created_at)}
            </>
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              {customer.is_active ? (
                <Badge tone="success">Active</Badge>
              ) : (
                <Badge tone="danger">Deactivated</Badge>
              )}
              {!customer.profile_id ? <Badge tone="warning">No login</Badge> : null}
              {customer.marketing_consent ? <Badge tone="accent">Marketing ok</Badge> : null}
            </div>
          }
        />
      </div>

      <ActionFeedback error={query.error as string} ok={query.ok as string} />

      {!customer.is_active ? (
        <div className="mb-6">
          <Alert tone="warning" title="This account is deactivated">
            {customer.deletion_reason ?? 'No reason recorded.'} Their history below is intact and
            deliberately kept.
          </Alert>
        </div>
      ) : null}

      <div className="space-y-8">
        {/* -------------------------------------------------------------- */}
        {/* Details                                                         */}
        {/* -------------------------------------------------------------- */}
        {canManage ? (
          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
              Details
            </h2>

            <Card className="p-5">
              <form action={saveCustomer} className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required>
                  <Input name="fullName" defaultValue={customer.full_name} required />
                </Field>

                <Field label="Mobile" required>
                  <Input name="phone" defaultValue={customer.phone} inputMode="tel" required />
                </Field>

                <Field label="Email">
                  <Input name="email" type="email" defaultValue={customer.email ?? ''} />
                </Field>

                <Field label="Notes" hint="Internal — never shown to the customer.">
                  <Input name="notes" defaultValue={customer.notes ?? ''} />
                </Field>

                <div className="sm:col-span-2">
                  <Button type="submit">Save details</Button>
                </div>
              </form>

              <div className="mt-6 flex flex-wrap items-end gap-6 border-t border-line pt-5">
                <form action={setConsent} className="flex items-end gap-3">
                  <input
                    type="hidden"
                    name="marketingConsent"
                    value={customer.marketing_consent ? 'false' : 'true'}
                  />
                  <div>
                    <p className="text-sm font-medium">Marketing consent</p>
                    <p className="text-xs text-subtle">
                      {customer.marketing_consent ? 'Given' : 'Not given'}
                      {customer.marketing_consent_updated_at
                        ? ` · ${dateTime(customer.marketing_consent_updated_at)}`
                        : ''}
                      {customer.marketing_consent_source
                        ? ` · via ${customer.marketing_consent_source}`
                        : ''}
                    </p>
                  </div>
                  <Button type="submit" size="sm" variant="secondary">
                    {customer.marketing_consent ? 'Withdraw' : 'Record consent'}
                  </Button>
                </form>

                <form action={setAccountActive} className="ml-auto flex items-end gap-2">
                  <input
                    type="hidden"
                    name="activate"
                    value={customer.is_active ? 'false' : 'true'}
                  />
                  {customer.is_active ? (
                    <Field label="Reason for deactivating" required>
                      <Input name="reason" className="w-64" required />
                    </Field>
                  ) : (
                    <input type="hidden" name="reason" value="" />
                  )}
                  <Button
                    type="submit"
                    size="md"
                    variant={customer.is_active ? 'danger' : 'success'}
                  >
                    {customer.is_active ? 'Deactivate account' : 'Reactivate account'}
                  </Button>
                </form>
              </div>
            </Card>
          </section>
        ) : null}

        {/* -------------------------------------------------------------- */}
        {/* Addresses                                                       */}
        {/* -------------------------------------------------------------- */}
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
            Addresses
          </h2>

          <div className="space-y-3">
            {activeAddresses.length === 0 ? (
              <Card className="p-4 text-sm text-muted">No address on file.</Card>
            ) : (
              activeAddresses.map((address) => (
                <Card key={address.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{address.label}</span>
                    {address.is_default ? <Badge tone="neutral">Default</Badge> : null}
                    <span className="text-xs text-subtle">
                      {address.recipient_name} · {address.phone}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-muted">
                    {[address.line1, address.line2, address.landmark].filter(Boolean).join(', ')},{' '}
                    {address.city}, {address.state} {address.postal_code}
                  </p>

                  {address.delivery_instructions ? (
                    <p className="mt-1 text-xs text-subtle">
                      Instructions: {address.delivery_instructions}
                    </p>
                  ) : null}

                  {canManage ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-muted hover:text-ink">
                        Edit
                      </summary>

                      <form
                        action={saveAddress}
                        className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-3"
                      >
                        <input type="hidden" name="addressId" value={address.id} />

                        <Field label="Label">
                          <Input name="label" defaultValue={address.label} />
                        </Field>
                        <Field label="Recipient" required>
                          <Input name="recipientName" defaultValue={address.recipient_name} required />
                        </Field>
                        <Field label="Phone" required>
                          <Input name="phone" defaultValue={address.phone} required />
                        </Field>
                        <Field label="Address line 1" required>
                          <Input name="line1" defaultValue={address.line1} required />
                        </Field>
                        <Field label="Address line 2">
                          <Input name="line2" defaultValue={address.line2 ?? ''} />
                        </Field>
                        <Field label="Landmark">
                          <Input name="landmark" defaultValue={address.landmark ?? ''} />
                        </Field>
                        <Field label="City" required>
                          <Input name="city" defaultValue={address.city} required />
                        </Field>
                        <Field label="State" required>
                          <Input name="state" defaultValue={address.state} required />
                        </Field>
                        <Field label="Postcode" required>
                          <Input name="postalCode" defaultValue={address.postal_code} required />
                        </Field>

                        <div className="sm:col-span-3">
                          <Field label="Delivery instructions">
                            <Input
                              name="deliveryInstructions"
                              defaultValue={address.delivery_instructions ?? ''}
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

                        <div className="flex items-end gap-2 sm:col-span-2">
                          <Button type="submit" size="sm" variant="secondary">
                            Save address
                          </Button>
                        </div>
                      </form>

                      <form action={removeAddress} className="mt-2">
                        <input type="hidden" name="addressId" value={address.id} />
                        <ConfirmButton confirmLabel="Really retire?">Retire this address</ConfirmButton>
                      </form>
                    </details>
                  ) : null}
                </Card>
              ))
            )}

            {canManage ? (
              <Card className="p-5">
                <details>
                  <summary className="cursor-pointer font-medium">Add an address</summary>

                  <form action={saveAddress} className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Field label="Label">
                      <Input name="label" defaultValue="Home" />
                    </Field>
                    <Field label="Recipient" required>
                      <Input name="recipientName" defaultValue={customer.full_name} required />
                    </Field>
                    <Field label="Phone" required>
                      <Input name="phone" defaultValue={customer.phone} required />
                    </Field>
                    <Field label="Address line 1" required>
                      <Input name="line1" required />
                    </Field>
                    <Field label="Address line 2">
                      <Input name="line2" />
                    </Field>
                    <Field label="Landmark">
                      <Input name="landmark" />
                    </Field>
                    <Field label="City" required>
                      <Input name="city" required />
                    </Field>
                    <Field label="State" required>
                      <Input name="state" required />
                    </Field>
                    <Field label="Postcode" required>
                      <Input name="postalCode" required />
                    </Field>

                    <div className="sm:col-span-3">
                      <Field label="Delivery instructions">
                        <Textarea name="deliveryInstructions" className="min-h-10" />
                      </Field>
                    </div>

                    <label className="flex items-center gap-2 self-end text-sm">
                      <input type="checkbox" name="isDefault" className="h-4 w-4" defaultChecked />
                      Default address
                    </label>

                    <div className="flex items-end">
                      <Button type="submit" size="sm">
                        Add address
                      </Button>
                    </div>
                  </form>
                </details>
              </Card>
            ) : null}

            {retiredAddresses.length > 0 ? (
              <p className="text-xs text-subtle">
                {retiredAddresses.length} retired address(es) are kept so past deliveries still
                resolve.
              </p>
            ) : null}
          </div>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* History                                                         */}
        {/* -------------------------------------------------------------- */}
        <section className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
              Subscriptions
            </h2>
            {subscriptions.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <Card className="divide-y divide-line">
                {subscriptions.map((subscription) => (
                  <div key={subscription.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                    <span className="font-medium">
                      {subscription.subscription_plans?.name ?? 'Plan'}
                    </span>
                    <Badge
                      tone={
                        subscription.status === 'active'
                          ? 'success'
                          : subscription.status === 'cancelled'
                            ? 'neutral'
                            : 'warning'
                      }
                    >
                      {SUBSCRIPTION_STATUS_LABELS[subscription.status] ?? subscription.status}
                    </Badge>
                    <span className="ml-auto tabular">{money(subscription.price_paid)}</span>
                    <span className="w-full font-mono text-xs text-subtle">
                      {subscription.subscription_number}
                      {subscription.current_period_end
                        ? ` · ends ${dateOnly(subscription.current_period_end)}`
                        : ''}
                    </span>
                  </div>
                ))}
              </Card>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
              Recent orders
            </h2>
            {orders.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <Card className="divide-y divide-line">
                {orders.map((order) => (
                  <div key={order.id} className="flex items-center gap-3 p-3 text-sm">
                    <span className="font-mono text-xs">#{order.order_number}</span>
                    <Badge tone="neutral">{order.source}</Badge>
                    <span className="text-muted">{order.status}</span>
                    <span className="ml-auto tabular">{money(order.grand_total)}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
              Invoices
            </h2>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <Card className="divide-y divide-line">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center gap-3 p-3 text-sm">
                    <span className="font-mono text-xs">{invoice.invoice_number}</span>
                    <span className="text-muted">{dateOnly(invoice.issued_at)}</span>
                    <span className="ml-auto tabular">{money(invoice.total)}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
              Reviews and refund requests
            </h2>

            {reviews.length === 0 && refunds.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <Card className="divide-y divide-line">
                {reviews.map((review) => (
                  <div key={review.id} className="flex items-center gap-3 p-3 text-sm">
                    <span>{'★'.repeat(review.rating)}</span>
                    <span className="min-w-0 truncate text-muted">
                      {review.products?.name ?? 'General'}
                    </span>
                    <Badge tone={review.status === 'published' ? 'success' : 'neutral'}>
                      {review.status}
                    </Badge>
                  </div>
                ))}

                {refunds.map((refund) => (
                  <div key={refund.id} className="flex items-center gap-3 p-3 text-sm">
                    <Badge tone="info">Refund</Badge>
                    <span className="min-w-0 truncate text-muted">{refund.reason}</span>
                    <span className="ml-auto text-xs text-subtle">{refund.status}</span>
                  </div>
                ))}
              </Card>
            )}

            <Link href="/admin/refunds" className="mt-2 inline-block text-sm text-muted hover:text-ink">
              Handle refund requests →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
