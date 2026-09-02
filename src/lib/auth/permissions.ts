import type { Route } from 'next';

/**
 * Permission codes, mirroring the rows in `public.permissions`.
 *
 * The database is authoritative -- these constants exist so TypeScript catches
 * a typo in a guard, not so the application can decide anything on its own.
 * Which role holds which permission is data (`role_permissions`) and is never
 * encoded here.
 */
export const PERMISSIONS = {
  auditView: 'audit.view',
  settingsManage: 'settings.manage',
  employeesView: 'employees.view',
  employeesManage: 'employees.manage',
  permissionsManage: 'permissions.manage',
  catalogManage: 'catalog.manage',
  plansManage: 'plans.manage',
  couponsManage: 'coupons.manage',
  customersView: 'customers.view',
  customersManage: 'customers.manage',
  subscriptionsViewAll: 'subscriptions.view_all',
  subscriptionsManage: 'subscriptions.manage',
  ordersView: 'orders.view',
  ordersViewFinancial: 'orders.view_financial',
  ordersViewContact: 'orders.view_contact',
  paymentsView: 'payments.view',
  paymentsManage: 'payments.manage',
  analyticsView: 'analytics.view',
  kotView: 'kot.view',
  kotAccept: 'kot.accept',
  kotReject: 'kot.reject',
  kotStartPrep: 'kot.start_prep',
  kotMarkReady: 'kot.mark_ready',
  kotHandoff: 'kot.handoff',
  kotCancel: 'kot.cancel',
  kotOverrideEta: 'kot.override_eta',
  reviewsModerate: 'reviews.moderate',
  notificationsView: 'notifications.view',
  notificationsManage: 'notifications.manage',
  integrationsView: 'integrations.view',
  integrationsManage: 'integrations.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type AppRole =
  | 'developer_admin'
  | 'owner'
  | 'branch_manager'
  | 'kitchen_staff'
  | 'customer';

/**
 * Where each role lands after signing in.
 *
 * Typed as a Route so a rename of any of these pages is a compile error rather
 * than a staff member landing on a 404.
 */
export function landingPathForRole(role: AppRole): Route {
  switch (role) {
    case 'developer_admin':
    case 'owner':
      return '/admin';
    case 'branch_manager':
      return '/kot/manager';
    case 'kitchen_staff':
      return '/kot/kitchen';
    default:
      return '/account';
  }
}
