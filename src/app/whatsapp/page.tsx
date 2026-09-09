import type { Metadata } from 'next';
import { listDeliveryWindows, listMenuByCategory } from '@/lib/data/catalog';
import { clockTime } from '@/lib/format';
import { Badge } from '@/components/ui/primitives';
import { ProductTile } from '@/components/product-card';
import { WHATSAPP_DISPLAY, WhatsAppButton } from './chat';

/**
 * The poster page.
 *
 * A printed poster went out before the storefront was finished, so there is a
 * URL in the world that people are typing in off paper. This is what it has to
 * land on: the whole menu, and a way to actually order -- which for now is a
 * WhatsApp message rather than a checkout.
 *
 * There is deliberately no plans section. The plans are not decided yet, and a
 * price on a page someone found on a poster is a price they will hold the
 * kitchen to; the conversation is where that gets settled until the numbers
 * are fixed. When they are, this is where they go -- see the storefront's
 * `/subscriptions` for the card that already renders them.
 *
 * Three things make it different from every other route, and all three are
 * deliberate:
 *
 * It sits outside the `(site)` group, so it does not inherit the storefront
 * shell -- no header, no nav, no footer links. Someone arriving from a poster
 * is one tap from a conversation, and every link out to a half-finished
 * account or checkout page is a way to lose them into a part of the site that
 * is not ready to be seen. There is exactly one action on this page, and it
 * leaves for WhatsApp.
 *
 * It is `noindex`. The poster drives direct traffic; nothing needs to find
 * this in a search. Left indexable, a temporary page carrying the kitchen's
 * whole menu would compete with the real storefront for the brand's own name
 * for as long as Google kept it -- which is longer than this page will exist.
 *
 * Everything it reads is a `use cache` query, so the page prerenders to static
 * HTML and costs the database nothing per visitor. That matters more here than
 * elsewhere: poster traffic arrives in bursts, and the failure mode of a slow
 * first paint is somebody deciding the kitchen is not open.
 */
export const metadata: Metadata = {
  title: 'Order on WhatsApp',
  description:
    'Our full menu and meal plans. Ordering is over WhatsApp while the website is being built.',
  robots: { index: false, follow: false },
};

const STEPS = [
  {
    title: 'Message us',
    body: 'Tap the button. WhatsApp opens with the message already written.',
  },
  {
    title: 'We set up your plan',
    body: 'Tell us your meals, your window and your address. We confirm the price.',
  },
  {
    title: 'We cook and deliver',
    body: 'Cooked fresh the same morning, delivered inside your window.',
  },
] as const;

export default async function OrderPage() {
  const [groups, windows] = await Promise.all([
    listMenuByCategory(),
    listDeliveryWindows(),
  ]);

  const dishCount = groups.reduce((total, group) => total + group.products.length, 0);

  return (
    /* The page has to clear the fixed bar at the foot of small screens, which
       is outside the normal flow and so cannot push anything down itself. */
    <div className="pb-24 sm:pb-0">
      {/* ------------------------------------------------------------------ */}
      {/* The button at the top                                              */}
      {/* ------------------------------------------------------------------ */}
      {/* Sticky rather than merely first: on a page this long, a CTA at the
          top is only "at the top" for one screen unless it follows. */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold tracking-tight">Cloud Kitchen</p>
            <p className="truncate text-xs text-subtle">Home-style meals, cooked daily</p>
          </div>

          {/* One button, two labels. "Order on WhatsApp" is the label that
              says what happens, and it is the one shown wherever it fits; on a
              narrow handset it would push the brand name into an ellipsis, and
              a header that truncates the kitchen's own name to fit a button is
              the wrong trade. The glyph carries the rest. */}
          <WhatsAppButton size="sm" className="sm:hidden">
            Order
          </WhatsAppButton>
          <WhatsAppButton size="md" className="hidden sm:inline-flex">
            Order on WhatsApp
          </WhatsAppButton>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-b border-line bg-sunken">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <div className="max-w-2xl">
            <Badge tone="brand">Ordering is on WhatsApp for now</Badge>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Home-style meals, cooked fresh every single day.
            </h1>

            <p className="mt-5 text-lg text-muted text-pretty">
              One kitchen cooking one honest menu: South Indian tiffin in the morning, a
              banana leaf thali at midday. Our website is still being built, so for now
              everything is ordered over a WhatsApp message. Send us one and we will set you
              up on a meal plan.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-4">
              <WhatsAppButton size="lg">Order on WhatsApp</WhatsAppButton>
              <p className="text-sm text-muted">
                or save{' '}
                <span className="font-semibold whitespace-nowrap text-ink tabular">
                  {WHATSAPP_DISPLAY}
                </span>
              </p>
            </div>

            {windows.length > 0 ? (
              <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-line pt-6">
                {windows.map((window) => (
                  <div key={window.id}>
                    <dt className="text-xs tracking-caps text-subtle uppercase">
                      {window.label}
                    </dt>
                    <dd className="mt-1 font-semibold tabular">
                      {clockTime(window.starts_at)} – {clockTime(window.ends_at)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How it works                                                       */}
      {/* ------------------------------------------------------------------ */}
      {/* Three lines, and they earn their space: ordering dinner by messaging
          a stranger is unfamiliar enough that saying what happens next is the
          difference between a tap and a closed tab. */}
      {/* The rule is full-bleed rather than inside the container, matching the
          hero's. It is doing the job the plans section used to do by being a
          different colour: without something here, three short steps and the
          menu heading sit on one uninterrupted ground and the menu -- the
          thing the page is actually for -- does not read as starting. The
          menu's own category rules are inset to the container, so keeping this
          one edge to edge is also what stops it being mistaken for one. */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <ol className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-white tabular"
                >
                  {index + 1}
                </span>
                <div>
                  <h2 className="font-semibold tracking-tight">{step.title}</h2>
                  <p className="mt-1 text-sm text-muted text-pretty">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* The menu                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <header className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">The menu</h2>
          <p className="mt-2 text-muted text-pretty">
            {dishCount > 0
              ? `Everything the kitchen cooks, all ${dishCount} of them. Anything greyed out is off the board today.`
              : 'Our menu is being published. Message us and we will tell you what is cooking today.'}
          </p>
        </header>

        <div className="mt-12 space-y-16">
          {groups.map((group) => (
            <div key={group.slug}>
              {/* The name sits on a rule that runs the full width. A menu is
                  read by hunting for the section you want, so section names
                  have to stay findable while scrolling past at speed. */}
              <div className="flex items-baseline gap-4 border-b border-line pb-3">
                <h3 className="text-2xl font-semibold tracking-tight whitespace-nowrap">
                  {group.name}
                </h3>
                <p className="text-sm text-subtle tabular">{group.products.length} dishes</p>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {group.products.map((product) => (
                  <ProductTile key={product.id} product={product} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* The button at the bottom                                           */}
      {/* ------------------------------------------------------------------ */}
      {/* Someone who has read the whole menu has already decided. This is the
          same action as the top of the page, put where they finished reading
          so it does not have to be scrolled back to. */}
      <section className="border-t border-line bg-brand">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
            Hungry? Let&rsquo;s talk.
          </h2>

          <p className="mx-auto mt-4 max-w-lg text-brand-soft text-pretty">
            Send us a message and we will walk you through the plans, the prices and the
            delivery windows. No account, no app, just WhatsApp.
          </p>

          <div className="mt-9 flex justify-center">
            <WhatsAppButton size="lg">Order on WhatsApp</WhatsAppButton>
          </div>

          <p className="mt-6 text-sm text-brand-soft">
            or save us as{' '}
            <span className="font-semibold whitespace-nowrap text-white tabular">
              {WHATSAPP_DISPLAY}
            </span>
          </p>
        </div>
      </section>

      <footer className="bg-brand px-4 pb-14 text-center">
        <p className="text-xs text-brand-soft">
          Cloud Kitchen · Prices are per meal and include taxes. Delivery windows are set by
          the kitchen and may change.
        </p>
      </footer>

      {/* ------------------------------------------------------------------ */}
      {/* Always within reach on a phone                                     */}
      {/* ------------------------------------------------------------------ */}
      {/* The menu is long and it is being read on a handset. Between the top
          of the page and the bottom of it there are several screens of dishes
          with no way to act on wanting one, and that gap is where the tap is
          lost. Small screens only -- on a desktop the sticky header never
          leaves, so a second bar would be the same button twice. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 p-3 backdrop-blur-md sm:hidden">
        <WhatsAppButton size="md" className="w-full">
          Order on WhatsApp
        </WhatsAppButton>
      </div>
    </div>
  );
}
