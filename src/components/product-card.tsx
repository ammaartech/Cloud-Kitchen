import Image from 'next/image';
import type { ProductCard as Product } from '@/lib/data/catalog';
import { money } from '@/lib/format';
import { Badge, cx } from '@/components/ui/primitives';

/**
 * A meal on the menu.
 *
 * An unavailable product is rendered grayscale with an explicit badge and is
 * not selectable (PRD 6, PRD 19) -- shown rather than hidden, so a customer
 * learns what the kitchen normally makes and why it is off today.
 */
export function ProductTile({ product }: { product: Product }) {
  const unavailable = !product.isAvailable;

  return (
    <article
      className={cx(
        'group overflow-hidden rounded-ck-lg border border-line bg-surface shadow-ck-sm',
        unavailable && 'is-unavailable',
      )}
    >
      <div className="relative aspect-[4/3] bg-sunken">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-subtle">No photo yet</div>
        )}

        {unavailable ? (
          <div className="absolute inset-x-0 bottom-0 bg-ink/80 px-3 py-2">
            <p className="text-xs font-semibold text-white">Unavailable today</p>
            {product.unavailableReason ? (
              <p className="text-xs text-white/80">{product.unavailableReason}</p>
            ) : null}
          </div>
        ) : null}

        <div className="absolute top-2 left-2 flex gap-1">
          <Badge tone={product.isVegetarian ? 'success' : 'danger'}>
            {product.isVegetarian ? 'Veg' : 'Non-veg'}
          </Badge>
          {product.creditCost > 1 ? <Badge tone="accent">{product.creditCost} credits</Badge> : null}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-ink">{product.name}</h3>
          <p className="shrink-0 font-semibold tabular text-ink">{money(product.basePrice)}</p>
        </div>

        {product.ratingCount > 0 && product.ratingAverage !== null ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs">
            <span aria-hidden className="text-warning">
              {'★'.repeat(Math.round(product.ratingAverage))}
              <span className="text-subtle">
                {'★'.repeat(5 - Math.round(product.ratingAverage))}
              </span>
            </span>
            <span className="text-muted">
              {product.ratingAverage.toFixed(1)} from{' '}
              {product.ratingCount === 1 ? '1 review' : `${product.ratingCount} reviews`}
            </span>
          </p>
        ) : null}

        {product.shortDescription ? (
          <p className="mt-1 text-sm text-muted">{product.shortDescription}</p>
        ) : null}

        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">
          {product.calories !== null ? (
            <div className="flex gap-1">
              <dt>Calories</dt>
              <dd className="tabular font-medium text-muted">{product.calories}</dd>
            </div>
          ) : null}
          {product.proteinGrams ? (
            <div className="flex gap-1">
              <dt>Protein</dt>
              <dd className="tabular font-medium text-muted">{product.proteinGrams}g</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </article>
  );
}
