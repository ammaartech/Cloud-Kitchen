import { adminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';
import type { AppRole } from './permissions';

/**
 * The seeded accounts, for the sign-in page's development panel.
 *
 * Read from `auth_profiles` rather than written out here, for the same reason
 * everything else in this system is data: a staff account added through
 * /admin/employees shows up automatically, and a list of emails in source
 * cannot drift out of step with the database it claims to describe.
 *
 * The service role is used because an anonymous visitor cannot read
 * auth_profiles -- which is correct, and is exactly why this file is gated
 * before it ever runs.
 */

export interface DemoAccount {
  email: string;
  fullName: string;
  role: AppRole;
  note: string;
}

/** Most privileged first, so the list reads top-down like the org chart. */
const ROLE_ORDER: AppRole[] = [
  'developer_admin',
  'owner',
  'branch_manager',
  'kitchen_staff',
  'customer',
];

export const ROLE_LABELS: Record<AppRole, string> = {
  developer_admin: 'Developer Admin',
  owner: 'Owner',
  branch_manager: 'Branch Manager',
  kitchen_staff: 'Kitchen Staff',
  customer: 'Customer',
};

const ROLE_NOTES: Record<AppRole, string> = {
  developer_admin: 'Everything, plus system config and integrations.',
  owner: 'Admin and analytics. Watches the KOT, cannot touch it.',
  branch_manager: 'Runs the board: accept, reject, ETA, ready, handoff.',
  kitchen_staff: 'Kitchen display only. Starts cooking. No money shown.',
  customer: 'Storefront and account: plan, deliveries, reviews, refunds.',
};

export interface DemoAccountList {
  /** One account per role — what the sign-in table shows by default. */
  onePerRole: DemoAccount[];
  /** Every active account, for the cases where the alternates matter. */
  all: DemoAccount[];
  /** Null when the flag is on but no password has been configured. */
  password: string | null;
}

function demoAccountsEnabled(): boolean {
  return serverEnv().SHOW_DEMO_ACCOUNTS === 'true';
}

/**
 * Says once, in the server log, why the panel is not on the page.
 *
 * Without this the panel's absence is indistinguishable from a broken build,
 * which is a genuinely expensive thing to debug on a deployment: the variables
 * live in `.env.local`, which is gitignored and therefore never travels with a
 * push. Once per process, so it explains itself on a cold start without
 * narrating every request.
 */
let explained = false;

function explainAbsence(reason: string): null {
  if (!explained) {
    explained = true;
    console.info(`[demo-accounts] panel not rendered: ${reason}`);
  }
  return null;
}

export async function listDemoAccounts(): Promise<DemoAccountList | null> {
  if (!demoAccountsEnabled()) {
    return explainAbsence(
      "SHOW_DEMO_ACCOUNTS is not 'true'. Set it in the hosting environment, " +
        'not just .env.local, and redeploy — env vars are bound at build time.',
    );
  }

  const { data, error } = await adminClient()
    .from('auth_profiles')
    .select('email, full_name, role, is_active')
    .eq('is_active', true);

  // A panel that cannot load is simply absent. It is a convenience, and it
  // must never be the reason nobody can reach the sign-in form.
  if (error || !data) {
    return explainAbsence(`could not read auth_profiles — ${error?.message ?? 'no rows returned'}`);
  }

  const all = (data as Array<{ email: string | null; full_name: string; role: string }>)
    .filter((row): row is { email: string; full_name: string; role: string } => Boolean(row.email))
    .map((row) => ({
      email: row.email,
      fullName: row.full_name,
      role: row.role as AppRole,
      note: ROLE_NOTES[row.role as AppRole] ?? '',
    }))
    .sort((a, b) => {
      const byRole = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
      return byRole !== 0 ? byRole : a.email.localeCompare(b.email);
    });

  const seen = new Set<AppRole>();
  const onePerRole = all.filter((account) => {
    if (seen.has(account.role)) return false;
    seen.add(account.role);
    return true;
  });

  return {
    onePerRole,
    all,
    password: serverEnv().DEMO_ACCOUNT_PASSWORD ?? null,
  };
}
