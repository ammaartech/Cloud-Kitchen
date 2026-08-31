import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { requireAnyPermission, can } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { dateOnly } from '@/lib/format';
import { bool, str } from '@/lib/admin/form';
import { ActionFeedback, done, fail, readable } from '@/lib/admin/feedback';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  Input,
  SectionHeading,
  Textarea,
} from '@/components/ui/primitives';

export const metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

const PATH = '/admin/customers';

interface CustomerRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  phone_verified: boolean;
  marketing_consent: boolean;
  created_source: string;
  is_active: boolean;
  deleted_at: string | null;
  profile_id: string | null;
  created_at: string;
}

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  owner: 'Created by owner',
  marketplace: 'Marketplace',
  import: 'Imported',
};

/**
 * Customers (PRD 14).
 *
 * Customers normally arrive through a website order. The create form here
 * exists for the edge case the PRD calls out -- a phone order, a walk-in, a
 * record being migrated -- which is why `profile_id` is nullable in the schema:
 * such a customer has business records but no login until they make one.
 */
export default async function CustomersPage({ searchParams }: PageProps<'/admin/customers'>) {
  const session = await requireAnyPermission([
    PERMISSIONS.customersView,
    PERMISSIONS.customersManage,
  ]);
  const params = await searchParams;
  const supabase = await serverClient();

  // PostgREST parses commas and parentheses inside `or`, so anything that
  // could break out of the filter is stripped before it gets there.
  const query = String(params.q ?? '').replace(/[,()*%\\]/g, '').trim();

  let request = supabase
    .from('customers')
    .select(
      `id, full_name, email, phone, phone_verified, marketing_consent, created_source,
       is_active, deleted_at, profile_id, created_at`,
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (query) {
    request = request.or(
      `full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`,
    );
  }

  const [customersResult, subscriptionsResult] = await Promise.all([
    request,
    supabase.from('subscriptions').select('customer_id, status'),
  ]);

  const customers = (customersResult.data ?? []) as unknown as CustomerRow[];
  const subscriptions = (subscriptionsResult.data ?? []) as Array<{
    customer_id: string;
    status: string;
  }>;

  const liveSubs = new Map<string, number>();
  for (const subscription of subscriptions) {
    if (!['active', 'paused', 'past_due'].includes(subscription.status)) continue;
    liveSubs.set(subscription.customer_id, (liveSubs.get(subscription.customer_id) ?? 0) + 1);
  }

  const canManage = can(session, PERMISSIONS.customersManage);

  async function createCustomer(formData: FormData) {
    'use server';

    const fullName = str(formData, 'fullName');
    const phone = str(formData, 'phone');
    if (!fullName || !phone) fail(PATH, 'A customer needs a name and a mobile number.');

    const db = await serverClient();
    const { data, error } = await db
      .from('customers')
      .insert({
        full_name: fullName,
        phone,
        email: str(formData, 'email') || null,
        notes: str(formData, 'notes') || null,
        // Consent is recorded with its source and time, and stays independent
        // of whether the account is active (PRD 14).
        marketing_consent: bool(formData, 'marketingConsent'),
        marketing_consent_updated_at: new Date().toISOString(),
        marketing_consent_source: 'owner_created',
        created_source: 'owner',
      })
      .select('id')
      .single();

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    done(`${PATH}/${data!.id}`, 'Customer record created.');
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SectionHeading
        title="Customers"
        description="Records, contact details and consent. Deactivating an account stops the login without erasing the orders behind it."
      />

      <ActionFeedback error={params.error as string} ok={params.ok as string} />

      <form className="mb-6 flex flex-wrap items-end gap-3">
        <Field label="Search">
          <Input
            name="q"
            defaultValue={query}
            placeholder="Name, mobile or email"
            className="w-72"
          />
        </Field>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {query ? (
          <ButtonLink href={PATH} type="button" variant="ghost">Clear</ButtonLink>
        ) : null}
      </form>

      {canManage ? (
        <Card className="mb-8 p-5">
          <h2 className="font-semibold">Create a customer</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            For the edge cases — a phone order, a record moved over from before. They will have no
            login until they create one with this mobile number.
          </p>

          <form action={createCustomer} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Full name" required>
              <Input name="fullName" required />
            </Field>

            <Field label="Mobile" required>
              <Input name="phone" inputMode="tel" required />
            </Field>

            <Field label="Email">
              <Input name="email" type="email" />
            </Field>

            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="Notes">
                <Textarea name="notes" className="min-h-10" />
              </Field>
            </div>

            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" name="marketingConsent" className="h-4 w-4" />
              They agreed to marketing
            </label>

            <div className="flex items-end">
              <Button type="submit">Create customer</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {customers.length === 0 ? (
        <EmptyState
          title={query ? 'Nobody matches that search' : 'No customers yet'}
          description={
            query
              ? 'Try a partial mobile number or the first few letters of a name.'
              : 'Customers appear here as soon as someone buys a plan.'
          }
        />
      ) : (
        <Card className="divide-y divide-line">
          {customers.map((customer) => (
            <div key={customer.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/customers/${customer.id}`}
                    className="font-medium hover:underline"
                  >
                    {customer.full_name}
                  </Link>
                  {!customer.is_active || customer.deleted_at ? (
                    <Badge tone="danger">Deactivated</Badge>
                  ) : null}
                  {customer.created_source !== 'website' ? (
                    <Badge tone="neutral">
                      {SOURCE_LABELS[customer.created_source] ?? customer.created_source}
                    </Badge>
                  ) : null}
                  {!customer.profile_id ? <Badge tone="warning">No login</Badge> : null}
                  {customer.marketing_consent ? <Badge tone="accent">Marketing ok</Badge> : null}
                </div>

                <p className="mt-0.5 text-xs text-subtle">
                  {customer.phone}
                  {customer.phone_verified ? ' (verified)' : ''}
                  {customer.email ? ` · ${customer.email}` : ''} · since{' '}
                  {dateOnly(customer.created_at)}
                </p>
              </div>

              {(liveSubs.get(customer.id) ?? 0) > 0 ? (
                <Badge tone="success">{liveSubs.get(customer.id)} live plan(s)</Badge>
              ) : null}

              <ButtonLink href={`/admin/customers/${customer.id}`} variant="secondary" size="sm">Open</ButtonLink>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
