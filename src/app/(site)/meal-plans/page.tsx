import Link from 'next/link';
import { listCollections, listDeliveryWindows } from '@/lib/data/catalog';
import { ProductTile } from '@/components/product-card';
import { clockTime } from '@/lib/format';
import { Button, Card, EmptyState } from '@/components/ui/primitives';

export const metadata = {
  title: 'Meal Plans',
  description: 'How our meals are grouped, and how a week of eating actually looks.',
};

/**
 * Meal Plans is education, not commerce (PRD 6). It explains how the food is
 * grouped and how a week looks; the actual purchase happens on Subscriptions.
 */
export default async function MealPlansPage() {
  const [collections, windows] = await Promise.all([listCollections(), listDeliveryWindows()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Meal plans</h1>
        <p className="mt-2 text-muted text-pretty">
          How we group the food, and how a week of eating with us actually looks. When you
          are ready to buy, that happens on the subscriptions page.
        </p>
      </header>

      {windows.length ? (
        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Delivery windows</h2>
          <p className="mt-1 text-sm text-muted">
            Pick the window that suits you when you subscribe. Each has its own cut-off for
            changes.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {windows.map((window) => (
              <Card key={window.id} className="p-5">
                <h3 className="font-semibold">{window.label}</h3>
                <p className="mt-1 text-sm tabular text-muted">
                  {clockTime(window.starts_at)} – {clockTime(window.ends_at)}
                </p>
                <p className="mt-3 text-xs text-subtle">
                  Changes close {Math.round(window.cutoff_minutes_before / 60)} hours before
                  the window opens.
                </p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {collections.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title="No collections yet"
            description="The kitchen groups dishes into collections; none have been published."
          />
        </div>
      ) : (
        <div className="mt-14 space-y-14">
          {collections.map((collection) => (
            <section key={collection.slug}>
              <h2 className="text-xl font-semibold tracking-tight">{collection.name}</h2>
              {collection.description ? (
                <p className="mt-1 max-w-2xl text-sm text-muted">{collection.description}</p>
              ) : null}

              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {collection.products.map((product) => (
                  <ProductTile key={product.id} product={product} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-16 rounded-ck-lg border border-line bg-surface p-8 text-center">
        <h2 className="text-xl font-semibold">Pick the plan that fits your week</h2>
        <Link href="/subscriptions" className="mt-5 inline-block">
          <Button size="lg">See subscription plans</Button>
        </Link>
      </div>
    </div>
  );
}
