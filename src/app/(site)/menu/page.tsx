import '@/components/site/motion-gate.css';
import '@/components/site/menu.css';
import { Suspense } from 'react';
import Link from 'next/link';
import { listMenuByCategory, type ProductCard } from '@/lib/data/catalog';
import { money, pluralise } from '@/lib/format';
import { ButtonLink, EmptyState, Skeleton } from '@/components/ui/primitives';
import { MenuSearch } from '@/components/site/menu-search';
import { DishRow, dishFacts } from '@/components/site/dish-row';
import { MenuBoard, MenuStage, type PassDish } from '@/components/site/menu-motion';

export const metadata = {
  title: 'Menu',
  description: 'Everything the kitchen cooks, and what is available today.',
};

/**
 * Every term has to appear somewhere in the dish, so "ghee dosa" narrows
 * rather than widening the way an OR would. Category and description are part
 * of the haystack: someone searching "tiffin" or "coconut" is describing the
 * dish, not naming it.
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
 * The query and the menu it selects, read once per boundary.
 *
 * Both the board and the list need this, and both sit behind their own
 * `Suspense` so the shell around them stays prerendered. The menu read is
 * cached, so asking twice costs one database read.
 */
async function readMenu(searchParams: PageProps<'/menu'>['searchParams']) {
  const params = await searchParams;
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (raw ?? '').trim().slice(0, 80);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  const all = await listMenuByCategory();
  const groups = terms.length
    ? all
        .map((group) => ({
          ...group,
          products: group.products.filter((product) => matches(product, terms)),
        }))
        .filter((group) => group.products.length > 0)
    : all;

  return { query, all, groups };
}

function toPassDish(product: ProductCard): PassDish {
  return {
    id: product.id,
    name: product.name,
    description: product.shortDescription,
    price: money(product.basePrice),
    facts: dishFacts(product),
    vegetarian: product.isVegetarian,
    available: product.isAvailable,
    reason: product.unavailableReason,
    imageUrl: product.imageUrl,
  };
}

/**
 * The menu page.
 *
 * Two ideas, one for each screen it has to work on.
 *
 * **The board.** The dishes are a Bangalore darshini menu -- khara bath, chow
 * chow bath, puliyogare -- and a darshini's menu is painted on a board on the
 * wall. So the page opens on one: the storefront's green, framed and hung on
 * the brick stock the home page already calls the kitchen wall, with the tally
 * and the search painted onto it. It is an object on the page rather than a
 * band across it, the same way the hero's bowl panel is, which is how the green
 * appears here without competing with the footer's.
 *
 * **The list, and the pass.** Below it the menu is rows, not cards: a menu is
 * scanned, and rows are the shape that scans. On a phone each row carries its
 * photograph on the right and a rail of sections stays under the header. On a
 * desktop the photographs leave the rows for the pass -- a large sticky window
 * beside the list that shows whichever dish is being read -- with the section
 * index down the other side.
 *
 * The shell is still static. `searchParams` is handed down as the promise it is,
 * and only the two boundaries that depend on `q` read it.
 */
export default function MenuPage({ searchParams }: PageProps<'/menu'>) {
  return (
    <div className="menu-page motion-stage">
      <section className="menu-wall texture-brick border-b border-line bg-sunken">
        <div className="landing-container mx-auto max-w-6xl px-4">
          <MenuBoard>
            <svg className="board-hanger" viewBox="0 0 240 64" aria-hidden focusable="false">
              <line x1="120" y1="9" x2="34" y2="64" />
              <line x1="120" y1="9" x2="206" y2="64" />
              <circle cx="120" cy="9" r="5" />
            </svg>

            <div className="menu-board" data-enter>
              <span className="board-paint" aria-hidden>
                <span className="paint-top" />
                <span className="paint-right" />
                <span className="paint-bottom" />
                <span className="paint-left" />
              </span>

              <div className="board-split">
                <div>
                  <p className="board-kicker" data-enter>
                    Cooked this morning
                  </p>
                  <h1 className="board-title" data-enter>
                    Today’s menu
                  </h1>
                  <p className="board-lede" data-enter>
                    A small menu, bought fresh and cooked each day. Meals come on a
                    subscription rather than one at a time, so this is what you would
                    be eating.
                  </p>
                </div>

                <Suspense fallback={<BoardDetailsFallback />}>
                  <BoardDetails searchParams={searchParams} />
                </Suspense>
              </div>
            </div>
          </MenuBoard>
        </div>
      </section>

      <section className="menu-body texture-hatch">
        <div className="landing-container mx-auto max-w-6xl px-4">
          <Suspense fallback={<MenuResultsFallback />}>
            <MenuResults searchParams={searchParams} />
          </Suspense>
        </div>
      </section>

      <section className="border-t border-line bg-sunken">
        <div className="landing-container landing-spacing mx-auto max-w-6xl px-4">
          <div className="menu-closing">
            <h2 className="section-display font-semibold text-balance">eat like this every day</h2>
            <p className="menu-closing-lede text-pretty">
              Meals are ordered through a subscription. Pick a plan, set your window, and
              the kitchen cooks to it.
            </p>
            <ButtonLink
              href="/subscriptions"
              variant="outline"
              size="lg"
              className="btn-plain btn-wide"
            >
              see subscription plans
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}

/** The part of the board that depends on the request: the tally and the search. */
async function BoardDetails({
  searchParams,
}: {
  searchParams: PageProps<'/menu'>['searchParams'];
}) {
  const { query, all, groups } = await readMenu(searchParams);
  const dishes = all.flatMap((group) => group.products);
  const shown = groups.reduce((count, group) => count + group.products.length, 0);
  const vegetarian = dishes.filter((dish) => dish.isVegetarian).length;
  const off = dishes.filter((dish) => !dish.isAvailable).length;

  return (
    <div className="board-details">
      {dishes.length > 0 ? (
        <dl className="board-tally">
          <div>
            <dt>dishes</dt>
            <dd className="tabular">{dishes.length}</dd>
          </div>
          <div>
            <dt>sections</dt>
            <dd className="tabular">{all.length}</dd>
          </div>
          <div>
            <dt>vegetarian</dt>
            <dd className="tabular">{vegetarian === dishes.length ? 'all' : vegetarian}</dd>
          </div>
          {off > 0 ? (
            <div>
              <dt>off today</dt>
              <dd className="tabular">{off}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <MenuSearch defaultValue={query} className="board-search" />

      {query ? (
        <p className="board-status" role="status">
          {shown === 0 ? 'No dishes match' : `${pluralise(shown, 'dish', 'dishes')} matching`}{' '}
          <span className="board-query">“{query}”</span>.{' '}
          <Link href="/menu" className="board-clear">
            Clear search
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function BoardDetailsFallback() {
  return (
    <div className="board-details" aria-hidden>
      <span className="board-skeleton" />
      <span className="board-skeleton" />
      <span className="board-skeleton board-skeleton-field" />
    </div>
  );
}

/** Holds the shape of the index and the first rows while the list streams. */
function MenuResultsFallback() {
  return (
    <div role="status" aria-label="Loading the menu" className="menu-fallback">
      <Skeleton className="h-10 w-full max-w-md" />
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="menu-fallback-row">
          <div className="flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-3 w-full max-w-sm" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
          <Skeleton className="size-24 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** The index, the list and the pass -- everything that depends on `q`. */
async function MenuResults({
  searchParams,
}: {
  searchParams: PageProps<'/menu'>['searchParams'];
}) {
  const { query, groups } = await readMenu(searchParams);

  if (groups.length === 0) {
    return (
      <div className="menu-empty">
        {query ? (
          <EmptyState
            title={`Nothing on the menu matches “${query}”`}
            description="We cook a small menu, so it is a short list. Try a broader word: a section like tiffin, or an ingredient like ghee."
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
    );
  }

  /* Where each section starts in the menu as a whole, so every row knows its
     position across sections -- which is the number the pass is keyed by. */
  const starts = groups.map((_, index) =>
    groups.slice(0, index).reduce((count, group) => count + group.products.length, 0),
  );
  const dishes = groups.flatMap((group) => group.products).map(toPassDish);

  return (
    <MenuStage dishes={dishes}>
      <nav className="menu-index" aria-label="Menu sections">
        <p className="menu-index-label">on the menu</p>
        <ol className="menu-index-list">
          {groups.map((group) => (
            <li key={group.slug}>
              <a href={`#menu-${group.slug}`} className="menu-index-link" data-index-link>
                <span>{group.name}</span>
                <span className="menu-index-count tabular">{group.products.length}</span>
              </a>
            </li>
          ))}
          {/* Inside the list, so it scrolls with the rail on a phone. */}
          <li className="menu-index-marker" aria-hidden />
        </ol>
      </nav>

      <div className="menu-list">
        {groups.map((group, groupIndex) => (
          <section
            key={group.slug}
            id={`menu-${group.slug}`}
            className="menu-section"
            data-section
            aria-labelledby={`menu-${group.slug}-title`}
          >
            <header className="menu-section-head">
              <h2
                id={`menu-${group.slug}-title`}
                className="menu-section-title"
                data-enter
                data-split-heading
              >
                {group.name}
              </h2>
              <p className="menu-section-count">
                {pluralise(group.products.length, 'dish', 'dishes')}
              </p>
            </header>

            <ul className="dish-list" role="list">
              {group.products.map((product, index) => {
                const position = starts[groupIndex] + index;
                return (
                  <DishRow
                    key={product.id}
                    product={product}
                    index={position}
                    eager={position < 4}
                  />
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </MenuStage>
  );
}
