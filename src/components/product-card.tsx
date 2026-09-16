import Image from 'next/image';
import type { ProductCard as Product } from '@/lib/data/catalog';
import { money } from '@/lib/format';
import { Badge, cx } from '@/components/ui/primitives';

/**
 * A meal on the menu, as it sits on the home page's printed spread.
 *
 * Set like a line on a paper menu: the name in Zodiak, a dotted leader, the
 * price at the end of the line. The photograph is inset from the card's edge
 * rather than bled to it, so it reads as a plate on the sheet -- and it stays
 * the loudest thing in the card, because nothing else in it has colour. See
 * `.menu-spread` in `globals.css`.
 *
 * An unavailable product is rendered grayscale with an explicit badge and is
 * not selectable (PRD 6, PRD 19) -- shown rather than hidden, so a customer
 * learns what the kitchen normally makes and why it is off today.
 */
export function ProductTile({
  product,
  loading,
  fetchPriority,
}: {
  product: Product;
  /**
   * `eager` for a tile the page knows is on the first screen. Lazy is right
   * for the rest of a grid and wrong for its first row: a lazy image is only
   * requested once layout has placed it, so the largest picture on the screen
   * arrives last.
   */
  loading?: 'eager' | 'lazy';
  /** `high` for the one tile that is the page's LCP candidate, and no other. */
  fetchPriority?: 'high' | 'low' | 'auto';
}) {
  const unavailable = !product.isAvailable;
  const rated = product.ratingCount > 0 && product.ratingAverage !== null;

  return (
    <article className={cx('spread-dish', unavailable && 'is-unavailable')}>
      <div className="spread-dish-photo">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt}
            fill
            sizes="(max-width: 639px) calc(100vw - 56px), (max-width: 1023px) calc(50vw - 52px), (max-width: 1248px) 31vw, 390px"
            loading={loading}
            fetchPriority={fetchPriority}
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

        <div className="absolute top-2.5 left-2.5 flex gap-1">
          <Badge tone={product.isVegetarian ? 'success' : 'danger'}>
            {product.isVegetarian ? 'Veg' : 'Non-veg'}
          </Badge>
          {product.creditCost > 1 ? <Badge tone="accent">{product.creditCost} credits</Badge> : null}
        </div>
      </div>

      <div className="spread-dish-body">
        <div className="spread-dish-line">
          <h3 className="spread-dish-name">{product.name}</h3>
          <span className="spread-dish-leader" aria-hidden />
          <p className="spread-dish-price tabular">{money(product.basePrice)}</p>
        </div>

        {product.shortDescription ? (
          <p className="spread-dish-desc">{product.shortDescription}</p>
        ) : null}

        <dl className="spread-dish-facts">
          {product.calories !== null ? (
            <div>
              <dt>Calories</dt>
              <dd className="tabular">{product.calories}</dd>
            </div>
          ) : null}
          {product.proteinGrams ? (
            <div>
              <dt>Protein</dt>
              <dd className="tabular">{product.proteinGrams}g</dd>
            </div>
          ) : null}
          {rated ? (
            <div>
              <dt className="sr-only">Rating</dt>
              <dd className="tabular">
                <span aria-hidden className="spread-dish-star">
                  ★{' '}
                </span>
                {product.ratingAverage!.toFixed(1)}
                <span className="spread-dish-soft">
                  {' '}
                  ({product.ratingCount === 1 ? '1 review' : `${product.ratingCount} reviews`})
                </span>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </article>
  );
}
