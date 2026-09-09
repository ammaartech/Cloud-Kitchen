import Image from 'next/image';
import type { ProductCard } from '@/lib/data/catalog';
import { cx } from '@/components/ui/button-styles';

/**
 * A dish, as a row rather than a photo card.
 *
 * This page deliberately does not use `ProductTile`, and the reason is the
 * shape of this menu on a phone. A tile leads with a 4:3 photograph, so at one
 * column it costs roughly 370px per dish; twenty-seven of those is about ten
 * thousand pixels of scrolling between the top of the menu and the bottom of
 * it. Nobody reads that far, and this is the page a poster sends people to, so
 * the menu has to survive being read with a thumb.
 *
 * As a row it is about 112px, which is a third of the height, and the text
 * gets the full width instead of sharing it with a picture. That is also the
 * order a menu is actually read in: the name first, the photograph only as
 * confirmation.
 *
 * There is no price on this row, and that is the same decision the page makes
 * about plans one section up. A price on a page somebody found on a poster is a
 * price they will hold the kitchen to, and the numbers are not settled -- so
 * the menu says what is cooked and the conversation says what it costs. When
 * the numbers are fixed, `product.basePrice` is still on the card this renders
 * and putting it back is the block that used to sit beside the name.
 *
 * The other half of it is bytes. `ProductTile` asks for `calc(100vw - 40px)`
 * because its photo really is that wide; here the thumbnail is 96px, and
 * saying so is the difference between twenty-seven full-width images and
 * twenty-seven thumbnails on a phone connection.
 */

/**
 * The green square with a dot, and the red one, exactly as they appear on
 * every packet and menu board in India. It is the mark people already look for
 * and it costs one line where a "Vegetarian" badge costs a whole row, so on a
 * menu this long it is the compact option *and* the familiar one.
 *
 * The colour is not the only signal, because it must not be: the label is on
 * the element for anyone who cannot use it.
 */
function VegMark({ vegetarian }: { vegetarian: boolean }) {
  return (
    <span
      role="img"
      aria-label={vegetarian ? 'Vegetarian' : 'Non-vegetarian'}
      className={cx(
        'grid size-3.5 shrink-0 translate-y-px place-items-center rounded-[3px] border-[1.5px]',
        vegetarian ? 'border-success' : 'border-danger',
      )}
    >
      <span
        className={cx('size-1.5 rounded-full', vegetarian ? 'bg-success' : 'bg-danger')}
      />
    </span>
  );
}

export function MenuItem({ product }: { product: ProductCard }) {
  const unavailable = !product.isAvailable;

  return (
    <article
      className={cx(
        'flex gap-3 rounded-ck-lg border border-line bg-surface p-3 shadow-ck-sm sm:gap-4',
        unavailable && 'is-unavailable',
      )}
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-ck bg-sunken sm:size-24">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt=""
            fill
            /* The thumbnail is 80px on a phone and 96px above that. Next
               multiplies for device pixel ratio on its own, so this is the CSS
               size and not the file size. */
            sizes="(max-width: 639px) 80px, 96px"
            className="object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center px-1 text-center text-[10px] leading-tight text-subtle">
            No photo yet
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {/* No row wrapping the heading any more. With the price gone there is
            nothing for the name to share a line with, and a flex row with one
            child in it is a container that only constrains -- the name now
            takes the full width and wraps against the card edge rather than
            against a number that is not there. */}
        <h4 className="flex items-baseline gap-1.5 leading-snug font-semibold">
          <VegMark vegetarian={product.isVegetarian} />
          <span className="min-w-0">{product.name}</span>
        </h4>

        {product.shortDescription ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted">{product.shortDescription}</p>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
          {product.calories !== null ? <span className="tabular">{product.calories} cal</span> : null}
          {product.proteinGrams ? (
            <span className="tabular">{product.proteinGrams}g protein</span>
          ) : null}
          {unavailable ? (
            <span className="font-medium text-danger">
              {product.unavailableReason || 'Off the board today'}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
