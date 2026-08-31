import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { requireAnyPermission, can } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { dateTime, money } from '@/lib/format';
import { str } from '@/lib/admin/form';
import { ActionFeedback, done, fail, readable } from '@/lib/admin/feedback';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  SectionHeading,
  Select,
  cx,
} from '@/components/ui/primitives';

export const metadata = { title: 'Refunds' };
export const dynamic = 'force-dynamic';

const PATH = '/admin/refunds';

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under review' },
  { value: 'approved', label: 'Approved' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'all', label: 'Everything' },
] as const;

const STATUS_TONES: Record<string, 'success' | 'warning' | 'neutral' | 'danger' | 'info'> = {
  open: 'warning',
  under_review: 'info',
  approved: 'success',
  completed: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};

/** Statuses that end the case, and therefore stamp `resolved_at`. */
const TERMINAL = new Set(['approved', 'rejected', 'completed', 'withdrawn']);

interface RequestRow {
  id: string;
  reason: string;
  requested_amount: string | null;
  status: string;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  customers: { id: string; full_name: string; phone: string } | null;
  subscriptions: { subscription_number: string; price_paid: string } | null;
  orders: { order_number: number; grand_total: string } | null;
  payments: { provider: string; status: string; amount: string } | null;
}

/**
 * Refund requests (PRD 7, PRD 22).
 *
 * The refund *policy* is still pending owner sign-off, so this is deliberately
 * a case workflow rather than a refund button: recording a decision here moves
 * no money and touches no payment. When the policy is settled, an approved
 * case is what a real refund would be raised against.
 */
export default async function RefundsPage({ searchParams }: PageProps<'/admin/refunds'>) {
  const session = await requireAnyPermission([
    PERMISSIONS.paymentsView,
    PERMISSIONS.paymentsManage,
  ]);
  const params = await searchParams;
  const supabase = await serverClient();

  const filter = FILTERS.some((option) => option.value === params.status)
    ? String(params.status)
    : 'open';

  let request = supabase
    .from('refund_requests')
    .select(
      `id, reason, requested_amount, status, resolution_note, resolved_at, created_at,
       customers ( id, full_name, phone ),
       subscriptions ( subscription_number, price_paid ),
       orders ( order_number, grand_total ),
       payments ( provider, status, amount )`,
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (filter !== 'all') request = request.eq('status', filter);

  const [requestsResult, countsResult] = await Promise.all([
    request,
    supabase.from('refund_requests').select('status'),
  ]);

  const requests = (requestsResult.data ?? []) as unknown as RequestRow[];
  const counts = new Map<string, number>();
  for (const row of (countsResult.data ?? []) as Array<{ status: string }>) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  const canManage = can(session, PERMISSIONS.paymentsManage);
  const actorId = session.id;

  async function resolveRequest(formData: FormData) {
    'use server';

    const status = str(formData, 'status');
    const note = str(formData, 'resolutionNote');

    if (status !== 'under_review' && !note) {
      fail(`${PATH}?status=${filter}`, 'Record why before closing a refund case.');
    }

    const db = await serverClient();
    const { error } = await db
      .from('refund_requests')
      .update({
        status,
        resolution_note: note || null,
        handled_by: actorId,
        resolved_at: TERMINAL.has(status) ? new Date().toISOString() : null,
      })
      .eq('id', str(formData, 'requestId'));

    if (error) fail(`${PATH}?status=${filter}`, readable(error));

    revalidatePath(PATH);
    done(`${PATH}?status=${filter}`, 'Refund case updated.');
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <SectionHeading
        title="Refund requests"
        description="Customer refund cases, from request to decision."
      />

      <ActionFeedback error={params.error as string} ok={params.ok as string} />

      <div className="mb-6">
        <Alert tone="info" title="This is a case workflow, not a refund button">
          Refund and cancellation policy is still an open item (PRD 22). Recording a decision here
          moves no money — it documents what was agreed so a real refund can be raised against it
          once the policy is signed off.
        </Alert>
      </div>

      <nav className="mb-6 flex flex-wrap gap-1" aria-label="Filter refund requests">
        {FILTERS.map((option) => {
          const count =
            option.value === 'all'
              ? [...counts.values()].reduce((sum, value) => sum + value, 0)
              : (counts.get(option.value) ?? 0);

          return (
            <Link
              key={option.value}
              href={`${PATH}?status=${option.value}`}
              aria-current={filter === option.value ? 'page' : undefined}
              className={cx(
                'rounded-ck border px-3 py-1.5 text-sm font-medium',
                filter === option.value
                  ? 'border-transparent bg-brand-soft text-brand'
                  : 'border-line text-muted hover:bg-sunken hover:text-ink',
              )}
            >
              {option.label}
              <span className="ml-1.5 text-xs text-subtle tabular">{count}</span>
            </Link>
          );
        })}
      </nav>

      {requests.length === 0 ? (
        <EmptyState
          title={filter === 'open' ? 'No open cases' : 'Nothing here'}
          description="Customers raise these from their account page."
        />
      ) : (
        <div className="space-y-3">
          {requests.map((row) => (
            <Card key={row.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONES[row.status] ?? 'neutral'}>
                      {row.status.replace('_', ' ')}
                    </Badge>
                    {row.customers ? (
                      <Link
                        href={`/admin/customers/${row.customers.id}`}
                        className="font-medium hover:underline"
                      >
                        {row.customers.full_name}
                      </Link>
                    ) : (
                      <span className="font-medium">Unknown customer</span>
                    )}
                    {row.requested_amount ? (
                      <span className="tabular text-muted">
                        asking {money(row.requested_amount)}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-sm whitespace-pre-line">{row.reason}</p>

                  <p className="mt-2 text-xs text-subtle">
                    Raised {dateTime(row.created_at)}
                    {row.subscriptions
                      ? ` · subscription ${row.subscriptions.subscription_number} (${money(
                          row.subscriptions.price_paid,
                        )})`
                      : ''}
                    {row.orders ? ` · order #${row.orders.order_number}` : ''}
                    {row.payments
                      ? ` · ${row.payments.provider} payment ${row.payments.status}, ${money(
                          row.payments.amount,
                        )}`
                      : ''}
                  </p>

                  {row.resolution_note ? (
                    <p className="mt-2 rounded-ck bg-sunken px-3 py-2 text-sm text-muted">
                      <span className="font-medium text-ink">Decision:</span> {row.resolution_note}
                      {row.resolved_at ? ` · ${dateTime(row.resolved_at)}` : ''}
                    </p>
                  ) : null}
                </div>
              </div>

              {canManage ? (
                <form
                  action={resolveRequest}
                  className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4"
                >
                  <input type="hidden" name="requestId" value={row.id} />

                  <label className="text-xs">
                    <span className="mb-1 block text-subtle">Decision</span>
                    <Select name="status" defaultValue={row.status} className="w-44">
                      <option value="under_review">Under review</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="completed">Completed</option>
                      <option value="withdrawn">Withdrawn</option>
                    </Select>
                  </label>

                  <label className="min-w-0 flex-1 text-xs">
                    <span className="mb-1 block text-subtle">
                      Note — required for anything but “under review”
                    </span>
                    <Input name="resolutionNote" defaultValue={row.resolution_note ?? ''} />
                  </label>

                  <Button type="submit" size="md" variant="secondary">
                    Record decision
                  </Button>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
