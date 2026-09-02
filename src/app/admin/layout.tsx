import Link from 'next/link';
import { requireAnyPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { AdminNav } from '@/components/admin/admin-nav';
import { SignOutButton } from '@/components/auth/sign-out-button';

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
 * Owner / Developer Admin shell.
 *
 * The nav is filtered by permission, so a role that cannot reach a section is
 * not shown a link into a wall. That is a courtesy, not the security boundary
 * -- each page guards itself, and RLS guards the data underneath.
 */
const SECTIONS = [
  { href: '/admin', label: 'Overview', permission: PERMISSIONS.analyticsView },
  { href: '/admin/catalog', label: 'Catalog', permission: PERMISSIONS.catalogManage },
  { href: '/admin/plans', label: 'Plans', permission: PERMISSIONS.plansManage },
  { href: '/admin/coupons', label: 'Offers', permission: PERMISSIONS.couponsManage },
  { href: '/admin/customers', label: 'Customers', permission: PERMISSIONS.customersView },
  { href: '/admin/reviews', label: 'Reviews', permission: PERMISSIONS.reviewsModerate },
  { href: '/admin/refunds', label: 'Refunds', permission: PERMISSIONS.paymentsView },
  { href: '/admin/employees', label: 'Employees', permission: PERMISSIONS.employeesView },
  { href: '/admin/settings', label: 'Settings', permission: PERMISSIONS.settingsManage },
  { href: '/admin/integrations', label: 'Integrations', permission: PERMISSIONS.integrationsView },
  { href: '/admin/audit', label: 'Audit log', permission: PERMISSIONS.auditView },
] as const;

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const session = await requireAnyPermission([
    PERMISSIONS.analyticsView,
    PERMISSIONS.catalogManage,
    PERMISSIONS.auditView,
  ]);

  const visible = SECTIONS.filter((section) => session.permissions.has(section.permission)).map(
    ({ href, label }) => ({ href, label }),
  );

  const brand = (
    <Link href="/" className="flex items-center gap-2 font-semibold">
      <span
        className="grid h-7 w-7 place-items-center rounded-ck bg-brand text-xs font-bold text-white"
        aria-hidden
      >
        CK
      </span>
      Admin
    </Link>
  );

  return (
    <div className="flex min-h-dvh bg-bg">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="border-b border-line px-4 py-3">{brand}</div>
        <div className="flex-1 overflow-y-auto p-3">
          <AdminNav sections={visible} />
        </div>
        <div className="border-t border-line p-3">
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-line bg-surface">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-6">
            <div className="md:hidden">{brand}</div>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <Link href="/kot/manager" className="text-muted hover:text-ink">
                KOT board
              </Link>
              <span className="text-subtle">
                {session.fullName} · {session.role.replace('_', ' ')}
              </span>
              <span className="md:hidden">
                <SignOutButton />
              </span>
            </div>
          </div>
          <div className="border-t border-line px-4 py-2 md:hidden">
            <AdminNav sections={visible} orientation="horizontal" />
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
