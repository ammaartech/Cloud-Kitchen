import type { Metadata } from 'next';
import Image from 'next/image';
import { listMenuByCategory } from '@/lib/data/catalog';
import { Badge } from '@/components/ui/primitives';
import { MenuItem } from './menu-item';
import { HeroReel } from './hero-reel';
import { WHATSAPP_DISPLAY, WhatsAppButton } from './chat';
import './reel.css';

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

/**
 * Where the kitchen delivers, and what it will cook for each area.
 *
 * The two rows are not the same fact stated twice, and getting them the wrong
 * way round is the most expensive mistake this page could make: bulk travels
 * anywhere in the city, single and small orders do not leave North Bangalore.
 * Somebody in South Bangalore reading a bare "we deliver across Bangalore" and
 * messaging about one meal has been told the wrong thing by this page, so
 * "only" is load-bearing and stays in.
 *
 * Stated as two areas rather than one sentence with an exception in it,
 * because a reader looks for their own part of the city and stops reading, and
 * an exception buried in a clause is the part they skip.
 */
const COVERAGE = [
  { label: 'Bulk orders', area: 'All over Bangalore' },
  { label: 'Small orders', area: 'North Bangalore only' },
] as const;

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
  const groups = await listMenuByCategory();

  const dishes = groups.flatMap((group) => group.products);
  const dishCount = dishes.length;
  /* Only mention the grey ones when there are grey ones. Saying "anything
     greyed out is off today" over a menu where nothing is sends the reader
     hunting for something that is not there. */
  const anyUnavailable = dishes.some((dish) => !dish.isAvailable);

  return (
    /* Clears the fixed bar at the foot of small screens, which is outside the
       normal flow and so cannot push anything down itself. `env()` is the rest
       of it: on a phone with a home indicator the last 34px of the viewport
       are not reachable, and without this the footer ends underneath it. */
    <div className="pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-0">
      {/* ------------------------------------------------------------------ */}
      {/* The button at the top                                              */}
      {/* ------------------------------------------------------------------ */}
      {/* Sticky from `sm` up only, and that split is deliberate.

          On a desktop this bar carries the CTA, so it has to follow: on a page
          this long a button at the top is only "at the top" for one screen. On
          a phone it carries no button at all (the fixed bar at the foot has
          that job), so sticking it would spend 57px of a 667px viewport on a
          logo the reader has already seen, on top of the bar at the bottom and
          the category heading below. Letting it scroll away also means the
          menu's category headings can stick to `top-0` instead of to a
          hardcoded offset that has to be kept in step with this element's
          height, where being one pixel out shows as content sliding through
          the seam. */}
      <header className="z-30 border-b border-line bg-surface/85 backdrop-blur-md sm:sticky sm:top-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* `alt=""` because the name is right beside it in text: a logo
                that repeats the word next to it is the same word twice to a
                screen reader. */}
            <Image
              src="/brand/mark-green.png"
              alt=""
              width={933}
              height={416}
              sizes="(max-width: 639px) 54px, 63px"
              priority
              className="h-6 w-auto sm:h-7"
            />
            <div className="min-w-0">
              <p className="truncate font-brand leading-tight font-semibold">
                Infinity Kitchens
              </p>
              <p className="truncate text-xs text-subtle">
                Home-style meals, cooked daily
              </p>
            </div>
          </div>

          {/* Desktop only, and that is the fix rather than an omission. On a
              phone the fixed bar at the foot of the screen is already showing
              this exact button, so a second one up here put two identical
              calls to action on screen at once and squeezed the kitchen's name
              into an ellipsis to do it. Below `sm` the bar has the job; from
              `sm` up there is no bar, so the header takes it back. */}
          <WhatsAppButton size="md" className="hidden shrink-0 sm:inline-flex">
            Order on WhatsApp
          </WhatsAppButton>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-b border-line bg-sunken">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-20">
          {/* Three children, and the order they fall into is the whole reason
              this is a grid rather than two columns of markup.

              On a phone it runs copy, then the photographs, then the coverage
              list, which keeps the button inside the first screen instead of
              pushing it below a hero image. From `md` the reel spans both rows
              of the second column, so the copy and the coverage stack down the
              left of it and nothing had to be written twice or rendered twice
              to get there. */}
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_22rem] md:items-start md:gap-12 lg:gap-16">
            <div className="max-w-2xl">
              <Badge tone="brand">Ordering is on WhatsApp for now</Badge>

              {/* Three steps rather than two. At 36px the headline ran to five
                lines on a 360px handset, which is most of the first screen
                spent on one sentence; 30px holds it to four and leaves the
                button above the fold. */}
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl">
                Home-style meals, cooked fresh every single day.
              </h1>

              <p className="mt-4 text-base text-muted text-pretty sm:mt-5 sm:text-lg">
                One kitchen cooking one honest menu: South Indian tiffin in the
                morning, a banana leaf thali at midday. Our website is still
                being built, so for now everything is ordered over a WhatsApp
                message. Send us one and we will set you up on a meal plan.
              </p>

              {/* Full width on a phone. A centred pill two thirds of the way
                across is a smaller target than the thumb reaching for it, and
                the row it shared with the phone number was wrapping anyway. */}
              <div className="mt-7 flex flex-col items-start gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-4">
                <WhatsAppButton size="lg" className="w-full sm:w-auto">
                  Order on WhatsApp
                </WhatsAppButton>
                <p className="text-sm text-muted">
                  or save{' '}
                  <span className="font-semibold whitespace-nowrap text-ink tabular">
                    {WHATSAPP_DISPLAY}
                  </span>
                </p>
              </div>
            </div>

            {/* `self-center` so the reel sits against the middle of the copy
                beside it rather than hanging from the top of a taller column. */}
            <HeroReel className="md:row-span-2 md:self-center" />

            {/* Coverage sits where the delivery windows used to, and it is the
                better use of the position. Windows are a detail that gets
                settled in the conversation anyway; whether the kitchen comes
                to your part of the city at the size you want to order is the
                question that decides whether there is a conversation at all,
                and it should be answered before anybody taps. */}
            {/* Stacked on a phone rather than two columns. Side by side, "North
                Bangalore only" wraps inside a 150px column and the constraint
                that matters lands on its own orphaned line, which is exactly
                the word a reader must not skip. */}
            <dl className="mt-8 grid gap-4 border-t border-line pt-6 sm:mt-10 sm:flex sm:flex-wrap sm:gap-x-12 sm:gap-y-5">
              {COVERAGE.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs tracking-caps text-subtle uppercase">
                    {row.label}
                  </dt>
                  <dd className="mt-1 font-semibold">{row.area}</dd>
                </div>
              ))}
            </dl>
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
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <ol className="grid gap-6 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3.5 sm:gap-4">
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-white tabular sm:size-8"
                >
                  {index + 1}
                </span>
                <div>
                  <h2 className="font-semibold tracking-tight">{step.title}</h2>
                  <p className="mt-1 text-sm text-muted text-pretty">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* The menu                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <header className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            The menu
          </h2>
          <p className="mt-2 text-muted text-pretty">
            {dishCount === 0
              ? 'Our menu is being published. Message us and we will tell you what is cooking today.'
              : anyUnavailable
                ? `Everything the kitchen cooks, all ${dishCount} of them. Anything greyed out is off the board today.`
                : `Everything the kitchen cooks, all ${dishCount} of them.`}
          </p>
        </header>

        <div className="mt-8 space-y-10 sm:mt-12 sm:space-y-14">
          {groups.map((group) => (
            <div key={group.slug}>
              {/* The name sits on a rule that runs the full width. A menu is
                  read by hunting for the section you want, so section names
                  have to stay findable while scrolling past at speed. It is
                  sticky on a phone: a category can run past a whole screen of
                  thumb-scrolling, and losing track of which one you are in is
                  what makes a long menu feel like one undifferentiated list.

                  `top-0` rather than an offset, because the page header does
                  not stick on a phone. Nothing to sit beneath means nothing to
                  keep in step with. */}
              <div className="sticky top-0 z-20 -mx-4 flex items-baseline gap-3 border-b border-line bg-bg/95 px-4 pt-2.5 pb-2.5 backdrop-blur-sm sm:static sm:mx-0 sm:gap-4 sm:bg-transparent sm:px-0 sm:pt-0 sm:pb-3 sm:backdrop-blur-none">
                <h3 className="text-xl font-semibold tracking-tight whitespace-nowrap sm:text-2xl">
                  {group.name}
                </h3>
                <p className="text-sm text-subtle tabular">
                  {group.products.length} dishes
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {group.products.map((product) => (
                  <MenuItem key={product.id} product={product} />
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
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:py-20">
          {/* The cream cut of the mark, which is the one place on the site the
              logo gets to sit on its own dark ground the way it was drawn. */}
          <Image
            src="/brand/mark-cream.png"
            alt=""
            width={933}
            height={416}
            sizes="(max-width: 639px) 81px, 99px"
            className="mx-auto mb-6 h-9 w-auto sm:h-11"
          />

          <h2 className="text-2xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
            Hungry? Let&rsquo;s talk.
          </h2>

          <p className="mx-auto mt-3 max-w-lg text-brand-soft text-pretty sm:mt-4">
            Send us a message and we will walk you through the plans, the prices
            and the delivery windows. No account, no app, just WhatsApp.
          </p>

          <div className="mt-7 flex justify-center sm:mt-9">
            <WhatsAppButton size="lg" className="w-full sm:w-auto">
              Order on WhatsApp
            </WhatsAppButton>
          </div>

          <p className="mt-5 text-sm text-brand-soft sm:mt-6">
            or save us as{' '}
            <span className="font-semibold whitespace-nowrap text-white tabular">
              {WHATSAPP_DISPLAY}
            </span>
          </p>
        </div>
      </section>

      <footer className="bg-brand px-4 pb-12 text-center sm:pb-14">
        <p className="text-xs text-brand-soft">
          Infinity Kitchens · Prices are per meal and include taxes. Delivery
          areas and timings are set by the kitchen and may change.
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
      {/* The bottom padding is the home indicator. On an iPhone the last ~34px
          of the viewport belong to the system gesture bar, and a button that
          ends flush with `bottom: 0` sits underneath it: half the target is
          unreachable and a tap there swipes the app away instead. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden">
        <WhatsAppButton size="md" className="w-full">
          Order on WhatsApp
        </WhatsAppButton>
      </div>
    </div>
  );
}
