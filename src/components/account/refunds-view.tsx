import { RememberShape } from './account-shape';
import { Enter } from './account-shell';
import { ActionFeedback } from '@/lib/admin/feedback';
import { dateTime, money, SUBSCRIPTION_STATUS_LABELS } from '@/lib/format';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui/primitives';

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
  approved: 'Approved. The refund will follow.',
  completed: 'Settled.',
  rejected: 'Not approved.',
  withdrawn: 'You took this one back.',
};

/** A case can only be taken back before it has been decided. */
export const WITHDRAWABLE = new Set(['open', 'under_review']);

export interface RequestRow {
  id: string;
  reason: string;
  requested_amount: string | null;
  status: string;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  subscriptions: { subscription_number: string } | null;
}

export interface SubscriptionOption {
  id: string;
  subscription_number: string;
  status: string;
  price_paid: string;
  subscription_plans: { name: string } | null;
}

type FormAction = (formData: FormData) => void | Promise<void>;

/**
 * The refunds page over plain rows; the page owns the reads and the Server
 * Actions. Split out so `RefundsSkeleton` can be checked against it.
 */
export function RefundsView({
  requests,
  subscriptions,
  feedback,
  actions,
}: {
  requests: RequestRow[];
  subscriptions: SubscriptionOption[];
  feedback: { error?: string; ok?: string };
  actions: { raise: FormAction; withdraw: FormAction };
}) {
  const openCase = requests.find((row) => WITHDRAWABLE.has(row.status));

  return (
    <>
      <RememberShape
        page="refunds"
        shape={{
          customer: true,
          cards: requests.length,
          openCase: Boolean(openCase),
        }}
        measure={{
          card: '[data-shape-card]',
          cardTexts: {
            status: '[data-text="status"]',
            amount: '[data-text="amount"]',
            when: '[data-text="when"]',
            reason: '[data-text="reason"]',
            note: '[data-text="note"]',
            reply: '[data-text="reply"]',
            withdraw: '[data-text="withdraw"]',
          },
        }}
      />
      <ActionFeedback error={feedback.error} ok={feedback.ok} />

      <Enter index={1} className="mb-6">
        <Alert tone="info">
          Raising a request opens a case. It does not cancel your plan or issue a refund by
          itself. Refund terms are still being finalised, so we will come back to you with what we
          can do.
        </Alert>
      </Enter>

      {/* ------------------------------------------------------------------ */}
      {/* Raise                                                               */}
      {/* ------------------------------------------------------------------ */}
      <Enter index={2}>
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Raise a request</h2>

        {openCase ? (
          <Alert tone="warning">
            You already have a request open. Add to it by getting in touch rather than raising a
            second one.
          </Alert>
        ) : null}

        <form action={actions.raise} className="mt-4 grid gap-4 sm:grid-cols-2">
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
            <Input name="requestedAmount" inputMode="decimal" placeholder="450" />
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
      </Enter>

      {/* ------------------------------------------------------------------ */}
      {/* History                                                             */}
      {/* ------------------------------------------------------------------ */}
      <Enter as="section" index={3} className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Your requests</h2>

        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-muted">You have not raised any.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {requests.map((request) => (
              <Card key={request.id} className="acct-card p-4" data-shape-card="">
                <div className="flex flex-wrap items-center gap-2">
                  <span data-text="status" className="contents">
                    <Badge tone={STATUS_TONES[request.status] ?? 'neutral'}>
                      {request.status.replace('_', ' ')}
                    </Badge>
                  </span>
                  {request.requested_amount ? (
                    <span className="tabular text-sm text-muted" data-text="amount">
                      {money(request.requested_amount)}
                    </span>
                  ) : null}
                  <span className="text-xs text-subtle" data-text="when">
                    {dateTime(request.created_at)}
                    {request.subscriptions
                      ? ` · ${request.subscriptions.subscription_number}`
                      : ''}
                  </span>
                </div>

                <p className="mt-2 text-sm whitespace-pre-line" data-text="reason">
                  {request.reason}
                </p>

                <p className="mt-2 text-xs text-subtle" data-text="note">
                  {STATUS_NOTE[request.status] ?? request.status}
                </p>

                {request.resolution_note ? (
                  <p className="mt-2 rounded-ck bg-sunken px-3 py-2 text-sm text-muted" data-text="reply">
                    <span className="font-medium text-ink">Our reply:</span>{' '}
                    {request.resolution_note}
                    {request.resolved_at ? ` · ${dateTime(request.resolved_at)}` : ''}
                  </p>
                ) : null}

                {WITHDRAWABLE.has(request.status) ? (
                  <form action={actions.withdraw} className="mt-3" data-text="withdraw">
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
      </Enter>
    </>
  );
}

/** A signed-in account with no customer record: staff, usually. */
export function RefundsNoCustomer() {
  return (
    <Enter index={1}>
      <RememberShape page="refunds" shape={{ customer: false, cards: 0, openCase: false }} />
      <EmptyState
        title="Nothing to refund yet"
        description="Refund requests relate to a subscription you have paid for."
        action={
          <ButtonLink href="/subscriptions">Browse plans</ButtonLink>
        }
      />
    </Enter>
  );
}
