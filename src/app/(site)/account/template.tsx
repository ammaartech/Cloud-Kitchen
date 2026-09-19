import { ViewTransition } from 'react';

/**
 * The slide between account tabs.
 *
 * `(site)/template.tsx` remounts when the storefront segment changes, and
 * `/account` to `/account/addresses` does not change it -- both are under
 * `account` -- so the storefront's transition never fires between tabs. This
 * is a wrapper one level down, keyed on the tab instead. The tabs above it
 * live in the account layout and stay put while the page slides beneath.
 *
 * ## Why not the storefront's `PageTransition`
 *
 * That one takes its direction from the `transitionTypes` on the link, and
 * between tabs those did not survive. React keeps a transition's types on the
 * root and hands them to the first transition commit that lands, and an
 * account page is the one navigation on the site that waits on the database
 * before it can commit -- time enough for some other commit to take them. The
 * tab switch then ran untyped, both pages resolved to `none`, and the whole
 * outgoing page crossfaded over the incoming one.
 *
 * So the class here is fixed, and the direction is an attribute `AccountNav`
 * puts on `<html>` when a tab is pressed (`account.css` reads it). It does not
 * depend on which commit the navigation ends up in. Anything that swaps the
 * page without a tab press -- a link in the page, the back button, a form's
 * redirect -- finds no attribute and swaps without moving.
 */
export default function AccountTemplate({ children }: LayoutProps<'/account'>) {
  return (
    <ViewTransition enter="acct-page" exit="acct-page" default="none">
      {children}
    </ViewTransition>
  );
}
