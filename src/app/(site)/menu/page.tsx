import { listMenuByCategory } from '@/lib/data/catalog';
import { ProductTile } from '@/components/product-card';
import { Alert, ButtonLink, EmptyState } from '@/components/ui/primitives';

export const metadata = {
  title: 'Menu',
  description: 'Everything the kitchen cooks, and what is available today.',
};

export default async function MenuPage() {
  const groups = await listMenuByCategory();
  const unavailableCount = groups
    .flatMap((group) => group.products)
    .filter((product) => !product.isAvailable).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Menu</h1>
        <p className="mt-2 text-muted text-pretty">
          This is what our kitchen cooks. It is here so you know what you are signing up
          for — meals are ordered through a subscription rather than one at a time.
        </p>
      </header>

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
          <EmptyState
            title="The menu has not been published yet"
            description="Once the kitchen adds dishes, they will appear here."
          />
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
