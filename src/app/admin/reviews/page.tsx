import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { revalidateStorefront } from '@/lib/data/catalog-cache';
import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { dateTime } from '@/lib/format';
import { str } from '@/lib/admin/form';
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
  Card,
  EmptyState,
  Input,
  SectionHeading,
  cx,
} from '@/components/ui/primitives';

export const metadata = { title: 'Reviews' };

const PATH = '/admin/reviews';

const FILTERS = [
  { value: 'pending', label: 'Awaiting moderation' },
  { value: 'published', label: 'Published' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'Everything' },
] as const;

interface ReviewRow {
  id: string;
  rating: number;
  title: string;
  body: string;
  status: string;
  is_verified_purchase: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  customers: { id: string; full_name: string } | null;
  products: { name: string } | null;
}

const STATUS_TONES: Record<string, 'success' | 'warning' | 'neutral' | 'danger'> = {
  published: 'success',
  pending: 'warning',
  hidden: 'neutral',
  rejected: 'danger',
};

/** Stars, plus the number, because a row of glyphs is not readable to everyone. */
function Rating({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-1">
      <span aria-hidden className="text-warning">
        {'★'.repeat(value)}
        <span className="text-subtle">{'★'.repeat(5 - value)}</span>
      </span>
      <span className="text-xs text-subtle">{value} of 5</span>
    </span>
  );
}

/**
 * Review moderation (PRD 14).
 *
 * Reviews arrive pending and never render publicly until they are published
 * here -- that ordering is enforced by RLS, not by this screen. Every decision
 * writes a review_moderation row naming the moderator, so hiding a review is
 * itself part of the audit history.
 */
export default async function ReviewsPage({ searchParams }: PageProps<'/admin/reviews'>) {
  await requirePermission(PERMISSIONS.reviewsModerate);
  const params = await searchParams;
  const supabase = await serverClient();

  const filter = FILTERS.some((option) => option.value === params.status)
    ? String(params.status)
    : 'pending';

  let request = supabase
    .from('reviews')
    .select(
      `id, rating, title, body, status, is_verified_purchase, edited_at, deleted_at, created_at,
       customers ( id, full_name ), products ( name )`,
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (filter !== 'all') request = request.eq('status', filter);

  const [reviewsResult, countsResult] = await Promise.all([
    request,
    supabase.from('reviews').select('status'),
  ]);

  const reviews = (reviewsResult.data ?? []) as unknown as ReviewRow[];
  const counts = new Map<string, number>();
  for (const row of (countsResult.data ?? []) as Array<{ status: string }>) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  async function moderate(formData: FormData) {
    'use server';

    const status = str(formData, 'status');
    const db = await serverClient();

    const { error } = await db.rpc('moderate_review', {
      p_review_id: str(formData, 'reviewId'),
      p_status: status,
      p_reason: str(formData, 'reason') || null,
    });

    if (error) fail(`${PATH}?status=${filter}`, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/menu');
    done(`${PATH}?status=${filter}`, `Review ${status}.`);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <SectionHeading
        title="Reviews"
        description="Nothing a customer writes appears on the storefront until it is published here."
      />

      <ActionFeedback error={params.error as string} ok={params.ok as string} />

      <nav className="mb-6 flex flex-wrap gap-1" aria-label="Filter reviews">
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

      {reviews.length === 0 ? (
        <EmptyState
          title={filter === 'pending' ? 'Nothing waiting' : 'No reviews here'}
          description={
            filter === 'pending'
              ? 'The moderation queue is empty.'
              : 'Try a different filter above.'
          }
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Rating value={review.rating} />
                    <Badge tone={STATUS_TONES[review.status] ?? 'neutral'}>{review.status}</Badge>
                    {review.is_verified_purchase ? (
                      <Badge tone="info">Verified purchase</Badge>
                    ) : null}
                    {review.edited_at ? <Badge tone="warning">Edited</Badge> : null}
                    {review.deleted_at ? <Badge tone="danger">Withdrawn by customer</Badge> : null}
                  </div>

                  <p className="mt-2 font-medium">{review.title || 'Untitled'}</p>
                  {review.body ? (
                    <p className="mt-1 text-sm whitespace-pre-line text-muted">{review.body}</p>
                  ) : null}

                  <p className="mt-2 text-xs text-subtle">
                    {review.products?.name ?? 'The kitchen generally'} ·{' '}
                    {review.customers ? (
                      <Link
                        href={`/admin/customers/${review.customers.id}`}
                        className="hover:text-ink hover:underline"
                      >
                        {review.customers.full_name}
                      </Link>
                    ) : (
                      'Unknown customer'
                    )}{' '}
                    · {dateTime(review.created_at)}
                  </p>
                </div>
              </div>

              <form
                action={moderate}
                className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4"
              >
                <input type="hidden" name="reviewId" value={review.id} />

                <label className="text-xs">
                  <span className="mb-1 block text-subtle">Moderator note (optional)</span>
                  <Input name="reason" className="w-72" placeholder="Why this decision" />
                </label>

                <div className="flex flex-wrap gap-2">
                  {review.status !== 'published' ? (
                    <Button type="submit" name="status" value="published" size="sm" variant="success">
                      Publish
                    </Button>
                  ) : null}

                  {review.status !== 'hidden' ? (
                    <Button type="submit" name="status" value="hidden" size="sm" variant="secondary">
                      Hide
                    </Button>
                  ) : null}

                  {review.status !== 'rejected' ? (
                    <Button type="submit" name="status" value="rejected" size="sm" variant="danger">
                      Reject
                    </Button>
                  ) : null}

                  {review.status !== 'pending' ? (
                    <Button type="submit" name="status" value="pending" size="sm" variant="ghost">
                      Back to queue
                    </Button>
                  ) : null}
                </div>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
