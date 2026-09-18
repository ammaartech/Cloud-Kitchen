import { PageTransition } from '@/components/site/page-transition';

/**
 * The slide between account tabs.
 *
 * `(site)/template.tsx` remounts when the storefront segment changes, and
 * `/account` to `/account/addresses` does not change it -- both are under
 * `account` -- so the storefront's transition never fires between tabs. This
 * is the same wrapper one level down, keyed on the tab instead. The tabs above
 * it live in the account layout and stay put while the page slides beneath.
 *
 * Which way it slides is decided by the tab that was pressed (`AccountNav`
 * sets `nav-forward` or `nav-back`); anything else -- a link in the page, the
 * back button, a form's redirect -- moves without one, as on the storefront.
 */
export default function AccountTemplate({ children }: LayoutProps<'/account'>) {
  return <PageTransition>{children}</PageTransition>;
}
