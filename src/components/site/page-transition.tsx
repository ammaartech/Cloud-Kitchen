import { ViewTransition, type ReactNode } from 'react';

/**
 * The storefront's page-to-page motion.
 *
 * One wrapper per storefront page, and it has to be per *page* rather than in
 * `(site)/layout.tsx`: a layout persists across navigation, so a
 * `<ViewTransition>` living in one never mounts or unmounts and its `enter` and
 * `exit` never fire. The shell around it -- header, offer strip, footer -- is
 * exactly what should not move, and it stays put for free by not being in here.
 *
 * ## Why this and not GSAP
 *
 * Every other entrance on this site is GSAP or CSS keyframes, so the exception
 * is worth arguing. A page transition is the one animation that needs the
 * outgoing page and the incoming page on screen at the same moment, and neither
 * library can do that -- by the time GSAP could run on the new route, React has
 * already unmounted the old one. The browser's View Transitions API takes a
 * snapshot of the old page before the swap, which is the whole mechanism, and
 * React's `<ViewTransition>` is what drives it from a route change.
 *
 * It also costs the bundle nothing. The animation is four CSS rules in
 * `globals.css`; this component contributes no runtime beyond the element
 * itself, which is what makes it affordable on a set of routes whose entire
 * argument is that they arrive prerendered and fast.
 *
 * ## The failure mode is the right way round
 *
 * Where the API is missing -- an older engine, a headless renderer, a
 * screenshot service -- the navigation simply happens, instantly, the way it
 * did before. Nothing is hidden waiting for an animation that will never run,
 * which is the rule every reveal on this site is held to. `prefers-reduced-
 * motion` collapses the durations in `globals.css` and lands in the same place.
 *
 * ## `default="none"`
 *
 * Without it every named `<ViewTransition>` on the page animates on every
 * unrelated transition. Naming the two directions explicitly and defaulting the
 * rest to `none` means a browser back button, a `router.refresh()` or a
 * Suspense reveal produces no slide -- only a link that said which way it was
 * going gets one.
 *
 * Which links say it is a judgement made at each call site rather than inferred
 * here, because only the call site knows the direction. A `transitionTypes`
 * prop carrying `nav-forward` goes on links that travel deeper into the site --
 * the home page's three section closers, the footer's columns, the menu and
 * subscriptions pages closing on each other -- and `nav-back` goes on the
 * header's links, every one of which points at a section of the home page and
 * is therefore a return. Everything else is left untyped on purpose and moves
 * without a slide.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'none' }}
      exit={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'none' }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
