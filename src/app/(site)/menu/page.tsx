import { Suspense } from 'react';
import Link from 'next/link';
import { listMenuByCategory, type ProductCard } from '@/lib/data/catalog';
import { ProductTile } from '@/components/product-card';
import { MenuSearch } from '@/components/site/menu-search';
import { pluralise } from '@/lib/format';
import { Alert, ButtonLink, EmptyState, Skeleton } from '@/components/ui/primitives';

export const metadata = {
  title: 'Menu',
  description: 'Everything the kitchen cooks, and what is available today.',
};

/**
 * Every term has to appear somewhere in the dish, so "paneer curry" narrows
 * rather than widening the way an OR would. Category and description are part
 * of the haystack: someone searching "breakfast" or "coconut" is describing
 * the dish, not naming it.
 */
function matches(product: ProductCard, terms: string[]): boolean {
  const haystack = [
    product.name,
    product.shortDescription,
    product.description,
    product.categoryName ?? '',
  ]
    .join(' ')
    .toLowerCase();

  return terms.every((term) => haystack.includes(term));
}

/**
 * The page itself is a static shell: a heading and a closing call to action,
 * identical for everybody, prerendered into HTML at build time.
 *
 * `searchParams` is handed down as the promise it is rather than awaited here.
 * Awaiting it would make this component request-dependent and take the whole
 * page dynamic again -- the very thing the split exists to avoid. Only
 * `MenuResults`, behind the boundary, actually reads it.
 */
export default function MenuPage({ searchParams }: PageProps<'/menu'>) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Menu</h1>
        <p className="mt-2 text-muted text-pretty">
          This is what our kitchen cooks. It is here so you know what you are signing up
          for — meals are ordered through a subscription rather than one at a time.
        </p>
      </header>

      <Suspense fallback={<MenuResultsFallback />}>
        <MenuResults searchParams={searchParams} />
      </Suspense>

      <div className="mt-16 rounded-ck-lg border border-line bg-surface p-8 text-center">
        <h2 className="text-xl font-semibold">Ready to eat like this every day?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Subscriptions are how meals are ordered. Pick a plan, set your window, and the
          kitchen cooks to it.
        </p>
        <ButtonLink href="/subscriptions" size="lg" className="mt-5">See subscription plans</ButtonLink>
      </div>
    </div>
  );
}

/**
 * Holds the shape of the results while they stream.
 *
 * The search field is in here rather than in the static shell because its value
 * *is* the query -- prerendering an empty box and swapping the real term in
 * underneath someone who had already started typing is worse than showing the
 * field a beat later.
 */
function MenuResultsFallback() {
  return (
    <div role="status" aria-label="Loading the menu">
      <Skeleton className="mt-6 h-11 w-full max-w-xl" />

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((card) => (
          <div key={card} className="overflow-hidden rounded-ck-lg border border-line">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-1 h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Everything that depends on `q`. The menu itself is cached, so what this waits
 * on is the request, not the database.
 */
async function MenuResults({
  searchParams,
}: {
  searchParams: PageProps<'/menu'>['searchParams'];
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (raw ?? '').trim().slice(0, 80);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  const allGroups = await listMenuByCategory();

  const groups = terms.length
    ? allGroups
        .map((group) => ({
          ...group,
          products: group.products.filter((product) => matches(product, terms)),
        }))
        .filter((group) => group.products.length > 0)
    : allGroups;

  const shown = groups.flatMap((group) => group.products);
  const unavailableCount = shown.filter((product) => !product.isAvailable).length;

  return (
    <>
      <MenuSearch defaultValue={query} className="mt-6 max-w-xl" />

      {query ? (
        <p className="mt-3 text-sm text-muted">
          {shown.length === 0
            ? 'No dishes match'
            : `${pluralise(shown.length, 'dish', 'dishes')} matching`}{' '}
          <span className="font-medium text-ink">“{query}”</span>.{' '}
          <Link href="/menu" className="font-medium text-brand hover:underline">
            Clear search
          </Link>
        </p>
      ) : null}

      {unavailableCount > 0 ? (
        <div className="mt-6 max-w-2xl">
          <Alert tone="info">
            {unavailableCount === 1
              ? 'One dish is unavailable today. It is shown greyed out below, with the reason.'
              : `${unavailableCount} dishes are unavailable today. They are shown greyed out below, with the reason.`}
          </Alert>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div className="mt-10">
          {query ? (
            <EmptyState
              title={`Nothing on the menu matches “${query}”`}
              description="We cook a small menu, so it is a short list. Try a broader word — a category like breakfast, or an ingredient like paneer."
              action={
                <ButtonLink href="/menu" variant="secondary">
                  Show the whole menu
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              title="The menu has not been published yet"
              description="Once the kitchen adds dishes, they will appear here."
            />
          )}
        </div>
      ) : (
        <div className="mt-10 space-y-14">
          {groups.map((group) => (
            <section key={group.slug}>
              <h2 className="text-xl font-semibold tracking-tight">{group.name}</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {group.products.map((product) => (
                  <ProductTile key={product.id} product={product} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
