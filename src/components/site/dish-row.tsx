import Image from 'next/image';
import type { ProductCard } from '@/lib/data/catalog';
import { money } from '@/lib/format';
import { cx } from '@/components/ui/button-styles';
import { VegMark } from './veg-mark';

/**
 * The facts under a dish, in the order someone choosing between dishes asks
 * for them. Credits only when a dish costs more than one -- the note on the
 * subscriptions page is that premium dishes do, and a "1 credit" on every row
 * would be noise hiding the rows where it matters.
 */
export function dishFacts(product: ProductCard): string[] {
  return [
    product.calories !== null ? `${product.calories} kcal` : null,
    product.proteinGrams ? `${Number(product.proteinGrams)} g protein` : null,
    product.creditCost > 1 ? `${product.creditCost} credits` : null,
  ].filter((fact): fact is string => fact !== null);
}

/**
 * One dish on the menu, as a row rather than a card.
 *
 * A menu is read by scanning down it, and a grid of photo cards is the wrong
 * shape for that: on a phone it is one dish per screen, and on a desktop the
 * eye zig-zags across three columns to compare two prices. A row puts the name
 * and the price on one line and everything else under it, which is how every
 * printed menu has always been set.
 *
 * ## Two layouts, one element
 *
 * Below `lg` the row is the shape the delivery apps have taught this market:
 * the words on the left and a square photograph on the right, so the food is
 * still on screen while the list is being scanned. From `lg` the photograph
 * leaves the row -- the pass beside the list shows it, far larger than a
 * thumbnail could -- and the price moves to the end of the name's line with a
 * dotted leader running to it. Same markup in both; the stylesheet moves the
 * grid areas, so there is one price in the DOM and a screen reader hears it
 * once.
 *
 * `data-dish` is the row's position in the whole menu, which is what the pass
 * uses to know which photograph to show.
 */
export function DishRow({
  product,
  index,
  eager = false,
}: {
  product: ProductCard;
  index: number;
  /** For the rows on the first phone screen, whose photographs should not wait. */
  eager?: boolean;
}) {
  const unavailable = !product.isAvailable;
  const facts = dishFacts(product);
  const rated = product.ratingCount > 0 && product.ratingAverage !== null;

  return (
    <li className={cx('dish', unavailable && 'is-unavailable')} data-dish={index} data-rise>
      <VegMark vegetarian={product.isVegetarian} className="dish-mark" />
      <h3 className="dish-name">{product.name}</h3>
      <span className="dish-leader" aria-hidden />
      <p className="dish-price tabular">{money(product.basePrice)}</p>

      {product.shortDescription ? <p className="dish-desc">{product.shortDescription}</p> : null}

      {facts.length > 0 || rated ? (
        <p className="dish-meta">
          {facts.map((fact) => (
            <span key={fact} className="tabular">
              {fact}
            </span>
          ))}
          {rated ? (
            <span className="tabular">
              <span aria-hidden>★ </span>
              {product.ratingAverage!.toFixed(1)}
              <span className="dish-meta-soft"> ({product.ratingCount})</span>
            </span>
          ) : null}
        </p>
      ) : null}

      {unavailable ? (
        <p className="dish-off">
          Off today{product.unavailableReason ? `: ${product.unavailableReason}` : ''}
        </p>
      ) : null}

      {product.imageUrl ? (
        <div className="dish-thumb">
          {/* Hidden from `lg`, and lazy for exactly that reason: a lazy image
              inside a `display: none` box is never requested, so a desktop that
              shows these photographs on the pass does not also download a
              thumbnail of each. */}
          <Image
            src={product.imageUrl}
            alt={product.imageAlt}
            fill
            sizes="6rem"
            loading={eager ? 'eager' : 'lazy'}
            className="object-cover"
          />
        </div>
      ) : null}
    </li>
  );
}
