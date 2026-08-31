import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth/session';
import { serverClient } from '@/lib/supabase/server';
import { dateOnly } from '@/lib/format';
import { num, str } from '@/lib/admin/form';
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

export const metadata = { title: 'Your reviews' };
export const dynamic = 'force-dynamic';

const PATH = '/account/reviews';

interface ReviewRow {
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

/**
 * Customer reviews (PRD 14).
 *
 * Customers write, edit and withdraw their own; the kitchen moderates. Editing
 * a published review sends it back for checking -- that is enforced by a
 * database trigger, not by this page, so it holds however the edit arrives.
 */
export default async function AccountReviewsPage({ searchParams }: PageProps<'/account/reviews'>) {
  const session = await requireSession();
  const params = await searchParams;
  const supabase = await serverClient();

  if (!session.customerId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          title="Nothing to review yet"
          description="Once meals have been delivered to you, you can say what you thought."
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

  // Reviewable dishes are the ones actually delivered. RLS already confines
  // both queries to this customer, so neither filters by customer itself.
  const [reviewsResult, deliveriesResult] = await Promise.all([
    supabase
      .from('reviews')
      .select(
        'id, product_id, rating, title, body, status, is_verified_purchase, edited_at, created_at, products ( name )',
      )
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('subscription_deliveries')
      .select('id')
      .eq('status', 'fulfilled')
      .limit(200),
  ]);

  const reviews = (reviewsResult.data ?? []) as unknown as ReviewRow[];
  const deliveryIds = ((deliveriesResult.data ?? []) as Array<{ id: string }>).map((row) => row.id);

  let eaten: Array<{ id: string; name: string }> = [];
  if (deliveryIds.length > 0) {
    const { data } = await supabase
      .from('subscription_delivery_items')
      .select('product_id, products ( name )')
      .in('delivery_id', deliveryIds);

    const seen = new Map<string, string>();
    for (const row of (data ?? []) as unknown as Array<{
      product_id: string;
      products: { name: string } | null;
    }>) {
      if (row.products) seen.set(row.product_id, row.products.name);
    }
    eaten = [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }

  const reviewedProducts = new Set(reviews.map((review) => review.product_id));

  async function submitReview(formData: FormData) {
    'use server';

    const rating = num(formData, 'rating', 0);
    if (rating < 1 || rating > 5) fail(PATH, 'Pick a rating from 1 to 5.');

    const body = str(formData, 'body');
    if (!body) fail(PATH, 'Tell us a little about what you thought.');

    const db = await serverClient();
    const { error } = await db.from('reviews').insert({
      customer_id: customerId,
      product_id: str(formData, 'productId') || null,
      rating,
      title: str(formData, 'title'),
      body,
    });

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    done(PATH, 'Thank you — your review will appear once it has been checked.');
  }

  async function updateReview(formData: FormData) {
    'use server';

    const rating = num(formData, 'rating', 0);
    if (rating < 1 || rating > 5) fail(PATH, 'Pick a rating from 1 to 5.');

    const db = await serverClient();
    const { error } = await db
      .from('reviews')
      .update({
        rating,
        title: str(formData, 'title'),
        body: str(formData, 'body'),
      })
      .eq('id', str(formData, 'reviewId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidatePath('/menu');
    done(PATH, 'Review updated. It goes back for a quick check before it reappears.');
  }

  async function withdrawReview(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db
      .from('reviews')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', str(formData, 'reviewId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidatePath('/menu');
    done(PATH, 'Review withdrawn.');
  }

  const unreviewed = eaten.filter((product) => !reviewedProducts.has(product.id));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <SectionHeading
        title="Your reviews"
        description="Say what you thought. Reviews are checked before they go on the menu."
      />

      <ActionFeedback error={params.error as string} ok={params.ok as string} />

      {/* ------------------------------------------------------------------ */}
      {/* Write                                                               */}
      {/* ------------------------------------------------------------------ */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Write a review</h2>

        <form action={submitReview} className="grid gap-4 sm:grid-cols-2">
          <Field label="What is this about?">
            <Select name="productId" defaultValue="">
              <option value="">The kitchen generally</option>
              {eaten.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                  {reviewedProducts.has(product.id) ? ' (already reviewed)' : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Rating" required>
            <Select name="rating" defaultValue="5">
              <option value="5">5 — excellent</option>
              <option value="4">4 — good</option>
              <option value="3">3 — fine</option>
              <option value="2">2 — disappointing</option>
              <option value="1">1 — bad</option>
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
          <p className="mt-4 text-xs text-subtle">
            Once dishes have been delivered to you, they will be listed above so you can review
            them by name.
          </p>
        ) : unreviewed.length > 0 ? (
          <p className="mt-4 text-xs text-subtle">
            {unreviewed.length} dish(es) you have eaten are still unreviewed.
          </p>
        ) : null}
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Existing                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">What you have written</h2>

        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {reviews.map((review) => (
              <Card key={review.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden className="text-warning">
                    {'★'.repeat(review.rating)}
                    <span className="text-subtle">{'★'.repeat(5 - review.rating)}</span>
                  </span>
                  <span className="text-xs text-subtle">{review.rating} of 5</span>
                  <Badge tone={review.status === 'published' ? 'success' : 'neutral'}>
                    {review.status}
                  </Badge>
                  {review.is_verified_purchase ? <Badge tone="info">Verified</Badge> : null}
                </div>

                <p className="mt-2 font-medium">{review.title || 'Untitled'}</p>
                <p className="mt-1 text-sm whitespace-pre-line text-muted">{review.body}</p>

                <p className="mt-2 text-xs text-subtle">
                  {review.products?.name ?? 'The kitchen generally'} · {dateOnly(review.created_at)}
                  {review.edited_at ? ' · edited' : ''} ·{' '}
                  {STATUS_NOTE[review.status] ?? review.status}
                </p>

                <details className="mt-3 border-t border-line pt-3">
                  <summary className="cursor-pointer text-sm text-muted hover:text-ink">
                    Edit or withdraw
                  </summary>

                  <form action={updateReview} className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="reviewId" value={review.id} />

                    <Field label="Rating" required>
                      <Select name="rating" defaultValue={String(review.rating)}>
                        <option value="5">5 — excellent</option>
                        <option value="4">4 — good</option>
                        <option value="3">3 — fine</option>
                        <option value="2">2 — disappointing</option>
                        <option value="1">1 — bad</option>
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

                  <form action={withdrawReview} className="mt-2">
                    <input type="hidden" name="reviewId" value={review.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Withdraw this review
                    </Button>
                  </form>
                </details>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="mt-8">
        <Alert tone="info">
          Editing a published review sends it back to be checked before it reappears — that keeps
          the menu honest for everyone reading it.
        </Alert>
      </div>
    </div>
  );
}
