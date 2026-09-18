import { RememberShape } from './account-shape';
import { Enter } from './account-shell';
import { ActionFeedback } from '@/lib/admin/feedback';
import { dateOnly } from '@/lib/format';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui/primitives';

export interface ReviewRow {
  id: string;
  product_id: string | null;
  rating: number;
  title: string;
  body: string;
  status: string;
  is_verified_purchase: boolean;
  edited_at: string | null;
  created_at: string;
  products: { name: string } | null;
}

const STATUS_NOTE: Record<string, string> = {
  pending: 'Waiting to be checked before it goes live.',
  published: 'Live on the menu.',
  hidden: 'Not currently shown.',
  rejected: 'Not published.',
};

type FormAction = (formData: FormData) => void | Promise<void>;

/**
 * The reviews page over plain rows; the page owns the reads and the Server
 * Actions. Split out so `ReviewsSkeleton` can be checked against it.
 */
export function ReviewsView({
  reviews,
  eaten,
  reviewed,
  unreviewed,
  feedback,
  actions,
}: {
  reviews: ReviewRow[];
  /** Dishes actually delivered to this customer, by name. */
  eaten: Array<{ id: string; name: string }>;
  /** Product ids already reviewed. */
  reviewed: Array<string | null>;
  unreviewed: Array<{ id: string; name: string }>;
  feedback: { error?: string; ok?: string };
  actions: { submit: FormAction; update: FormAction; withdraw: FormAction };
}) {
  return (
    <>
      <RememberShape
        page="reviews"
        shape={{ customer: true, cards: reviews.length, note: eaten.length === 0 || unreviewed.length > 0 }}
        measure={{
          texts: { formNote: '[data-text="form-note"]' },
          card: '[data-shape-card]',
          cardTexts: {
            status: '[data-text="status"]',
            verified: '[data-text="verified"]',
            title: '[data-text="title"]',
            body: '[data-text="body"]',
            meta: '[data-text="meta"]',
          },
        }}
      />
      <ActionFeedback error={feedback.error} ok={feedback.ok} />

      {/* ------------------------------------------------------------------ */}
      {/* Write                                                               */}
      {/* ------------------------------------------------------------------ */}
      <Enter index={1}>
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Write a review</h2>

        <form action={actions.submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="What is this about?">
            <Select name="productId" defaultValue="">
              <option value="">The kitchen generally</option>
              {eaten.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                  {reviewed.includes(product.id) ? ' (already reviewed)' : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Rating" required>
            <Select name="rating" defaultValue="5">
              <option value="5">5 · excellent</option>
              <option value="4">4 · good</option>
              <option value="3">3 · fine</option>
              <option value="2">2 · disappointing</option>
              <option value="1">1 · bad</option>
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Title">
              <Input name="title" placeholder="Consistently good dal" />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Your review" required>
              <Textarea name="body" required placeholder="What was it like?" />
            </Field>
          </div>

          <div>
            <Button type="submit">Submit review</Button>
          </div>
        </form>

        {eaten.length === 0 ? (
          <p className="mt-4 text-xs text-subtle" data-text="form-note">
            Once dishes have been delivered to you, they will be listed above so you can review
            them by name.
          </p>
        ) : unreviewed.length > 0 ? (
          <p className="mt-4 text-xs text-subtle" data-text="form-note">
            {unreviewed.length} dish(es) you have eaten are still unreviewed.
          </p>
        ) : null}
      </Card>
      </Enter>

      {/* ------------------------------------------------------------------ */}
      {/* Existing                                                            */}
      {/* ------------------------------------------------------------------ */}
      <Enter as="section" index={2} className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">What you have written</h2>

        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {reviews.map((review) => (
              <Card key={review.id} className="acct-card p-4" data-shape-card="">
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden className="text-warning">
                    {'★'.repeat(review.rating)}
                    <span className="text-subtle">{'★'.repeat(5 - review.rating)}</span>
                  </span>
                  <span className="text-xs text-subtle">{review.rating} of 5</span>
                  <span data-text="status" className="contents">
                    <Badge tone={review.status === 'published' ? 'success' : 'neutral'}>
                      {review.status}
                    </Badge>
                  </span>
                  {review.is_verified_purchase ? (
                    <span data-text="verified" className="contents">
                      <Badge tone="info">Verified</Badge>
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 font-medium" data-text="title">
                  {review.title || 'Untitled'}
                </p>
                <p className="mt-1 text-sm whitespace-pre-line text-muted" data-text="body">
                  {review.body}
                </p>

                <p className="mt-2 text-xs text-subtle" data-text="meta">
                  {review.products?.name ?? 'The kitchen generally'} · {dateOnly(review.created_at)}
                  {review.edited_at ? ' · edited' : ''} ·{' '}
                  {STATUS_NOTE[review.status] ?? review.status}
                </p>

                <details className="acct-details mt-3 border-t border-line pt-3">
                  <summary className="acct-details-summary">Edit or withdraw</summary>

                  <form action={actions.update} className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="reviewId" value={review.id} />

                    <Field label="Rating" required>
                      <Select name="rating" defaultValue={String(review.rating)}>
                        <option value="5">5 · excellent</option>
                        <option value="4">4 · good</option>
                        <option value="3">3 · fine</option>
                        <option value="2">2 · disappointing</option>
                        <option value="1">1 · bad</option>
                      </Select>
                    </Field>

                    <Field label="Title">
                      <Input name="title" defaultValue={review.title} />
                    </Field>

                    <div className="sm:col-span-2">
                      <Field label="Your review" required>
                        <Textarea name="body" defaultValue={review.body} required />
                      </Field>
                    </div>

                    <div>
                      <Button type="submit" size="sm" variant="secondary">
                        Save changes
                      </Button>
                    </div>
                  </form>

                  <form action={actions.withdraw} className="mt-2">
                    <input type="hidden" name="reviewId" value={review.id} />
                    <ConfirmButton confirmLabel="Really withdraw?">
                      Withdraw this review
                    </ConfirmButton>
                  </form>
                </details>
              </Card>
            ))}
          </div>
        )}
      </Enter>

      <Enter index={3} className="mt-8">
        <Alert tone="info">
          Editing a published review sends it back to be checked before it reappears. That keeps
          the menu honest for everyone reading it.
        </Alert>
      </Enter>
    </>
  );
}

/** A signed-in account with no customer record: staff, usually. */
export function ReviewsNoCustomer() {
  return (
    <Enter index={1}>
      <RememberShape page="reviews" shape={{ customer: false, cards: 0, note: false }} />
      <EmptyState
        title="Nothing to review yet"
        description="Once meals have been delivered to you, you can say what you thought."
        action={
          <ButtonLink href="/subscriptions">Browse plans</ButtonLink>
        }
      />
    </Enter>
  );
}
