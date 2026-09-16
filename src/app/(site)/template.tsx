import { PageTransition } from '@/components/site/page-transition';

/**
 * The storefront's page-to-page motion, applied once for every route under
 * `(site)`.
 *
 * ## Why a template and not the layout
 *
 * `<ViewTransition>` animates on mount and unmount, and a layout does neither:
 * `(site)/layout.tsx` is instantiated once and persists across every navigation
 * beneath it, so an enter or exit declared there would never fire. A template
 * is the same position in the tree with the opposite lifetime -- Next gives it
 * a key per segment and remounts it whenever that segment changes, which is
 * exactly the signal the transition needs.
 *
 * ## Why not in each page
 *
 * Because the shell must not move. The header, the offer strip and the footer
 * live in the layout *above* this file, so they sit outside the transition and
 * stay put while the content slides underneath them -- which is the whole
 * effect. Putting the wrapper in each `page.tsx` would reach the same place by
 * repeating it eleven times and leaving the twelfth page to be forgotten.
 *
 * ## What it costs
 *
 * Nothing that blocks. This is a server component wrapping a server component;
 * it adds no client bundle, and the animation itself is four rules of CSS in
 * `globals.css`. The routes underneath are still prerendered, and a remount per
 * navigation is what the router is already doing to the page's own subtree.
 *
 * The account pages under `(site)/account` inherit this, and that is the right
 * side of the trade: they are storefront routes reached from storefront links,
 * and a visitor moving between "your account" and "delivery addresses" is doing
 * the same kind of moving as one going from the menu to a plan. The surfaces
 * this deliberately does not reach are the ones with a task on them -- checkout
 * and the plan configurator live outside `(site)`, and `DESIGN.md` is explicit
 * that the buying flow answers rather than performs.
 */
export default function SiteTemplate({ children }: LayoutProps<'/'>) {
  return <PageTransition>{children}</PageTransition>;
}
