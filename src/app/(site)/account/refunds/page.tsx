import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth/session';
import { serverClient } from '@/lib/supabase/server';
import { dateTime, money, SUBSCRIPTION_STATUS_LABELS } from '@/lib/format';
import { nullableNum, str } from '@/lib/admin/form';
import { ActionFeedback, done, fail, readable } from '@/lib/admin/feedback';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  SectionHeading,
  Select,
  Textarea,
} from '@/components/ui/primitives';

export const metadata = { title: 'Refund requests' };
export const dynamic = 'force-dynamic';

const PATH = '/account/refunds';

const STATUS_TONES: Record<string, 'success' | 'warning' | 'neutral' | 'danger' | 'info'> = {
  open: 'warning',
  under_review: 'info',
  approved: 'success',
  completed: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};

const STATUS_NOTE: Record<string, string> = {
  open: 'Received. Someone will look at it.',
  under_review: 'Being looked at now.',
  approved: 'Approved — the refund will follow.',
  completed: 'Settled.',
  rejected: 'Not approved.',
  withdrawn: 'You took this one back.',
};

/** A case can only be taken back before it has been decided. */
const WITHDRAWABLE = new Set(['open', 'under_review']);

interface RequestRow {
  id: string;
  reason: string;
  requested_amount: string | null;
  status: string;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  subscriptions: { subscription_number: string } | null;
}

/**
 * Refund requests (PRD 7, PRD 22).
 *
 * Refund policy is still being finalised, so this raises a case rather than
 * promising an outcome -- and the page says so plainly instead of implying a
 * guarantee the business has not agreed to yet.
 */
export default async function AccountRefundsPage({ searchParams }: PageProps<'/account/refunds'>) {
  const session = await requireSession();
  const params = await searchParams;
  const supabase = await serverClient();

  if (!session.customerId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          title="Nothing to refund yet"
          description="Refund requests relate to a subscription you have paid for."
          action={
            <Link href="/subscriptions">
              <Button>Browse plans</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const customerId = session.customerId;

  const [requestsResult, subscriptionsResult] = await Promise.all([
    supabase
      .from('refund_requests')
      .select(
        'id, reason, requested_amount, status, resolution_note, resolved_at, created_at, subscriptions ( subscription_number )',
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('subscriptions')
      .select('id, subscription_number, status, price_paid, subscription_plans ( name )')
      .order('created_at', { ascending: false }),
  ]);

  const requests = (requestsResult.data ?? []) as unknown as RequestRow[];
  const subscriptions = (subscriptionsResult.data ?? []) as unknown as Array<{
    id: string;
    subscription_number: string;
    status: string;
    price_paid: string;
    subscription_plans: { name: string } | null;
  }>;

  const openCase = requests.find((row) => WITHDRAWABLE.has(row.status));

  async function raiseRequest(formData: FormData) {
    'use server';

    const reason = str(formData, 'reason');
    if (reason.length < 10) {
      fail(PATH, 'Tell us a bit more about what went wrong — a sentence or two is plenty.');
    }

    const db = await serverClient();
    const { error } = await db.from('refund_requests').insert({
      customer_id: customerId,
      subscription_id: str(formData, 'subscriptionId') || null,
      reason,
      requested_amount: nullableNum(formData, 'requestedAmount'),
    });

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    done(PATH, 'Request raised. You will hear back about it.');
  }

  async function withdrawRequest(formData: FormData) {
    'use server';

    const db = await serverClient();
    // Goes through an RPC that re-proves ownership and refuses a case that has
    // already been decided.
    const { error } = await db.rpc('withdraw_refund_request', {
      p_request_id: str(formData, 'requestId'),
    });

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    done(PATH, 'Request withdrawn.');
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <SectionHeading
        title="Refund requests"
        description="Something wrong with an order or a plan? Raise it here and it gets looked at."
      />

      <ActionFeedback error={params.error as string} ok={params.ok as string} />

      <div className="mb-6">
        <Alert tone="info">
          Raising a request opens a case — it does not cancel your plan or issue a refund by
          itself. Refund terms are still being finalised, so we will come back to you with what we
          can do.
        </Alert>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Raise                                                               */}
      {/* ------------------------------------------------------------------ */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Raise a request</h2>

        {openCase ? (
          <Alert tone="warning">
            You already have a request open. Add to it by getting in touch rather than raising a
            second one.
          </Alert>
        ) : null}

        <form action={raiseRequest} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Which subscription?">
            <Select name="subscriptionId" defaultValue="">
              <option value="">Not about a specific plan</option>
              {subscriptions.map((subscription) => (
                <option key={subscription.id} value={subscription.id}>
                  {subscription.subscription_plans?.name ?? 'Plan'} ·{' '}
                  {subscription.subscription_number} (
                  {SUBSCRIPTION_STATUS_LABELS[subscription.status] ?? subscription.status})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Amount you are asking for" hint="Leave blank if you are not sure.">
            <Input name="requestedAmount" inputMode="decimal" placeholder="—" />
          </Field>

          <div className="sm:col-span-2">
            <Field label="What happened?" required>
              <Textarea
                name="reason"
                required
                minLength={10}
                placeholder="Tell us what went wrong and when."
              />
            </Field>
          </div>

          <div>
            <Button type="submit">Raise request</Button>
          </div>
        </form>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* History                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Your requests</h2>

        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-muted">You have not raised any.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {requests.map((request) => (
              <Card key={request.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONES[request.status] ?? 'neutral'}>
                    {request.status.replace('_', ' ')}
                  </Badge>
                  {request.requested_amount ? (
                    <span className="tabular text-sm text-muted">
                      {money(request.requested_amount)}
                    </span>
                  ) : null}
                  <span className="text-xs text-subtle">
                    {dateTime(request.created_at)}
                    {request.subscriptions
                      ? ` · ${request.subscriptions.subscription_number}`
                      : ''}
                  </span>
                </div>

                <p className="mt-2 text-sm whitespace-pre-line">{request.reason}</p>

                <p className="mt-2 text-xs text-subtle">
                  {STATUS_NOTE[request.status] ?? request.status}
                </p>

                {request.resolution_note ? (
                  <p className="mt-2 rounded-ck bg-sunken px-3 py-2 text-sm text-muted">
                    <span className="font-medium text-ink">Our reply:</span>{' '}
                    {request.resolution_note}
                    {request.resolved_at ? ` · ${dateTime(request.resolved_at)}` : ''}
                  </p>
                ) : null}

                {WITHDRAWABLE.has(request.status) ? (
                  <form action={withdrawRequest} className="mt-3">
                    <input type="hidden" name="requestId" value={request.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Withdraw this request
                    </Button>
                  </form>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
