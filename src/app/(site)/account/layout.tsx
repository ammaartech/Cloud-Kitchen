import { requireSession } from '@/lib/auth/session';
import { AccountNav } from '@/components/account/account-nav';

/**
 * These screens are per-user by definition -- a session decides not just what
 * they show but whether you may see them at all -- so there is no static shell
 * to prerender and no point pretending otherwise. `instant = false` says that
 * plainly: this segment is allowed to block.
 *
 * It is a statement about *this* route, not a global escape hatch. The public
 * storefront next door is held to the opposite standard.
 */
export const instant = false;

/**
 * Customer account shell.
 *
 * Guarding here means every account page is behind a session without each one
 * repeating the check. The pages still resolve their own customer record --
 * a signed-in staff member has a session but no customer row, and the pages
 * say so rather than rendering an empty dashboard.
 */
export default async function AccountLayout({ children }: LayoutProps<'/account'>) {
  await requireSession();

  // The nav sits in its own container so each page keeps control of its own
  // width and padding.
  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <AccountNav />
      </div>
      {children}
    </>
  );
}
