import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { requireAnyPermission, requirePermission, can } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { rowsOf } from '@/lib/supabase/query';
import { dateOnly } from '@/lib/format';
import { bool, str } from '@/lib/admin/form';
import { ActionFeedback, done, fail, flashFrom, readable } from '@/lib/admin/feedback';

import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  FieldAction,
  Input,
  SectionHeading,
  Textarea,
} from '@/components/ui/primitives';

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

export const metadata = { title: 'Customers' };

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

/** Subscription states that still hold a customer to a plan. */
const LIVE_STATUSES = ['active', 'paused', 'past_due'] as const;

/** Longest search anyone types; anything past it is not a name or a number. */
const MAX_QUERY_LENGTH = 80;

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
  const params = await searchParams;
  const supabase = await serverClient();

  // PostgREST parses commas and parentheses inside `or`, so anything that
  // could break out of the filter is stripped before it gets there.
  const query = String(Array.isArray(params.q) ? params.q[0] : (params.q ?? ''))
    .replace(/[,()*%\\]/g, '')
    .trim()
    .slice(0, MAX_QUERY_LENGTH);

  // Live plans ride along as an embedded count filtered at the database, so
  // the page reads the hundred customers it shows and nothing else -- rather
  // than every subscription row ever created, which the API would eventually
  // cap and silently miscount.
  let request = supabase
    .from('customers')
    .select(
      `id, full_name, email, phone, phone_verified, marketing_consent, created_source,
       is_active, deleted_at, profile_id, created_at, subscriptions ( count )`,
    )
    .in('subscriptions.status', [...LIVE_STATUSES])
    .order('created_at', { ascending: false })
    .limit(100);

  if (query) {
    request = request.or(
      `full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`,
    );
  }

  // The guard and the reads go out together. Every read is already filtered
  // by RLS as this user, and a refused guard still redirects before render.
  const [session, customersResult] = await Promise.all([
    requireAnyPermission([PERMISSIONS.customersView, PERMISSIONS.customersManage]),
    request,
  ]);

  const customers = rowsOf<CustomerRow & { subscriptions: Array<{ count: number }> }>(
    customersResult,
    'customers',
  );

  const liveSubs = new Map<string, number>();
  for (const customer of customers) {
    liveSubs.set(customer.id, customer.subscriptions[0]?.count ?? 0);
  }

  const canManage = can(session, PERMISSIONS.customersManage);

  async function createCustomer(formData: FormData) {
    'use server';

    await requirePermission(PERMISSIONS.customersManage);

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

      <ActionFeedback {...flashFrom(params)} />

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
            For the edge cases: a phone order, a record moved over from before. They will have no
            login until they create one with this mobile number.
          </p>

          <form action={createCustomer} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Full name" required>
              <Input name="fullName" required placeholder="Meera Iyer" />
            </Field>

            <Field label="Mobile" required>
              <Input name="phone" inputMode="tel" required placeholder="+91 98100 00000" />
            </Field>

            <Field label="Email">
              <Input name="email" type="email" placeholder="meera@example.com" />
            </Field>

            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="Notes">
                <Textarea
              name="notes"
              className="min-h-10"
              placeholder="Allergic to peanuts. Prefers the 7pm window."
            />
              </Field>
            </div>

            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" name="marketingConsent" className="h-4 w-4" />
              They agreed to marketing
            </label>

            <FieldAction>
              <Button type="submit">Create customer</Button>
            </FieldAction>
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
