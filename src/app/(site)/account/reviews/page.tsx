import { Suspense } from 'react';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getUserId, requireSession } from '@/lib/auth/session';
import { serverClient } from '@/lib/supabase/server';
import { num, str } from '@/lib/admin/form';
import { done, fail, readable } from '@/lib/admin/feedback';
import { AccountHead } from '@/components/account/account-shell';
import { ReviewsSkeleton } from '@/components/account/account-skeletons';
import { ReviewsNoCustomer, ReviewsView, type ReviewRow } from '@/components/account/reviews-view';

export const metadata = { title: 'Your reviews' };

const PATH = '/account/reviews';

/**
 * Customer reviews (PRD 14).
 *
 * Customers write, edit and withdraw their own; the kitchen moderates. Editing
 * a published review sends it back for checking -- that is enforced by a
 * database trigger, not by this page, so it holds however the edit arrives.
 */
export default function AccountReviewsPage({ searchParams }: PageProps<'/account/reviews'>) {
  return (
    <div className="acct-page mx-auto max-w-3xl px-4">
      <AccountHead eyebrow="Your meals" title="Your reviews">
        Say what you thought. Reviews are checked before they go on the menu.
      </AccountHead>
      <div className="acct-body">
        <Suspense fallback={<ReviewsSkeleton />}>
          <Reviews searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Reviews({ searchParams }: Pick<PageProps<'/account/reviews'>, 'searchParams'>) {
  const [supabase, userId] = await Promise.all([serverClient(), getUserId()]);
  if (!userId) redirect('/sign-in');

  // The guard and both reads go out together. RLS confines the delivery items
  // to this customer, and a refused guard still redirects before render.
  // Reviewable dishes are the ones actually delivered, read in one query
  // through the delivery rather than as a list of delivery ids and a second
  // read filtered by them.
  //
  // Published reviews are readable by everyone, so the reviews read has to
  // name its customer. It names them by the verified token subject through
  // `customers.profile_id`, rather than by the customer id -- which would mean
  // waiting a full round trip for the session before the read could start.
  const [session, params, eatenResult, reviewsResult] = await Promise.all([
    requireSession(),
    searchParams,
    supabase
      .from('subscription_delivery_items')
      .select('product_id, products ( name ), subscription_deliveries!inner ( status )')
      .eq('subscription_deliveries.status', 'fulfilled')
      .limit(1000),
    supabase
      .from('reviews')
      .select(
        'id, product_id, rating, title, body, status, is_verified_purchase, edited_at, created_at, products ( name ), customers!inner ( profile_id )',
      )
      .eq('customers.profile_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ]);

  if (!session.customerId) {
    return <ReviewsNoCustomer />;
  }

  const customerId = session.customerId;

  const reviews = (reviewsResult.data ?? []) as unknown as ReviewRow[];

  const seen = new Map<string, string>();
  for (const row of (eatenResult.data ?? []) as unknown as Array<{
    product_id: string;
    products: { name: string } | null;
  }>) {
    if (row.products) seen.set(row.product_id, row.products.name);
  }
  const eaten = [...seen]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
    done(PATH, 'Thank you. Your review will appear once it has been checked.');
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
    <ReviewsView
      reviews={reviews}
      eaten={eaten}
      reviewed={[...reviewedProducts]}
      unreviewed={unreviewed}
      feedback={{ error: params.error as string | undefined, ok: params.ok as string | undefined }}
      actions={{ submit: submitReview, update: updateReview, withdraw: withdrawReview }}
    />
  );
}
