import Link from 'next/link';
import { requireAnyPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { AdminNav } from '@/components/admin/admin-nav';
import { SignOutButton } from '@/components/auth/sign-out-button';

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

  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span
              className="grid h-7 w-7 place-items-center rounded-ck bg-brand text-xs font-bold text-white"
              aria-hidden
            >
              CK
            </span>
            Admin
          </Link>

          <AdminNav sections={visible} />

          <div className="flex items-center gap-3 text-sm">
            <Link href="/kot/manager" className="text-muted hover:text-ink">
              KOT board
            </Link>
            <span className="text-subtle">
              {session.fullName} · {session.role.replace('_', ' ')}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
